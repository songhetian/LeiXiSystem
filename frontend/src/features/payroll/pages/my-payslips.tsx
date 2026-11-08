'use client';

import { useEffect, useState } from 'react';
import { Modal, Table, Descriptions, Divider, Empty, Input, Button, Skeleton, Message } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import MoneyText from '@/components/MoneyText';
import { payslipApi, Payslip, PayslipDetail, PayslipItem, MyYearSummary } from '@/services/payslip';
import { authApi } from '@/services/auth';
import { useCachedData } from '@/hooks/use-cached-data';
import { useSystemInfo } from '@/hooks/use-system-info';
import { formatDateTime, formatMoney } from '@/lib/format';
import { shiftMonth, thisMonth } from '@/lib/month';
import { buildPayslipPrintHtml, openPayslipPrintWindow, downloadPayslipHtml } from '@/lib/payslip-print';
import { SearchFieldConfig } from '@/components/SearchForm';

/**
 * 金额字符串 → 整数分。
 *
 * 后端金额是 decimal 的 `toFixed(2)` 字符串，`Number(x) * 100` 会先转成 IEEE754
 * 再乘一百，属于「先浮点后定点」；这里按字符串拆整数/小数位拼整数，全程不碰浮点，
 * 顺带兼容千分位与非法值（非法值按 0 处理，不产生 NaN 传播到整列差额）。
 */
function toCents(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const raw = String(value).trim().replace(/,/g, '');
  const matched = /^(-?)(\d*)(?:\.(\d*))?$/.exec(raw);
  // 整数位允许为空（'.5' 这类输入），但整体必须像数字
  if (!matched || (!matched[2] && !matched[3])) return 0;
  const integer = matched[2] || '0';
  const fraction = matched[3] ?? '';
  // 小数位按四舍五入到分：截断会让 12.999 少 1 分，差额方向甚至可能被吞成「持平」
  const cents = Number(integer) * 100 + Math.round(Number(`0.${fraction || '0'}`) * 100);
  // -0 会落进 is-flat 且不带负号，统一归一成 0
  return matched[1] === '-' && cents !== 0 ? -cents : cents;
}

/** 按分求差，避免浮点误差；正数=本月比上月多，负数=少 */
function diffCents(current: unknown, previous: unknown): number {
  return toCents(current) - toCents(previous);
}

/** 差额文本：带 +/− 号与涨跌色（涨绿跌红，持平中性） */
function DeltaText({ cents }: { cents: number }) {
  const tone = cents > 0 ? 'is-up' : cents < 0 ? 'is-down' : 'is-flat';
  const sign = cents > 0 ? '+' : cents < 0 ? '-' : '';
  // 统一走 formatMoney：钱只在一个地方格式化，避免 toLocaleString 的 ICU 差异
  return <span className={`lx-payslip-delta ${tone}`}>{sign + formatMoney(Math.abs(cents) / 100)}</span>;
}

type ItemDiffKind = 'added' | 'removed' | 'changed';

interface ItemDiff {
  code: string;
  name: string;
  kind: ItemDiffKind;
  /** 差额（分）：正=本月多，负=本月少 */
  delta: number;
}

const itemDiffLabels: Record<ItemDiffKind, string> = {
  added: '新增',
  removed: '取消',
  changed: '变动',
};

/**
 * 逐项对比两个月工资条：新增项、取消项、金额变动项。
 * 员工问「这个月为什么不一样」时，光看合计差额看不出是哪一项变了，
 * 必须落到具体工资项（如社保基数调整、少一次加班费）。
 */
function diffPayslipItems(current: PayslipItem[], previous: PayslipItem[]): ItemDiff[] {
  const currentMap = new Map(current.map((i) => [i.code, i]));
  const previousMap = new Map(previous.map((i) => [i.code, i]));
  const rows: ItemDiff[] = [];

  for (const item of current) {
    const prev = previousMap.get(item.code);
    if (!prev) {
      rows.push({
        code: item.code,
        name: item.name,
        kind: 'added',
        delta: toCents(item.amount),
      });
      continue;
    }
    const delta = diffCents(item.amount, prev.amount);
    if (delta !== 0) rows.push({ code: item.code, name: item.name, kind: 'changed', delta });
  }
  for (const item of previous) {
    if (!currentMap.has(item.code)) {
      rows.push({
        code: item.code,
        name: item.name,
        kind: 'removed',
        delta: -toCents(item.amount),
      });
    }
  }
  return rows;
}

