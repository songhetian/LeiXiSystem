import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Badge, Space, Typography, Modal, Button, Tooltip, Empty, List, Avatar } from 'antd';
import { 
  SyncOutlined, 
  TeamOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  InfoCircleOutlined,
  UserOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import api from '../../api';
import { getFileUrl } from '../../utils/apiConfig';
import { wsManager } from '../../services/websocket';

const { Text } = Typography;

// --- 性能优化：提取员工列表项并 Memo 化，减少详情弹窗滚动/刷新时的重绘 ---
const EmployeeItem = React.memo(({ emp, getEmployeeStatusUI }) => (
  <List.Item
    extra={getEmployeeStatusUI(emp.status)}
    className="border-b border-slate-100 last:border-none py-4 px-2 hover:bg-slate-50/50 rounded-2xl transition-all"
  >
    <List.Item.Meta
      avatar={
        <Badge dot status={emp.isOnline ? 'success' : 'default'} offset={[-2, 28]}>
          <Avatar src={getFileUrl(emp.avatar)} className="rounded-xl border border-slate-200 shadow-sm" icon={<UserOutlined />} />
        </Badge>
      }
      title={<span className="font-black text-slate-900">{emp.name}</span>}
      description={
        <div className="text-[10px] font-bold text-slate-500 flex items-center gap-2">
          <ClockCircleOutlined /> {emp.shift || '未安排班次'}
          {emp.reason && <span className="text-rose-600 italic ml-2">({emp.reason})</span>}
        </div>
      }
    />
  </List.Item>
));

const RealtimeAttendanceCard = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/realtime-attendance');
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      logger.error('获取实时考勤失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    setIsSocketConnected(wsManager.isConnected());
    
    const handleConnect = () => setIsSocketConnected(true);
    const handleDisconnect = () => setIsSocketConnected(false);
    
    wsManager.on('connected', handleConnect);
    wsManager.on('disconnected', handleDisconnect);

    const timer = setInterval(fetchAttendance, 60000);
    return () => {
        clearInterval(timer);
        wsManager.off('connected', handleConnect);
        wsManager.off('disconnected', handleDisconnect);
    };
  }, []);

  const showDetail = (dept) => {
    setSelectedDept(dept);
    setDetailModalVisible(true);
  };

  // --- 性能优化：使用 useMemo 缓存 Table 列配置 ---
  const columns = React.useMemo(() => [
    {
      title: <span className="text-slate-900 font-black">组织架构</span>,
      dataIndex: 'name',
      key: 'name',
      width: '25%',
      render: (text, record) => (
        <div className="flex items-center gap-2">
          <span className="font-black text-slate-900">{text}</span>
          {!record.hasSchedulePlan && (
            <Tooltip title="今日尚未排班">
              <WarningOutlined className="text-amber-600 text-xs" />
            </Tooltip>
          )}
        </div>
      )
    },
    {
      title: <span className="text-slate-900 font-black">在岗概况</span>,
      key: 'stats',
      align: 'center',
      width: '25%',
      render: (_, record) => {
        if (!record.hasSchedulePlan) return <Text className="text-[10px] text-slate-600 font-black uppercase">无计划</Text>;
        const onDuty = record.onDutyCount;
        const totalDuty = record.onDutyCount + record.absentCount;
        const percentage = totalDuty > 0 ? (onDuty / totalDuty * 100).toFixed(0) : 0;
        return (
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs font-black text-slate-900">{onDuty} / {totalDuty}</span>
            <Tag variant="borderless" className={`m-0 text-[10px] font-black rounded-full px-2 ${parseFloat(percentage) >= 90 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              {percentage}%
            </Tag>
          </div>
        );
      }
    },
    {
      title: <span className="text-slate-900 font-black">实时在线</span>,
      dataIndex: 'onlineCount',
      key: 'onlineCount',
      align: 'center',
      width: '20%',
      render: (count) => <span className="text-emerald-800 font-black text-lg">{count}</span>
    },
    {
      title: <span className="text-slate-900 font-black">缺勤异常</span>,
      dataIndex: 'absentCount',
      key: 'absentCount',
      align: 'center',
      width: '20%',
      render: (count) => <span className={count > 0 ? "text-rose-700 font-black text-lg" : "text-slate-500 font-medium"}>{count}</span>
    },
    {
      title: <span className="text-slate-900 font-black">详情</span>,
      key: 'action',
      align: 'right',
      width: '10%',
      render: (_, record) => (
        <Button 
          type="text" 
          icon={<ArrowRightOutlined className="text-slate-500 group-hover:text-blue-500 transition-colors" />} 
          onClick={() => showDetail(record)}
          className="hover:bg-blue-50 rounded-xl"
        />
      )
    }
  ], []);

  // --- 性能优化：使用 useCallback 稳定状态渲染函数 ---
  const getEmployeeStatusUI = React.useCallback((status) => {
    switch (status) {
      case 'on_duty': return <Tag className="border-none rounded-full px-3 font-bold text-[10px]" color="success">在岗</Tag>;
      case 'absent': return <Tag className="border-none rounded-full px-3 font-bold text-[10px]" color="error">缺勤</Tag>;
      case 'resting_online': return <Tag className="border-none rounded-full px-3 font-bold text-[10px]" color="processing">休息在线</Tag>;
      default: return <Tag className="border-none rounded-full px-3 font-bold text-[10px]" color="default">离线</Tag>;
    }
  }, []);

  return (
    <>
      <Card 
        title={
          <div className="flex justify-between items-center py-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner">
                <TeamOutlined />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900 uppercase tracking-widest">实时考勤监视</span>
                <span className={`text-[9px] font-black ${isSocketConnected ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {isSocketConnected ? '● 实时链路已就绪' : '○ 通讯链路断开'}
                </span>
              </div>
            </div>
            <Button 
              size="small" 
              type="text" 
              className="text-slate-700 font-black hover:text-blue-600" 
              icon={<SyncOutlined spin={loading} />} 
              onClick={fetchAttendance}
            >
              刷新数据
            </Button>
          </div>
        }
        variant="borderless" 
        className="rounded-[32px] shadow-sm border-none flex flex-col h-full overflow-hidden"
        styles={{ body: { flex: 1, overflowY: 'auto', padding: '8px 24px 24px' } }}
      >
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="id" 
          pagination={false} 
          size="middle"
          loading={loading}
          className="admin-dashboard-table"
          locale={{ emptyText: <Empty description="当前无实时数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-3 py-2">
            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg"><TeamOutlined /></div>
            <div>
              <div className="text-lg font-black text-slate-900">{selectedDept?.name}</div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">实时员工状态名单</div>
            </div>
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
        centered
        className="refined-modal"
      >
        <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          <List
            itemLayout="horizontal"
            dataSource={selectedDept?.employees || []}
            renderItem={emp => (
              <EmployeeItem 
                key={emp.id} 
                emp={emp} 
                getEmployeeStatusUI={getEmployeeStatusUI} 
              />
            )}
          />
        </div>
        <div className="mt-6 p-5 bg-slate-50 rounded-[24px] border border-slate-200 flex justify-around shadow-inner">
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-1">正在岗位</p>
            <Text className="text-lg font-black text-emerald-700">{selectedDept?.onDutyCount}</Text>
          </div>
          <div className="w-[1px] bg-slate-300" />
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-1">考勤缺勤</p>
            <Text className="text-lg font-black text-rose-600">{selectedDept?.absentCount}</Text>
          </div>
          <div className="w-[1px] bg-slate-300" />
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-1">当前在线</p>
            <Text className="text-lg font-black text-slate-900">{selectedDept?.onlineCount}</Text>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default RealtimeAttendanceCard;
