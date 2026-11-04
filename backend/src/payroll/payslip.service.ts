import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException, Optional } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { DataScopeService, scopeIsEmpty } from '../common/data-scope.service';
import { RedisService } from '../common/redis/redis.service';
import { LocalFallbackStore } from '../common/local-fallback-store';
import { fromCents, sumCents } from '../common/money.util';
import { ERROR_CODES } from '../common/error-codes';
import { payslipPrivacyKey } from '../common/privacy-key';

type TxClient = Prisma.TransactionClient | PrismaService;

/** 二级密码验证标记有效期（秒）：验证通过后 5 分钟内可连续查看，无需重复输入 */
const PRIVACY_TTL_SECONDS = 300;

@Injectable()
export class PayslipService {
  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    private redis: RedisService,
    // 进程内兜底通行证（S23 / D3）：Redis 已配置但不可达时 RedisService.set 静默失败，
    // 只靠 Redis 会让「密码验证通过 → 详情仍 403」死循环，所以本地始终同步写一份。
    @Optional() private readonly local?: LocalFallbackStore,
  ) {}

  async generateFromRun(runId: number, tx?: TxClient) {
    const db = tx || this.prisma;
    const run = await db.payrollRun.findUnique({
      where: { id: runId },
      include: { details: true, adjustments: true },
    });
    if (!run) {
      throw new NotFoundException({ code: ERROR_CODES.PAYROLL_RUN_NOT_FOUND, message: '算薪批次不存在' });
    }

    // 工资条 = 计算值 + 调整值（CONTEXT.md 业务规则）。
    // 调整项必须与明细一并汇总，只取 details 会漏掉调整金额，导致工资条总额与批次明细对不上。
    const detailMap = new Map<number, any[]>();
    for (const d of run.details) {
      if (!detailMap.has(d.employeeId)) {
        detailMap.set(d.employeeId, []);
      }
      detailMap.get(d.employeeId)!.push({
        code: d.itemCode,
        name: d.itemName,
        amount: Number(d.amount),
        // 供工资条前端按收入/扣款分组展示
        type: Number(d.amount) < 0 ? 'deduction' : 'income',
      });
    }
    for (const a of run.adjustments ?? []) {
      if (!detailMap.has(a.employeeId)) {
        detailMap.set(a.employeeId, []);
      }
      detailMap.get(a.employeeId)!.push({
        code: a.itemCode,
        name: a.reason || a.itemCode,
        amount: Number(a.amount),
        type: 'adjustment',
      });
    }

    const existingPayslips = await db.payslip.findMany({
      where: { runId },
      select: { employeeId: true },
    });
    const existingIds = new Set(existingPayslips.map((p) => p.employeeId));

    const payslipData: Array<{
      runId: number;
      employeeId: number;
      month: string;
      totalAmount: Prisma.Decimal;
      itemsJson: string;
    }> = [];
    for (const [employeeId, items] of detailMap) {
      if (existingIds.has(employeeId)) continue;
      // 定点累加：先转整数分再相加，写库边界统一转 Prisma.Decimal
      const totalCents = sumCents(items.map((i) => i.amount));
      payslipData.push({
        runId,
        employeeId,
        month: run.month,
        totalAmount: new Prisma.Decimal(fromCents(totalCents).toFixed(2)),
        itemsJson: JSON.stringify(items),
      });
    }
    if (payslipData.length > 0) {
      await db.payslip.createMany({ data: payslipData });
    }
  }

  /**
   * 由 items_json 汇总工资条页面需要的派生金额。
   *
   * Payslip 实体只落 total_amount 与 items_json，「基本工资 / 应发合计 / 扣款合计」
   * 都需要从明细还原；累加走 Decimal 定点口径（与生成链路一致），避免浮点漂移。
   * - totalIncome 只统计 type=income：调整项不参与应发基数，否则加项会被重复计入；
   * - totalDeduction 为负数（与明细记账习惯一致，前端据此标红）；
   * - netSalary 直接取批次落库的 total_amount（已含调整项），不重复计算；
   * - baseSalary 找不到 base 项时为 null，让前端展示占位而不是伪造的 0。
   */
  private summarizeItems(payslip: { totalAmount: Prisma.Decimal; itemsJson: string }) {
    let items: Array<{ code?: string; amount?: unknown; type?: string }> = [];
    try {
      const parsed = JSON.parse(payslip.itemsJson);
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      // items_json 损坏时降级为空明细，不阻断列表返回
      items = [];
    }

    let income = new Prisma.Decimal(0);
    let deduction = new Prisma.Decimal(0);
    let adjustment = new Prisma.Decimal(0);
    let base: Prisma.Decimal | null = null;

    for (const item of items) {
      const amount = new Prisma.Decimal(String(item?.amount ?? 0));
      if (item?.code === 'base') base = amount;
      if (item?.type === 'income') income = income.plus(amount);
      else if (item?.type === 'deduction') deduction = deduction.plus(amount);
      // 调整项（奖惩/补发补扣）单列一桶：实发取批次落库的 totalAmount（含调整项），
      // 若不单独给出，页面「应发 / 扣款 / 实发」三项就加不起来，年度对账不可用。
      // 但不能并进应发：详情页把调整项作为独立区块展示，并进应发会重复计算。
      else if (item?.type === 'adjustment') adjustment = adjustment.plus(amount);
    }

    return {
      baseSalary: base ? base.toFixed(2) : null,
      totalIncome: income.toFixed(2),
      totalDeduction: deduction.toFixed(2),
      adjustmentTotal: adjustment.toFixed(2),
      netSalary: payslip.totalAmount.toFixed(2),
    };
  }

  /**
   * 我的工资条列表。
   * month 为可选筛选（'YYYY-MM'）；传空串视同不筛选，避免前端清空月份后查无数据。
   */
  async getMyPayslips(userId: number, page: number, pageSize: number, month?: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      return { list: [], total: 0, page, pageSize };
    }

    const where = month ? { employeeId: employee.id, month } : { employeeId: employee.id };

    const [list, total] = await Promise.all([
      this.prisma.payslip.findMany({
        where,
        // 同月可能有补发/追加批次（唯一键 runId+employeeId），二级排序固定取最新一张，
        // 否则「与上月对比」拿到哪一批是不确定的。
        orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      // count 与 findMany 共用同一 where，否则会出现「列表 0 条但总数 12」的错位分页
      this.prisma.payslip.count({ where }),
    ]);

    return {
      // itemsJson 必须剥掉：明细是二级密码门禁保护的高敏数据，列表接口不下发原始明细，
      // 否则「点开才要密码」只是前端仪式 —— 直接 GET /payslips/me 就能拿到全部工资项。
      // 需要明细的调用方（详情、上月对比）走 getMyPayslipDetail，那里统一过门禁。
      list: list.map(({ itemsJson, ...p }) => ({
        ...p,
        ...this.summarizeItems({ totalAmount: p.totalAmount, itemsJson }),
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 我的年度累计（员工对账用）。
   *
   * 口径与列表/详情保持一致：应发只算 income 项、扣款为负数、实发取批次落库的
   * total_amount（已含调整项）。累加走 Decimal 定点，避免浮点漂移；按
   * `month startsWith 'YYYY-'` 过滤，跨年数据不会串进来。
   * 员工档案缺失时返回全 0 而非抛错——与 getMyPayslips 的空列表降级一致。
   */
  async getMyYearSummary(userId: number, year: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      return {
        year,
        months: 0,
        totalIncome: '0.00',
        totalDeduction: '0.00',
        adjustmentTotal: '0.00',
        netSalary: '0.00',
      };
    }

    const rows = await this.prisma.payslip.findMany({
      where: { employeeId: employee.id, month: { startsWith: `${year}-` } },
      select: { month: true, totalAmount: true, itemsJson: true },
      orderBy: { month: 'asc' },
    });

    let income = new Prisma.Decimal(0);
    let deduction = new Prisma.Decimal(0);
    let adjustment = new Prisma.Decimal(0);
    let net = new Prisma.Decimal(0);
    for (const row of rows) {
      const summary = this.summarizeItems(row);
      income = income.plus(summary.totalIncome);
      deduction = deduction.plus(summary.totalDeduction);
      adjustment = adjustment.plus(summary.adjustmentTotal);
      net = net.plus(summary.netSalary);
    }

    return {
      year,
      // 口径是「月份数」而不是「工资条张数」：同月补发/追加批次会有第二张工资条
      // （唯一键是 runId+employeeId），按张数算会把 1 个月显示成「已发放 2 个月」。
      months: new Set(rows.map((r) => r.month)).size,
      totalIncome: income.toFixed(2),
      totalDeduction: deduction.toFixed(2),
      // 三项之外的第四项：不给出它，「应发 + 扣款 = 实发」在有奖惩调整的月份不成立，
      // 而这张卡的全部意义就是员工自己能把账对上。
      adjustmentTotal: adjustment.toFixed(2),
      netSalary: net.toFixed(2),
    };
  }

  /** 二级密码验证标记的 Redis key */
  private privacyKey(userId: number): string {
    return payslipPrivacyKey(userId);
  }

  /**
   * 工资条二级密码验证：优先校验独立隐私密码（users.privacyPasswordHash），
   * 未设置时回退登录密码（存量用户兼容）。通过后写入短时效通行证
   * （PRIVACY_TTL_SECONDS 内免重复验证）：进程内始终写一份，Redis 启用时同步写，
   * 这样 Redis 断连也不会出现「验证通过却打不开详情」。账号停用/软删除一律拒绝，
   * 与登录规则一致。
   */
  async verifyPassword(userId: number, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        privacyPasswordHash: true,
        status: true,
        deletedAt: true,
      },
    });
    // 用户不存在/密码错误/账号停用统一同一错误，避免探测账号是否存在
    const expectedHash = user?.privacyPasswordHash ?? user?.passwordHash;
    if (
      !user ||
      user.deletedAt ||
      user.status !== 'active' ||
      !expectedHash ||
      !(await bcrypt.compare(password, expectedHash))
    ) {
      throw new UnauthorizedException({
        code: ERROR_CODES.PAYSLIP_PASSWORD_INVALID,
        message: '二级密码错误',
      });
    }
    const key = this.privacyKey(userId);
    // 本地通行证始终写：Redis 已配置但不可达时 RedisService.set 不抛错也不生效，
    // 只写 Redis 会让用户校验通过后仍被判「未验证」。
    this.local?.set(key, '1', PRIVACY_TTL_SECONDS);
    if (this.redis.isEnabled) {
      await this.redis.set(key, '1', PRIVACY_TTL_SECONDS);
    }
    return { verified: true, expiresInSeconds: PRIVACY_TTL_SECONDS };
  }

  async getMyPayslipDetail(userId: number, payslipId: number) {
    // 二级密码门禁：薪资明细属高敏数据，未验证一律拒绝。
    // Redis 故障时用进程内通行证，Redis 未配置同样要求二次验证（不再直通降级）。
    // 读取顺序：Redis 可用则先读 Redis，未命中（含断连时返回 null）再回落本地。
    const key = this.privacyKey(userId);
    const redisOn = this.redis.isEnabled;
    const pass = (redisOn ? await this.redis.get(key) : null) ?? this.local?.get(key) ?? null;
    if (!pass) {
      throw new ForbiddenException({
        code: ERROR_CODES.PAYSLIP_PASSWORD_REQUIRED,
        message: '查看工资条需先完成二级密码验证',
      });
    }

    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { department: { select: { id: true, name: true } } },
    });
    if (!employee) {
      throw new NotFoundException({ code: ERROR_CODES.PAYSLIP_NOT_FOUND, message: '工资条不存在' });
    }

    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
    });
    if (!payslip || payslip.employeeId !== employee.id) {
      throw new NotFoundException({ code: ERROR_CODES.PAYSLIP_NOT_FOUND, message: '工资条不存在' });
    }

    const items = JSON.parse(payslip.itemsJson);
    return {
      ...payslip,
      // 派生金额与列表同一口径，避免详情与列表对不上
      ...this.summarizeItems(payslip),
      // 归属信息供弹窗「基本信息」区展示（此前未返回，页面上工号/姓名/部门全空）
      employeeNo: employee.employeeNo,
      employeeName: employee.name,
      departmentName: employee.department?.name ?? null,
      items,
      // 调整项单独返回，供工资条页面独立区块展示（items 中仍保留，type=adjustment）
      adjustments: items.filter((i: any) => i?.type === 'adjustment'),
    };
  }

  async markAsViewed(userId: number, payslipId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException({ code: ERROR_CODES.PAYSLIP_NOT_FOUND, message: '工资条不存在' });
    }

    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
    });
    if (!payslip || payslip.employeeId !== employee.id) {
      throw new NotFoundException({ code: ERROR_CODES.PAYSLIP_NOT_FOUND, message: '工资条不存在' });
    }

    if (payslip.status === 'viewed') {
      return payslip;
    }

    return this.prisma.payslip.update({
      where: { id: payslipId },
      data: { status: 'viewed', viewedAt: new Date() },
    });
  }

  /**
   * 管理端工资条详情（HR 核对用）。
   *
   * 与员工端详情返回同一套派生金额与归属信息，但授权口径不同：
   * - 员工端靠「工资条必须属于本人」；
   * - 管理端靠数据权限（全量 / 部门范围 / 仅本人）。
   * 越权与不存在统一按 3011 处理，避免通过错误码探测他人工资条是否存在。
   */
  async getPayslipDetail(userId: number, payslipId: number) {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        employee: {
          select: {
            id: true,
            employeeNo: true,
            name: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!payslip) {
      throw new NotFoundException({ code: ERROR_CODES.PAYSLIP_NOT_FOUND, message: '工资条不存在' });
    }

    const scope = await this.dataScope.visibleScope(userId);
    const departmentId = payslip.employee?.department?.id ?? null;
    const allowed = scopeIsEmpty(scope)
      ? false
      : scope.all ||
        (scope.selfEmployeeId ? payslip.employeeId === scope.selfEmployeeId : false) ||
        (departmentId !== null && scope.ids.includes(departmentId));

    if (!allowed) {
      throw new NotFoundException({ code: ERROR_CODES.PAYSLIP_NOT_FOUND, message: '工资条不存在' });
    }

    const items = JSON.parse(payslip.itemsJson);
    const { employee, ...rest } = payslip;
    return {
      ...rest,
      ...this.summarizeItems(payslip),
      employeeNo: employee?.employeeNo ?? null,
      employeeName: employee?.name ?? null,
      departmentName: employee?.department?.name ?? null,
      items,
      adjustments: items.filter((i: any) => i?.type === 'adjustment'),
    };
  }

  async listPayslips(params: {
    userId: number;
    runId?: number;
    month?: string;
    status?: string;
    departmentId?: number;
    page: number;
    pageSize: number;
  }) {
    const { userId, runId, month, status, departmentId, page, pageSize } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: any = {};
    if (runId) where.runId = runId;
    if (month) where.month = month;
    // 只接受枚举内的值：前端传入脏值时不下发条件，避免「筛了却查不出数据」的困惑
    if (status === 'viewed' || status === 'unviewed') where.status = status;

    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (departmentId) {
      // 部门筛选与数据权限的可见部门取交集：HR 只在授权部门范围内筛人，不能借筛选越权
      where.employee = scope.all
        ? { departmentId }
        : { departmentId: { in: scope.ids.filter((id) => id === departmentId) } };
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }

    const [list, total] = await Promise.all([
      this.prisma.payslip.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              name: true,
              // 催办需要按员工发通知，因此带上 userId
              userId: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ month: 'desc' }, { employeeId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payslip.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }
}
