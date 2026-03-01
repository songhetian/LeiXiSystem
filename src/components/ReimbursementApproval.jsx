/**
 * 报销审批组件
 *
 * 功能：
 * - 列表展示待审批申请（Table模式）
 * - 搜索筛选（部门、时间、姓名、状态）
 * - 审批操作（通过/驳回/退回）
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Modal,
  Tooltip,
  Typography
} from 'antd';
import { toast } from 'sonner';
import api from '../api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const TYPE_LABELS = {
  travel: '差旅费用',
  office: '办公费用',
  entertainment: '招待费用',
  training: '培训费用',
  other: '其他费用'
};

const ReimbursementApproval = ({ user, onViewDetail }) => {
  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(null);
  const [opinion, setOpinion] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);
  const [currentRecord, setCurrentRecord] = useState(null);

  // 筛选状态
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    department_id: undefined,
    dateRange: null,
    keyword: '',
    status: 'approving'
  });

  // 获取部门列表
  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments', { params: { forManagement: true } });
      if (Array.isArray(response.data)) {
        setDepartments(response.data);
      }
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  };

  // 获取列表数据
  const fetchPendingList = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { department_id, keyword, status, dateRange } = filters;
      const params = {
        user_id: user?.id,
        department_id,
        keyword,
        status,
        start_date: dateRange?.[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : undefined,
        end_date: dateRange?.[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : undefined
      };

      const response = await api.get('/reimbursement/pending', { params });
      if (response.data.success) {
        setPendingList(response.data.data);
      }
    } catch (error) {
      console.error('获取审批列表失败:', error);
      toast.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [user?.id, filters]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchPendingList();
  }, [user?.id, filters.status]); // 状态改变时自动刷新

  // 处理审批
  const handleApproval = async () => {
    if (!currentRecord || !currentAction) return;
    if (currentAction !== 'approve' && !opinion.trim()) {
      toast.error('请填写意见原因');
      return;
    }

    setApproving(currentRecord.id);
    try {
      const response = await api.post(`/reimbursement/${currentRecord.id}/approval`, {
        approver_id: user?.id,
        action: currentAction,
        opinion
      });

      if (response.data.success) {
        toast.success('处理成功');
        setShowModal(false);
        fetchPendingList();
      } else {
        toast.error(response.data.message || '操作失败');
      }
    } catch (error) {
      console.error('审批操作失败:', error);
      toast.error('操作失败');
    } finally {
      setApproving(null);
    }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      align: 'center',
      ellipsis: true,
      render: (text) => <strong>{text}</strong>
    },
    {
      title: '申请人',
      key: 'applicant',
      align: 'center',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.applicant_name}</span>
          <Tag color="blue" style={{ fontSize: 10, margin: 0, border: 0 }}>{record.department_name}</Tag>
        </Space>
      )
    },
    {
      title: '报销类型',
      dataIndex: 'type',
      key: 'type',
      align: 'center',
      render: (type) => <Tag>{TYPE_LABELS[type] || type}</Tag>
    },
    {
      title: '金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'center',
      render: (amount) => (
        <span className="reimbursement-amount">
          ¥{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      align: 'center',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '当前节点',
      dataIndex: 'current_node_name',
      key: 'current_node_name',
      align: 'center',
      render: (name) => <Tag color="purple">{name || '流程处理中'}</Tag>
    },
        {
          title: '操作',
          key: 'action',
          align: 'center',
          width: 280,
          fixed: 'right',
          render: (_, record) => {
            return (
              <Space size="small">
                <Tooltip title="查看详情">
                  <Button 
                    type="text" 
                    icon={<EyeOutlined style={{ color: '#1890ff' }} />} 
                    onClick={() => onViewDetail?.(record)} 
                  />
                </Tooltip>
                {/* 只有当单据当前需要我审批时，才显示操作按钮 */}
                {record.is_approvable ? (
                  <>
                    <Button 
                      size="small"
                      className="btn-custom btn-success"
                      onClick={() => {
                        setCurrentRecord(record);
                        setCurrentAction('approve');
                        setOpinion('');
                        setShowModal(true);
                      }}
                    >
                      通过
                    </Button>
                    <Button 
                      size="small"
                      className="btn-custom btn-danger"
                      onClick={() => {
                        setCurrentRecord(record);
                        setCurrentAction('reject');
                        setOpinion('');
                        setShowModal(true);
                      }}
                    >
                      驳回
                    </Button>
                    <Button 
                      size="small"
                      className="btn-custom btn-warning"
                      onClick={() => {
                        setCurrentRecord(record);
                        setCurrentAction('return');
                        setOpinion('');
                        setShowModal(true);
                      }}
                    >
                      退回
                    </Button>
                  </>
                ) : null}
              </Space>
            );
          }
        }  ];

  return (
    <div className="reimbursement-approval" style={{ padding: 24 }}>
      <style>{`
        /* 彻底修复 AntD 按钮背景变黑问题 */
        .reimbursement-approval .btn-custom {
          color: white !important;
          border: none !important;
          font-weight: 500 !important;
          box-shadow: 0 2px 0 rgba(0,0,0,0.045) !important;
        }

        .reimbursement-approval .btn-success { background-color: #52c41a !important; }
        .reimbursement-approval .btn-success:hover { background-color: #73d13d !important; }

        .reimbursement-approval .btn-danger { background-color: #ff4d4f !important; }
        .reimbursement-approval .btn-danger:hover { background-color: #ff7875 !important; }

        .reimbursement-approval .btn-warning { background-color: #faad14 !important; }
        .reimbursement-approval .btn-warning:hover { background-color: #ffc53d !important; }

        .reimbursement-approval .btn-search-primary {
          background-color: #1890ff !important;
          border-color: #1890ff !important;
        }
        .reimbursement-approval .btn-search-primary:hover {
          background-color: #40a9ff !important;
        }

        .reimbursement-amount {
          color: #111827;
          font-weight: 700;
          font-size: 16px;
          font-family: 'Consolas', monospace;
        }

        /* 隐藏 AntD 按钮自带的描边阴影，防止黑色残留 */
        .reimbursement-approval .ant-btn-primary::after { display: none !important; }
      `}</style>

      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>报销审批中心</h1>
          <p style={{ color: '#888', marginTop: 4 }}>高效处理待办申请，保障业务流转</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchPendingList}>刷新列表</Button>
      </div>

      {/* 搜索工具栏 */}
      <div style={{ background: 'white', padding: '24px', borderRadius: 16, marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <Space wrap size="middle" align="end">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>单据状态</label>
            <Select
              value={filters.status}
              style={{ width: 140 }}
              onChange={val => setFilters(prev => ({ ...prev, status: val }))}
              options={[
                { value: 'approving', label: '待我审批' },
                { value: 'approved', label: '已通过' },
                { value: 'rejected', label: '已驳回' },
                { value: 'all', label: '全部单据' }
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>申请部门</label>
            <Select
              placeholder="选择部门"
              allowClear
              style={{ width: 180 }}
              value={filters.department_id}
              onChange={val => setFilters(prev => ({ ...prev, department_id: val }))}
              options={(departments || []).map(d => ({ value: d?.id, label: d?.name }))}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>申请时间</label>
            <RangePicker
              style={{ width: 260 }}
              value={filters.dateRange}
              onChange={dates => setFilters(prev => ({ ...prev, dateRange: dates }))}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>关键词</label>
            <Input
              placeholder="姓名 / 单号 / 标题"
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              style={{ width: 220 }}
              value={filters.keyword}
              onChange={e => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
              onPressEnter={fetchPendingList}
              allowClear
            />
          </div>

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={fetchPendingList}
            className="btn-custom btn-search-primary"
            style={{
              height: 38,
              padding: '0 24px',
              borderRadius: 8,
              backgroundColor: '#1890ff',
              borderColor: '#1890ff'
            }}
          >
            查询
          </Button>
        </Space>
      </div>

      <div style={{ background: 'white', borderRadius: 16, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <Table
          columns={columns}
          dataSource={pendingList}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条数据`
          }}
        />
      </div>

      {/* 审批弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
            {currentAction === 'approve' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
             currentAction === 'reject' ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> :
             <RollbackOutlined style={{ color: '#faad14' }} />}
            <span>{currentAction === 'approve' ? '通过审批' : currentAction === 'reject' ? '驳回申请' : '退回修改'}</span>
          </div>
        }
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleApproval}
        confirmLoading={!!approving}
        width={500}
        okText="确定处理"
        cancelText="取消"
        centered
        okButtonProps={{
          className: `btn-custom ${currentAction === 'approve' ? 'btn-success' : currentAction === 'reject' ? 'btn-danger' : 'btn-warning'}`
        }}
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 20, padding: '16px', background: '#f9fafb', borderRadius: 12, border: '1px solid #f3f4f6' }}>
            <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>正在审批单据：</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{currentRecord?.title}</div>
            <div style={{ color: '#667eea', fontSize: 13, marginTop: 4, fontFamily: 'monospace' }}>{currentRecord?.reimbursement_no}</div>
          </div>

          <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#374151' }}>
            审批意见 {currentAction !== 'approve' && <span style={{ color: '#ff4d4f' }}>(必填)</span>}
          </div>

          <Input.TextArea
            rows={4}
            placeholder={currentAction === 'approve' ? '请输入审批意见（选填）' : '请输入驳回/退回的原因（必填）'}
            value={opinion}
            onChange={e => setOpinion(e.target.value)}
            style={{ borderRadius: 10 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default ReimbursementApproval;
