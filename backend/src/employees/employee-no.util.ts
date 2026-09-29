/**
 * 员工工号分配（序列驱动 + 占用检测）
 *
 * 背景：工号此前存在两个生成器（入职审批走 sequences 自增、员工新增走全表 max+1），
 * 且序列初始化取的是「最后一条员工记录」的工号而非最大值，导致两条号段区间重叠、
 * 可能产出相同工号，触发 employeeNo 唯一约束（P2002）使入职审批事务整体回滚。
 *
 * 本工具统一由一个入口分配工号，并对分配结果做占用检测，确保永不撞号。
 */

/** 分配时可跳过的最多号数（防止异常数据导致死循环） */
const MAX_SKIP = 1000;

/** 需要的最小 db 能力（PrismaClient 与事务 tx 均满足） */
export interface EmployeeNoDb {
  sequence: {
    findUnique(args: any): Promise<any>;
    create(args: any): Promise<any>;
  };
  employee: {
    findMany(args: any): Promise<any[]>;
    findUnique(args: any): Promise<any>;
  };
  $executeRaw(...args: any[]): Promise<any>;
  $queryRaw(...args: any[]): Promise<any>;
}

/** 序号 → 工号（EMP + 4 位补零） */
export function formatEmployeeNo(value: number): string {
  return `EMP${String(value).padStart(4, '0')}`;
}

/** 从现有工号集合中取 EMP 号段的最大序号 */
function maxExistingEmployeeNo(rows: { employeeNo: string }[]): number {
  let max = 0;
  for (const row of rows) {
    const matched = /^EMP(\d+)$/.exec(row.employeeNo ?? '');
    if (!matched) continue;
    const value = parseInt(matched[1], 10);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max;
}

/**
 * 分配一个未被占用的员工工号。
 *
 * 序列不存在时以现有 EMP 工号的**最大值**初始化；随后逐号分配并检测占用，
 * 若已被占用则继续向后取号，保证返回的工号一定空闲。
 */
export async function allocateEmployeeNo(db: EmployeeNoDb): Promise<string> {
  const seqName = 'employee_no';

  let seq = await db.sequence.findUnique({ where: { name: seqName } });

  if (!seq) {
    const existing = await db.employee.findMany({
      where: { employeeNo: { startsWith: 'EMP' } },
      select: { employeeNo: true },
    });
    const currentMax = maxExistingEmployeeNo(existing ?? []);

    seq = await db.sequence.create({
      data: {
        name: seqName,
        currentValue: currentMax,
        step: 1,
        description: '员工编号序列',
      },
    });
  }

  for (let attempt = 0; attempt < MAX_SKIP; attempt++) {
    await db.$executeRaw`
      UPDATE sequences
      SET current_value = LAST_INSERT_ID(current_value + step)
      WHERE name = ${seqName}
    `;

    const result: any = await db.$queryRaw`SELECT LAST_INSERT_ID() as next_val`;
    const nextVal: number = result?.[0]?.next_val ?? (seq?.currentValue ?? 0) + (seq?.step ?? 1);
    const candidate = formatEmployeeNo(nextVal);

    const occupied = await db.employee.findUnique({
      where: { employeeNo: candidate },
      select: { id: true },
    });
    if (!occupied) return candidate;
  }

  throw new Error(`员工工号分配失败：连续 ${MAX_SKIP} 个号段均已被占用`);
}