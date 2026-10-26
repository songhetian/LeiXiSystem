'use client';

import { useEffect, type ReactNode } from 'react';
import { Drawer, Spin, Empty } from '@arco-design/web-react';
import StatusTag from '@/components/StatusTag';
import { employeeApi, Employee, EmployeeChangeLog } from '@/services/employee';
import { formatDate, formatDateTime as formatDateTimeTz, formatMoney } from '@/lib/format';
import useFetchState from '@/hooks/use-fetch-state';

interface TimelineItem {
  key: string;
  date: string;
  type: 'hire' | 'restore' | 'resign';
  title: string;
  detail?: string;
}

const TYPE_META: Record<TimelineItem['type'], { dot: string; label: string }> = {
  hire: { dot: 'hire', label: '首次入职' },
  restore: { dot: 'restore', label: '再次入职' },
  resign: { dot: 'resign', label: '离职' },
};

function formatDateTime(v?: string | null): string {
  // 直接复用 lib/format 中的 formatDateTime，恒以北京时间渲染，
  // 避免 slice(0,16) 截断 ISO 串导致 UTC 时间被误显示（差 8 小时）。
  return formatDateTimeTz(v);
}

function formatSalary(v?: string | number): string {
  const n = Number(v ?? 0);
  if (!n || n <= 0) return '-';
  return `¥ ${formatMoney(n, '0.00')}`;
}

