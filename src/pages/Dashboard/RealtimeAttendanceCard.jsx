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
      console.error('获取实时考勤失败:', error);
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

  const columns = [
    {
      title: '组织架构',
      dataIndex: 'name',
      key: 'name',
      width: '25%',
      render: (text, record) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">{text}</span>
          {!record.hasSchedulePlan && (
            <Tooltip title="今日尚未排班">
              <WarningOutlined className="text-amber-400 text-xs" />
            </Tooltip>
          )}
        </div>
      )
    },
    {
      title: '在岗概况',
      key: 'stats',
      align: 'center',
      width: '25%',
      render: (_, record) => {
        if (!record.hasSchedulePlan) return <Text className="text-[10px] text-slate-300 font-bold uppercase">无计划</Text>;
        const onDuty = record.onDutyCount;
        const totalDuty = record.onDutyCount + record.absentCount;
        const percentage = totalDuty > 0 ? (onDuty / totalDuty * 100).toFixed(0) : 0;
        return (
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs font-bold text-slate-600">{onDuty} / {totalDuty}</span>
            <Tag bordered={false} className={`m-0 text-[10px] font-bold rounded-full px-2 ${parseFloat(percentage) >= 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {percentage}%
            </Tag>
          </div>
        );
      }
    },
    {
      title: '实时在线',
      dataIndex: 'onlineCount',
      key: 'onlineCount',
      align: 'center',
      width: '20%',
      render: (count) => <span className="text-emerald-600 font-black text-lg">{count}</span>
    },
    {
      title: '缺勤异常',
      dataIndex: 'absentCount',
      key: 'absentCount',
      align: 'center',
      width: '20%',
      render: (count) => <span className={count > 0 ? "text-rose-500 font-black text-lg" : "text-slate-200 font-medium"}>{count}</span>
    },
    {
      title: '详情',
      key: 'action',
      align: 'right',
      width: '10%',
      render: (_, record) => (
        <Button 
          type="text" 
          icon={<ArrowRightOutlined className="text-slate-300 group-hover:text-blue-500 transition-colors" />} 
          onClick={() => showDetail(record)}
          className="hover:bg-blue-50 rounded-xl"
        />
      )
    }
  ];

  const getEmployeeStatusUI = (status) => {
    switch (status) {
      case 'on_duty': return <Tag className="border-none rounded-full px-3 font-bold text-[10px]" color="success">在岗</Tag>;
      case 'absent': return <Tag className="border-none rounded-full px-3 font-bold text-[10px]" color="error">缺勤</Tag>;
      case 'resting_online': return <Tag className="border-none rounded-full px-3 font-bold text-[10px]" color="processing">休息在线</Tag>;
      default: return <Tag className="border-none rounded-full px-3 font-bold text-[10px]" color="default">离线</Tag>;
    }
  };

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
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">实时考勤监视</span>
                <span className={`text-[9px] font-bold ${isSocketConnected ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isSocketConnected ? '● 实时链路已就绪' : '○ 通讯链路断开'}
                </span>
              </div>
            </div>
            <Button 
              size="small" 
              type="text" 
              className="text-slate-400 font-bold hover:text-blue-600" 
              icon={<SyncOutlined spin={loading} />} 
              onClick={fetchAttendance}
            >
              刷新数据
            </Button>
          </div>
        }
        bordered={false} 
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
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">实时员工状态名单</div>
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
              <List.Item
                extra={getEmployeeStatusUI(emp.status)}
                className="border-b border-slate-50 last:border-none py-4 px-2 hover:bg-slate-50/50 rounded-2xl transition-all"
              >
                <List.Item.Meta
                  avatar={
                    <Badge dot status={emp.isOnline ? 'success' : 'default'} offset={[-2, 28]}>
                      <Avatar src={getFileUrl(emp.avatar)} className="rounded-xl border border-slate-100 shadow-sm" icon={<UserOutlined />} />
                    </Badge>
                  }
                  title={<span className="font-bold text-slate-800">{emp.name}</span>}
                  description={
                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                      <ClockCircleOutlined /> {emp.shift || '未安排班次'}
                      {emp.reason && <span className="text-rose-500 italic ml-2">({emp.reason})</span>}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
        <div className="mt-6 p-5 bg-slate-50 rounded-[24px] border border-slate-100 flex justify-around shadow-inner">
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">正在岗位</p>
            <Text className="text-lg font-black text-emerald-600">{selectedDept?.onDutyCount}</Text>
          </div>
          <div className="w-[1px] bg-slate-200" />
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">考勤缺勤</p>
            <Text className="text-lg font-black text-rose-500">{selectedDept?.absentCount}</Text>
          </div>
          <div className="w-[1px] bg-slate-200" />
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">当前在线</p>
            <Text className="text-lg font-black text-slate-800">{selectedDept?.onlineCount}</Text>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default RealtimeAttendanceCard;
