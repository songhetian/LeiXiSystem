/**
 * 报销详情组件 (雷犀 2.0 旗舰平衡版)
 * 
 * 核心设计：
 * 1. 结构回归：左侧毛玻璃侧边栏 + 右侧主内容流，恢复直观视觉。
 * 2. 交互进化：备注列单元格(td)全域可点击，弹出极简纯文字浮层。
 * 3. 视觉纠偏：圆角严格控制在 12px，移除冗余装饰，保持干练。
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  LayoutOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  PaperClipOutlined
} from '@ant-design/icons';
import { toast } from 'sonner';
import { 
  Button, Tag, Table, Timeline, Empty, Typography, Divider, Space, Image, Spin, Modal
} from 'antd';
import api from '../api';
import { getAttachmentUrl } from '../utils/fileUtils';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

const TYPE_LABELS = { travel: '差旅费用', office: '办公费用', entertainment: '招待费用', training: '培训费用', other: '其他费用' };
const STATUS_LABELS = { draft: '草案', pending: '待审批', approving: '审批中', approved: '已通过', rejected: '已驳回', cancelled: '已撤销' };

const ReimbursementDetail = ({ reimbursementId, onBack }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNoteModal, setShowNoteModal] = useState({ open: false, content: '' });

  useEffect(() => { if (reimbursementId) fetchDetail(); }, [reimbursementId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/reimbursement/${reimbursementId}`);
      if (response.data.success) setDetail(response.data.data);
    } catch (error) { toast.error('档案加载失败'); } finally { setLoading(false); }
  };

  const handleDownload = (url) => window.open(getAttachmentUrl(url), '_blank');

  const itemColumns = [
    { title: '费用项', dataIndex: 'item_type', key: 'item_type', width: 120, render: (t) => <span className="font-black text-slate-800 text-xs">{t}</span> },
    { title: '申报金额', dataIndex: 'amount', key: 'amount', align: 'center', render: (v) => <span className="font-mono font-black text-indigo-600">¥{parseFloat(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> },
    { title: '日期', dataIndex: 'expense_date', align: 'center', width: 110, render: (v) => <span className="text-slate-400 text-[10px] font-mono font-bold">{v ? dayjs(v).format('YYYY-MM-DD') : '-'}</span> },
    { 
      title: '备注(点击详情)', 
      dataIndex: 'description', 
      onCell: (record) => ({
        onClick: () => record.description && setShowNoteModal({ open: true, content: record.description })
      }),
      className: 'cursor-pointer hover:bg-slate-50/50 transition-colors',
      render: (t) => (
        <div className="text-slate-500 text-[11px] truncate max-w-[200px] font-medium">
          {t || '-'}
        </div>
      )
    },
    {
      title: '凭证',
      dataIndex: 'attachment_url',
      align: 'center',
      width: 150,
      render: (url) => url ? (
        <Space size="middle">
          <Image
            src={getAttachmentUrl(url)}
            width={40} height={24}
            className="rounded border border-slate-200 object-cover shadow-sm"
            preview={{ mask: <div className="text-[10px] font-black">预览</div> }}
          />
          <Button type="link" size="small" icon={<DownloadOutlined />} className="text-slate-400 hover:text-black p-0 text-[10px] font-black" onClick={(e) => { e.stopPropagation(); handleDownload(url); }}>下载</Button>
        </Space>
      ) : <Text type="disabled" className="text-[10px]">未上传</Text>
    }
  ];

  if (loading) return <div className="flex items-center justify-center p-20 min-h-screen bg-slate-50"><Spin size="large" /></div>;
  if (!detail) return <div className="p-20 text-center bg-slate-50 min-h-screen flex flex-col items-center justify-center"><Empty description="单据路径失效" /><Button onClick={onBack} size="small" className="mt-4">返回列表</Button></div>;

  return (
    <div className="p-0 bg-slate-50 min-h-screen flex flex-col relative overflow-hidden">
      
      {/* 1. 旗舰顶栏 (毛玻璃) */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-all group">
            <ArrowLeftOutlined className="text-slate-400 group-hover:text-black" />
          </button>
          <Divider type="vertical" className="h-6 border-slate-200" />
          <div className="text-left">
            <h1 className="text-base font-black text-slate-900 m-0">{detail.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">NO: {detail.reimbursement_no}</span>
                <Tag className="m-0 border-none bg-black text-white font-black text-[8px] px-2 py-0 rounded-sm">{STATUS_LABELS[detail.status]}</Tag>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">结算总额</span>
          <span className="text-xl font-black text-slate-900 font-mono">¥{parseFloat(detail.total_amount).toLocaleString()}</span>
        </div>
      </div>

      <div className="flex-1 flex w-full max-w-[1600px] mx-auto p-6 gap-6">
        
        {/* 2. 左侧：业务面板 (340px) */}
        <div className="w-[340px] shrink-0 space-y-4">
          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100/50 pb-4">
                <InfoCircleOutlined className="text-black" />
                <h3 className="text-xs font-black text-slate-800 m-0 uppercase tracking-widest">基础报送信息</h3>
            </div>
            <div className="space-y-5 text-left">
                {[
                    { label: '报销类型', value: TYPE_LABELS[detail.type] || detail.type, icon: <LayoutOutlined /> },
                    { label: '所属部门', value: detail.department_name || '-', icon: <UserOutlined /> },
                    { label: '创建时间', value: dayjs(detail.created_at).format('YYYY-MM-DD HH:mm'), icon: <ClockCircleOutlined /> }
                ].map((item, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                            {item.icon} {item.label}
                        </div>
                        <div className="text-xs font-black text-slate-700 pl-4">{item.value}</div>
                    </div>
                ))}
            </div>
            {detail.remark && <div className="mt-6 p-3 bg-slate-50/50 rounded-lg border border-slate-100 text-[11px] text-slate-500 italic">" {detail.remark} "</div>}
          </div>

          <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100/50 pb-4">
                <HistoryOutlined className="text-indigo-600" />
                <h3 className="text-xs font-black text-slate-800 m-0 uppercase tracking-widest">审批流转记录</h3>
            </div>
            <Timeline className="compact-timeline-glass">
                {detail.workflow?.history?.map((h, i) => (
                  <Timeline.Item key={i} color="black">
                    <div className="pb-3 text-left">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="font-black text-slate-800 text-[11px]">{h.approver_name}</span>
                        <span className="text-[9px] text-slate-400 font-mono font-bold">{dayjs(h.approved_at).format('MM-DD HH:mm')}</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500">{h.action === 'approve' ? '审批通过' : '驳回处理'}</div>
                    </div>
                  </Timeline.Item>
                ))}
            </Timeline>
          </div>
        </div>

        {/* 3. 右侧：内容流 */}
        <div className="flex-1 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                <CreditCardOutlined className="text-slate-400 text-xs" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">费用明细清单</span>
            </div>
            <Table columns={itemColumns} dataSource={detail.items} pagination={false} size="small" rowKey={(r,i)=>i} className="glass-table" />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <PaperClipOutlined className="text-slate-400" />
                    <h3 className="text-xs font-black text-slate-800 m-0 uppercase tracking-widest">汇总证明材料</h3>
                </div>
            </div>
            {detail.attachments?.length > 0 ? (
              <Image.PreviewGroup>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {detail.attachments.map((att, i) => (
                    <div key={i} className="flex flex-col gap-2 group text-left">
                      <div className="aspect-[4/3] rounded-lg border border-slate-100 overflow-hidden relative shadow-sm hover:border-black transition-all bg-slate-50">
                        <Image src={getAttachmentUrl(att.file_url)} className="w-full h-full object-cover" preview={{ mask: <div className="text-[10px] font-black">查看</div> }} />
                      </div>
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[9px] font-black text-slate-400 truncate max-w-[80px]">{att.file_name}</span>
                        <button onClick={() => handleDownload(att.file_url)} className="w-5 h-5 rounded-full bg-slate-50 hover:bg-black hover:text-white transition-all flex items-center justify-center"><DownloadOutlined style={{fontSize: 9}} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </Image.PreviewGroup>
            ) : <div className="py-10 text-center text-slate-300 font-bold text-[10px] uppercase tracking-widest">无补充附件</div>}
          </div>
        </div>
      </div>

      {/* 极简备注弹窗 */}
      <Modal 
        open={showNoteModal.open} onCancel={() => setShowNoteModal({ open: false, content: '' })} footer={null} centered width={360} closable={false}
        className="minimal-note-modal"
      >
        <div className="p-2 text-xs text-slate-600 leading-relaxed font-bold italic">
            "{showNoteModal.content}"
        </div>
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .ant-table-thead > tr > th { background: #fcfcfd !important; color: #94a3b8 !important; font-weight: 900 !important; font-size: 9px !important; text-align: center !important; padding: 12px !important; border-bottom: 1px solid #f1f5f9 !important; }
        .ant-table-tbody > tr > td { text-align: center !important; font-size: 11px !important; padding: 12px !important; border-bottom: 1px solid #f8fafc !important; }
        .ant-modal-content { border-radius: 12px !important; background: rgba(255,255,255,0.98) !important; backdrop-filter: blur(20px) !important; padding: 20px !important; border: 1px solid #f1f5f9 !important; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1) !important; }
        .compact-timeline-glass .ant-timeline-item { padding-bottom: 15px !important; }
        * { font-style: normal !important; }
      `}} />
    </div>
  );
};

export default ReimbursementDetail;
