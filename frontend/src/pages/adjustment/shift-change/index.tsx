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
  Grid,
  DatePicker,
  Empty,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { getShiftChangeList } from '@/api/adjustment'
import type { ShiftChange } from '@/api/adjustment'
import { FilterBar, TableHeader } from '@/components'
import styles from './shift-change.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '审批中', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
  cancelled: { text: '已撤销', color: 'gray' },
}

const shiftOptions = ['标准早班', '午班', '夜班', '弹性工作制']

function ShiftChangePage() {
  const [data, setData] = useState<ShiftChange[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const fetchData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await getShiftChangeList({
        page,
        pageSize,
        status: searchStatus,
      })
      let list = res.data.list
      if (searchText) {
        list = list.filter(
          (item: ShiftChange) =>
            item.employeeName?.includes(searchText) ||
            item.employeeNo?.includes(searchText),
        )
      }
      setData(list)
      setPagination((prev) => ({ ...prev, current: page, pageSize, total: res.data.total }))
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns: TableProps<ShiftChange>['columns'] = [
    {
      title: '申请人',
      dataIndex: 'employeeName',
      width: 100,
    },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      width: 100,
    },
    {
      title: '原班次',
      dataIndex: 'originalShift',
      width: 120,
      render: (value: string) => <Tag color="gray">{value}</Tag>,
    },
    {
      title: '调班后',
      dataIndex: 'targetShift',
      width: 120,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '调班日期',
      dataIndex: 'date',
      width: 110,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => {
        const info = statusMap[value] || { text: value, color: 'gray' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (value: string) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: '操作',
      width: 120,
      render: (_: unknown, record: ShiftChange) => (
        <Space size="small">
          <Button type="text" size="small" icon={<IconEye />}>
            详情
          </Button>
          {record.status === 'pending' && (
            <Popconfirm
              title="确认撤销"
              content="确定要撤销该调班申请吗？"
              onOk={() => handleCancel(record.id)}
            >
              <Button type="text" size="small" status="danger">
                撤销
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const handleAdd = () => {
    form.resetFields()
    setVisible(true)
  }

  const handleCancel = (_id: number) => {
    Message.info('功能开发中')
  }

  const handleOk = async () => {
    try {
      await form.validate()
      Message.info('调班功能开发中')
      setVisible(false)
    } catch {
      // error handled by interceptor
    }
  }

  const handleSearch = () => {
    fetchData(1, pagination.pageSize)
  }

  const handleReset = () => {
    setSearchText('')
    setSearchStatus(undefined)
    fetchData(1, pagination.pageSize)
  }

  const handlePageChange = (page: number, pageSize: number) => {
    fetchData(page, pageSize)
  }

  return (
    <div className={styles['adjustment-shift']}>
      <Card bordered={false} className={styles['adjustment-shift__search-card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="关键字">
                <Input
                  className={styles['adjustment-shift__search-input']}
                  placeholder="姓名/工号"
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
              </FormItem>
              <FormItem label="状态">
                <Select
                  className={styles['adjustment-shift__status-select']}
                  placeholder="请选择"
                  value={searchStatus}
                  onChange={setSearchStatus}
                  allowClear
                >
                  <Option value="pending">审批中</Option>
                  <Option value="approved">已通过</Option>
                  <Option value="rejected">已驳回</Option>
                  <Option value="cancelled">已撤销</Option>
                </Select>
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
        />
      </Card>

      <Card bordered={false} className={styles['adjustment-shift__table-card']}>
        <TableHeader
          title="调班申请"
          total={pagination.total}
          totalText="条"
          extra={
            <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>
              申请调班
            </Button>
          }
        />

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
          noDataElement={<Empty description="暂无调班申请记录" />}
        />
      </Card>

      <Modal focusLock
        title="申请调班"
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        className={styles['adjustment-shift__modal']}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem
                label="原班次"
                field="originalShift"
                rules={[{ required: true, message: '请选择原班次' }]}
              >
                <Select placeholder="请选择">
                  {shiftOptions.map((s) => (
                    <Option key={s} value={s}>
                      {s}
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                label="调班后班次"
                field="targetShift"
                rules={[{ required: true, message: '请选择目标班次' }]}
              >
                <Select placeholder="请选择">
                  {shiftOptions.map((s) => (
                    <Option key={s} value={s}>
                      {s}
                    </Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
          </Row>
          <FormItem
            label="调班日期"
            field="date"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker className={styles['adjustment-shift__date-picker']} />
          </FormItem>
          <FormItem label="调班原因" field="reason">
            <Input.TextArea placeholder="请输入调班原因" rows={4} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default ShiftChangePage