/**
 * 搜索字段工厂函数。
 *
 * 不能写成模块级常量：`本月/上月` 的预设值会在 bundle 加载那一刻被算死，
 * 页面长时间挂着或跨月后从别处切回时，「本月」仍指向上个月。
 */
export function buildSearchFields(): SearchFieldConfig[] {
  const current = thisMonth();
  return [
    {
      key: 'month',
      label: '月份',
      type: 'month',
      placeholder: '选择月份',
      // 工资条通常按月翻，快捷预设省去每月重复点日历；值口径与 prisma payslip.month(Char 7) 一致
      presets: [
        { label: '本月', value: current },
        { label: '上月', value: shiftMonth(current, -1) },
      ],
    },
  ];
}

const statusMap: Record<string, { label: string; color: string }> = {
  unviewed: { label: '未查看', color: 'arcoblue' },
  viewed: { label: '已查看', color: 'gray' },
};

interface PayslipListEnvelope {
  code: number;
  message?: string;
  data?: { list: Payslip[]; page: number; pageSize: number; total: number };
}

export default function MyPayslipsPage() {
  const { info: systemInfo } = useSystemInfo();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});
  // 每次渲染重算「本月/上月」预设：模块级常量（或 useMemo 空依赖）会把月份算死在
  // 首次加载那一刻，页面跨月仍挂着时「本月」会指向上个月。
  const searchFieldList = buildSearchFields();

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  // 同一 id 重新验证后必须重拉：SWR 缓存按 key 命中，key 不变就不会重跑 fetcher，
  // 用户会卡在「重新验证成功但弹窗还是旧的报错」。每次验证通过 +1 强制换 key。
  const [detailNonce, setDetailNonce] = useState(0);

  // 二级密码门禁：点击行先验证二级密码（未设置时回退登录密码），通过后才拉取明细
  const [pwdVisible, setPwdVisible] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<Payslip | null>(null);
  const [password, setPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [verifying, setVerifying] = useState(false);
  // 服务端验证标记的本地镜像（毫秒时间戳）：后端 Redis 给了 300s 免验窗口，
  // 前端不记就会「连续点两条都要重新输密码」，与弹窗里「5 分钟内可连续查看」自相矛盾。
  // 只作体验优化，真实门禁仍由后端 403 兜底。
  const [verifiedUntil, setVerifiedUntil] = useState(0);
  // null = 未知（加载中/查询失败），此时按通用文案降级，不阻断验证
  const [privacyEnabled, setPrivacyEnabled] = useState<boolean | null>(null);

  // 弹窗打开时查询二级密码设置状态，用于切换提示文案与 placeholder
  useEffect(() => {
    if (!pwdVisible) return;
    let cancelled = false;
    authApi
      .getPrivacyPasswordStatus()
      .then((res) => {
        if (!cancelled && res.code === 0 && res.data) {
          setPrivacyEnabled(!!res.data.enabled);
        }
      })
      .catch(() => {
        // 查询失败保持 null，通用文案降级
      });
    return () => {
      cancelled = true;
    };
  }, [pwdVisible]);

  // SWR 缓存：参数编入 cacheKey，搜索/翻页即重新订阅；同参数复用缓存
  const cacheKey = `payroll:my-payslips:${pagination.current}:${pagination.pageSize}:${JSON.stringify(searchParams)}`;
  const { data: res, loading, error, revalidate } = useCachedData<PayslipListEnvelope>(
    cacheKey,
    () => payslipApi.getMyPayslips({ page: pagination.current, pageSize: pagination.pageSize, ...searchParams }),
    { staleTime: 30_000 },
  );
  const data = res?.code === 0 && res.data ? res.data.list : [];
  const pageResult = res?.code === 0 && res.data
    ? { current: res.data.page, pageSize: res.data.pageSize, total: res.data.total }
    : pagination;

  // SWR 缓存：明细按工资条 id 共享缓存，detailId 变化自动重拉；未打开时不发请求。
  // 二级密码门禁：openDetail 仅在验证通过后调用，因此拉取时机仍是「验证通过后」。
  // key 必须与管理端工资条页（payslips.tsx 的 payroll:payslip-detail:*）区分开：
  // 两页同 key 但缓存形状不同（这里存 PayslipDetail，管理端存 {code,data} 信封），
  // 同一人（HR 兼员工）先开管理端再进本页时，会拿到信封当明细用 → 字段全 undefined。
  const { data: currentPayslip, loading: detailLoading, error: detailError } =
    useCachedData<PayslipDetail>(
      `payroll:my-payslip-detail:${detailId ?? 'none'}:${detailNonce}`,
      async () => {
        if (!detailId) return null as unknown as PayslipDetail;
        const result = await payslipApi.getMyPayslipDetail(detailId);
        if (result.code === 0 && result.data) {
          if (result.data.status === 'unviewed') {
            await payslipApi.markAsViewed(result.data.id);
            // 未读→已读会变更列表状态，强制刷新列表缓存
            revalidate();
          }
          return result.data;
        }
        throw new Error(result.message || '获取明细失败');
      },
    );

  // 年度累计条：年份取当前筛选月份所属年份（未筛选取今年）。
  // 与列表共用 SWR 缓存，翻页/切月只重拉这一年，不额外打接口。
  const summaryYear = String(searchParams.month || thisMonth()).slice(0, 4);
  const { data: yearRes, loading: yearLoading, error: yearError } = useCachedData<{ code: number; data?: MyYearSummary }>(
    `payroll:my-summary:${summaryYear}`,
    () => payslipApi.getMyYearSummary(summaryYear),
    { staleTime: 60_000 },
  );
  const yearSummary = yearRes?.code === 0 ? yearRes.data : undefined;
  // 全年都没有奖惩/补发补扣时不显示这一项，避免多一个恒为 0 的格子
  const hasAdjustment = toCents(yearSummary?.adjustmentTotal) !== 0;
  // 失败时不能一直停在「统计中…」，否则用户以为还在算
  const yearMeta = yearLoading
    ? '统计中…'
    : yearError
      ? '统计失败，可刷新重试'
      : yearSummary
        ? `已发放 ${yearSummary.months} 个月`
        : '暂无数据';

  // 与上月对比：明细弹窗打开后，按当前工资条月份回溯一个月取上月工资条。
  // 上月没有工资条时 prevMonth 请求返回空列表，页面降级为「无可对比数据」。
  const prevMonth = currentPayslip ? shiftMonth(currentPayslip.month, -1) : '';
  const { data: prevRes } = useCachedData<PayslipListEnvelope>(
    `payroll:my-payslips:prev:${prevMonth || 'none'}`,
    async () => {
      if (!prevMonth) return null as unknown as PayslipListEnvelope;
      return payslipApi.getMyPayslips({ month: prevMonth, page: 1, pageSize: 1 });
    },
    { staleTime: 30_000 },
  );
  const prevPayslip = prevRes?.code === 0 && prevRes.data ? prevRes.data.list[0] : undefined;
  // 上月明细必须走**受二级密码门禁**的详情接口：列表接口已不下发明细（高敏数据不能
  // 靠前端弹窗当门禁）。免验窗口已过期时这里拿 3013，items 为空 → 对比区降级为无数据。
  const { data: prevDetail } = useCachedData<PayslipDetail>(
    `payroll:my-payslip-detail:${prevPayslip?.id ?? 'none'}`,
    async () => {
      if (!prevPayslip) return null as unknown as PayslipDetail;
      const result = await payslipApi.getMyPayslipDetail(prevPayslip.id);
      if (result.code === 0 && result.data) return result.data;
      throw new Error(result.message || '获取上月工资条失败');
    },
    { staleTime: 30_000 },
  );
  const prevItems = prevDetail?.items ?? [];
  const itemDiffs = currentPayslip ? diffPayslipItems(currentPayslip.items ?? [], prevItems) : [];

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleReset = () => {
    setSearchParams({});
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination((p) => ({ ...p, current: page, pageSize }));
  };

  /** 打开明细弹窗并拉取详情（仅在二级密码验证通过后调用） */
  const openDetail = (record: Payslip) => {
    setPendingRecord(record);
    setDetailId(record.id);
    setDetailVisible(true);
  };

  // 免验窗口失效（后端 300s 标记过期 / Redis 被清 / 另一设备登出）时详情会返回 3013。
  // 不复位本地镜像的话，之后每次点「查看」都还走免验分支，用户永远打不开这条工资条。
  useEffect(() => {
    if (detailError) setVerifiedUntil(0);
  }, [detailError]);

  const handleViewDetail = (record: Payslip) => {
    // 免验窗口内直接打开，避免每点一条都输一次密码（与后端 TTL 一致）
    if (Date.now() < verifiedUntil) {
      openDetail(record);
      return;
    }
    setPendingRecord(record);
    setPassword('');
    setPwdError('');
    setPwdVisible(true);
  };

  const handleVerify = async () => {
    const pwd = password.trim();
    if (!pwd) {
      setPwdError('请输入二级密码');
      return;
    }
    setVerifying(true);
    setPwdError('');
    try {
      const result = await payslipApi.verifyPassword(pwd);
      if (result.code !== 0) {
        setPwdError(result.message || '二级密码错误');
        return;
      }
      setPwdVisible(false);
      // 后端口径为准：返回多少秒就记多少秒，前端不自己拍 TTL
      const ttlSeconds = result.data?.expiresInSeconds ?? 300;
      setVerifiedUntil(Date.now() + ttlSeconds * 1000);
      // 重新验证后强制重拉明细（同一 id 的旧缓存可能是失败态）
      setDetailNonce((n) => n + 1);
      if (pendingRecord) openDetail(pendingRecord);
    } catch (err) {
      // HTTP 401 会被拦截器转成 reject（不跳登录，见 lib/request 特判），透出后端 message
      setPwdError((err as Error)?.message || '验证失败，请重试');
    } finally {
      setVerifying(false);
    }
  };

  const handleDetailCancel = () => {
    setDetailVisible(false);
    // 置空后同一张工资条再点开才会重新发请求（key 变化），否则命中失败态缓存
    setDetailId(null);
  };

  /** 明细被门禁拒绝（3013）后的恢复入口：关弹窗重新走密码验证 */
  const handleReVerify = () => {
    setDetailVisible(false);
    setPassword('');
    setPwdError('');
    setPwdVisible(true);
  };

  /** 打印 / 另存 PDF：把当前明细渲染到独立窗口，不进页面菜单与列表 */
  const handlePrintDetail = () => {
    if (!currentPayslip) return;
    const html = buildPayslipPrintHtml(currentPayslip, {
      companyName: systemInfo.name,
      logoUrl: systemInfo.logoUrl || undefined,
    });
    if (!openPayslipPrintWindow(html)) {
      Message.warning('浏览器拦截了打印窗口，请允许本站弹出窗口后重试');
    }
  };

  /** 下载工资条（打印稿 HTML）：浏览器打印对话框另存 PDF 之外，给一份可归档的文件 */
  const handleDownloadDetail = () => {
    if (!currentPayslip) return;
    const html = buildPayslipPrintHtml(currentPayslip, {
      companyName: systemInfo.name,
      logoUrl: systemInfo.logoUrl || undefined,
    });
    downloadPayslipHtml(html, `工资条-${currentPayslip.month}-${currentPayslip.employeeName || '本人'}.html`);
  };

  const columns: ProTableColumn[] = [
    { title: '月份', dataIndex: 'month', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
    // 金额统一走 MoneyText：千分位 + 两位小数，负数（扣款）自动标红
    {
      title: '基本工资',
      dataIndex: 'baseSalary',
      width: 120,
      render: (value: unknown) => <MoneyText value={value} />,
    },
    {
      title: '应发合计',
      dataIndex: 'totalIncome',
      width: 120,
      render: (value: unknown) => <MoneyText value={value} />,
    },
    {
      title: '扣款合计',
      dataIndex: 'totalDeduction',
      width: 120,
      render: (value: unknown) => <MoneyText value={value} />,
    },
    {
      title: '实发工资',
      dataIndex: 'netSalary',
      width: 120,
      render: (value: unknown) => (
        <span className="lx-payslip-net">
          <MoneyText value={value} />
        </span>
      ),
    },
    { title: '发放时间', dataIndex: 'createdAt', width: 200, render: (v: unknown) => formatDateTime(v) },
    {
      // 行可点这件事在视觉上没有任何提示，显式给一个「查看」入口
      title: '操作',
      dataIndex: 'actions',
      width: 90,
      // 列宽合计 990px，窄屏（1366@125% 内容区约 797px）必然横向滚动，
      // 操作列固定在右侧，否则「查看」按钮默认落在可视区外。
      fixed: 'right',
      render: (_: unknown, record: Payslip) => (
        <Button
          type="text"
          size="small"
          onClick={(e) => {
            // 行本身也绑了点击，不阻断会连开两次门禁弹窗
            e.stopPropagation();
            handleViewDetail(record);
          }}
        >
          查看
        </Button>
      ),
    },
  ];

  const renderDetailContent = () => {
    if (detailError) {
      return (
        <div style={{ padding: '8px 0 16px', textAlign: 'center' }}>
          <Empty description={detailError} />
          <Button type="primary" style={{ marginTop: 12 }} onClick={handleReVerify}>
            重新验证
          </Button>
        </div>
      );
    }
    if (!currentPayslip) return null;

    const incomeItems = currentPayslip.items.filter((item: PayslipItem) => item.type === 'income');
    const deductionItems = currentPayslip.items.filter((item: PayslipItem) => item.type === 'deduction');
    const adjustmentItems = currentPayslip.adjustments || [];

    /** 明细小表：结构与列宽三块一致，避免同一个月三张表宽窄不一 */
    const renderItemsTable = (items: PayslipItem[]) => (
      <Table
        data={items}
        rowKey="code"
        columns={[
          { title: '项目', dataIndex: 'name', width: 240 },
          {
            title: '金额',
            dataIndex: 'amount',
            width: 140,
            align: 'center',
            render: (value: unknown) => <MoneyText value={value} />,
          },
        ]}
        pagination={false}
        size="small"
        border={false}
      />
    );

    return (
      <div>
        <Descriptions
          title="基本信息"
          column={2}
          data={[
            { label: '工号', value: currentPayslip.employeeNo || '--' },
            { label: '姓名', value: currentPayslip.employeeName || '--' },
            { label: '部门', value: currentPayslip.departmentName || '--' },
            { label: '月份', value: currentPayslip.month },
          ]}
        />
        <Divider />
        {/* 汇总区：应发 − 扣款 = 实发，三个数字并排，用户不必自己心算勾稽关系 */}
        <div className="lx-payslip-summary">
          <div className="lx-payslip-summary-item">
            <span className="lx-payslip-summary-label">应发合计</span>
            <span className="lx-payslip-summary-value">
              <MoneyText value={currentPayslip.totalIncome} />
            </span>
          </div>
          <div className="lx-payslip-summary-item">
            <span className="lx-payslip-summary-label">扣款合计</span>
            <span className="lx-payslip-summary-value">
              <MoneyText value={currentPayslip.totalDeduction} />
            </span>
          </div>
          <div className="lx-payslip-summary-item is-net">
            <span className="lx-payslip-summary-label">实发工资</span>
            <span className="lx-payslip-summary-value">
              <MoneyText value={currentPayslip.netSalary} />
            </span>
          </div>
        </div>
        {/* 与上月对比：员工最先关心的就是「这个月为什么和上个月不一样」 */}
        <div
          className={`lx-payslip-diff${prevPayslip ? '' : ' is-empty'}`}
          data-testid="payslip-diff"
        >
          <span className="lx-payslip-diff-title">与上月（{prevMonth}）对比</span>
          {prevPayslip ? (
            <div className="lx-payslip-diff-items">
              <span className="lx-payslip-diff-item">
                应发 <DeltaText cents={diffCents(currentPayslip.totalIncome, prevPayslip.totalIncome)} />
              </span>
              <span className="lx-payslip-diff-item">
                扣款 <DeltaText cents={diffCents(currentPayslip.totalDeduction, prevPayslip.totalDeduction)} />
              </span>
              <span className="lx-payslip-diff-item">
                实发 <DeltaText cents={diffCents(currentPayslip.netSalary, prevPayslip.netSalary)} />
              </span>
            </div>
          ) : (
            <span className="lx-payslip-diff-empty">上月无工资条，暂无可对比数据</span>
          )}
          {prevPayslip && (
            // 合计差额只说明「变了多少」，这里落到具体工资项「变在哪」
            <div className="lx-payslip-diff-detail" data-testid="payslip-item-diff">
              {itemDiffs.length === 0 ? (
                <span className="lx-payslip-diff-empty">各工资项与上月一致</span>
              ) : (
                itemDiffs.map((diff) => (
                  <span className="lx-payslip-diff-item" key={`${diff.kind}-${diff.code}`}>
                    {diff.name}
                    <i className="lx-payslip-diff-badge">{itemDiffLabels[diff.kind]}</i>
                    <DeltaText cents={diff.delta} />
                  </span>
                ))
              )}
            </div>
          )}
        </div>
        <Divider />
        <h4 className="lx-payslip-section-title">收入明细</h4>
        {renderItemsTable(incomeItems)}
        {deductionItems.length > 0 && (
          <>
            <Divider />
            <h4 className="lx-payslip-section-title">扣款明细</h4>
            {renderItemsTable(deductionItems)}
          </>
        )}
        {adjustmentItems.length > 0 && (
          <>
            <Divider />
            <h4 className="lx-payslip-section-title">调整项</h4>
            {renderItemsTable(adjustmentItems)}
          </>
        )}
      </div>
    );
  };

  return (
    <PageContainer >
      {/* 年度累计条：员工对账（贷款/个税汇算）最常问的「今年一共发了多少」一屏可见 */}
      <div className="lx-payslip-year" data-testid="payslip-year">
        <div className="lx-payslip-year-head">
          <span className="lx-payslip-year-title">{summaryYear} 年度累计</span>
          <span className="lx-payslip-year-meta">{yearMeta}</span>
        </div>
        <div className="lx-payslip-year-items">
          <div className="lx-payslip-year-item">
            <span className="lx-payslip-year-label">应发合计</span>
            <span className="lx-payslip-year-value">
              <MoneyText value={yearSummary?.totalIncome} />
            </span>
          </div>
          <div className="lx-payslip-year-item">
            <span className="lx-payslip-year-label">扣款合计</span>
            <span className="lx-payslip-year-value">
              <MoneyText value={yearSummary?.totalDeduction} />
            </span>
          </div>
          {/* 有奖惩/补发补扣时才出现：实发含调整项，缺这一项「应发+扣款」对不上实发 */}
          {hasAdjustment && (
            <div className="lx-payslip-year-item" data-testid="payslip-year-adjustment">
              <span className="lx-payslip-year-label">调整合计</span>
              <span className="lx-payslip-year-value">
                <MoneyText value={yearSummary?.adjustmentTotal} />
              </span>
            </div>
          )}
          <div className="lx-payslip-year-item is-net">
            <span className="lx-payslip-year-label">实发合计</span>
            <span className="lx-payslip-year-value is-net">
              <MoneyText value={yearSummary?.netSalary} />
            </span>
          </div>
        </div>
      </div>
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        searchFields={searchFieldList}
        onSearch={handleSearch}
        onReset={handleReset}
        pagination={pageResult}
        onPageChange={handlePageChange}
        onRowClick={handleViewDetail}
        // 员工可把当前筛选结果导出为台账，离职/贷款/个税汇算时能直接用
        showExport
        exportFilename={`我的工资条${searchParams.month ? `-${searchParams.month}` : ''}.csv`}
      />
      <Modal
        title="二级密码验证"
        visible={pwdVisible}
        confirmLoading={verifying}
        onOk={handleVerify}
        onCancel={() => setPwdVisible(false)}
        okText="确认查看"
        cancelText="取消"
        style={{ width: 400 }}
        maskClosable={false}
      >
        {privacyEnabled === false ? (
          <p style={{ margin: '0 0 12px', color: 'var(--lx-text-2)', fontSize: 13 }}>
            尚未设置二级密码，当前使用登录密码验证。建议前往「个人中心 → 二级密码」设置独立密码，避免泄露登录密码。
          </p>
        ) : (
          <p style={{ margin: '0 0 12px', color: 'var(--lx-text-2)', fontSize: 13 }}>
            为保护薪资隐私，查看工资条明细需先完成二次验证；验证通过后 5 分钟内可连续查看。
          </p>
        )}
        <Input.Password
          placeholder={
            privacyEnabled === false ? '请输入登录密码' : privacyEnabled ? '请输入二级密码' : '请输入密码'
          }
          value={password}
          onChange={setPassword}
          onPressEnter={handleVerify}
          autoFocus
        />
        {pwdError && (
          <p style={{ margin: '8px 0 0', color: 'var(--lx-danger-text)', fontSize: 12 }}>{pwdError}</p>
        )}
      </Modal>
      <Modal
        title="工资条明细"
        visible={detailVisible}
        onCancel={handleDetailCancel}
        // 「关闭」是即时动作，不该跟着明细请求转圈；加载态由按钮禁用 + 正文骨架体现
        footer={
          <div className="lx-payslip-modal-footer">
            <Button onClick={handleDetailCancel}>关闭</Button>
            <Button disabled={detailLoading || !currentPayslip} onClick={handleDownloadDetail}>
              下载工资条
            </Button>
            <Button type="primary" disabled={detailLoading || !currentPayslip} onClick={handlePrintDetail}>
              打印 / 另存 PDF
            </Button>
          </div>
        }
        style={{ width: 720, maxWidth: '92vw' }}
      >
        {detailLoading ? <Skeleton animation text={{ rows: 6 }} /> : renderDetailContent()}
      </Modal>
    </PageContainer>
  );
}
