import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Message,
  Tag,
  Grid,
  InputTag,
  Progress,
  Statistic,
  Descriptions,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconSearch,
  IconRefresh,
  IconSend,
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  getAnnouncementStats,
  type Announcement,
  type AnnouncementStats,
} from '@/api/announcement'
import styles from './index.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TextArea = Input.TextArea

const TYPE_OPTIONS = [
  { value: 'notice', label: '通知', color: 'arcoblue' },
  { value: 'urgent', label: '紧急', color: 'red' },
  { value: 'system', label: '系统', color: 'purple' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿', color: 'gray' },
  { value: 'published', label: '已发布', color: 'green' },
  { value: 'expired', label: '已过期', color: 'orange' },
]

const PRIORITY_OPTIONS = [
  { value: 'normal', label: '普通', color: 'gray' },
  { value: 'high', label: '高', color: 'orange' },
  { value: 'urgent', label: '紧急', color: 'red' },
]

const TARGET_TYPE_OPTIONS = [
  { value: 'all', label: '全部员工' },
  { value: 'department', label: '按部门' },
  { value: 'role', label: '按角色' },
  { value: 'tag', label: '按标签' },
  { value: 'employee', label: '指定员工' },
]

function AnnouncementPage() {
  const [loading, setLoading] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState<string | undefined>()
  const [filterStatus, setFilterStatus] = useState<string | undefined>()

  const [modalVisible, setModalVisible] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [form] = Form.useForm()

  const [statsVisible, setStatsVisible] = useState(false)
  const [currentStats, setCurrentStats] = useState<AnnouncementStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null)

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAnnouncements({
        page,
        pageSize,
        keyword: keyword || undefined,
        type: filterType,
        status: filterStatus,
      })
      if (res.code === 0) {
        setAnnouncements(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, keyword, filterType, filterStatus])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  const handleSearch = () => {
    setPage(1)
  }

  const handleReset = () => {
    setKeyword('')
    setFilterType(undefined)
    setFilterStatus(undefined)
    setPage(1)
  }

  const handleCreate = () => {
    setEditingAnnouncement(null)
    form.resetFields()
    form.setFieldsValue({
      type: 'notice',
      priority: 'normal',
      targetType: 'all',
    })
    setModalVisible(true)
  }

  const handleEdit = async (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    try {
      const res = await getAnnouncement(announcement.id)
      if (res.code === 0) {
        const data = res.data
        form.setFieldsValue({
          title: data.title,
          type: data.type,
          priority: data.priority,
          content: data.content,
          targetType: data.targetType,
          targetConfig: data.targetConfig,
          expiresAt: data.expiresAt,
        })
      }
    } catch {
      form.setFieldsValue({
        title: announcement.title,
        type: announcement.type,
        priority: announcement.priority,
        targetType: announcement.targetType,
        targetConfig: announcement.targetConfig,
        expiresAt: announcement.expiresAt,
      })
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      if (editingAnnouncement) {
        await updateAnnouncement(editingAnnouncement.id, values)
        Message.success('更新成功')
      } else {
        await createAnnouncement(values)
        Message.success('创建成功')
      }
      setModalVisible(false)
      fetchAnnouncements()
    } catch {
      // handled
    }
  }

  const handleDelete = (announcement: Announcement) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除公告「${announcement.title}」吗？`,
      onOk: async () => {
        await deleteAnnouncement(announcement.id)
        Message.success('删除成功')
        fetchAnnouncements()
      },
    })
  }

  const handlePublish = (announcement: Announcement) => {
    Modal.confirm({
      title: '确认发布',
      content: `确定要发布公告「${announcement.title}」吗？发布后将通知接收人。`,
      onOk: async () => {
        await publishAnnouncement(announcement.id)
        Message.success('发布成功')
        fetchAnnouncements()
      },
    })
  }

  const handleViewStats = async (announcement: Announcement) => {
    setCurrentAnnouncement(announcement)
    setStatsVisible(true)
    setStatsLoading(true)
    try {
      const res = await getAnnouncementStats(announcement.id)
      if (res.code === 0) {
        setCurrentStats(res.data)
      }
    } finally {
      setStatsLoading(false)
    }
  }

  const getTypeTag = (type: string) => {
    const item = TYPE_OPTIONS.find((t) => t.value === type)
    return <Tag color={item?.color}>{item?.label || type}</Tag>
  }

  const getStatusTag = (status: string) => {
    const item = STATUS_OPTIONS.find((s) => s.value === status)
    return <Tag color={item?.color}>{item?.label || status}</Tag>
  }

  const getPriorityTag = (priority: string) => {
    const item = PRIORITY_OPTIONS.find((p) => p.value === priority)
    return <Tag color={item?.color}>{item?.label || priority}</Tag>
  }

  const getTargetTypeLabel = (targetType: string) => {
    const item = TARGET_TYPE_OPTIONS.find((t) => t.value === targetType)
    return item?.label || targetType
  }

  const columns: TableProps<Announcement>['columns'] = [
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (val) => <span className={styles['announcement__text-title']}>{val}</span>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (val: string) => getTypeTag(val),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => getStatusTag(val),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (val: string) => getPriorityTag(val),
    },
    {
      title: '接收范围',
      dataIndex: 'targetType',
      width: 120,
      render: (val: string) => getTargetTypeLabel(val),
    },
    {
      title: '已读/总数',
      width: 140,
      render: (_: any, record) => (
        <span>
          {record.readCount} / {record.totalReceivers}
        </span>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'createdByName',
      width: 100,
      render: (val) => val || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
    },
    {
      title: '操作',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record) => (
        <Space size="small">
          <Button type="text" size="small" icon={<IconEye />} onClick={() => handleViewStats(record)}>
            统计
          </Button>
          {record.status === 'draft' && (
            <Button type="text" size="small" icon={<IconSend />} status="success" onClick={() => handlePublish(record)}>
              发布
            </Button>
          )}
          {record.status === 'draft' && (
            <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          <Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const targetType = Form.useWatch('targetType', form)

  return (
    <div className={styles.announcement}>
      <Card bordered={false} className={styles.announcement__filter}>
        <Row gutter={16} align="end">
          <Col span={6}>
            <FormItem label="关键字" field="keyword">
              <Input
                placeholder="搜索公告标题"
                value={keyword}
                onChange={(val) => setKeyword(val)}
                onPressEnter={handleSearch}
              />
            </FormItem>
          </Col>
          <Col span={4}>
            <FormItem label="类型" field="type">
              <Select
                placeholder="全部类型"
                allowClear
                value={filterType}
                onChange={(val) => setFilterType(val)}
              >
                {TYPE_OPTIONS.map((item) => (
                  <Option key={item.value} value={item.value}>
                    {item.label}
                  </Option>
                ))}
              </Select>
            </FormItem>
          </Col>
          <Col span={4}>
            <FormItem label="状态" field="status">
              <Select
                placeholder="全部状态"
                allowClear
                value={filterStatus}
                onChange={(val) => setFilterStatus(val)}
              >
                {STATUS_OPTIONS.map((item) => (
                  <Option key={item.value} value={item.value}>
                    {item.label}
                  </Option>
                ))}
              </Select>
            </FormItem>
          </Col>
          <Col span={10}>
            <Space>
              <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<IconRefresh />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card
        bordered={false}
        className={styles.announcement__table}
        title="公告列表"
        extra={
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            新建公告
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={announcements}
          pagination={{
            total,
            current: page,
            pageSize,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      <Modal focusLock
        title={editingAnnouncement ? '编辑公告' : '新建公告'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        className={styles['announcement__modal--lg']}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <FormItem label="公告标题" field="title" rules={[{ required: true, message: '请输入公告标题' }]}>
            <Input placeholder="请输入公告标题" maxLength={200} />
          </FormItem>
          <Row gutter={16}>
            <Col span={8}>
              <FormItem label="公告类型" field="type" rules={[{ required: true, message: '请选择公告类型' }]}>
                <Select placeholder="请选择">
                  {TYPE_OPTIONS.map((item) => (
                    <Option key={item.value} value={item.value}>
                      {item.label}
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="优先级" field="priority" rules={[{ required: true, message: '请选择优先级' }]}>
                <Select placeholder="请选择">
                  {PRIORITY_OPTIONS.map((item) => (
                    <Option key={item.value} value={item.value}>
                      {item.label}
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="过期时间" field="expiresAt">
                <DatePicker
                  className={styles['announcement__input-full']}
                  showTime
                  placeholder="选择过期时间"
                  format="YYYY-MM-DD HH:mm:ss"
                />
              </FormItem>
            </Col>
          </Row>
          <FormItem label="接收范围" field="targetType" rules={[{ required: true, message: '请选择接收范围' }]}>
            <Select placeholder="请选择接收范围">
              {TARGET_TYPE_OPTIONS.map((item) => (
                <Option key={item.value} value={item.value}>
                  {item.label}
                </Option>
              ))}
            </Select>
          </FormItem>
          {targetType && targetType !== 'all' && (
            <FormItem label="目标配置" field="targetConfig">
              <InputTag placeholder={
                targetType === 'department'
                  ? '请输入部门ID，按回车添加'
                  : targetType === 'role'
                  ? '请输入角色ID，按回车添加'
                  : targetType === 'tag'
                  ? '请输入标签，按回车添加'
                  : '请输入员工ID，按回车添加'
              } />
            </FormItem>
          )}
          <FormItem label="公告内容" field="content" rules={[{ required: true, message: '请输入公告内容' }]}>
            <TextArea placeholder="请输入公告内容" rows={8} maxLength={5000} />
          </FormItem>
        </Form>
      </Modal>

      <Modal focusLock
        title="阅读统计"
        visible={statsVisible}
        onCancel={() => setStatsVisible(false)}
        footer={null}
        className={styles['announcement__modal--md']}
      >
        {currentAnnouncement && (
          <Descriptions
            column={1}
            title={currentAnnouncement.title}
            data={[
              { label: '类型', value: getTypeTag(currentAnnouncement.type) },
              { label: '优先级', value: getPriorityTag(currentAnnouncement.priority) },
              { label: '状态', value: getStatusTag(currentAnnouncement.status) },
            ]}
            className={styles['announcement__desc-margin']}
          />
        )}
        {statsLoading ? (
          <div className={styles.announcement__loading}>加载中...</div>
        ) : currentStats ? (
          <div className={styles.announcement__stats}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="总接收人数" value={currentStats.totalReceivers} />
              </Col>
              <Col span={8}>
                <Statistic title="已读人数" value={currentStats.readCount} />
              </Col>
              <Col span={8}>
                <Statistic title="未读人数" value={currentStats.unreadCount} />
              </Col>
            </Row>
            <div className={styles['announcement__stats-progress']}>
              <div className={styles['announcement__stats-label']}>
                <span>阅读率</span>
                <span className={styles['announcement__text-weight']}>{(currentStats.readRate * 100).toFixed(1)}%</span>
              </div>
              <Progress percent={currentStats.readRate * 100} status="success" />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default AnnouncementPage
