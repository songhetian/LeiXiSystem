import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { WalletCards, Download } from 'lucide-react';
import { useCan } from '../auth/permission';
import { useSalaries, useCreateSalary } from './hooks';
import { useUsers } from '../rbac/hooks';
import { downloadExport } from '../../lib/exportDownload';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Field, Select, Input } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty } from '../../components/ui/table';
import { Pagination } from '../../components/ui/pagination';

const PAGE_SIZE = 10;

function fmtMoney(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 录入薪资表单：选择目标员工（部门由后端按员工归属写入，net 由后端计算） */
function SalaryCreateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateSalary();
  const { data: usersQ } = useUsers();
  const users = usersQ?.users ?? [];

  const [month, setMonth] = useState(currentMonth());
  const [userId, setUserId] = useState<number | ''>('');
  const [basic, setBasic] = useState('');
  const [bonus, setBonus] = useState('');
  const [deduction, setDeduction] = useState('');

  const basicN = Number(basic) || 0;
  const bonusN = Number(bonus) || 0;
  const deductionN = Number(deduction) || 0;
  const net = basicN + bonusN - deductionN;

  const employeeOptions = useMemo(
    () => users.filter((u) => u.status === 'active').map((u) => ({ value: u.id, label: `${u.realName}（${u.username}）` })),
    [users],
  );

  const submit = async () => {
    if (!month) return toast.error('请选择薪资月份');
    if (userId === '') return toast.error('请选择目标员工');
    if (!basic || basicN <= 0) return toast.error('请填写正确的基本工资');
    try {
      await create.mutateAsync({
        month,
        userId: Number(userId),
        basic: basicN,
        bonus: bonusN,
        deduction: deductionN,
      });
      toast.success('薪资已录入');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '录入失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="录入薪资"
      description="按月为员工录入薪资单；实发按基本+绩效−扣除自动计算"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? '提交中…' : '录入'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="薪资月份" required>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <Field label="目标员工" required>
          <Select
            value={userId}
            onChange={(v) => setUserId(Number(v))}
            options={employeeOptions}
            placeholder="选择员工"
          />
        </Field>
        <Field label="基本工资（元）" required>
          <Input type="number" min="0" step="0.01" value={basic} onChange={(e) => setBasic(e.target.value)} placeholder="如 10000" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="绩效/奖金（元）">
            <Input type="number" min="0" step="0.01" value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="如 2000" />
          </Field>
          <Field label="扣除（元）">
            <Input type="number" min="0" step="0.01" value={deduction} onChange={(e) => setDeduction(e.target.value)} placeholder="如 500" />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-2.5 text-sm ring-1 ring-stone-100">
          <span className="text-faint">实发（自动计算）</span>
          <span className="font-mono text-base font-semibold text-ink">{fmtMoney(net)}</span>
        </div>
      </div>
    </Modal>
  );
}

export function SalariesPage() {
  const salariesQ = useSalaries();
  const salaries = salariesQ.data?.salaries ?? [];
  const canCreate = useCan('salary_create');
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 导出薪资台账
  const onExport = async () => {
    setExporting(true);
    try {
      await downloadExport('/api/export/salaries');
      toast.success('薪资台账已导出');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const [page, setPage] = useState(1);
  const total = salaries.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = salaries.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <PageShell>
      <PageHeader
        title="薪资管理"
        description="按月为员工录入薪资单；部门数据隔离 —— 仅展示「本部门 + 下属部门」的员工薪资。"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? '导出中…' : '导出'}
            </Button>
            {canCreate && (
              <Button onClick={() => setModalOpen(true)}>
                <WalletCards className="h-4 w-4" />
                录入薪资
              </Button>
            )}
          </div>
        }
      />

      <Panel>
        <PanelHeader title="薪资台账" description={`当前作用域内共 ${salaries.length} 条`} />
        <Table>
          <THead>
            <TH className="w-14">ID</TH>
            <TH>月份</TH>
            <TH>员工</TH>
            <TH>所属部门</TH>
            <TH className="text-right">基本工资</TH>
            <TH className="text-right">绩效/奖金</TH>
            <TH className="text-right">扣除</TH>
            <TH className="text-right">实发</TH>
          </THead>
          <tbody>
            {paged.map((l) => (
              <Row key={l.id}>
                <TD className="font-mono text-xs text-stone-400">#{l.id}</TD>
                <TD className="whitespace-nowrap font-medium text-ink">{l.month}</TD>
                <TD className="font-medium text-ink">{l.employeeName}</TD>
                <TD className="text-stone-500">{l.departmentName}</TD>
                <TD className="whitespace-nowrap text-right font-mono text-stone-700">{fmtMoney(l.basic)}</TD>
                <TD className="whitespace-nowrap text-right font-mono text-stone-700">{fmtMoney(l.bonus)}</TD>
                <TD className="whitespace-nowrap text-right font-mono text-stone-500">{fmtMoney(l.deduction)}</TD>
                <TD className="whitespace-nowrap text-right font-mono text-sm font-semibold text-ink">{fmtMoney(l.net)}</TD>
              </Row>
            ))}
          </tbody>
        </Table>
        {salaries.length === 0 && <Empty>当前作用域内暂无薪资记录</Empty>}
        {salaries.length > 0 && (
          <Pagination page={current} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </Panel>

      {modalOpen && <SalaryCreateModal onClose={() => setModalOpen(false)} />}
    </PageShell>
  );
}