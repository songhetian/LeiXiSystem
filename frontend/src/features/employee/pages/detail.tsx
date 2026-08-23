'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Message,
  Descriptions,
  Button,
  Space,
  Card,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  Divider,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { employeeApi, Employee } from '@/services/employee';
import { systemApi, SysDepartment, SysPosition } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import useFetchState from '@/hooks/use-fetch-state';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '在职', color: 'green' },
  inactive: { label: '待入职', color: 'orange' },
  resigned: { label: '已离职', color: 'red' },
};

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { can } = usePermission();
  const { data: employee, loading, error, run: runFetch, setData: setEmployee } = useFetchState<Employee>();

  const [editVisible, setEditVisible] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<SysDepartment[]>([]);
  const [positions, setPositions] = useState<SysPosition[]>([]);

  const [resignVisible, setResignVisible] = useState(false);
  const [resignForm] = Form.useForm();
  const [resigning, setResigning] = useState(false);

  const id = Number(params?.id);

  const fetchData = async () => {
    if (!id) return;
    await runFetch(async () => {
      const res = await employeeApi.getById(id);
      if (res.code === 0 && res.data) {
        return res.data;
      }
      throw new Error(res.message || '获取员工信息失败');
    });
  };

  const fetchDepartments = async () => {
    try {
      const res = await systemApi.listDepartments();
      if (res.code === 0 && res.data) setDepartments(res.data);
    } catch (e) {}
  };

  const fetchPositions = async () => {
    try {
      const res = await systemApi.listPositions();
      if (res.code === 0 && res.data) setPositions(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
    fetchDepartments();
    fetchPositions();
  }, [id]);

  const openEdit = () => {
    if (!employee) return;
    form.setFieldsValue({
      name: employee.name,
      departmentId: employee.departmentId,
      positionId: employee.positionId,
      hireDate: employee.hireDate,
      phone: employee.phone,
      salary: Number(employee.salary),
    });
    setEditVisible(true);
  };

  const handleSave = async () => {
    const values = await form.validate();
    setSaving(true);
    try {
      const res = await employeeApi.update(id, {
        ...values,
        salary: values.salary?.toString(),
      });
      if (res.code === 0) {
        Message.success('保存成功');
        setEditVisible(false);
        fetchData();
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e) {
      Message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleResign = async () => {
    const values = await resignForm.validate();
    setResigning(true);
    try {
      const res = await employeeApi.resign(id, values);
      if (res.code === 0) {
        Message.success('已办理离职');
        setResignVisible(false);
        fetchData();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setResigning(false);
    }
  };

  const statusInfo = employee ? STATUS_MAP[employee.status] || STATUS_MAP.active : STATUS_MAP.active;

  return (
    <PageContainer title="员工详情">
      <Card className="rounded-md">
        <DataState loading={loading} error={error} onRetry={fetchData} isEmpty={!employee}>
          {employee && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Space size="medium">
                <h2 style={{ margin: 0 }}>{employee.name}</h2>
                <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
              </Space>
              <Space>
                <Button onClick={openEdit}>编辑</Button>
                {employee.status === 'active' && (
                  <Button status="warning" onClick={() => setResignVisible(true)}>
                    办理离职
                  </Button>
                )}
              </Space>
            </div>

            <Divider />

            <Descriptions
              column={2}
              title="基本信息"
              data={[
                { label: '工号', value: employee.employeeNo },
                { label: '手机号', value: employee.phone || '-' },
                { label: '部门', value: employee.departmentName || employee.department?.name || '-' },
                { label: '岗位', value: employee.positionName || employee.position?.name || '-' },
                { label: '入职日期', value: employee.hireDate },
                { label: '离职日期', value: employee.resignDate || '-' },
                { label: '薪资', value: `¥${employee.salary}` },
                { label: '创建时间', value: employee.createdAt || '-' },
              ]}
            />
          </>
        )}
        </DataState>
      </Card>

      <Modal
        title="编辑员工"
        visible={editVisible}
        onOk={handleSave}
        onCancel={() => setEditVisible(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="姓名" field="name" rules={[{ required: true }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item label="部门" field="departmentId" rules={[{ required: true }]}>
            <Select
              placeholder="请选择部门"
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
            />
          </Form.Item>
          <Form.Item label="岗位" field="positionId">
            <Select
              placeholder="请选择岗位"
              allowClear
              options={positions.map((p) => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>
          <Form.Item label="入职日期" field="hireDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="手机号" field="phone">
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item label="薪资" field="salary">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="办理离职"
        visible={resignVisible}
        onOk={handleResign}
        onCancel={() => setResignVisible(false)}
        confirmLoading={resigning}
        okText="确认"
        cancelText="取消"
      >
        <Form form={resignForm} layout="vertical">
          <Form.Item label="离职日期" field="resignDate">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="离职原因" field="reason">
            <Input.TextArea rows={3} placeholder="请输入离职原因" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
