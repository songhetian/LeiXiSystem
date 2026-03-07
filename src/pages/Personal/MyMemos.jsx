import logger from '@/utils/logger';
/**
 * 我的备忘录 (雷犀极效办公版)
 * 
 * 核心重构：
 * 1. 极致本地化：全量移除英文标签与提示语。
 * 2. 视觉标准对齐：AntD Select 替代原生下拉框，应用 44px 物理缝合搜索栏。
 * 3. 布局重塑：采用更紧凑的高级感卡片流展示。
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Table, Button, Tag, Space, Card, Typography, Empty, Badge, 
  Select, Input, Divider, Avatar, Tooltip, Modal, Form 
} from 'antd';
import {
  FileTextOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  TeamOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  EyeOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig';
import { wsManager } from '../../services/websocket';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const MyMemos = () => {
  const [memos, setMemos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [currentMemo, setCurrentMemo] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form] = Form.useForm();

  // 筛选条件
  const [filters, setFilters] = useState({
    isRead: 'all',
    priority: 'all',
    search: ''
  });

  // 分页
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 12,
    total: 0
  });

  // 处理WebSocket新备忘录事件
  const handleNewMemo = useCallback((memo) => {
    toast.success('您收到一条新的备忘录消息');
    loadMemos();
  }, []);

  useEffect(() => {
    wsManager.on('memo', handleNewMemo);
    return () => wsManager.off('memo', handleNewMemo);
  }, [handleNewMemo]);

  useEffect(() => {
    loadMemos();
  }, [pagination.page, filters.isRead, filters.priority]);

  const loadMemos = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        isRead: filters.isRead === 'all' ? '' : filters.isRead,
        priority: filters.priority === 'all' ? '' : filters.priority,
        search: filters.search
      };

      Object.keys(params).forEach(key => 
        (params[key] === '' || params[key] === undefined) && delete params[key]
      );

      const token = localStorage.getItem('token');
      const response = await axios.get(getApiUrl('/api/memos/my-memos'), {
        params,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        setMemos(response.data.data);
        setPagination(prev => ({ ...prev, total: response.data.pagination.total }));
      }
    } catch (error) {
      logger.error('加载失败:', error);
      toast.error('数据同步失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditMode(false);
    form.resetFields();
    form.setFieldsValue({ priority: 'normal' });
    setShowEditor(true);
  };

  const handleEdit = (memo) => {
    if (memo.type === 'department') {
      toast.error('部门备忘录不允许修改');
      return;
    }
    setEditMode(true);
    setCurrentMemo(memo);
    form.setFieldsValue({
      title: memo.title,
      content: memo.content,
      priority: memo.priority
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('token');
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      if (editMode) {
        await axios.put(getApiUrl(`/api/memos/personal/${currentMemo.id}`), values, config);
        toast.success('更新成功');
      } else {
        await axios.post(getApiUrl('/api/memos/personal'), values, config);
        toast.success('已成功存入备忘录');
      }

      setShowEditor(false);
      loadMemos();
    } catch (error) {
      toast.error('保存失败，请检查输入项');
    }
  };

  const handleDelete = (memo) => {
    Modal.confirm({
      title: '确认删除？',
      icon: <ExclamationCircleOutlined className="text-rose-500" />,
      content: '删除后，该备忘录将永久消失，无法撤回。',
      okText: '确认移除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          await axios.delete(getApiUrl(`/api/memos/personal/${memo.id}`), {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          toast.success('已彻底删除');
          loadMemos();
        } catch (e) { toast.error('操作失败'); }
      }
    });
  };

  const handleCardClick = async (memo) => {
    setCurrentMemo(memo);
    setShowDetail(true);
    if (!memo.is_read) {
      try {
        const token = localStorage.getItem('token');
        await axios.put(getApiUrl(`/api/memos/${memo.id}/read`), {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        // 局部更新状态
        setMemos(memos.map(m => m.id === memo.id ? { ...m, is_read: 1 } : m));
      } catch (e) {}
    }
  };

  const getPriorityTag = (p) => {
    const map = {
      low: { t: '低', c: 'bg-slate-100 text-slate-500' },
      normal: { t: '普通', c: 'bg-indigo-50 text-indigo-600' },
      high: { t: '高', c: 'bg-orange-50 text-orange-600' },
      urgent: { t: '紧急', c: 'bg-rose-50 text-rose-600' }
    };
    const cfg = map[p] || map.normal;
    return <span className={`px-2 py-0.5 rounded text-[10px] font-black ${cfg.c}`}>{cfg.t}</span>;
  };

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50/30">
      {/* 顶部标题栏 */}
      <div className="max-w-[1400px] mx-auto mb-8 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shadow-lg">
              <FileTextOutlined className="text-white text-xl" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 !m-0">个人备忘录</h1>
          </div>
          <p className="text-slate-400 text-sm font-bold">记录灵感、任务与部门重要通知</p>
        </div>
        <button 
          onClick={handleCreate}
          className="bg-black hover:bg-slate-800 text-white rounded-lg h-10 px-8 flex items-center justify-center gap-2 transition-all font-bold text-xs shadow-md active:scale-95"
        >
          <PlusOutlined /> <span>写新备忘</span>
        </button>
      </div>

      {/* 雷犀标准：44px 物理缝合搜索栏 (对齐高级感下拉) */}
      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex items-center bg-white rounded-xl overflow-hidden shadow-sm border border-[#64748b]">
          <div className="flex-1 flex items-center h-[44px] px-4">
            <SearchOutlined className="text-slate-400 mr-3" />
            <Input 
              placeholder="按标题或内容关键词检索..." 
              variant="borderless"
              className="h-full text-sm font-medium"
              value={filters.search}
              onChange={e => setFilters({...filters, search: e.target.value})}
              onPressEnter={loadMemos}
              allowClear
            />
          </div>
          <Divider type="vertical" className="h-6 border-slate-200 m-0" />
          <div className="w-40 flex items-center h-[44px] px-4 bg-slate-50/30 border-r border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase mr-3 shrink-0">阅读状态</span>
            <Select 
              value={filters.isRead} 
              onChange={val => setFilters({...filters, isRead: val})}
              variant="borderless"
              className="w-full text-xs font-black text-slate-700"
              options={[{label:'全部', value:'all'}, {label:'未读', value:'0'}, {label:'已读', value:'1'}]}
            />
          </div>
          <div className="w-48 flex items-center h-[44px] px-4 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase mr-3 shrink-0">优先级</span>
            <Select 
              value={filters.priority} 
              onChange={val => setFilters({...filters, priority: val})}
              variant="borderless"
              className="w-full text-xs font-black text-slate-700"
              options={[
                {label:'不限等级', value:'all'},
                {label:'普通等级', value:'normal'},
                {label:'高优先级', value:'high'},
                {label:'紧急处理', value:'urgent'}
              ]}
            />
          </div>
          <button 
            onClick={loadMemos}
            className="h-[44px] px-6 bg-black text-white hover:bg-slate-800 transition-colors flex items-center justify-center border-none"
          >
            <ReloadOutlined className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 备忘录卡片流 */}
      <div className="max-w-[1400px] mx-auto">
        {loading ? (
          <div className="py-32 flex justify-center"><ReloadOutlined spin className="text-3xl text-slate-200" /></div>
        ) : memos.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {memos.map(memo => (
                <div 
                  key={memo.id}
                  onClick={() => handleCardClick(memo)}
                  className={`group bg-white rounded-2xl border border-slate-200 p-5 hover:border-black hover:shadow-xl transition-all cursor-pointer relative overflow-hidden ${!memo.is_read ? 'ring-1 ring-indigo-500' : ''}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    {getPriorityTag(memo.priority)}
                    <div className="flex items-center gap-2">
                      <Tag className="m-0 border-none bg-slate-100 text-slate-400 text-[9px] font-black rounded px-1.5 uppercase">
                        {memo.type === 'personal' ? '个人' : '部门'}
                      </Tag>
                      {!memo.is_read && <Badge status="processing" />}
                    </div>
                  </div>
                  
                  <h3 className="text-base font-black text-slate-800 mb-2 truncate group-hover:text-indigo-600 transition-colors">{memo.title}</h3>
                  <div className="text-xs text-slate-500 line-clamp-3 mb-6 h-12 leading-relaxed">
                    {memo.content.replace(/[#*`]/g, '')}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold">
                      <ClockCircleOutlined /> {dayjs(memo.created_at).fromNow()}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <EyeOutlined className="text-slate-300" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 纤巧居中分页 */}
            {pagination.total > pagination.pageSize && (
              <div className="mt-12 flex justify-center">
                <div className="bg-white px-6 py-2 rounded-full border border-slate-200 shadow-sm flex items-center gap-4">
                  <Button type="text" size="small" disabled={pagination.page === 1} onClick={() => setPagination(p=>({...p, page: p.page-1}))} icon={<LeftOutlined />} />
                  <span className="text-[11px] font-black text-slate-600">第 {pagination.page} / {Math.ceil(pagination.total/pagination.pageSize)} 页</span>
                  <Button type="text" size="small" disabled={pagination.page >= Math.ceil(pagination.total/pagination.pageSize)} onClick={() => setPagination(p=>({...p, page: p.page+1}))} icon={<RightOutlined />} />
                </div>
              </div>
            )}
          </>
        ) : (
          <Empty className="py-24" description={<span className="text-slate-400 font-bold">暂无备忘记录</span>} />
        )}
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title={<div className="font-black text-slate-800 text-sm flex items-center gap-2"><EditOutlined className="text-indigo-600" /> {editMode ? '修改备忘' : '记录新备忘'}</div>}
        open={showEditor}
        onCancel={() => setShowEditor(false)}
        onOk={handleSave}
        centered width={600}
        okText="保存到我的云端"
        cancelText="取消"
        className="custom-modal"
      >
        <Form form={form} layout="vertical" className="mt-6">
          <Form.Item name="title" label={<span className="text-[10px] font-black text-slate-400 uppercase">主题标题</span>} rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="输入醒目的主题..." className="rounded-lg h-11 border-slate-200" />
          </Form.Item>
          <Form.Item name="priority" label={<span className="text-[10px] font-black text-slate-400 uppercase">紧急程度</span>} rules={[{ required: true }]}>
            <Select className="rounded-lg h-11">
              <Option value="low">低级别 (后续处理)</Option>
              <Option value="normal">普通 (日常记录)</Option>
              <Option value="high">高级别 (优先关注)</Option>
              <Option value="urgent">最高级 (即刻执行)</Option>
            </Select>
          </Form.Item>
          <Form.Item name="content" label={<span className="text-[10px] font-black text-slate-400 uppercase">详细内容 (支持 Markdown)</span>} rules={[{ required: true, message: '必填' }]}>
            <Input.TextArea rows={8} placeholder="在此记录您的想法或任务细节..." className="rounded-lg border-slate-200" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title={null}
        open={showDetail}
        onCancel={() => setShowDetail(false)}
        footer={null}
        centered width={800}
        className="custom-modal detail-modal"
      >
        {currentMemo && (
          <div className="py-4">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {getPriorityTag(currentMemo.priority)}
                  <Tag className="m-0 border-none bg-slate-100 text-slate-500 text-[10px] font-bold">
                    {currentMemo.type === 'personal' ? '个人备忘录' : '部门同步通知'}
                  </Tag>
                </div>
                <h2 className="text-2xl font-black text-slate-900 m-0">{currentMemo.title}</h2>
              </div>
              <div className="text-right">
                <Text type="secondary" className="text-[10px] font-bold uppercase block">Created At</Text>
                <span className="text-xs font-mono font-bold text-slate-400">{dayjs(currentMemo.created_at).format('YYYY-MM-DD HH:mm')}</span>
              </div>
            </div>

            <Divider className="my-6 border-slate-100" />

            <div className="prose prose-slate max-w-none min-h-[300px] text-slate-700 leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentMemo.content}</ReactMarkdown>
            </div>

            <Divider className="my-8 border-slate-100" />

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Avatar size="small" icon={<UserOutlined />} className="bg-slate-100" />
                <span className="text-xs font-bold text-slate-500">{currentMemo.creator_name || '我自己'} 发起</span>
              </div>
              <Space>
                {currentMemo.type === 'personal' && (
                  <>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => { setShowDetail(false); handleDelete(currentMemo); }}>删除</Button>
                    <Button type="text" icon={<EditOutlined />} onClick={() => { setShowDetail(false); handleEdit(currentMemo); }}>修改</Button>
                  </>
                )}
                <BlackButton onClick={() => setShowDetail(false)}>关闭阅览</BlackButton>
              </Space>
            </div>
          </div>
        )}
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .ant-modal-content { border-radius: 24px !important; padding: 24px !important; }
        .ant-btn-primary span { color: #ffffff !important; }
        .ant-select-selection-item { font-weight: 700 !important; }
        .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      `}} />
    </div>
  );
};

// 补全图标导入缺失
const LeftOutlined = () => <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor"><path d="M724 218.3V141c0-6.7-7.7-10.4-12.9-6.3L260.3 486.8a31.86 31.86 0 0 0 0 50.3l450.8 352.1c5.3 4.1 12.9.4 12.9-6.3v-77.3c0-4.9-2.3-9.6-6.1-12.6l-360-281 360-281.1c3.8-3 6.1-7.7 6.1-12.6z"></path></svg>;
const RightOutlined = () => <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor"><path d="M765.7 486.8L314.9 134.7A7.97 7.97 0 0 0 302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.4 12.9 6.3l450.8-352.1a31.96 31.96 0 0 0 0-50.4z"></path></svg>;

export default MyMemos;
