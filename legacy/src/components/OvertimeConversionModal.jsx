import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, Button, Alert, Statistic, Row, Col, Descriptions, ConfigProvider } from 'antd';
import { SwapOutlined, CalculatorOutlined } from '@ant-design/icons';
import { Zap, Calculator, Info, ShieldAlert, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api';

const OvertimeConversionModal = ({ visible, onClose, onSuccess, employeeId, overtimeHours }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [activeRule, setActiveRule] = useState(null);
  const [calculationResult, setCalculationResult] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) setUser(JSON.parse(userStr));
  }, []);

  useEffect(() => {
    if (visible) loadActiveRule();
  }, [visible]);

  const loadActiveRule = async () => {
    try {
      const response = await api.get('/conversion-rules', { params: { source_type: 'overtime', enabled: true } });
      if (response.data.success && response.data.data.length > 0) {
        const rule = response.data.data[0];
        setActiveRule(rule);
        if (overtimeHours) {
          form.setFieldsValue({ overtime_hours: overtimeHours });
          handleCalculate(overtimeHours, rule);
        }
      } else {
        toast.error('未找到启用的转换规则');
      }
    } catch (error) { toast.error('加载转换规则失败'); }
  };

  const handleCalculate = (hours, rule) => {
    if (!rule) rule = activeRule;
    if (!rule || !hours) return;
    const ratio = parseFloat(rule.ratio || rule.conversion_rate || 0.125);
    const hoursPerDay = Math.round(1 / ratio);
    const totalHours = parseFloat(hours);
    const wholeDays = Math.floor(totalHours / hoursPerDay);
    const hoursToConvert = wholeDays * hoursPerDay;
    const remainderHours = totalHours - hoursToConvert;

    setCalculationResult({
      converted_days: wholeDays,
      conversion_ratio: ratio,
      source_hours: hoursToConvert,
      decimal_remainder: remainderHours,
      rule_name: rule.name || '默认转换规则',
      hours_per_day: hoursPerDay
    });
  };

  const handleSubmit = async () => {
    if (!calculationResult) return toast.error('请先计算转换结果');
    
    Modal.confirm({
      title: <span className="font-black text-slate-900">确认假务转换</span>,
      icon: <Zap className="text-amber-500 mr-2 inline" size={20}/>,
      content: (
        <div className="py-4">
          <p className="text-sm font-bold text-slate-600">确定要将 <span className="text-indigo-600 font-black">{calculationResult.source_hours} 小时</span> 加班时长转换为 <span className="text-emerald-600 font-black">{calculationResult.converted_days} 天</span> 假期吗?</p>
          {calculationResult.decimal_remainder > 0 && (
            <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
              <ShieldAlert size={14} className="text-amber-600 mt-0.5" />
              <p className="text-[11px] font-bold text-amber-700 m-0 leading-relaxed">
                剩余 <span className="font-black">{calculationResult.decimal_remainder.toFixed(1)} 小时</span> 将保留在账户中。
              </p>
            </div>
          )}
        </div>
      ),
      okText: '确认固化',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        setLoading(true);
        try {
          const response = await api.post('/vacation/convert-from-overtime', {
            employee_id: employeeId,
            user_id: user?.id,
            overtime_hours: calculationResult.source_hours,
            notes: calculationResult.decimal_remainder > 0
              ? `加班时长物理转换（原始: ${overtimeHours}h，保留: ${calculationResult.decimal_remainder.toFixed(1)}h）`
              : '加班时长物理转换'
          });

          if (response.data.success) {
            toast.success('假务资产转换成功');
            form.resetFields();
            setCalculationResult(null);
            onSuccess?.();
            onClose();
          }
        } catch (error) { toast.error('转换操作失败'); }
        finally { setLoading(false); }
      }
    });
  };

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 12 }
    }}>
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={520}
      centered
      closable={false}
      styles={{ 
          body: { padding: 0, overflowX: 'hidden', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(30px)' },
          mask: { backdropFilter: 'blur(4px)', background: 'rgba(0, 0, 0, 0.1)' }
      }}
    >
      <div className="flex flex-col">
        {/* 头部 */}
        <div className="px-8 py-6 border-b border-white/20 bg-white/40 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-100">
                    <RefreshCw size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">加班时长核销转换</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">权益资产物理转换审计</p>
                </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100/50 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><X size={18}/></button>
        </div>

        <div className="p-8 space-y-6">
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-start gap-3">
                <Info size={16} className="text-blue-500 mt-0.5" />
                <p className="text-[11px] font-bold text-blue-700 leading-relaxed m-0">
                    将积攒的加班时长转换为通用假期天数。转换后可用于请假抵扣，转换记录将永久存档。
                </p>
            </div>

            {activeRule && (
                <div className="p-4 bg-slate-900 rounded-2xl text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Calculator size={48} /></div>
                    <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <ShieldAlert size={10}/> 当前执行规则：{activeRule.name}
                    </div>
                    <div className="text-sm font-black">
                        1 标准工作天 = <span className="text-amber-400 text-lg mx-1">{calculationResult?.hours_per_day || 8}</span> 小时加班时长
                    </div>
                </div>
            )}

            <Form form={form} layout="vertical" initialValues={{ overtime_hours: overtimeHours || 0 }}>
                <Form.Item label={<span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">可转换时长 (h)</span>} name="overtime_hours">
                    <InputNumber disabled className="w-full h-11 rounded-xl font-black text-lg border-slate-200 bg-slate-50 flex items-center" addonAfter="Hours" />
                </Form.Item>

                {calculationResult && (
                    <div className="p-6 bg-white/50 border border-white rounded-2xl shadow-inner space-y-4 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">拟转换天数</div>
                                <div className="text-2xl font-black text-indigo-600">{calculationResult.converted_days} <span className="text-xs">天</span></div>
                            </div>
                            <div className="text-right">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">转换基数</div>
                                <div className="text-lg font-black text-slate-700">{calculationResult.source_hours}h</div>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-white/60 flex items-center gap-2 text-[10px] font-bold text-slate-400">
                            <Calculator size={12}/> 运算逻辑：{calculationResult.source_hours}h ÷ {calculationResult.hours_per_day}h = {calculationResult.converted_days}天
                        </div>
                    </div>
                )}
            </Form>

            <div className="flex gap-3 pt-2">
                <Button block className="h-11 rounded-xl font-black text-xs border-slate-200 text-slate-500" onClick={onClose}>放弃返回</Button>
                <Button block type="primary" className="h-11 rounded-xl font-black text-xs bg-slate-900 border-none shadow-lg shadow-slate-200" onClick={handleSubmit} disabled={!calculationResult} loading={loading}>物理固化转换</Button>
            </div>
        </div>
      </div>
    </Modal>
    </ConfigProvider>
  );
};

export default OvertimeConversionModal;
