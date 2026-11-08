'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Empty, Message, Radio, Skeleton, Table, Tooltip } from '@arco-design/web-react';
import { IconDown } from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import SearchForm from '@/components/SearchForm';
import DataState from '@/components/DataState';
import { employeeApi, TimelineRecord, TimelineRecordType, TimelineSummary } from '@/services/employee';
import { useCachedData } from '@/hooks/use-cached-data';
import { useDepartments } from '@/hooks/use-departments';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';
import { fetchAllPages } from '@/lib/fetch-all';
import { formatDate, todayStr } from '@/lib/format';
import { buildTimelineSearchFields, TYPE_META, TYPE_ORDER } from '../lib/timeline-fields';

type ViewMode = 'timeline' | 'employee' | 'list';

const VIEWS: { value: ViewMode; label: string; hint: string }[] = [
  { value: 'timeline', label: '时间轴', hint: '按月份倒序铺开，看「最近发生了什么」' },
  { value: 'employee', label: '按员工', hint: '一人一行，展开看这个人的完整履历' },
  { value: 'list', label: '明细', hint: '表格明细，便于核对与导出' },
];

interface TimelineFiltersState {
  keyword?: string;
  departmentId?: number;
  dateFrom?: string;
  dateTo?: string;
  type?: TimelineRecordType;
}

// 事件类型属于状态语义，统一走公共 StatusTag；cyan 不在公共色规约内，归入 info
const TYPE_STATUS_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  Object.entries(TYPE_META).map(([key, meta]) => [
    key,
    { label: meta.label, color: meta.color === 'cyan' ? 'info' : meta.color },
  ]),
);

const columns = [
  { title: '变动日期', dataIndex: 'occurredAt', width: 120 },
  {
    title: '员工',
    dataIndex: 'employeeName',
    width: 170,
    render: (_: unknown, r: TimelineRecord) => (
      <div>
        <div style={{ fontWeight: 500, color: 'var(--lx-text-1)' }}>{r.employeeName}</div>
        <div style={{ fontSize: 12, color: 'var(--lx-text-3)' }}>{r.employeeNo}</div>
      </div>
    ),
  },
  {
    title: '类型',
    dataIndex: 'type',
    width: 100,
    render: (_: unknown, r: TimelineRecord) => <StatusTag status={r.type} statusMap={TYPE_STATUS_MAP} />,
  },
  {
    title: '详情',
    dataIndex: 'detailText',
    ellipsis: true,
    render: (_: unknown, r: TimelineRecord) => (
      <Tooltip content={r.detailText}>
        <span>{r.detailText}</span>
      </Tooltip>
    ),
  },
  {
    title: '备注',
    dataIndex: 'reason',
    ellipsis: true,
    render: (_: unknown, r: TimelineRecord) =>
      r.reason
        ? <span style={{ color: 'var(--lx-text-2)' }}>{r.reason}</span>
        : <span style={{ color: 'var(--lx-text-4)' }}>—</span>,
  },
];

