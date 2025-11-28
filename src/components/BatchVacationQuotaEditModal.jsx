import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, message, Spin, Alert, Radio, Space } from 'antd';
import { getApiBaseUrl } from '../utils/apiConfig';

const BatchVacationQuotaEditModal = ({ visible, onClose, employees = [], year, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [types, setTypes] = useState([]);
  const [mode, setMode] = useState('overwrite'); // 'overwrite' or 'add'
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      loadTypes();
      form.resetFields();
    }
  }, [visible]);

  const loadTypes = async () => {
    try {
      const token = localStorage.getItem('token');
      const typesRes = await fetch(`${getApiBaseUrl()}/vacation-types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const typesData = await typesRes.json();

      if (typesData.success) {
        const activeTypes = typesData.data.filter(t => t.enabled);
        setTypes(activeTypes);
      }
    } catch (error) {
      message.error('加载假期类型失败');
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const token = localStorage.getItem('token');
      const quotas = Object.keys(values).map(key => ({
        type: key,
        days: values[key]
      })).filter(q => q.days !== undefined && q.days !== null);

      if (quotas.length === 0) {
        message.warning('请至少输入一项额度');
        setLoading(false);
        return;
      }

      // Process each employee sequentially (or parallel)
      // For better UX, we should probably have a batch API, but frontend loop is fine for small batches
      let successCount = 0;
      let failCount = 0;

      for (const employee of employees) {
        try {
          // If mode is 'add', we need to fetch current balance first?
          // The current API is PUT /balance/:id which sets the total.
          // So 'add' mode would require fetching first.
          // For now, let's stick to 'overwrite' as implemented in the single edit modal logic
          // But wait, the single edit modal logic (VacationQuotaEditModal) does a PUT with { quotas }.
          // The backend `vacation-optimization.js` -> `updateVacationBalance` uses `balance[field] = days`.
          // So it is an overwrite of the TOTAL quota.

          // If we want to support 'add', we need to know the current.
          // Let's just support 'overwrite' for now to be safe and consistent.

          const response = await fetch(`${getApiBaseUrl()}/vacation/balance/${employee.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              year,
              quotas
            })
          });

          const result = await response.json();
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (e) {
          failCount++;
        }
      }

      if (failCount === 0) {
        message.success(`成功更新 ${successCount} 位员工的额度`);
        onSuccess();
        onClose();
      } else {
        message.warning(`更新完成: ${successCount} 成功, ${failCount} 失败`);
        onSuccess(); // Still reload data
        onClose();
      }

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const supportedTypes = ['annual_leave', 'sick_leave', 'overtime_leave'];

  const leaveTypeNames = {
    'annual_leave': '年假',
    'sick_leave': '病假',
    'overtime_leave': '加班假'
  };

  return (
    <Modal
      title={`批量编辑假期额度 - 已选 ${employees.length} 人 (${year}年)`}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      width={600}
    >
      <Spin spinning={loading}>
        <Alert
          message="批量操作警告"
          description="此操作将直接覆盖所选员工的假期总额度。请谨慎操作。"
          type="warning"
          showIcon
          className="mb-6"
        />

        <Form
          form={form}
          layout="horizontal"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
        >
          {types.filter(t => supportedTypes.includes(t.code)).map(type => (
            <Form.Item
              key={type.id}
              name={type.code}
              label={type.name}
            >
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber
                  min={0}
                  precision={1}
                  placeholder="保持不变"
                  style={{ width: '100%' }}
                />
                <Input defaultValue="天" readOnly={true} disabled={true} />
              </Space.Compact>
            </Form.Item>
          ))}

          <div className="text-gray-400 text-xs text-center mt-2">
            注：留空则不修改该类型的额度
          </div>
        </Form>
      </Spin>
    </Modal>
  );
};

export default BatchVacationQuotaEditModal;
