'use client';

import { useMemo, useState } from 'react';
import { Message, Tag, Space, Button, Modal } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { attendanceApi, VacationType, VacationTypeCreateDto } from '@/services/attendance';
import { useCachedData } from '@/hooks/use-cached-data';
import { usePermission } from '@/hooks/use-permission';
import { notifyError } from '@/lib/request';
import { isMonthlyDays } from '@/lib/vacation-type';

interface TypeEnvelope {
  code: number;
  message?: string;
  data?: VacationType[];
}

/** 工龄规则数组 → 简洁摘要文本，如「0~1年5天 / 1年+10天」 */
function ruleSummary(rule?: { minYears?: number; maxYears?: number; days: number }[] | null): string {
  if (!rule || rule.length === 0) return '-';
  return rule
    .map((r) => {
      if (r.maxYears === undefined || r.maxYears === null) return `${r.minYears ?? 0}年+${r.days}天`;
      return `${r.minYears ?? 0}~${r.maxYears}年${r.days}天`;
    })
    .join(' / ');
}

export default function VacationTypeSettingsPage() {
  const { can } = usePermission();
  const canManage = can('vacation:manage');

  const { data: res, loading, error, revalidate } = useCachedData<TypeEnvelope>(
    'vacation:types',
    () => attendanceApi.getVacationTypes(),
    { staleTime: 30_000 },
  );
  const list = res?.code === 0 && res.data ? res.data : [];
  // 业务错误（code!==0）不是空数据，必须透出错误态，否则会被误读为「暂无假期类型」
  const errorText = error ?? (res && res.code !== 0 ? res.message || '加载假期类型失败' : null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editing, setEditing] = useState<VacationType | null>(null);
  // 月假模式开关：开启时展示并提交 12 个月额度；关闭（非月假）提交 null
  const [monthlyMode, setMonthlyMode] = useState(false);

  const fields: FormFieldConfig[] = [
    { key: 'code', label: '类型编码', type: 'input', required: true, placeholder: '如 annual / sick' },
    { key: 'name', label: '类型名称', type: 'input', required: true, placeholder: '如 年假' },
    { key: 'baseDays', label: '基础天数', type: 'input', required: true, placeholder: '如 5' },
    {
      key: 'isPaid',
      label: '是否计薪',
      type: 'select',
      options: [
        { value: 'false', label: '无薪（取消全勤奖）' },
        { value: 'true', label: '有薪（不取消全勤奖）' },
      ],
    },
    { key: 'sortOrder', label: '排序', type: 'input', placeholder: '数值越小越靠前' },
    {
      key: 'enabled',
      label: '启用',
      type: 'select',
      options: [
        { value: 'true', label: '启用' },
        { value: 'false', label: '停用' },
      ],
    },
    {
      key: 'monthlyMode',
      label: '额度模式',
      type: 'select',
      options: [
        { value: 'false', label: '按年额度' },
        { value: 'true', label: '按月额度（月假）' },
      ],
    },
    // 月假：12 个月每天额度，月度不结转，未休作废
    ...(monthlyMode
      ? ([
          {
            key: 'monthlyDays',
            label: '月假额度（1~12 月每日天数）',
            type: 'monthDays',
            placeholder: '0',
          },
        ] as FormFieldConfig[])
      : []),
    // 月假月末未休作废、不结转，故按月模式下不展示年结结转配置
    ...(monthlyMode
      ? []
      : ([
          { key: 'carryOverRatio', label: '结转比例(0~1)', type: 'input', placeholder: '如 0.5 表示结转剩余的一半' },
          { key: 'carryOverMaxDays', label: '结转上限(天)', type: 'input', placeholder: '留空表示不设上限' },
        ] as FormFieldConfig[])),
    {
      key: 'seniorityRule',
      label: '工龄规则',
      type: 'textarea',
      placeholder: 'JSON 数组，留空回退基础天数，如 [{"minYears":0,"maxYears":1,"days":5},{"minYears":1,"days":10}]',
      rules: [],
    },
  ];

  const openCreate = () => {
    setEditing(null);
    setMonthlyMode(false);
    setModalVisible(true);
  };

  const openEdit = (record: VacationType) => {
    setEditing(record);
    setMonthlyMode(isMonthlyDays(record.monthlyDays));
    setModalVisible(true);
  };

  const initialValues = useMemo(() => {
    if (!editing) return { enabled: 'true', monthlyMode: 'false', isPaid: 'false' };
    const isMonthly = isMonthlyDays(editing.monthlyDays);
    return {
      ...editing,
      enabled: editing.enabled ? 'true' : 'false',
      isPaid: editing.isPaid ? 'true' : 'false',
      seniorityRule: editing.seniorityRule ? JSON.stringify(editing.seniorityRule) : '',
      monthlyMode: isMonthly ? 'true' : 'false',
      monthlyDays: isMonthly ? [...editing.monthlyDays!] : undefined,
    };
  }, [editing]);

  const handleSubmit = async (values: Record<string, any>) => {
    setModalLoading(true);
    const payload: Record<string, any> = {
      code: values.code,
      name: values.name,
    };
    if (values.baseDays !== undefined && values.baseDays !== '') payload.baseDays = Number(values.baseDays);
    if (values.sortOrder !== undefined && values.sortOrder !== '') payload.sortOrder = Number(values.sortOrder);
    if (values.enabled !== undefined) payload.enabled = values.enabled === 'true';
    if (values.isPaid !== undefined) payload.isPaid = values.isPaid === 'true';
    if (values.carryOverRatio !== undefined && values.carryOverRatio !== '') payload.carryOverRatio = Number(values.carryOverRatio);
    if (values.carryOverMaxDays !== undefined && values.carryOverMaxDays !== '') payload.carryOverMaxDays = Number(values.carryOverMaxDays);
    if (values.seniorityRule) {
      try {
        payload.seniorityRule = JSON.parse(values.seniorityRule);
      } catch {
        Message.error('工龄规则不是合法的 JSON');
        setModalLoading(false);
        return;
      }
    }
    // 月假类型提交 12 个月额度；按年额度类型显式置 null，避免残留旧月假配置。
    // 用户切到「按月额度」但未逐格编辑时表单值仍是 undefined，必须补 12 个 0 兜底，
    // 否则会静默提交 null —— 模式选择被丢弃，列表仍显示「按年额度」。
    if (values.monthlyMode === 'true') {
      const days = isMonthlyDays(values.monthlyDays) ? values.monthlyDays : Array(12).fill(0);
      payload.monthlyDays = days.map((d: any) => Number(d) || 0);
    } else {
      payload.monthlyDays = null;
    }
    try {
      const res = editing
        ? await attendanceApi.updateVacationType(editing.id, payload as Partial<VacationTypeCreateDto>)
        : await attendanceApi.createVacationType(payload as VacationTypeCreateDto);
      if (res.code === 0) {
        Message.success(editing ? '已更新假期类型' : '已新增假期类型');
        setModalVisible(false);
        revalidate();
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e) {
      notifyError(e, '保存失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = (record: VacationType) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除假期类型「${record.name}」吗？此操作不可恢复。`,
      okButtonProps: { status: 'danger' },
      onOk: async () => {
        try {
          const res = await attendanceApi.deleteVacationType(record.id);
          if (res.code === 0) {
            Message.success('已删除');
            revalidate();
          } else {
            Message.error(res.message || '删除失败');
          }
        } catch (e) {
          notifyError(e, '删除失败');
        }
      },
    });
  };

  const columns: ProTableColumn[] = [
    { title: '类型编码', dataIndex: 'code', width: 120 },
    { title: '类型名称', dataIndex: 'name', width: 120 },
    {
      title: '基础天数',
      dataIndex: 'baseDays',
      width: 100,
      render: (_: any, r: VacationType) => `${Number(r.baseDays ?? 0)}`,
    },
    {
      title: '工龄规则',
      dataIndex: 'seniorityRule',
      width: 260,
      ellipsis: true,
      render: (_: any, r: VacationType) => ruleSummary(r.seniorityRule),
    },
    {
      title: '额度模式',
      dataIndex: 'monthlyDays',
      width: 200,
      render: (_: any, r: VacationType) => {
        if (!isMonthlyDays(r.monthlyDays)) return '按年额度';
        const monthlyDays = r.monthlyDays!;
        return (
          <span title={monthlyDays.map((d, i) => `${i + 1}月:${d}天`).join('  ')}>
            按月额度（{monthlyDays.join(' / ')}）
          </span>
        );
      },
    },
    {
      title: '结转比例',
      dataIndex: 'carryOverRatio',
      width: 100,
      render: (_: any, r: VacationType) => (r.carryOverRatio == null ? '-' : `${r.carryOverRatio}`),
    },
    {
      title: '结转上限',
      dataIndex: 'carryOverMaxDays',
      width: 100,
      render: (_: any, r: VacationType) => (r.carryOverMaxDays == null ? '-' : `${r.carryOverMaxDays} 天`),
    },
    {
      title: '计薪',
      dataIndex: 'isPaid',
      width: 90,
      render: (_: any, r: VacationType) =>
        r.isPaid ? <Tag color="blue">有薪</Tag> : <Tag color="orange">无薪</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 90,
      render: (_: any, r: VacationType) =>
        r.enabled ? <Tag color="green">启用</Tag> : <Tag color="gray">停用</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: (_: any, r: VacationType) => (
        <Space>
          {canManage && (
            <>
              <Button size="small" type="text" onClick={() => openEdit(r)}>编辑</Button>
              <Button size="small" type="text" status="danger" onClick={() => handleDelete(r)}>删除</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable
        columns={columns}
        data={list}
        rowKey="id"
        loading={loading}
        error={errorText}
        onRetry={revalidate}
        toolbar={canManage ? [{ key: 'add', label: '新增假期类型', type: 'primary', onClick: openCreate }] : []}
        pagination={false}
      />

      <ModalForm
        visible={modalVisible}
        title={editing ? '编辑假期类型' : '新增假期类型'}
        fields={fields}
        initialValues={initialValues}
        columns={2}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        onValuesChange={(key, value) => {
          if (key === 'monthlyMode') setMonthlyMode(value === 'true');
        }}
        confirmLoading={modalLoading}
        width={640}
      />
    </PageContainer>
  );
}