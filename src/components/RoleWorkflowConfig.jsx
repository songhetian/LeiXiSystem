/**
 * 审批职责授权页面 (极致紧凑商务版)
 * 
 * 核心标准遵循：
 * 1. UI 标准：44px 物理缝合搜索栏，边框锁定为 slate-500 (#64748b)。
 * 2. 视觉进化：采用极致紧凑的高级感表格模式，全量居中对齐。
 * 3. 业务逻辑：未指定时默认指向“系统默认报销流程”。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Select, 
  Space, 
  Input, 
  Typography,
  Avatar,
  Divider,
  Badge,
  Tooltip
} from 'antd';
import { 
  TeamOutlined, 
  SearchOutlined,
  ReloadOutlined,
  SyncOutlined,
  CheckCircleFilled,
  InfoCircleOutlined
} from '@ant-design/icons';
import { toast } from 'sonner';
import api from '../api';

const { Text } = Typography;
const { Option } = Select;

const RoleWorkflowConfig = () => {
  const [roles, setRoles] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, workflowsRes] = await Promise.all([
        api.get('/approvers/roles/workflows'),
        api.get('/approval-workflow', { params: { type: 'reimbursement' } })
      ]);
      
      if (rolesRes.data.success) setRoles(rolesRes.data.data);
      if (workflowsRes.data.success) setWorkflows(workflowsRes.data.data);
    } catch (error) {
      console.error('获取数据失败:', error);
      toast.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkflowChange = async (roleId, workflowId) => {
    setUpdatingId(roleId);
    try {
      const response = await api.put(`/approvers/roles/${roleId}/workflow`, {
        role_id: roleId,
        workflow_id: workflowId || null
      });

      if (response.data.success) {
        toast.success('授权已即时生效');
        setRoles(roles.map(r => r.id === roleId ? { ...r, workflow_id: workflowId } : r));
      } else {
        toast.error(response.data.message || '保存失败');
      }
    } catch (error) {
      toast.error('同步失败');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredRoles = useMemo(() => {
    return roles.filter(role => 
      role.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [roles, searchTerm]);

  const columns = [
    {
      title: '职权角色名称',
      dataIndex: 'name',
      key: 'name',
      align: 'center',
      render: (text) => (
        <Space size="middle">
          <Avatar size={24} className="bg-slate-100 text-slate-600 text-[10px] font-bold" icon={<TeamOutlined />} />
          <span className="font-black text-slate-800 text-sm">{text}</span>
        </Space>
      )
    },
    {
      title: '绑定审批流程',
      key: 'workflow',
      align: 'center',
      width: 320,
      render: (_, record) => (
        <div className="flex items-center justify-center gap-3">
          <Select
            className="w-56 text-xs font-bold"
            value={record.workflow_id || ''}
            onChange={(val) => handleWorkflowChange(record.id, val || null)}
            loading={updatingId === record.id}
            variant="borderless"
            style={{ borderBottom: '1px solid #e2e8f0', borderRadius: 0 }}
          >
            <Option value="">
              <span className="text-slate-400 italic">系统默认报销流程</span>
            </Option>
            {workflows.map(wf => (
              <Option key={wf.id} value={wf.id}>
                {wf.name} {wf.is_default ? '(默认)' : ''}
              </Option>
            ))}
          </Select>
          {record.workflow_id ? (
            <CheckCircleFilled className="text-emerald-500" />
          ) : (
            <SyncOutlined className="text-slate-300" />
          )}
        </div>
      )
    },
    {
      title: '授权状态',
      key: 'status',
      align: 'center',
      width: 150,
      render: (_, record) => (
        record.workflow_id ? (
          <Tag color="black" className="rounded-full border-none px-3 py-0.5 text-[10px] font-black">专项授权</Tag>
        ) : (
          <Tag className="rounded-full border-slate-200 text-slate-400 px-3 py-0.5 text-[10px] font-bold">默认跟随</Tag>
        )
      )
    }
  ];

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50/50">
      {/* 顶部标题 */}
      <div className="max-w-[1400px] mx-auto mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-black !m-0">审批职责授权</h1>
          <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest font-bold">Role-Based Workflow Assignment</p>
        </div>
        <Button 
          type="primary" 
          onClick={fetchData} 
          icon={<ReloadOutlined className={loading ? 'animate-spin' : ''} />}
          className="bg-black hover:bg-slate-800 border-none rounded-lg h-9 font-bold text-white px-6"
        >
          同步数据
        </Button>
      </div>

      {/* 雷犀标准搜索栏：44px、物理缝合、slate-500 边框 */}
      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex items-center bg-white rounded-xl overflow-hidden shadow-sm border border-[#64748b]">
          <div className="flex-1 flex items-center h-[44px] px-4">
            <SearchOutlined className="text-slate-400 mr-3" />
            <Input 
              placeholder="按角色名称检索授权记录..." 
              variant="borderless"
              className="h-full text-sm font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              allowClear
            />
          </div>
          <Divider type="vertical" className="h-6 border-slate-200 m-0" />
          <div className="w-64 flex items-center h-[44px] px-4 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase mr-3 shrink-0">授权类型</span>
            <Select 
              defaultValue="all" 
              variant="borderless"
              className="w-full text-xs font-bold text-slate-700"
              options={[{ value: 'all', label: '显示全部角色' }, { value: 'assigned', label: '仅看专项授权' }]}
            />
          </div>
        </div>
      </div>

      {/* 高级感紧凑表格 */}
      <div className="max-w-[1400px] mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <InfoCircleOutlined className="text-indigo-600" />
            <Text type="secondary" className="text-[11px] font-black uppercase tracking-wider">
              说明：未进行“专项授权”的角色，在发起报销时将自动适配系统设定的通用默认流程。
            </Text>
          </div>
          <Table 
            columns={columns} 
            dataSource={filteredRoles} 
            rowKey="id" 
            loading={loading} 
            pagination={{
              pageSize: 15,
              size: 'small',
              showTotal: (total) => `共 ${total} 个角色权限模型`,
              className: "px-6 py-4"
            }}
            size="middle"
            className="custom-compact-table"
          />
        </div>
      </div>

      <style>{`
        .ant-table-thead > tr > th { 
          text-align: center !important; 
          background: #f8fafc !important; 
          color: #64748b !important; 
          font-weight: 900 !important; 
          font-size: 11px !important;
          padding: 14px !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .ant-table-tbody > tr > td { text-align: center !important; }
        .ant-btn-primary span { color: #ffffff !important; }
        .ant-select-selector { font-weight: 700 !important; }
      `}</style>
    </div>
  );
};

export default RoleWorkflowConfig;
