import React, { useState, useEffect } from 'react'
import { Card, Table, Select, Button, message, Tag, Space, Typography, Switch } from 'antd'
import { BellOutlined, SaveOutlined, MessageOutlined, DesktopOutlined } from '@ant-design/icons'
import { getApiUrl } from '../utils/apiConfig'
import { apiGet, apiPut } from '../utils/apiClient'
import { useChatStore } from '../hooks/useChatStore'
import Breadcrumb from './Breadcrumb'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

const NotificationSettings = () => {
  const [loading, setLoading] = useState(false)
  const { 
    notificationEnabled, 
    toggleNotification, 
    systemNotificationEnabled, 
    toggleSystemNotification 
  } = useChatStore();
  
  /* --- State Variables --- */
  const [settings, setSettings] = useState([])
  const [roles, setRoles] = useState([])
  const [saving, setSaving] = useState(false)

  // 事件类型映射
  const eventTypeMap = {
    'leave_apply': '请假申请',
    'leave_approval': '请假审批通过',
    'leave_rejection': '请假审批拒绝',
    'exam_publish': '考试发布',
    'exam_result': '考试结果发布'
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [settingsRes, rolesRes] = await Promise.all([
        apiGet('/api/notification-settings'),
        apiGet('/api/notification-settings/roles')
      ])

      if (settingsRes.success) {
        setSettings(settingsRes.data)
      }
      if (rolesRes.success) {
        // 添加特殊角色 "申请人" 和 "考生"
        setRoles(['申请人', '考生', ...rolesRes.data])
      }
    } catch (error) {
      console.error('获取数据失败:', error)
      message.error('获取配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = (eventType, newRoles) => {
    const newSettings = [...settings]
    const index = newSettings.findIndex(s => s.event_type === eventType)

    if (index > -1) {
      newSettings[index].target_roles = newRoles
      setSettings(newSettings)
    } else {
      newSettings.push({
        event_type: eventType,
        target_roles: newRoles
      })
      setSettings(newSettings)
    }
  }

  const handleSave = async (record) => {
    setSaving(true)
    try {
      await apiPut(`/api/notification-settings/${record.event_type}`, {
        targetRoles: record.target_roles
      })
      message.success('保存成功')
    } catch (error) {
      console.error('保存失败:', error)
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: '事件类型',
      dataIndex: 'event_type',
      key: 'event_type',
      render: (text) => (
        <Space>
          <BellOutlined style={{ color: '#1890ff' }} />
          <Text strong>{eventTypeMap[text] || text}</Text>
        </Space>
      )
    },
    {
      title: '接收通知角色',
      dataIndex: 'target_roles',
      key: 'target_roles',
      width: '50%',
      render: (targetRoles, record) => (
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="请选择接收角色"
          value={typeof targetRoles === 'string' ? JSON.parse(targetRoles) : targetRoles}
          onChange={(value) => handleRoleChange(record.event_type, value)}
        >
          {roles.map(role => (
            <Option key={role} value={role}>{role}</Option>
          ))}
        </Select>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={() => handleSave(record)}
          loading={saving}
        >
          保存
        </Button>
      )
    }
  ]

  // 确保所有定义的事件类型都显示，即使数据库中没有记录
  const displayData = Object.keys(eventTypeMap).map(type => {
    const existing = settings.find(s => s.event_type === type)
    return existing || { event_type: type, target_roles: [] }
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Breadcrumb items={['系统管理', '通知设置']} />
      
      <Card 
        className="mb-6 rounded-xl shadow-sm border-gray-100" 
        title={<Space><MessageOutlined className="text-green-500" /><span>个人消息提醒设置</span></Space>}
      >
        <div className="space-y-6 p-2">
          <div className="flex items-center justify-between">
            <div>
              <Text strong className="text-base">全局消息弹窗</Text>
              <Paragraph type="secondary" className="mb-0">
                收到新聊天消息时，在页面右上角显示实时悬浮提示
              </Paragraph>
            </div>
            <Switch 
              checked={notificationEnabled} 
              onChange={toggleNotification}
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Text strong className="text-base">系统级桌面通知</Text>
              <Paragraph type="secondary" className="mb-0">
                当浏览器处于后台或最小化时，通过操作系统发送桌面通知
              </Paragraph>
            </div>
            <Switch 
              checked={systemNotificationEnabled} 
              onChange={toggleSystemNotification}
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
          </div>
        </div>
      </Card>

      <Card 
        title={<Space><BellOutlined className="text-blue-500" /><span>业务通知规则配置</span></Space>} 
        bordered={false}
        className="rounded-xl shadow-sm border-gray-100"
      >
        <div className="mb-4 text-gray-500">
          管理员配置：各类系统业务事件（如审批、考试）触发时，哪些角色的用户会收到推送。
        </div>
        <Table
          columns={columns}
          dataSource={displayData}
          rowKey="event_type"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  )
}

export default NotificationSettings
