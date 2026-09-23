import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save, Upload } from 'lucide-react';
import { useCan } from '../auth/permission';
import { useQuotas, useSetQuota, useImportQuota } from './hooks';
import { useAuthStore } from '../auth/store';
import type { LeaveQuotaView } from '@leixi/shared';
import { Button } from '../../components/ui/button';
import { Input, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty } from '../../components/ui/table';

function currentYear(): number {
  return new Date().getFullYear();
}

export function QuotaPage() {
  const canManage = useCan('quota_manage');
  const { user } = useAuthStore();
  const [year, setYear] = useState<number>(currentYear());
  const quotasQ = useQuotas(year);
  const setQuota = useSetQuota();
  const importQuota = useImportQuota();

  const quotas = quotasQ.data?.quotas ?? [];
  const [edits, setEdits] = useState<Record<number, number>>({});
  const [file, setFile] = useState<File | null>(null);

  // 类型切换/数据刷新时清空本地编辑
  useEffect(() => setEdits({}), [year, quotasQ.data]);

  const editorFor = (quota: LeaveQuotaView) => edits[quota.id] ?? quota.allowance;
  const setEditor = (quota: LeaveQuotaView, v: number) => setEdits((prev) => ({ ...prev, [quota.id]: v }));

  const saveRow = (quota: LeaveQuotaView) => {
    const allowance = editorFor(quota);
    setQuota.mutate(
      { userId: quota.userId, year, leaveTypeId: quota.leaveTypeId, allowance, used: quota.used },
      {
        onSuccess: () => toast.success(`${quota.leaveTypeName} 额度已更新`),
        onError: (e) => toast.error(e instanceof Error ? e.message : '保存失败'),
      },
    );
  };

  const readAndImport = () => {
    if (!file) return toast.error('请先选择 Excel 文件');
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1] ?? '';
      importQuota.mutate(
        { year, file: base64 },
        {
          onSuccess: (r) => {
            toast.success(`导入成功：${r.count} 条，跳过 ${r.skipped}`);
            setFile(null);
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : '导入失败'),
        },
      );
    };
    reader.readAsDataURL(file);
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear() + i - 2;
    return { label: `${y} 年`, value: y };
  });

  return (
    <PageShell>
      <PageHeader
        title="年度请假额度"
        description="按年度为员工配置各请假类型的可用/已用额度，支持 Excel 批量导入。"
        action={
          canManage && (
            <div className="flex w-full max-w-md gap-2">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="block w-full text-sm text-faint file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button onClick={readAndImport} disabled={importQuota.isPending}>
                <Upload className="h-4 w-4" />
                导入
              </Button>
            </div>
          )
        }
      />

      <Panel>
        <PanelHeader
          title="额度明细"
          description={`${year} 年`}
          extra={
            <div className="w-40">
              <Select value={year} onChange={(v) => setYear(Number(v))} options={yearOptions} />
            </div>
          }
        />
        <Table>
          <THead>
            <TH className="w-14">ID</TH>
            <TH>类型</TH>
            <TH>可用额度</TH>
            <TH>已用</TH>
            <TH>剩余</TH>
            {canManage && <TH className="w-32">操作</TH>}
          </THead>
          <tbody>
            {quotas.map((q) => {
              const remaining = q.remaining;
              return (
                <Row key={q.id} className={user?.id === q.userId ? 'bg-brand-50/40' : undefined}>
                  <TD className="font-mono text-xs text-stone-400">#{q.id}</TD>
                  <TD className="font-medium text-ink">
                    {q.leaveTypeName}
                    {user?.id === q.userId && <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">我</span>}
                  </TD>
                  <TD>
                    {canManage ? (
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        className="w-24"
                        value={String(editorFor(q))}
                        onChange={(e) => setEditor(q, Number(e.target.value))}
                      />
                    ) : (
                      <span className="text-stone-700">{q.allowance}</span>
                    )}
                  </TD>
                  <TD className="text-stone-700">{q.used}</TD>
                  <TD className={remaining >= 0 ? 'font-medium text-ink' : 'font-medium text-rose-600'}>
                    {remaining >= 0 ? remaining : '超用'}
                  </TD>
                  {canManage && (
                    <TD>
                      <Button size="sm" variant="secondary" onClick={() => saveRow(q)} disabled={setQuota.isPending}>
                        <Save className="h-3.5 w-3.5" />
                        保存
                      </Button>
                    </TD>
                  )}
                </Row>
              );
            })}
          </tbody>
        </Table>
        {quotas.length === 0 && (
          <Empty>{canManage ? '暂无额度记录，可用 Excel 导入或直接录入' : '当前范围暂无额度记录'}</Empty>
        )}
      </Panel>

      {canManage && (
        <Panel>
          <PanelHeader title="导入说明" description="Excel 格式：第 1 列为【员工姓名】，第 2 列为【请假类型】，第 3 列为【年度额度】" />
          <div className="p-4 text-sm text-faint">
            仅导入当前员工范围内、且类型已存在的行；员工姓名或类型未匹配、额度非法（非数字 / 负数）的行会被跳过并计入 skipped。
          </div>
        </Panel>
      )}
    </PageShell>
  );
}