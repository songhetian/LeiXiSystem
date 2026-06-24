import React from 'react';
import { Card, List, Avatar, Button, Tag, Space } from 'antd';
import { BellOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const NotificationCenter = () => {
  const notifications = [
    {
      id: 1,
      title: '系统维护通知',
      content: '系统将于今晚00:00-02:00进行例行维护，请提前做好相关准备。',
      time: '2023-05-15 14:30',
      type: 'system',
      read: false,
    },
    {
      id: 2,
      title: '考勤异常提醒',
      content: '您今天上午的考勤记录存在异常，请及时处理。',
      time: '2023-05-15 09:15',
      type: 'warning',
      read: true,
    },
    {
      id: 3,
      title: '审批通过',
      content: '您提交的请假申请已通过审批。',
      time: '2023-05-14 16:45',
      type: 'success',
      read: true,
    },
    {
      id: 4,
      title: '新版本更新',
      content: '系统已更新至v2.1.0版本，新增多项功能和优化。',
      time: '2023-05-14 10:00',
      type: 'system',
      read: false,
    },
  ];

  const getIconByType = (type) => {
    switch (type) {
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      default:
        return <BellOutlined />;
    }
  };

  const getColorByType = (type) => {
    switch (type) {
      case 'warning':
        return 'orange';
      case 'success':
        return 'green';
      default:
        return 'blue';
    }
  };

  return (
    <div className="p-6">
      <Card
        title="消息通知中心"
        extra={
          <Space>
            <Button>标记全部已读</Button>
            <Button type="primary">刷新</Button>
          </Space>
        }
      >
        <List
          itemLayout="horizontal"
          dataSource={notifications}
          renderItem={item => (
            <List.Item
              actions={[<a key="view">查看详情</a>]}
              className={!item.read ? 'bg-blue-50' : ''}
            >
              <List.Item.Meta
                avatar={<Avatar icon={getIconByType(item.type)} />}
                title={
                  <div className="flex items-center">
                    <span className="mr-2">{item.title}</span>
                    {!item.read && <Tag color="red">未读</Tag>}
                    <Tag color={getColorByType(item.type)}>{item.type === 'system' ? '系统' : item.type === 'warning' ? '警告' : '成功'}</Tag>
                  </div>
                }
                description={
                  <div>
                    <div>{item.content}</div>
                    <div className="text-gray-400 text-sm mt-1">{item.time}</div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default NotificationCenter;
