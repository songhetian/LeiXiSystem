import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Select,
  Space,
  Modal,
  Form,
  Tag,
  Card,
  DatePicker,
  Descriptions,
  Typography,
  Divider,
  Input,
  Upload,
} from '@arco-design/web-react'
import {
  IconEye,
  IconCheck,
  IconClose,
  IconFile,
  IconDownload,
  IconUpload as IconUploadIcon,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { Dayjs } from 'dayjs'
import {
  getCertificateList,
  approveCertificate,
  rejectCertificate,
  generateCertificate,
  getCertificate,
} from '@/api/certificate'
import type { Certificate } from '@/api/certificate'
import { formatDate } from '@/utils/date'
import { FilterBar, PageHeader } from '@/components'
import { toast } from '@/utils/toast'
import styles from './certificate-manage.module.css'
const FormItem = Form.Item
const Option = Select.Option
const { RangePicker } = DatePicker
const { Title, Text } = Typography
const TextArea = Input.TextArea

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

function CertificateManage() {
  const [data, setData] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailData, setDetailData] = useState<Certificate | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rejectVisible, setRejectVisible] = useState(false)
  const [generateVisible, setGenerateVisible] = useState(false)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectForm] = Form.useForm()
  const [generateForm] = Form.useForm()
  const [searchType, setSearchType] = useState<string | undefined>()
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [dateRange, setDateRange] = useState<Dayjs[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getCertificateList({
        page,
        pageSize,
        keyword: searchKeyword || undefined,
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
      title: '员工信息',
      width: 180,
      render: (_: unknown, record: Certificate) => (
        <div className={styles['certificate-manage__employee']}>
          <div className={styles['certificate-manage__employee-name']}>{record.employeeName}</div>
          <div className={styles['certificate-manage__employee-no']}>{record.employeeNo}</div>
        </div>
      ),
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '证明类型',
      dataIndex: 'type',
      width: 120,
      render: (value: string) => (
        <Tag color="blue" className={styles['certificate-manage__type-tag']}>
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
      title: '审批人',
      dataIndex: 'approverName',
      width: 100,
      render: (value?: string) => value || '-',
    },
    {
      title: '操作',
      width: 240,
      fixed: 'right',
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
            <>
              <Button
                type="text"
                size="small"
                icon={<IconCheck />}
                status="success"
                onClick={() => handleApprove(record.id)}
              >
                通过
              </Button>
              <Button
                type="text"
                size="small"
                icon={<IconClose />}
                status="danger"
                onClick={() => handleRejectClick(record.id)}
              >
                驳回
              </Button>
            </>
          )}
          {record.status === 'approved' && (
            <Button
              type="text"
              size="small"
              icon={<IconUploadIcon />}
              status="success"
              onClick={() => handleGenerateClick(record.id)}
            >
              生成证明
            </Button>
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

  const handleApprove = async (id: number) => {
    Modal.confirm({
      title: '确认通过',
      content: '确定要通过该证明申请吗？',
      onOk: async () => {
        try {
          setActionLoading(true)
          await approveCertificate(id)
          toast.success('已通过')
          fetchData(pagination.current, pagination.pageSize)
        } catch {
          // error handled by interceptor
        } finally {
          setActionLoading(false)
        }
      },
      okText: '确认',
      cancelText: '取消',
    })
  }

  const handleRejectClick = (id: number) => {
    setCurrentId(id)
    rejectForm.resetFields()
    setRejectVisible(true)
  }

  const handleRejectSubmit = async () => {
    try {
      const values = await rejectForm.validate()
      if (!currentId) return

      setActionLoading(true)
      await rejectCertificate(currentId, { reason: values.reason })
      toast.success('已驳回')
      setRejectVisible(false)
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerateClick = (id: number) => {
    setCurrentId(id)
    generateForm.resetFields()
    setGenerateVisible(true)
  }

  const handleGenerateSubmit = async () => {
    try {
      const values = await generateForm.validate()
      if (!currentId) return

      setActionLoading(true)
      await generateCertificate(currentId, {
        content: values.content,
      })
      toast.success('证明已生成')
      setGenerateVisible(false)
      fetchData(pagination.current, pagination.pageSize)
    } catch {
      // error handled by interceptor
    } finally {
      setActionLoading(false)
    }
  }

  const handleSearch = () => {
    fetchData(1, pagination.pageSize)
  }

  const handleReset = () => {
    setSearchType(undefined)
    setSearchStatus(undefined)
    setSearchKeyword('')
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
    <div className={styles['certificate-manage']}>
      <Card bordered={false} className={styles['certificate-manage__card']}>
        <PageHeader
          title="证明申请管理"
          description="管理员工的证明申请"
          onRefresh={handleRefresh}
        />
      </Card>

      <Card bordered={false} className={styles['certificate-manage__card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="员工搜索">
                <Input
                  className={styles['certificate-manage__search-input']}
                  placeholder="姓名/工号"
                  value={searchKeyword}
                  onChange={setSearchKeyword}
                  allowClear
                />
              </FormItem>
              <FormItem label="证明类型">
                <Select
                  className={styles['certificate-manage__filter-select']}
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
                  className={styles['certificate-manage__filter-select']}
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
                  className={styles['certificate-manage__date-picker']}
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
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal focusLock
        title="证明申请详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        className={styles['certificate-manage__detail-modal']}
      >
        {detailLoading ? (
          <div className={styles['certificate-manage__loading']}>加载中...</div>
        ) : detailData ? (
          <div className={styles['certificate-manage__detail']}>
            <div className={styles['certificate-manage__detail-header']}>
              <Space size="large" align="center">
                <div>
                  <Title heading={6} className={styles['certificate-manage__detail-title']}>
                    {typeMap[detailData.type] || detailData.type}
                  </Title>
                  <Text type="secondary" className={styles['certificate-manage__detail-subtitle']}>
                    申请编号：{detailData.id}
                  </Text>
                </div>
                <Tag
                  color={statusMap[detailData.status]?.color}
                  className={styles['certificate-manage__detail-tag-right']}
                >
                  {statusMap[detailData.status]?.text}
                </Tag>
              </Space>
            </div>

            <Divider className={styles['certificate-manage__detail-divider']} />

            <Descriptions
              column={2}
              labelStyle={{ width: 80, color: 'var(--color-text-2)' }}
              data={[
                {
                  label: '员工姓名',
                  value: detailData.employeeName,
                },
                {
                  label: '工号',
                  value: detailData.employeeNo,
                },
                {
                  label: '部门',
                  value: detailData.departmentName || '-',
                },
                {
                  label: '证明类型',
                  value: typeMap[detailData.type] || detailData.type,
                },
                {
                  label: '申请时间',
                  value: formatDate(detailData.createdAt, 'YYYY-MM-DD HH:mm'),
                  span: 2,
                },
                {
                  label: '用途',
                  value: detailData.purpose || '-',
                  span: 2,
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
                  span: 2,
                },
              ]}
            />

            {detailData.rejectReason && (
              <>
                <Divider className={styles['certificate-manage__detail-divider']} />
                <div className={styles['certificate-manage__detail-reject']}>
                  <Text type="error" className={styles['certificate-manage__detail-text-bold']}>
                    驳回原因：
                  </Text>
                  <p className={styles['certificate-manage__detail-reject-text']}>
                    {detailData.rejectReason}
                  </p>
                </div>
              </>
            )}

            {detailData.fileUrl && (
              <>
                <Divider className={styles['certificate-manage__detail-divider']} />
                <div className={styles['certificate-manage__detail-file']}>
                  <Text className={styles['certificate-manage__detail-text-bold']}>证明文件：</Text>
                  <Button
                    type="text"
                    icon={<IconFile />}
                    onClick={() => window.open(detailData.fileUrl, '_blank')}
                    className={styles['certificate-manage__detail-file-btn']}
                  >
                    查看/下载
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal focusLock
        title="驳回申请"
        visible={rejectVisible}
        onOk={handleRejectSubmit}
        onCancel={() => setRejectVisible(false)}
        confirmLoading={actionLoading}
        okText="确认驳回"
        cancelText="取消"
      >
        <Form form={rejectForm} layout="vertical">
          <FormItem
            label="驳回原因"
            field="reason"
            rules={[{ required: true, message: '请填写驳回原因' }]}
          >
            <TextArea
              placeholder="请填写驳回原因"
              rows={4}
              maxLength={500}
              showWordLimit
            />
          </FormItem>
        </Form>
      </Modal>

      <Modal focusLock
        title="生成证明"
        visible={generateVisible}
        onOk={handleGenerateSubmit}
        onCancel={() => setGenerateVisible(false)}
        confirmLoading={actionLoading}
        okText="生成"
        cancelText="取消"
      >
        <Form form={generateForm} layout="vertical">
          <FormItem label="证明内容" field="content">
            <TextArea
              placeholder="请输入证明内容（可选）"
              rows={6}
              maxLength={2000}
              showWordLimit
            />
          </FormItem>
          <FormItem label="上传证明文件">
            <Upload
              multiple
              accept=".pdf,.doc,.docx"
              listType="picture-card"
              customRequest={() => {}}
              tip="支持 pdf、doc、docx 格式，单个文件不超过 10MB"
            />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default CertificateManage
