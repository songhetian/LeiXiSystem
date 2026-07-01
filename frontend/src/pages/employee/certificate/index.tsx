import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Modal,
  Form,
  Message,
  Tag,
  Popconfirm,
  Card,
  DatePicker,
  Radio,
  Switch,
  Descriptions,
  Typography,
  Divider,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEye,
  IconFile,
  IconDownload,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { Dayjs } from 'dayjs'
import {
  getMyCertificates,
  createCertificate,
  getCertificate,
  cancelCertificate,
} from '@/api/certificate'
import type { Certificate } from '@/api/certificate'
import { formatDate } from '@/utils/date'
import { FilterBar, PageHeader } from '@/components'
import styles from './certificate.module.css'
const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker
const { Title, Text } = Typography
const RadioGroup = Radio.Group

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  cancelled: { text: '已取消', color: 'gray' },
  generated: { text: '已生成', color: 'blue' },
}

const typeMap: Record<string, string> = {
  income: '收入证明',
  employment: '在职证明',
  residency: '居住证明',
  resignation: '离职证明',
  other: '其他证明',
}

const certificateTypes = [
  { value: 'income', label: '收入证明' },
  { value: 'employment', label: '在职证明' },
  { value: 'residency', label: '居住证明' },
  { value: 'resignation', label: '离职证明' },
  { value: 'other', label: '其他证明' },
]

