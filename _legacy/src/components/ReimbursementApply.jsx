import logger from '@/utils/logger';
/**
 * 报销申请组件 (精致商务最终版)
 * 
 * 核心优化：
 * 1. 整体缩小：高度下调至 40px，整体间距更紧凑。
 * 2. 全面中文：移除 "Click to Upload" 等英文，改用标准中文。
 * 3. 细节打磨：优化上传区域布局，增强商务质感。
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  InputNumber,
  DatePicker,
  Upload,
  Typography,
  Divider,
  Space,
  Spin,
  Card,
  Image
} from 'antd';
import {
  Save,
  Send,
  Plus,
  FileText,
  CreditCard,
  Paperclip,
  UploadCloud,
  FileSearch,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import api from '../api';
import { getAttachmentUrl } from '../utils/fileUtils';

const { TextArea } = Input;
const { Text } = Typography;

// --- 精致版发票上传器 ---
const InvoiceUploader = ({ value, onChange }) => {
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleUpload = async ({ file, onSuccess, onError }) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/upload', formData);
      if (response.data?.success) {
        onChange(response.data.url);
        onSuccess(response.data);
        toast.success('发票已关联');
      } else { throw new Error(); }
    } catch (err) { toast.error('上传失败'); onError(); } finally { setLoading(false); }
  };

  return (
    <div className="flex items-center gap-2">
      {value ? (
        <Space size="small">
          {/* 使用 Image 组件的预览功能，点击按钮触发 */}
          <div style={{ display: 'none' }}>
            <Image
              src={getAttachmentUrl(value)}
              preview={{
                visible: previewOpen,
                onVisibleChange: (visible) => setPreviewOpen(visible),
              }}
            />
          </div>
          <Button 
            size="small" 
            onClick={() => setPreviewOpen(true)}
            className="text-white border-none bg-[#06AD56] hover:bg-[#059346] h-10 px-5 font-bold shadow-sm transition-all rounded-lg"
          >
            预览凭证
          </Button>
          <Button 
            size="small" 
            danger 
            type="text" 
            onClick={() => onChange(null)}
            className="text-xs font-medium text-slate-400 hover:text-red-500"
          >
            清除
          </Button>
        </Space>
      ) : (
        <Upload customRequest={handleUpload} showUploadList={false}>
          <Button 
            icon={<UploadCloud size={16} />} 
            loading={loading}
            className="h-10 px-6 border-none text-white bg-[#07C160] hover:bg-[#06AD56] font-black shadow-sm flex items-center justify-center gap-2 transition-all rounded-lg"
          >
            关联报销发票
          </Button>
        </Upload>
      )}
    </div>
  );
};