/** 在职时长：按 年/月 描述 */
function tenureText(hire?: string, resign?: string | null): string {
  if (!hire) return '-';
  const s = new Date(hire);
  const e = resign ? new Date(resign) : new Date();
  if (Number.isNaN(s.getTime())) return '-';
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} 年`);
  if (rest > 0) parts.push(`${rest} 个月`);
  if (parts.length === 0) parts.push('1 个月以内');
  return parts.join(' ');
}

interface GridItem {
  key: string;
  label: string;
  value: ReactNode;
  wide?: boolean;
}

function InfoSection({ title, items }: { title: string; items: GridItem[] }) {
  return (
    <section className="ed-group">
      <h3 className="ed-group-title">{title}</h3>
      <div className="ed-grid">
        {items.map((it) => (
          <div key={it.key} className={`ed-item${it.wide ? ' ed-wide' : ''}`}>
            <div className="ed-k">{it.label}</div>
            <div className="ed-v">{it.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildTimeline(emp: Employee | null, logs: EmployeeChangeLog[]): TimelineItem[] {
  if (!emp) return [];
  const items: TimelineItem[] = [
    {
      key: 'hire-initial',
      date: formatDate(emp.hireDate),
      type: 'hire',
      title: '首次入职',
    },
  ];
  for (const log of logs) {
    if (log.changeType === 'resign') {
      const resignDate = log.newValue && log.field === 'resignDate' ? log.newValue : null;
      items.push({
        key: `resign-${log.id}`,
        date: resignDate ? formatDate(resignDate) : formatDate(log.createdAt),
        type: 'resign',
        title: '离职',
        detail: log.field === 'status' ? '状态变更为：离职' : undefined,
      });
    } else if (log.changeType === 'restore') {
      items.push({
        key: `restore-${log.id}`,
        date: formatDate(log.createdAt),
        type: 'restore',
        title: '再次入职',
        detail: '状态变更为：在职',
      });
    }
  }
  // 按日期倒序，最新在最上
  return items.sort((a, b) => (a.date < b.date ? 1 : -1));
}

interface Props {
  employeeId: number | null;
  visible: boolean;
  onClose: () => void;
}

export default function EmployeeDetailModal({ employeeId, visible, onClose }: Props) {
  const { data, loading, run } = useFetchState<{ emp: Employee | null; logs: EmployeeChangeLog[] }>();
  const emp = data?.emp ?? null;
  const logs = data?.logs ?? [];

  useEffect(() => {
    if (!visible || !employeeId) return;
    void run(async () => {
      const [detailRes, logRes] = await Promise.all([
        employeeApi.getById(employeeId),
        employeeApi.getEmployeeChangeLogs(employeeId),
      ]);
      return { emp: detailRes.data ?? null, logs: logRes.data ?? [] };
    });
  }, [visible, employeeId, run]);

  const timeline = buildTimeline(emp, logs);

  return (
    <Drawer
      title={`员工档案 · ${emp?.name ?? ''}`}
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={620}
      className="ed-drawer"
      unmountOnExit
    >
      {loading ? (
        <div className="ed-loading">
          <Spin size={24} />
          <span>加载中…</span>
        </div>
      ) : !emp ? (
        <Empty description="未找到员工信息" />
      ) : (
        <div className="ed-scroll">
          <div className="ed-body">
            <div className="ed-head">
              <div className="ed-head-left">
                <div className="ed-head-name">
                  <span className="ed-name">{emp.name}</span>
                  <StatusTag status={emp.status} />
                </div>
                <div className="ed-meta">
                  <span className="ed-meta-no">{emp.employeeNo}</span>
                  <span className="ed-chip">{emp.department?.name ?? emp.departmentName ?? '-'}</span>
                  <span className="ed-chip ed-chip-brand">{emp.position?.name ?? emp.positionName ?? '-'}</span>
                </div>
              </div>
              <span className="ed-head-tenure">
                {emp.status === 'active' ? `在职 ${tenureText(emp.hireDate)}` : `于 ${formatDate(emp.resignDate ?? emp.updatedAt)} 离职`}
              </span>
            </div>

            <InfoSection
              title="基本信息"
              items={[
                { key: 'no', label: '工号', value: emp.employeeNo },
                { key: 'st', label: '状态', value: <StatusTag status={emp.status} /> },
                { key: 'dept', label: '部门', value: emp.department?.name ?? emp.departmentName ?? '-' },
                { key: 'pos', label: '岗位', value: emp.position?.name ?? emp.positionName ?? '-' },
                { key: 'rating', label: '职级', value: emp.rating ? `${emp.rating} 星` : '-' },
                { key: 'edu', label: '学历', value: emp.education || '-' },
              ]}
            />

            <InfoSection
              title="任职与薪酬"
              items={[
                { key: 'hire', label: '入职日期', value: formatDate(emp.hireDate) },
                {
                  key: 'duration',
                  label: emp.status === 'resigned' ? '离职日期' : '在职时长',
                  value:
                    emp.status === 'resigned'
                      ? formatDate(emp.resignDate ?? emp.updatedAt)
                      : tenureText(emp.hireDate, emp.resignDate),
                },
                { key: 'sal', label: '月薪（税前）', value: <span className="ed-sal">{formatSalary(emp.salary)}</span>, wide: true },
              ]}
            />

            <InfoSection
              title="联系方式"
              items={[
                { key: 'phone', label: '手机号', value: emp.phone || '-' },
                { key: 'ec', label: '紧急联系人', value: emp.emergencyContact || '-' },
                { key: 'eph', label: '紧急联系电话', value: emp.emergencyPhone || '-' },
                { key: 'addr', label: '联系地址', value: emp.address || '-', wide: true },
              ]}
            />

            <InfoSection
              title="教育背景 · 技能"
              items={[
                { key: 'skills', label: '专业技能', value: emp.skills || '-', wide: true },
                { key: 'remark', label: '备注', value: emp.remark || '-', wide: true },
              ]}
            />

            <InfoSection
              title="系统信息"
              items={[
                { key: 'created', label: '建档时间', value: formatDateTime(emp.createdAt) },
                { key: 'updated', label: '最近更新', value: formatDateTime(emp.updatedAt) },
              ]}
            />

            <section className="ed-group">
              <h3 className="ed-group-title">在职履历</h3>
              {timeline.length === 0 ? (
                <div className="ed-timeline-empty">暂无履历记录</div>
              ) : (
                <div className="ed-timeline">
                  {timeline.map((item) => {
                    const meta = TYPE_META[item.type];
                    return (
                      <div className="ed-tl-item" key={item.key}>
                        <div className="ed-tl-rail">
                          <span className={`ed-tl-dot ${meta.dot}`} />
                        </div>
                        <div className="ed-tl-content">
                          <div className="ed-tl-row">
                            <span className="ed-tl-title">{item.title}</span>
                            <span className="ed-tl-date">{item.date}</span>
                          </div>
                          {item.detail && <div className="ed-tl-detail">{item.detail}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </Drawer>
  );
}