'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Upload,
  Message,
  Space,
  Divider,
  InputNumber,
  Grid,
  Card,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { IconPlus, IconDelete, IconLink } from '@arco-design/web-react/icon';
import { reimbursementApi, ReimbursementType, ExpenseType } from '@/services/reimbursement';
import { notifyError } from '@/lib/request';
import { formatMoney } from '@/lib/format';
import { useCachedData } from '@/hooks/use-cached-data';

const { Row, Col } = Grid;
const { Text } = Typography;

// /uploads/... 相对路径 → 后端静态读取端点（防穿越由后端保证）
export function resolveFileUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `/api/v1/files/serve?path=${encodeURIComponent(url)}`;
}

interface DraftItemState {
  key: number;
  itemType?: string;
  amount?: number;
  expenseDate?: string;
  description?: string;
  attachmentUrl?: string;
}

export interface ReimbursementFormProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ReimbursementForm({ visible, onSuccess, onCancel }: ReimbursementFormProps) {
  const [form] = Form.useForm();
  const [items, setItems] = useState<DraftItemState[]>([{ key: Date.now() }]);
  const [docAttachments, setDocAttachments] = useState<{ fileName: string; fileUrl: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemUploadingIdx, setItemUploadingIdx] = useState<number | null>(null);
  const [docUploading, setDocUploading] = useState(false);

  // 参考数据经 useCachedData 共享缓存，避免重复请求。
  // 业务码非 0 一律抛错交给下面的 catch 统一提示：静默降级会让「报销类型」
  // /「费用类型」下拉变空，用户无从判断是系统里没配还是接口挂了。
  const { data: types } = useCachedData<ReimbursementType[]>(
    'ref:reimbursement:types',
    useCallback(
      () =>
        reimbursementApi
          .getTypes()
          .then((res) => {
            if (res.code !== 0) throw new Error(res.message || '报销类型加载失败');
            return res.data ?? [];
          })
          .catch((e) => {
            notifyError(e, '报销类型加载失败，请刷新重试');
            return [];
          }),
      [],
    ),
  );
  const { data: expenseTypes } = useCachedData<ExpenseType[]>(
    'ref:reimbursement:expense-types',
    useCallback(
      () =>
        reimbursementApi
          .getExpenseTypes()
          .then((res) => {
            if (res.code !== 0) throw new Error(res.message || '费用类型加载失败');
            return res.data ?? [];
          })
          .catch((e) => {
            notifyError(e, '费用类型加载失败，请刷新重试');
            return [];
          }),
      [],
    ),
  );
  const typeList = types ?? [];
  const expenseTypeList = expenseTypes ?? [];