const ReimbursementApply = ({ user, onSuccess }) => {
  const [form] = Form.useForm();
  const [reimbursementTypes, setReimbursementTypes] = useState([]);
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initData = async () => {
      try {
        const [resTypes, resExpenses] = await Promise.all([
          api.get('/reimbursement/types', { params: { activeOnly: 1 } }),
          api.get('/reimbursement/expense-types', { params: { activeOnly: 1 } })
        ]);
        if (resTypes.data?.success) {
          const types = resTypes.data.data || [];
          setReimbursementTypes(types);
          // 动态设置第一个可用分类为默认值
          if (types.length > 0) {
            form.setFieldValue('type', types[0].code);
          }
        }
        if (resExpenses.data?.success) setExpenseTypes(resExpenses.data.data || []);
        
        form.setFieldsValue({
          title: `${dayjs().format('YYYY年MM月')}报销申请`,
          items: [{ item_type: undefined, amount: undefined, expense_date: dayjs() }]
        });
      } catch (e) { logger.error(e); }
    };
    initData();
  }, []);

  const itemsWatch = Form.useWatch('items', form) || [];
  const totalAmount = useMemo(() => itemsWatch.reduce((sum, cur) => sum + (parseFloat(cur?.amount) || 0), 0), [itemsWatch]);

  const handleGlobalUpload = async ({ file, onSuccess: upSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload', formData);
      if (res.data?.success) {
        setAttachments(prev => [...prev, { file_name: file.name, file_url: res.data.url }]);
        upSuccess();
      }
    } catch (err) { toast.error('上传失败'); onError(); }
  };

  const handleFinalSubmit = async (isDraft = false) => {
    try {
      const values = isDraft ? form.getFieldsValue() : await form.validateFields();
      const payload = {
        title: values.title || '未命名报销',
        type: values.type || 'other',
        remark: values.remark || '',
        amount: totalAmount,
        user_id: user?.id,
        status: isDraft ? 'draft' : 'pending',
        items: (values.items || []).filter(i => i).map(i => ({
          item_type: i.item_type,
          amount: parseFloat(i.amount) || 0,
          date: i.expense_date ? dayjs(i.expense_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
          description: i.description || '',
          attachment_url: i.attachment_url || null
        })),
        attachments: (attachments || []).map(a => a.file_url)
      };
      isDraft ? setSaving(true) : setSubmitting(true);
      const res = await api.post('/reimbursement', payload);
      if (res.data?.success) {
        toast.success(isDraft ? '草稿已保存' : '申请已提交');
        if (!isDraft) { form.resetFields(); setAttachments([]); onSuccess?.(); }
      } else { toast.error(res.data?.message || '失败'); }
    } catch (err) {
      if (err.errorFields) toast.error('请补全带星号的必填信息');
      else toast.error('系统繁忙');
    } finally { setSaving(false); setSubmitting(false); }
  };

  return (
    <div className="w-full h-[calc(100vh-64px)] bg-[#f8fafc] flex overflow-hidden">
      <Form form={form} layout="vertical" requiredMark={false} className="flex flex-1 w-full h-full overflow-hidden">
        
        {/* 左侧区域 (340px) */}
        <div className="w-[340px] h-full bg-white border-r border-slate-200 p-5 overflow-y-auto shrink-0 flex flex-col shadow-sm z-10">
          <div className="space-y-5 flex-1">
            <header className="mb-2">
              <h2 className="text-lg font-black text-slate-800 m-0 flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" /> 基础申报信息
              </h2>
            </header>

            <Form.Item name="title" label={<span className="text-xs font-bold text-slate-500">报销单标题</span>} rules={[{ required: true, message: '!' }]}>
              <Input className="h-10 rounded-lg border-slate-300 font-medium" placeholder="例如：12月办公费报销" />
            </Form.Item>
            
            <Form.Item name="type" label={<span className="text-xs font-bold text-slate-500">报销分类</span>} rules={[{ required: true, message: '!' }]}>
              <Select className="h-10 w-full">
                {reimbursementTypes.map(t => <Select.Option key={t.code} value={t.code}>{t.name}</Select.Option>)}
              </Select>
            </Form.Item>
            
            <Form.Item name="remark" label={<span className="text-xs font-bold text-slate-500">事由备注</span>}>
              <TextArea rows={3} className="rounded-lg border-slate-300 text-sm" placeholder="简单说明情况..." />
            </Form.Item>

            <Divider className="my-2" />

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Paperclip size={14} /> 补充证明附件
              </h3>
              <Upload.Dragger customRequest={handleGlobalUpload} showUploadList={false} multiple className="!bg-white p-3 border-slate-200">
                <UploadCloud size={20} className="mx-auto text-slate-300 mb-1" />
                <div className="text-[10px] font-black text-slate-400">点击上传汇总凭证材料</div>
              </Upload.Dragger>
              <div className="mt-3 space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                {attachments.map((att, idx) => (
                  <div key={idx} className="p-2 bg-white border border-slate-100 rounded-lg flex items-center gap-2 shadow-sm animate-in slide-in-from-bottom-1 duration-200">
                    <span className="flex-1 truncate text-[11px] font-bold text-slate-600">{att.file_name}</span>
                    <Button type="link" danger size="small" className="h-auto p-0 text-[10px]" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}>移除</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧区域 */}
        <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden relative">
          
          {/* 明细列表 */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="max-w-5xl mx-auto w-full space-y-5">
              
              <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-800 m-0">2. 报销费用明细</h2>
                    <Text type="secondary" className="text-[10px] font-bold uppercase tracking-tight">请确保每一项均关联了对应的有效发票</Text>
                  </div>
                </div>
                <div className="bg-indigo-50 px-5 py-1.5 rounded-lg border border-indigo-100">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-0.5">合计金额</span>
                  <span className="text-xl font-black text-indigo-600 font-mono">¥ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <Form.List name="items">
                {(fields, { add, remove }) => (
                  <div className="space-y-3">
                    {fields.map(({ key, name, ...restField }, index) => (
                      <Card key={key} size="small" className="rounded-xl border-slate-200 shadow-sm" styles={{ body: { padding: '16px 20px' } }}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-slate-800 text-white rounded flex items-center justify-center text-[10px] font-black">#{index + 1}</span>
                            <span className="text-xs font-black text-slate-600 uppercase tracking-wider">明细条目</span>
                          </div>
                          <Button type="link" danger size="small" onClick={() => fields.length > 1 ? remove(name) : toast.warning('请保留至少一项')} className="text-xs font-bold p-0">
                            移除该项
                          </Button>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-6 items-end">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
                            <Form.Item {...restField} name={[name, 'item_type']} label={<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">费用类型</span>} rules={[{ required: true, message: '!' }]} className="mb-0">
                              <Select placeholder="请选择" className="h-10">
                                {expenseTypes.map(t => <Select.Option key={t.id} value={t.name}>{t.name}</Select.Option>)}
                              </Select>
                            </Form.Item>
                            
                            <Form.Item {...restField} name={[name, 'amount']} label={<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">报销金额</span>} rules={[{ required: true, message: '!' }]} className="mb-0">
                              <InputNumber prefix="¥" controls={false} className="h-10 w-full font-black text-indigo-600" min={0.01} precision={2} placeholder="0.00" />
                            </Form.Item>
                            
                            <Form.Item {...restField} name={[name, 'expense_date']} label={<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">产生日期</span>} className="mb-0">
                              <DatePicker className="h-10 w-full" />
                            </Form.Item>
                            
                            <Form.Item {...restField} name={[name, 'description']} label={<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">用途备注</span>} className="mb-0">
                              <Input className="h-10" placeholder="说明用途..." />
                            </Form.Item>
                          </div>

                          <div className="shrink-0 flex items-center pb-[1px]">
                            <Form.Item {...restField} name={[name, 'attachment_url']} className="mb-0">
                              <InvoiceUploader />
                            </Form.Item>
                          </div>
                        </div>
                      </Card>
                    ))}
                    <Button 
                      type="dashed" 
                      block 
                      onClick={() => add()} 
                      icon={<Plus size={16} />} 
                      className="h-14 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 font-black text-sm hover:border-indigo-500 hover:text-indigo-600 bg-white/50"
                    >
                      新增一笔费用明细项
                    </Button>
                  </div>
                )}
              </Form.List>
              
              <div className="pb-24"></div>
            </div>
          </div>

          {/* 底部固定栏 */}
          <div className="shrink-0 bg-white border-t border-slate-200 px-8 py-4 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.04)] z-20">
            <div className="flex items-center gap-4">
              <AlertCircle className="text-amber-500" size={18} />
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">请仔细核对填报金额与发票附件后再行提交</span>
            </div>
            
            <Space size="middle">
              <Button size="large" icon={<Save size={16} />} onClick={(e) => { e.preventDefault(); handleFinalSubmit(true); }} loading={saving} className="h-11 px-6 rounded-lg font-bold border-slate-300 text-slate-600 text-sm">存为草稿</Button>
              <Button type="primary" size="large" icon={<Send size={16} />} loading={submitting} onClick={(e) => { e.preventDefault(); handleFinalSubmit(false); }} className="h-11 px-12 rounded-lg bg-indigo-600 border-none font-black text-sm shadow-xl shadow-indigo-100">正式提交报销申请</Button>
            </Space>
          </div>

        </div>
      </Form>

      <style>{`
        .ant-form-item-label label { color: #64748b !important; font-weight: 900 !important; font-size: 11px !important; margin-bottom: 2px !important; }
        
        .ant-select-selector, 
        .ant-input, 
        .ant-input-number, 
        .ant-input-number-affix-wrapper,
        .ant-picker { 
          border-radius: 6px !important; 
          border: 1.5px solid #cbd5e1 !important; 
          background: #fff !important; 
          height: 40px !important; 
          display: flex !important; 
          align-items: center !important; 
          box-shadow: none !important;
          font-size: 13px !important;
        }

        .ant-input-number-affix-wrapper .ant-input-number { border: none !important; background: transparent !important; box-shadow: none !important; height: 100% !important; width: 100% !important; }
        .ant-input-number-input { font-weight: 900 !important; font-size: 15px !important; height: 38px !important; padding-left: 4px !important; }
        
        .ant-select-selection-item { font-weight: 700 !important; }
        
        .ant-select-focused .ant-select-selector, .ant-input:focus, .ant-input-number-affix-wrapper-focused, .ant-picker-focused { 
          border-color: #4f46e5 !important; border-width: 2px !important; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.08) !important; 
        }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default ReimbursementApply;
