/**
 * 报销详情组件 (精简商务版)
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeftOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  EyeOutlined,
  PaperClipOutlined,
  CreditCardOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  HistoryOutlined,
  PaperClipOutlined as AttachmentIcon,
  LeftOutlined
} from '@ant-design/icons';
import { toast } from 'sonner';
import { 
  Button, 
  Tag, 
  Card, 
  Descriptions, 
  Table, 
  Timeline, 
  Empty, 
  Typography, 
  Divider,
  Space,
  Avatar,
  Tooltip,
  Tabs
} from 'antd';
import api from '../api';
import { getAttachmentUrl } from '../utils/fileUtils';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const TYPE_LABELS = {
  travel: '差旅费用',
  office: '办公费用',
  entertainment: '招待费用',
  training: '培训费用',
  other: '其他费用'
};

const STATUS_LABELS = {
  draft: '草稿',
  pending: '待审批',
  approving: '审批中',
  approved: '已通过',
  rejected: '已驳回',
  cancelled: '已撤销'
};

const STATUS_TAG_COLORS = {
  draft: 'default',
  pending: 'orange',
  approving: 'processing',
  approved: 'success',
  rejected: 'error',
  cancelled: 'default'
};

const ReimbursementDetail = ({ reimbursementId, onBack }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    if (reimbursementId) {
      fetchDetail();
    }
  }, [reimbursementId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/reimbursement/${reimbursementId}`);
      if (response.data.success) {
        setDetail(response.data.data);
      } else {
        toast.error('获取详情失败');
      }
    } catch (error) {
      console.error('获取报销详情失败:', error);
      toast.error('获取详情失败');
    } finally {
      setLoading(false);
    }
  };

  const previewAttachment = (file_url) => {
    const url = getAttachmentUrl(file_url);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('无法生成预览地址');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-screen">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-screen">
        <Empty description="报销单不存在" />
        <Button icon={<ArrowLeftOutlined />} onClick={onBack} className="mt-4">返回列表</Button>
      </div>
    );
  }

  const itemColumns = [
    {
      title: '费用类型',
      dataIndex: 'item_type',
      key: 'item_type',
      render: (text) => <Tag className="rounded-md px-3 bg-slate-50 border-slate-200">{text}</Tag>
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => (
        <span className="font-mono font-bold text-lg text-indigo-600">
          ¥{parseFloat(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      title: '发生日期',
      dataIndex: 'expense_date',
      key: 'expense_date',
      render: (date) => (
        <span className="text-slate-500">
          <CalendarOutlined className="mr-2" />
          {date ? dayjs(date).format('YYYY-MM-DD') : '-'}
        </span>
      )
    },
    {
      title: '用途说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => <Text type="secondary">{text || '-'}</Text>
    },
    {
      title: '单项凭证',
      dataIndex: 'attachment_url',
      key: 'attachment_url',
      align: 'center',
      render: (url) => url ? (
        <Tooltip title="查看对应发票">
          <Button 
            type="text" 
            icon={<PaperClipOutlined className="text-indigo-500" />} 
            onClick={() => previewAttachment(url)}
          />
        </Tooltip>
      ) : <Text type="disabled">-</Text>
    }
  ];

  const tabItems = [
    {
      key: 'summary',
      label: (
        <span className="flex items-center gap-2 px-2">
          <InfoCircleOutlined />
          详情总览
        </span>
      ),
      children: (
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-sm border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <Avatar icon={<InfoCircleOutlined />} className="bg-indigo-100 text-indigo-600" size="small" />
              <span className="text-base font-bold">基本信息</span>
            </div>
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small" className="custom-descriptions">
              <Descriptions.Item label="报销类型">{TYPE_LABELS[detail.type] || detail.type}</Descriptions.Item>
              <Descriptions.Item label="单据单号"><span className="font-mono text-xs">{detail.reimbursement_no}</span></Descriptions.Item>
              <Descriptions.Item label="审批流程">{detail.workflow_name || '自动匹配中'}</Descriptions.Item>
              <Descriptions.Item label="所属部门">{detail.department_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(detail.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              {detail.submitted_at && (
                <Descriptions.Item label="提交时间">{dayjs(detail.submitted_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              )}
            </Descriptions>
            {detail.remark && (
              <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <Text type="secondary" className="text-[10px] font-bold block mb-2 uppercase tracking-wider">事由/备注说明</Text>
                <Paragraph className="!mb-0 text-slate-700 text-sm leading-relaxed">{detail.remark}</Paragraph>
              </div>
            )}
          </Card>

          <Card className="rounded-2xl shadow-sm border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <Avatar icon={<AttachmentIcon />} className="bg-indigo-100 text-indigo-600" size="small" />
              <span className="text-base font-bold">证明材料</span>
            </div>
            {detail.attachments && detail.attachments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(detail?.attachments || []).map((att, index) => (
                  <div 
                    key={att?.id || index} 
                    className="group p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer flex items-center gap-3"
                    onClick={() => previewAttachment(att.file_url)}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${att.file_url?.toLowerCase().endsWith('pdf') ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                      {att.file_url?.toLowerCase().endsWith('pdf') ? <FilePdfOutlined /> : <FileImageOutlined />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Text className="block text-sm font-semibold truncate text-slate-700">{att.file_name}</Text>
                      <Text type="secondary" className="text-[10px] uppercase tracking-wider">点击预览</Text>
                    </div>
                    <EyeOutlined className="text-slate-300 group-hover:text-indigo-600 text-xs" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                暂无补充证明材料
              </div>
            )}
          </Card>
        </div>
      )
    },
    {
      key: 'items',
      label: (
        <span className="flex items-center gap-2 px-2">
          <CreditCardOutlined />
          费用清单
        </span>
      ),
      children: (
        <Card className="rounded-2xl shadow-sm border-slate-200 overflow-hidden" bodyStyle={{ padding: 0 }}>
          <Table 
            columns={itemColumns} 
            dataSource={detail?.items || []} 
            rowKey={(record, index) => record?.id || index}
            pagination={false}
            className="custom-table"
            size="middle"
          />
        </Card>
      )
    },
    {
      key: 'workflow',
      label: (
        <span className="flex items-center gap-2 px-2">
          <HistoryOutlined />
          流转记录
        </span>
      ),
      children: (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="rounded-2xl shadow-sm border-slate-200 min-h-[400px]">
              <div className="flex items-center gap-3 mb-8">
                <Avatar icon={<ClockCircleOutlined />} className="bg-indigo-100 text-indigo-600" size="small" />
                <span className="text-base font-bold">审批进度</span>
              </div>
              
              {detail.workflow?.history && detail.workflow.history.length > 0 ? (
                <Timeline 
                  className="custom-timeline mt-4"
                  items={detail.workflow.history.map((record, index) => ({
                    color: record.action === 'approve' ? 'green' : record.action === 'reject' ? 'red' : record.action === 'return' ? 'orange' : 'blue',
                    dot: record.action === 'approve' ? <CheckCircleOutlined className="text-base" /> : record.action === 'reject' ? <CloseCircleOutlined className="text-base" /> : record.action === 'return' ? <ClockCircleOutlined className="text-base" /> : <UserOutlined className="text-base" />,
                    children: (
                      <div className="pb-6">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-slate-800 text-sm">{record.approver_name}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            {dayjs(record.approved_at).format('MM-DD HH:mm')}
                          </span>
                        </div>
                        <div className="mb-2">
                          <Tag 
                            color={record.action === 'approve' ? 'success' : record.action === 'reject' ? 'error' : record.action === 'return' ? 'warning' : 'processing'}
                            className="rounded-md border-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          >
                            {record.action === 'approve' ? '审批通过' : record.action === 'reject' ? '驳回申请' : record.action === 'return' ? '退回修改' : '提交申请'}
                          </Tag>
                        </div>
                        {record.opinion && (
                          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-100 leading-relaxed italic">
                            " {record.opinion} "
                          </div>
                        )}
                      </div>
                    )
                  }))}
                />
              ) : (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                  <Empty description="暂无审批流转记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 text-xs">
                    该单据正在自动匹配审批链路...
                  </div>
                </div>
              )}
            </Card>
          </div>
          
          <div>
            <Card className="rounded-2xl shadow-sm border-slate-200 bg-white overflow-hidden relative border-l-4 border-l-indigo-500">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                    <HistoryOutlined className="text-indigo-600 text-sm" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">当前单据状态</span>
                </div>
                <div className="space-y-6">
                  <div>
                    <Tag color={STATUS_TAG_COLORS[detail.status]} className="px-4 py-1 rounded-lg border-0 text-sm font-black uppercase">
                      {STATUS_LABELS[detail.status]}
                    </Tag>
                  </div>
                  <Divider className="my-4" />
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">等待时长</div>
                      <div className="text-2xl font-black font-mono text-slate-800">
                        {dayjs().diff(dayjs(detail.submitted_at || detail.created_at), 'day')} 
                        <span className="text-xs font-normal text-slate-400 ml-1">Days</span>
                      </div>
                    </div>
                    <ClockCircleOutlined className="text-slate-100 text-4xl mb-1" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="w-full p-4 md:p-6 lg:p-8 bg-slate-50/30 min-h-screen">
      {/* 顶部操作固定栏 */}
      <div className="max-w-[1400px] mx-auto mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            type="link" 
            icon={<LeftOutlined />} 
            onClick={onBack} 
            className="flex items-center text-slate-500 hover:text-indigo-600 font-bold p-0"
          >
            返回上一层
          </Button>
          <Divider type="vertical" className="h-4 border-slate-300" />
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-slate-800">报销单详情</span>
            <Tag color={STATUS_TAG_COLORS[detail.status]} className="m-0 px-2 py-0 border-0 rounded text-[10px] font-bold">
              {STATUS_LABELS[detail.status]}
            </Tag>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">报销总额</div>
          <div className="text-2xl font-black text-indigo-600 font-mono">
            ¥{parseFloat(detail.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          className="custom-tabs"
          items={tabItems}
          size="large"
        />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-descriptions .ant-descriptions-item-label {
          background-color: #f8fafc !important;
          font-weight: 600 !important;
          color: #64748b !important;
          width: 120px;
          font-size: 13px;
        }
        .custom-descriptions .ant-descriptions-item-content {
          color: #1e293b !important;
          font-weight: 500 !important;
          font-size: 13px;
        }
        .custom-table .ant-table-thead > tr > th {
          background-color: #f8fafc !important;
          color: #64748b !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
        }
        .custom-timeline .ant-timeline-item-tail {
          border-left: 2px dashed #e2e8f0 !important;
        }
        .custom-tabs .ant-tabs-nav {
          margin-bottom: 20px !important;
          background: white;
          padding: 4px 16px 0;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }
        .custom-tabs .ant-tabs-tab {
          padding: 10px 16px !important;
          font-weight: 600 !important;
          font-size: 14px;
          transition: all 0.3s !important;
        }
        .custom-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #4f46e5 !important;
        }
        .custom-tabs .ant-tabs-ink-bar {
          background: #4f46e5 !important;
          height: 3px !important;
          border-radius: 3px 3px 0 0;
        }
      `}} />
    </div>
  );
};

export default ReimbursementDetail;