  const totalAmount = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0),
    [items],
  );

  // 打开弹窗时初始化表单：标题默认带月份，typeCode 在一级类型加载后默认选第一项
  useEffect(() => {
    if (!visible) return;
    setItems([{ key: Date.now() }]);
    setDocAttachments([]);
    form.resetFields();
    form.setFieldsValue({
      title: `${new Date().getFullYear()}年${new Date().getMonth() + 1}月报销申请`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible || typeList.length === 0) return;
    if (!form.getFieldValue('typeCode')) {
      form.setFieldsValue({ typeCode: typeList[0].code });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, typeList]);

  const addItem = () => setItems((prev) => [...prev, { key: Date.now() + Math.random() }]);
  const removeItem = (key: number) => setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  const updateItem = (key: number, patch: Partial<DraftItemState>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const uploadItemInvoice = async (idx: number, file: File) => {
    setItemUploadingIdx(idx);
    try {
      const res = await reimbursementApi.uploadFile(file, 'reimbursement');
      if (res.code === 0 && res.data) {
        updateItem(items[idx].key, { attachmentUrl: res.data.url });
        Message.success('发票已关联');
      } else {
        Message.error(res.message || '上传失败');
      }
    } catch (e) {
      notifyError(e, '上传失败');
    } finally {
      setItemUploadingIdx(null);
    }
  };

  const uploadDocAttachment = async (file: File) => {
    setDocUploading(true);
    try {
      const res = await reimbursementApi.uploadFile(file, 'reimbursement');
      if (res.code === 0 && res.data) {
        setDocAttachments((prev) => [...prev, { fileName: res.data!.fileName, fileUrl: res.data!.url }]);
        Message.success('附件已上传');
      } else {
        Message.error(res.message || '上传失败');
      }
    } catch (e) {
      notifyError(e, '上传失败');
    } finally {
      setDocUploading(false);
    }
  };

  const buildPayload = (status: 'draft' | 'pending') => {
    const values = form.getFieldsValue();
    return {
      title: values.title || '未命名报销',
      typeCode: values.typeCode || typeList[0]?.code || 'other',
      remark: values.remark || '',
      totalAmount,
      status,
      items: items
        .filter((i) => i.itemType || i.amount)
        .map((i) => ({
          itemType: i.itemType,
          amount: Number(i.amount) || 0,
          expenseDate: i.expenseDate,
          description: i.description || '',
          attachmentUrl: i.attachmentUrl || undefined,
        })),
      attachments: docAttachments.map((a) => ({ fileName: a.fileName, fileUrl: a.fileUrl })),
    };
  };

  const handleSubmit = async (status: 'draft' | 'pending') => {
    if (status === 'pending') {
      const valid = await form.validate().catch(() => false);
      if (!valid) return;
      if (items.every((i) => !i.amount)) {
        Message.warning('请至少填写一项费用明细');
        return;
      }
    }
    status === 'draft' ? setSaving(true) : setSubmitting(true);
    try {
      const res = await reimbursementApi.createReimbursement(buildPayload(status));
      if (res.code === 0) {
        Message.success(status === 'draft' ? '草稿已保存' : '申请已提交');
        onSuccess();
      } else {
        Message.error(res.message || '提交失败');
      }
    } catch (e) {
      notifyError(e, '提交失败');
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  const fieldLabel = (text: string) => (
    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
      {text}
    </Text>
  );

  return (
    <Modal
      visible={visible}
      title="新建报销"
      onCancel={onCancel}
      footer={null}
      style={{ width: 860 }}
      maskClosable={false}
      autoFocus={false}
    >
      <Form form={form} layout="vertical">
        {/* 基础信息 */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="报销单标题"
              field="title"
              rules={[{ required: true, message: '请输入标题' }]}
            >
              <Input placeholder="例如：8月办公费报销" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="报销分类"
              field="typeCode"
              rules={[{ required: true, message: '请选择报销分类' }]}
            >
              <Select placeholder="请选择">
                {typeList.map((t) => (
                  <Select.Option key={t.code} value={t.code}>
                    {t.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="事由备注" field="remark">
          <Input.TextArea placeholder="简单说明情况..." autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>

        <Divider orientation="left">费用明细</Divider>

        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {items.map((item, idx) => (
            <Card
              key={item.key}
              size="small"
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Tag size="small" color="arcoblue">
                    {idx + 1}
                  </Tag>
                  <Text type="secondary" style={{ fontWeight: 400 }}>
                    明细项
                  </Text>
                </span>
              }
              extra={
                <Button
                  type="text"
                  icon={<IconDelete />}
                  disabled={items.length === 1}
                  onClick={() => removeItem(item.key)}
                  aria-label="移除该项"
                />
              }
            >
              <Row gutter={8}>
                <Col span={6}>
                  {fieldLabel('费用类型')}
                  <Select
                    placeholder="请选择"
                    value={item.itemType}
                    onChange={(v) => updateItem(item.key, { itemType: v })}
                    style={{ width: '100%' }}
                  >
                    {expenseTypeList.map((t) => (
                      <Select.Option key={t.id} value={t.name}>
                        {t.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col span={6}>
                  {fieldLabel('报销金额')}
                  <InputNumber
                    placeholder="0.00"
                    min={0}
                    precision={2}
                    value={item.amount}
                    onChange={(v) => updateItem(item.key, { amount: v as number })}
                    style={{ width: '100%' }}
                    prefix="¥"
                  />
                </Col>
                <Col span={6}>
                  {fieldLabel('产生日期')}
                  <Input
                    placeholder="2026-08-01"
                    value={item.expenseDate}
                    onChange={(v) => updateItem(item.key, { expenseDate: v })}
                  />
                </Col>
                <Col span={6}>
                  {fieldLabel('用途备注')}
                  <Input
                    placeholder="说明用途..."
                    value={item.description}
                    onChange={(v) => updateItem(item.key, { description: v })}
                  />
                </Col>
              </Row>
              {/* 报销凭证：Divider 分隔，凭证操作条整行左对齐，已关联时展示文件名 */}
              <Divider style={{ margin: '14px 0 12px' }} />
              <Space size={12} align="center">
                <Upload
                  showUploadList={false}
                  autoUpload={false}
                  onChange={(fileList) => {
                    const f = fileList?.[0];
                    if (f?.originFile) void uploadItemInvoice(idx, f.originFile);
                  }}
                >
                  <Button
                    size="small"
                    type="outline"
                    icon={<IconLink />}
                    loading={itemUploadingIdx === idx}
                  >
                    关联报销发票
                  </Button>
                </Upload>
                {item.attachmentUrl && (
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 12,
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.attachmentUrl.split('/').pop()}
                  </Text>
                )}
                {item.attachmentUrl && (
                  <a
                    href={resolveFileUrl(item.attachmentUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: 'var(--lx-primary)' }}
                  >
                    预览
                  </a>
                )}
                {item.attachmentUrl && (
                  <Button size="mini" type="text" status="danger" onClick={() => updateItem(item.key, { attachmentUrl: undefined })}>
                    清除
                  </Button>
                )}
              </Space>
            </Card>
          ))}

          <Button long type="dashed" onClick={addItem} icon={<IconPlus />}>
            新增一笔费用明细项
          </Button>
        </Space>

        {/* 单据级附件 */}
        <Divider orientation="left">补充证明附件</Divider>
        <Upload
          showUploadList={false}
          autoUpload={false}
          onChange={(fileList) => {
            const f = fileList?.[0];
            if (f?.originFile) void uploadDocAttachment(f.originFile);
          }}
        >
          <Button size="small" loading={docUploading}>
            点击上传汇总凭证材料
          </Button>
        </Upload>
        {docAttachments.length > 0 && (
          <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
            {docAttachments.map((att) => (
              // 键与删除都按 fileUrl 定位：用下标会在删除中间一项后错位，
              // 让后面附件的「移除」删到别人头上
              <Space key={att.fileUrl} size={8} align="center">
                <Text style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {att.fileName}
                </Text>
                <Button
                  size="mini"
                  type="text"
                  status="danger"
                  onClick={() => setDocAttachments((prev) => prev.filter((a) => a.fileUrl !== att.fileUrl))}
                >
                  移除
                </Button>
              </Space>
            ))}
          </Space>
        )}
      </Form>

      <Divider style={{ marginTop: 20, marginBottom: 16 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text type="secondary">
          合计金额:{' '}
          <Text bold style={{ color: 'var(--lx-primary)' }}>
            ¥ {formatMoney(totalAmount, '0.00')}
          </Text>
        </Text>
        <Space>
          <Button onClick={() => handleSubmit('draft')} loading={saving}>
            存为草稿
          </Button>
          <Button type="primary" onClick={() => handleSubmit('pending')} loading={submitting}>
            正式提交
          </Button>
        </Space>
      </div>
    </Modal>
  );
}