function CertificatePage() {
  const [data, setData] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailData, setDetailData] = useState<Certificate | null>(null)
  const [saving, setSaving] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [form] = Form.useForm()
  const [searchType, setSearchType] = useState<string | undefined>()
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<Dayjs[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getMyCertificates({
        page,
        pageSize,
        type: searchType,
        status: searchStatus,
        startDate: dateRange[0]?.format('YYYY-MM-DD'),
        endDate: dateRange[1]?.format('YYYY-MM-DD'),
      })
      setData(res.data.list)
      setPagination((prev) => ({ ...prev, current: page, pageSize, total: res.data.total }))
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(pagination.current, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns: TableProps<Certificate>['columns'] = [
    {
      title: '证明类型',
      dataIndex: 'type',
      width: 120,
      render: (value: string) => (
        <Tag color="blue" className={styles['certificate__type-tag']}>
          {typeMap[value] || value}
        </Tag>
      ),
    },
    {
      title: '用途',
      dataIndex: 'purpose',
      width: 150,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => {
        const info = statusMap[value]
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value: string) => formatDate(value, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '处理时间',
      dataIndex: 'approvedAt',
      width: 160,
      render: (_value: string | undefined, record: Certificate) => {
        const time = record.approvedAt || record.generatedAt
        return time ? formatDate(time, 'YYYY-MM-DD HH:mm') : '-'
      },
    },
    {
      title: '操作',
      width: 180,
      render: (_: unknown, record: Certificate) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<IconEye />}
            onClick={() => handleViewDetail(record.id)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <Popconfirm
              title="确认取消"
              content="确定要取消该证明申请吗？"
              onOk={() => handleCancel(record.id)}
            >
              <Button type="text" size="small" status="danger">
                取消
              </Button>
            </Popconfirm>
          )}
          {(record.status === 'generated' || record.status === 'approved') && record.fileUrl && (
            <Button
              type="text"
              size="small"
              icon={<IconDownload />}
              onClick={() => window.open(record.fileUrl, '_blank')}
            >
              下载
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    form.resetFields()
    form.setFieldsValue({
      language: 'zh',
      needSeal: true,
      deliveryMethod: 'electronic',
    })
    setVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      setSaving(true)

      await createCertificate({
        type: values.type,
        purpose: values.purpose,
      })

      Message.success('申请提交成功')
      setVisible(false)
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    } finally {
      setSaving(false)
    }
  }

  const handleViewDetail = async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await getCertificate(id)
      setDetailData(res.data)
      setDetailVisible(true)
    } catch {
      // error handled by interceptor
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCancel = async (id: number) => {
    try {
      await cancelCertificate(id)
      Message.success('取消成功')
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    }
  }

  const handleSearch = () => {
    fetchData(1, pagination.pageSize)
  }

  const handleReset = () => {
    setSearchType(undefined)
    setSearchStatus(undefined)
    setDateRange([])
    fetchData(1, pagination.pageSize)
  }

  const handleRefresh = () => {
    fetchData(pagination.current, pagination.pageSize)
  }

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize)
  }

  return (
    <div className={styles.certificate}>
      <Card bordered={false} className={styles.certificate__card}>
        <PageHeader
          title="我的证明申请"
          description="申请各类人事证明文件"
          extra={
            <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
              申请证明
            </Button>
          }
          onRefresh={handleRefresh}
        />
      </Card>

      <Card bordered={false} className={styles.certificate__card}>
        <FilterBar
          filters={
            <>
              <FormItem label="证明类型">
                <Select
                  className={styles['certificate__filter-select']}
                  placeholder="请选择"
                  value={searchType}
                  onChange={setSearchType}
                  allowClear
                >
                  {certificateTypes.map((item) => (
                    <Option key={item.value} value={item.value}>
                      {item.label}
                    </Option>
                  ))}
                </Select>
              </FormItem>
              <FormItem label="状态">
                <Select
                  className={styles['certificate__filter-select']}
                  placeholder="请选择"
                  value={searchStatus}
                  onChange={setSearchStatus}
                  allowClear
                >
                  <Option value="pending">待审批</Option>
                  <Option value="approved">已通过</Option>
                  <Option value="rejected">已驳回</Option>
                  <Option value="cancelled">已取消</Option>
                  <Option value="generated">已生成</Option>
                </Select>
              </FormItem>
              <FormItem label="申请时间">
                <RangePicker
                  className={styles['certificate__date-picker']}
                  value={dateRange}
                  onChange={(_, date) => setDateRange(date)}
                />
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
          searchText="查询"
        />
      </Card>

      <Card bordered={false}>
        <Table
          loading={loading}
          columns={columns}
          data={data}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal focusLock
        title="申请证明"
        visible={visible}
        onOk={handleSubmit}
        onCancel={() => setVisible(false)}
        confirmLoading={saving}
        className={styles.certificate__modal}
        okText="提交申请"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="证明类型"
            field="type"
            rules={[{ required: true, message: '请选择证明类型' }]}
          >
            <Select placeholder="请选择证明类型">
              {certificateTypes.map((item) => (
                <Option key={item.value} value={item.value}>
                  {item.label}
                </Option>
              ))}
            </Select>
          </FormItem>

          <FormItem
            label="用途说明"
            field="purpose"
            rules={[{ required: true, message: '请填写用途说明' }]}
          >
            <Input.TextArea
              placeholder="请填写证明用途，如：办理房贷、办理签证、入职新公司等"
              rows={3}
              maxLength={200}
              showWordLimit
            />
          </FormItem>

          <FormItem label="语言版本" field="language">
            <RadioGroup>
              <Radio value="zh">中文</Radio>
              <Radio value="en">英文</Radio>
            </RadioGroup>
          </FormItem>

          <FormItem label="是否需要盖章" field="needSeal">
            <Switch checkedText="是" uncheckedText="否" />
          </FormItem>

          <FormItem label="交付方式" field="deliveryMethod">
            <RadioGroup>
              <Radio value="electronic">电子版</Radio>
              <Radio value="paper">纸质版</Radio>
            </RadioGroup>
          </FormItem>

          <FormItem label="备注" field="remark">
            <Input.TextArea
              placeholder="其他需要说明的事项"
              rows={2}
              maxLength={200}
              showWordLimit
            />
          </FormItem>
        </Form>
      </Modal>

      <Modal focusLock
        title="证明申请详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        className={styles['certificate__detail-modal']}
        style={{ width: 600 }}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>加载中...</div>
        ) : detailData ? (
          <div className={styles.certificate__detail}>
            <div className={styles['certificate__detail-header']}>
              <Space size="large" align="center">
                <div>
                  <Title heading={6} style={{ margin: 0 }}>
                    {typeMap[detailData.type] || detailData.type}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    申请编号：{detailData.id}
                  </Text>
                </div>
                <Tag color={statusMap[detailData.status]?.color} style={{ marginLeft: 'auto' }}>
                  {statusMap[detailData.status]?.text}
                </Tag>
              </Space>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            <Descriptions
              column={1}
              labelStyle={{ width: 100, color: 'var(--color-text-2)' }}
              data={[
                {
                  label: '证明类型',
                  value: typeMap[detailData.type] || detailData.type,
                },
                {
                  label: '用途',
                  value: detailData.purpose || '-',
                },
                {
                  label: '申请时间',
                  value: formatDate(detailData.createdAt, 'YYYY-MM-DD HH:mm'),
                },
                {
                  label: '审批人',
                  value: detailData.approverName || '-',
                },
                {
                  label: '审批时间',
                  value: detailData.approvedAt
                    ? formatDate(detailData.approvedAt, 'YYYY-MM-DD HH:mm')
                    : '-',
                },
                {
                  label: '生成时间',
                  value: detailData.generatedAt
                    ? formatDate(detailData.generatedAt, 'YYYY-MM-DD HH:mm')
                    : '-',
                },
              ]}
            />

            {detailData.rejectReason && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <div className={styles['certificate__detail-reject']}>
                  <Text type="error" style={{ fontWeight: 500 }}>
                    驳回原因：
                  </Text>
                  <p style={{ marginTop: 8, color: 'var(--color-text-2)' }}>
                    {detailData.rejectReason}
                  </p>
                </div>
              </>
            )}

            {detailData.fileUrl && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <div className={styles['certificate__detail-file']}>
                  <Text style={{ fontWeight: 500 }}>证明文件：</Text>
                  <Button
                    type="text"
                    icon={<IconFile />}
                    onClick={() => window.open(detailData.fileUrl, '_blank')}
                    style={{ padding: '4px 8px' }}
                  >
                    查看/下载
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default CertificatePage