/** 时间轴竖列：时间轴视图（按月分组）与按员工视图（单人）共用同一套节点 */
function TimelineTrack({
  items,
  canViewEmployee,
}: {
  items: TimelineRecord[];
  canViewEmployee: boolean;
}) {
  return (
    <ol className="tl-track">
      {items.map((r) => (
        <li key={r.id} className="tl-node">
          <span
            className="tl-node-dot"
            style={{ background: TYPE_META[r.type].tone }}
            aria-hidden="true"
          />
          <div className="tl-node-body">
            <div className="tl-node-head">
              <span className="tl-node-date">{r.occurredAt.slice(5)}</span>
              <span className="tl-node-type" style={{ color: TYPE_META[r.type].text }}>
                {TYPE_META[r.type].label}
              </span>
              {canViewEmployee ? (
                <Link className="tl-node-who" href={`/employees/${r.employeeId}`}>
                  {r.employeeName}
                  <em>{r.employeeNo}</em>
                </Link>
              ) : (
                <span className="tl-node-who is-plain">
                  {r.employeeName}
                  <em>{r.employeeNo}</em>
                </span>
              )}
            </div>
            <div className="tl-node-detail">{r.detailText}</div>
            {r.reason && <div className="tl-node-reason">备注：{r.reason}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

const EMPTY_RECORDS: TimelineRecord[] = [];
const BAR_MAX_H = 54;

export default function TimelinePage() {
  const { can } = usePermission();
  const canViewEmployee = can('employee:view');
  const { departments } = useDepartments();
  const searchFields = useMemo(() => buildTimelineSearchFields(departments), [departments]);
  const deptName = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);

  const [view, setView] = useState<ViewMode>('timeline');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState<TimelineFiltersState>({});
  // null = 还没手动展开过：默认展开最近有变动的那位，进来就能看见时间轴长什么样
  const [openSet, setOpenSet] = useState<Set<number> | null>(null);

  // 履历列表 + 概览统计：同一接口返回，切换视图不重复请求
  const cacheKey = `employee:timeline:${pagination.current}:${pagination.pageSize}:${JSON.stringify(filters)}`;
  const { data: resData, loading, error, revalidate } = useCachedData<{
    code: number;
    data?: {
      list: TimelineRecord[];
      page: number;
      pageSize: number;
      total: number;
      summary: TimelineSummary;
    };
  }>(
    cacheKey,
    async () => {
      const result = await employeeApi.getTimeline({
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword: filters.keyword,
        type: filters.type,
        departmentId: filters.departmentId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
      return { code: result.code, data: result.data };
    },
    { staleTime: 30_000 },
  );

  const data = resData?.code === 0 && resData.data ? resData.data.list : EMPTY_RECORDS;
  const summary = resData?.code === 0 ? resData.data?.summary : undefined;
  const pageResult = resData?.code === 0 && resData.data
    ? { current: resData.data.page, pageSize: resData.data.pageSize, total: resData.data.total }
    : pagination;

  // 时间轴/按员工视图用 summary.records（当前筛选的全量），不受分页影响
  const records = summary?.records ?? EMPTY_RECORDS;

  const monthGroups = useMemo(() => {
    const map = new Map<string, TimelineRecord[]>();
    for (const r of records) {
      const key = r.occurredAt.slice(0, 7);
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }
    return Array.from(map.entries());
  }, [records]);

  const recordsByEmployee = useMemo(() => {
    const map = new Map<number, TimelineRecord[]>();
    for (const r of records) {
      const arr = map.get(r.employeeId);
      if (arr) arr.push(r);
      else map.set(r.employeeId, [r]);
    }
    return map;
  }, [records]);

  const months = summary?.months ?? [];
  const counts = summary?.counts;
  const maxMonthTotal = Math.max(1, ...months.map((m) => m.total));
  const monthTotal = months.reduce((sum, m) => sum + m.total, 0);

  const resolveFilters = (values: Record<string, any>): TimelineFiltersState => {
    const { keyword, range, departmentId } = values;
    return {
      keyword: keyword || undefined,
      departmentId: departmentId || undefined,
      dateFrom: Array.isArray(range) && range[0] ? formatDate(range[0]) : undefined,
      dateTo: Array.isArray(range) && range[1] ? formatDate(range[1]) : undefined,
    };
  };

  // 类型筛选由上方计数条控制，提交搜索时必须保留，否则点查询就被悄悄清掉
  const handleSearch = (values: Record<string, any>) => {
    const next = resolveFilters(values);
    setFilters((prev) => ({ ...next, type: prev.type }));
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleReset = () => {
    setFilters({});
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const toggleType = (type?: TimelineRecordType) => {
    setFilters((prev) => ({ ...prev, type: prev.type === type ? undefined : type }));
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination({ current: page, pageSize, total: pageResult.total });
  };

  const defaultOpenId = summary?.employees[0]?.employeeId;

  const isEmployeeOpen = (id: number) => (openSet ? openSet.has(id) : id === defaultOpenId);

  const toggleEmployee = (id: number) => {
    setOpenSet((prev) => {
      // 首次展开/收起时，先把「默认展开的那一位」结算进集合，否则默认项会在首次点击后突然收起
      const next = new Set(prev ?? (defaultOpenId != null ? [defaultOpenId] : []));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    try {
      // 后端 pageSize 上限 100，写 10000 会被静默截断成第一页：必须翻页取全量
      const list = await fetchAllPages<TimelineRecord>(async (page, pageSize) => {
        const res = await employeeApi.getTimeline({ page, pageSize, ...filters });
        return { list: (res.data?.list ?? []) as TimelineRecord[], total: res.data?.total ?? 0 };
      });
      if (!exportToExcel(
        `人员履历_${todayStr()}.xlsx`,
        '人员履历',
        [
          { title: '变动日期', dataIndex: 'occurredAt' },
          { title: '工号', dataIndex: 'employeeNo' },
          { title: '姓名', dataIndex: 'employeeName' },
          { title: '类型', value: (r: TimelineRecord) => (TYPE_META[r.type]?.label ?? r.type) },
          { title: '详情', dataIndex: 'detailText' },
          { title: '备注', dataIndex: 'reason' },
        ],
        list,
      )) {
        Message.info('当前没有可导出的履历数据');
      }
    } catch {
      Message.error('导出失败');
    }
  };

  const renderEmpty = (text: string) => (
    <div className="tl-empty">
      <Empty description={text} />
    </div>
  );

  const renderTimeline = () => {
    if (records.length === 0) return renderEmpty('当前条件下没有变动记录');
    return (
      <div className="tl-feed">
        {monthGroups.map(([month, items]) => (
          <section key={month} className="tl-group">
            <div className="tl-group-head">
              <span className="tl-group-month">
                {month.slice(0, 4)} 年 {Number(month.slice(5))} 月
              </span>
              <span className="tl-group-count">{items.length} 次</span>
            </div>
            <TimelineTrack items={items} canViewEmployee={canViewEmployee} />
          </section>
        ))}
      </div>
    );
  };

  const renderByEmployee = () => {
    const groups = summary?.employees ?? [];
    if (groups.length === 0) return renderEmpty('当前条件下没有变动记录');
    return (
      <ol className="tl-people">
        {groups.map((g) => {
          const open = isEmployeeOpen(g.employeeId);
          const items = recordsByEmployee.get(g.employeeId) ?? [];
          return (
            <li key={g.employeeId} className={`tl-person ${open ? 'is-open' : ''}`}>
              <button
                type="button"
                className="tl-person-head"
                aria-expanded={open}
                onClick={() => toggleEmployee(g.employeeId)}
              >
                <span className={`tl-person-caret ${open ? 'is-open' : ''}`} aria-hidden="true">
                  <IconDown />
                </span>
                <span className="tl-person-name">{g.employeeName}</span>
                <span className="tl-person-no">{g.employeeNo}</span>
                {g.departmentId && deptName.get(g.departmentId) ? (
                  <span className="tl-person-dept">{deptName.get(g.departmentId)}</span>
                ) : null}
                <span className="tl-person-fill" />
                <span className="tl-person-count">{g.total} 次变动</span>
                <span className="tl-person-last">最近 {g.lastAt}</span>
              </button>
              {open && items.length > 0 && (
                <div className="tl-person-body">
                  <TimelineTrack items={items} canViewEmployee={canViewEmployee} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    );
  };

  const renderList = () => (
    <Table
      className="tl-table"
      columns={columns}
      data={data}
      rowKey="id"
      loading={loading}
      border
      pagination={{
        current: pageResult.current,
        pageSize: pageResult.pageSize,
        total: pageResult.total,
        showTotal: true,
        sizeCanChange: true,
        sizeOptions: [10, 20, 50, 100],
        onChange: handlePageChange,
      }}
      scroll={{ x: true }}
      noDataElement={<Empty description="当前条件下没有变动记录" />}
    />
  );

  const firstLoading = loading && !summary;

  return (
    <PageContainer>
      <SearchForm
        fields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        column={3}
        expandable={false}
        inlineActions
      />

      <div className="tl-overview">
        <div className="tl-counts" role="group" aria-label="按变动类型筛选">
          <button
            type="button"
            className={`tl-count ${!filters.type ? 'is-active' : ''}`}
            aria-pressed={!filters.type}
            onClick={() => toggleType(undefined)}
          >
            <span className="tl-count-label">全部</span>
            <span className="tl-count-num">{summary?.scopeTotal ?? 0}</span>
          </button>
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              className={`tl-count ${filters.type === t ? 'is-active' : ''}`}
              aria-pressed={filters.type === t}
              onClick={() => toggleType(t)}
            >
              <i className="tl-count-dot" style={{ background: TYPE_META[t].tone }} aria-hidden="true" />
              <span className="tl-count-label">{TYPE_META[t].label}</span>
              <span className="tl-count-num">{counts?.[t] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="tl-months">
          <div className="tl-months-head">
            <span className="tl-months-title">近 12 个月变动</span>
            <span className="tl-months-note">
              {months.length > 0
                ? `${months[0].month.slice(2)} – ${months[months.length - 1].month.slice(2)} · 共 ${monthTotal} 次`
                : '—'}
            </span>
          </div>
          <div
            className="tl-bars"
            role="img"
            aria-label={`近 12 个月人员变动分布，共 ${monthTotal} 次`}
          >
            {months.map((m) => {
              const h = m.total === 0 ? 2 : Math.max(4, Math.round((m.total / maxMonthTotal) * BAR_MAX_H));
              const detail = TYPE_ORDER.filter((t) => m.counts[t] > 0)
                .map((t) => `${TYPE_META[t].label} ${m.counts[t]}`)
                .join('，');
              return (
                <div
                  key={m.month}
                  className="tl-bar-col"
                  data-zero={m.total === 0 ? '1' : undefined}
                  title={`${m.month}：${m.total === 0 ? '无变动' : `${m.total} 次（${detail}）`}`}
                >
                  <div className="tl-bar-stack" style={{ height: h }}>
                    {m.total > 0
                      ? TYPE_ORDER.filter((t) => m.counts[t] > 0).map((t) => (
                          <i
                            key={t}
                            style={{
                              height: `${(m.counts[t] / m.total) * 100}%`,
                              background: TYPE_META[t].tone,
                            }}
                          />
                        ))
                      : null}
                  </div>
                  <span className="tl-bar-label">{m.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="tl-panel">
        <div className="tl-panel-head">
          <Radio.Group
            type="button"
            size="small"
            value={view}
            onChange={(v) => setView(v as ViewMode)}
          >
            {VIEWS.map((v) => (
              <Radio key={v.value} value={v.value}>
                {v.label}
              </Radio>
            ))}
          </Radio.Group>
          <div className="tl-panel-meta">
            <span className="tl-panel-scope">
              {summary
                ? `${summary.total} 条记录 · ${summary.employees.length} 人`
                : '—'}
            </span>
            <Button size="small" type="outline" onClick={handleExport}>
              导出报表
            </Button>
          </div>
        </div>

        <div className="tl-panel-body">
          {firstLoading ? (
            <div className="tl-loading" role="status" aria-live="polite">
              <span className="sr-only">正在加载履历数据</span>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} text={{ rows: 1, width: i % 2 === 0 ? '60%' : '40%' }} animation />
              ))}
            </div>
          ) : (
            <DataState error={error} onRetry={revalidate}>
              {view === 'timeline' ? renderTimeline() : view === 'employee' ? renderByEmployee() : renderList()}
            </DataState>
          )}
        </div>

        {summary?.truncated && view !== 'list' ? (
          <div className="tl-truncated">
            记录较多，当前视图仅展示最近 {records.length.toLocaleString('zh-CN')} 条；完整数据请切到「明细」或导出报表。
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}
