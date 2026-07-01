import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Button,
  Space,
  Table,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Message,
  Tag,
  Tabs,
  Grid,
} from '@arco-design/web-react'
import {
  IconCheck,
  IconEdit,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getMyPendingSchedules,
  getMyConfirmedSchedules,
  getMyAppeals,
  confirmSchedules,
  confirmWeekSchedules,
  createAppeal,
  cancelAppeal,
  type ScheduleConfirmationItem,
  type ScheduleAppealItem,
} from '@/api/schedule'
import { getShifts, type Shift } from '@/api/shift'
import styles from './style.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

interface PendingItem extends ScheduleConfirmationItem {
  schedule: ScheduleConfirmationItem['schedule'] & {
    shift: {
      name: string
      color?: string
      startTime?: string
      endTime?: string
    }
  }
}

function MySchedulePage() {
  const [pendingGroups, setPendingGroups] = useState<Array<{
    periodStart: string
    periodEnd: string
    items: PendingItem[]
  }>>([])
  const [confirmed, setConfirmed] = useState<ScheduleConfirmationItem[]>([])
  const [confirmedTotal, setConfirmedTotal] = useState(0)
  const [confirmedPage, setConfirmedPage] = useState(1)
  const [appeals, setAppeals] = useState<ScheduleAppealItem[]>([])

  const [_loading, setLoading] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [appealModalVisible, setAppealModalVisible] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<PendingItem | null>(null)
  const [appealForm] = Form.useForm()
  const [shifts, setShifts] = useState<Shift[]>([])

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyPendingSchedules()
      if (res.code === 0) setPendingGroups(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchConfirmed = useCallback(async () => {
    const res = await getMyConfirmedSchedules({ page: confirmedPage, pageSize: 20 })
    if (res.code === 0) {
      setConfirmed(res.data.list)
      setConfirmedTotal(res.data.total)
    }
  }, [confirmedPage])

  const fetchAppeals = useCallback(async () => {
    const res = await getMyAppeals()
    if (res.code === 0) setAppeals(res.data)
  }, [])

  const fetchShifts = useCallback(async () => {
    const res = await getShifts()
    if (res.code === 0) setShifts(res.data.list)
  }, [])

  useEffect(() => {
    fetchPending()
    fetchConfirmed()
    fetchAppeals()
    fetchShifts()
  }, [fetchPending, fetchConfirmed, fetchAppeals, fetchShifts])

  const handleConfirmWeek = async () => {
    const res = await confirmWeekSchedules()
    if (res.code === 0) {
      Message.success(res.message)
      fetchPending()
    }
  }

  const handleConfirmSelected = async () => {
    if (selectedKeys.length === 0) {
      Message.warning('请选择要确认的排班')
      return
    }
    const res = await confirmSchedules(selectedKeys)
    if (res.code === 0) {
      Message.success(`成功确认 ${res.data.count} 条排班`)
      setSelectedKeys([])
      fetchPending()
    }
  }

  const handleOpenAppeal = (item: PendingItem) => {
    setEditingSchedule(item)
    appealForm.resetFields()
    setAppealModalVisible(true)
  }

  const handleAppealSubmit = async () => {
    try {
      const values = await appealForm.validate()
      await createAppeal({
        scheduleId: editingSchedule!.schedule.id,
        reason: values.reason,
        expectedDate: values.expectedDate?.format('YYYY-MM-DD'),
        expectedShiftId: values.expectedShiftId,
      })
      Message.success('申诉已提交')
      setAppealModalVisible(false)
      fetchPending()
      fetchAppeals()
    } catch {
      // handled
    }
  }

  const handleCancelAppeal = async (id: number) => {
    await cancelAppeal(id)
    Message.success('申诉已取消')
    fetchPending()
    fetchAppeals()
  }

  const confirmedColumns: TableProps<ScheduleConfirmationItem>['columns'] = [
    {
      title: '日期',
      dataIndex: 'schedule',
      width: 110,
      render: (_: any, record: ScheduleConfirmationItem) => record.schedule?.scheduleDate?.split('T')[0],
    },
    {
      title: '班次',
      dataIndex: 'schedule',
      width: 100,
      render: (_: any, record: ScheduleConfirmationItem) => (
        <Tag color={record.schedule?.shift?.color}>{record.schedule?.shift?.name}</Tag>
      ),
    },
    {
      title: '时间',
      width: 140,
      render: (_: any, record: ScheduleConfirmationItem) => {
        const s = record.schedule?.shift
        return s?.startTime && s?.endTime ? `${s.startTime} - ${s.endTime}` : '-'
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => {
        const map: Record<string, string> = { confirmed: '已确认', auto_confirmed: '自动确认' }
        const color: Record<string, string> = { confirmed: 'green', auto_confirmed: 'gray' }
        return <Tag color={color[val]}>{map[val]}</Tag>
      },
    },
  ]

  const appealColumns: TableProps<ScheduleAppealItem>['columns'] = [
    {
      title: '排班日期',
      dataIndex: 'schedule',
      width: 110,
      render: (_: any, record: ScheduleAppealItem) => record.schedule?.scheduleDate?.split('T')[0],
    },
    {
      title: '原班次',
      dataIndex: 'schedule',
      render: (_: any, record: ScheduleAppealItem) => <Tag color={record.schedule?.shift?.color}>{record.schedule?.shift?.name}</Tag>,
    },
    {
      title: '申诉原因',
      dataIndex: 'reason',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (val: string) => {
        const map: Record<string, string> = { pending: '待处理', approved: '已批准', rejected: '已驳回' }
        const colorMap: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red' }
        return <Tag color={colorMap[val]}>{map[val]}</Tag>
      },
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => record.status === 'pending' ? (
        <Button type="text" size="small" status="danger" onClick={() => handleCancelAppeal(record.id)}>
          取消申诉
        </Button>
      ) : (
        <span className={styles['my-schedule__text-secondary']}>{record.handlerNote || '-'}</span>
      ),
    },
  ]

  const totalPending = pendingGroups.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <div className={styles['my-schedule']}>
      <Row gutter={16} className={styles['my-schedule__row']}>
        <Col span={8}>
          <Card bordered={false}>
            <div className={styles['my-schedule__stat']}>
              <div className={styles['my-schedule__stat-value'] + ' ' + styles['my-schedule__stat-value-orange']}>{totalPending}</div>
              <div className={styles['my-schedule__stat-label']}>待确认排班</div>
            </div>
          </Card>
        </Col>
        <Col span={16}>
          <Card bordered={false}>
            <Space>
              <Button type="primary" icon={<IconCheck />} onClick={handleConfirmWeek}>
                一键确认本周
              </Button>
              <Button icon={<IconCheck />} onClick={handleConfirmSelected} disabled={selectedKeys.length === 0}>
                确认所选 ({selectedKeys.length})
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} title="我的排班">
        <Tabs defaultActiveTab="pending">
          <TabPane title={`待确认 (${totalPending})`} key="pending">
            <div>
              {pendingGroups.map((group) => (
                <div key={`${group.periodStart}_${group.periodEnd}`} className={styles['my-schedule__period']}>
                  <div className={styles['my-schedule__period-title']}>
                    {group.periodStart.split('T')[0]} ~ {group.periodEnd.split('T')[0]}
                    <span className={styles['my-schedule__period-count']}>({group.items.length}天)</span>
                  </div>
                  <Table
                    rowKey="id"
                    size="small"
                    data={group.items}
                    rowSelection={{
                      type: 'checkbox',
                      selectedRowKeys: selectedKeys,
                      onChange: (keys) => setSelectedKeys(keys as number[]),
                    }}
                    columns={[
                      {
                        title: '日期',
                        dataIndex: 'schedule',
                        render: (_: any, record: any) => record.schedule?.scheduleDate?.split('T')[0],
                      },
                      {
                        title: '班次',
                        dataIndex: 'schedule',
                        render: (_: any, record: any) => (
                          <Tag color={record.schedule?.shift?.color}>{record.schedule?.shift?.name}</Tag>
                        ),
                      },
                      {
                        title: '时间',
                        render: (_: any, record: any) => {
                          const s = record.schedule?.shift
                          return s?.startTime && s?.endTime ? `${s.startTime} - ${s.endTime}` : '-'
                        },
                      },
                      {
                        title: '操作',
                        width: 80,
                        render: (_: any, record: any) => (
                          <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleOpenAppeal(record)}>
                            申诉
                          </Button>
                        ),
                      },
                    ]}
                  />
                </div>
              ))}
              {pendingGroups.length === 0 && (
                <div className={styles['my-schedule__empty']}>
                  暂无待确认的排班
                </div>
              )}
            </div>
          </TabPane>

          <TabPane title="已确认" key="confirmed">
            <Table
              rowKey="id"
              columns={confirmedColumns}
              data={confirmed}
              pagination={{
                total: confirmedTotal,
                current: confirmedPage,
                pageSize: 20,
                onChange: setConfirmedPage,
              }}
            />
          </TabPane>

          <TabPane title="申诉记录" key="appeals">
            <Table
              rowKey="id"
              columns={appealColumns}
              data={appeals}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal focusLock
        title="发起申诉"
        visible={appealModalVisible}
        onOk={handleAppealSubmit}
        onCancel={() => setAppealModalVisible(false)}
        okText="提交申诉"
      >
        <Form form={appealForm} layout="vertical">
          <FormItem label="排班日期">
            <Input disabled value={editingSchedule?.schedule?.scheduleDate?.split('T')[0]} />
          </FormItem>
          <FormItem label="原班次">
            <Input disabled value={editingSchedule?.schedule?.shift?.name} />
          </FormItem>
          <FormItem label="申诉原因" field="reason" rules={[{ required: true, message: '请输入申诉原因' }]}>
            <Input.TextArea rows={3} placeholder="请详细说明申诉原因" maxLength={500} />
          </FormItem>
          <FormItem label="期望调整日期" field="expectedDate">
            <DatePicker className={styles['my-schedule__date-picker']} />
          </FormItem>
          <FormItem label="期望班次" field="expectedShiftId">
            <Select placeholder="选择期望班次" allowClear>
              {shifts.map((s) => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
            </Select>
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default MySchedulePage
