import { useEffect, useState, useCallback } from 'react'
import {
  Button,
  Card,
  Form,
  Grid,
  Input,
  InputNumber,
  Message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
} from '@arco-design/web-react'
import { IconDelete, IconEdit, IconPlus } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import { createShift, deleteShift, getShifts, updateShift } from '@/api/shift'
import { PageHeader, FilterBar, DraggableTable } from '@/components'
import styles from './style.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface Shift {
  id: number
  name: string
  code: string
  startTime: string
  endTime: string
  workHours: number
  isFlexible: boolean
  isCrossDay: boolean
  beginCheckinMinutes: number
  allowCheckoutMinutes: number
  lateGraceMinutes: number
  earlyGraceMinutes: number
  status: 'active' | 'inactive'
  sortOrder: number
  description?: string
}

function ShiftList() {
  const [data, setData] = useState<Shift[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<Shift | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [form] = Form.useForm()

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getShifts({
        page: 1,
        pageSize: 100,
        keyword: searchText || undefined,
        status: searchStatus,
      })
      setData(res.data?.list || [])
      setTotal(res.data?.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      startTime: '09:00',
      endTime: '18:00',
      workHours: 8,
      isFlexible: false,
      isCrossDay: false,
      beginCheckinMinutes: 60,
      allowCheckoutMinutes: 60,
      lateGraceMinutes: 0,
      earlyGraceMinutes: 0,
      status: 'active',
      sortOrder: 0,
    })
    setVisible(true)
  }

  const openEdit = (record: Shift) => {
    setEditing(record)
    form.setFieldsValue({
      ...record,
      workHours: Number(record.workHours || 0),
    })
    setVisible(true)
  }

  const handleDelete = async (id: number) => {
    await deleteShift(id)
    Message.success('删除成功')
    loadData()
  }

  const handleSubmit = async () => {
    const values = await form.validate()
    const payload = {
      ...values,
      workHours: Number(values.workHours || 0),
      beginCheckinMinutes: Number(values.beginCheckinMinutes || 0),
      allowCheckoutMinutes: Number(values.allowCheckoutMinutes || 0),
      lateGraceMinutes: Number(values.lateGraceMinutes || 0),
      earlyGraceMinutes: Number(values.earlyGraceMinutes || 0),
      sortOrder: Number(values.sortOrder || 0),
    }

    if (editing) {
      await updateShift(editing.id, payload)
      Message.success('班次更新成功')
    } else {
      await createShift(payload)
      Message.success('班次创建成功')
    }

    setVisible(false)
    loadData()
  }

  const handleReorder = useCallback(async (items: Shift[], _oldIndex: number, newIndex: number) => {
    setData(items)
    try {
      const updatedItems = items.map((item, index) => ({
        ...item,
        sortOrder: index,
      }))
      setData(updatedItems)

      const movedItem = updatedItems[newIndex]
      await updateShift(movedItem.id, { sortOrder: newIndex })
      Message.success('排序已更新')
    } catch {
      loadData()
    }
  }, [loadData])

  const columns: TableProps<Shift>['columns'] = [
    { title: '班次名称', dataIndex: 'name', width: 140, fixed: 'left' },
    { title: '编码', dataIndex: 'code', width: 110, render: (value) => <Tag color="blue">{value}</Tag> },
    { title: '上班', dataIndex: 'startTime', width: 90 },
    { title: '下班', dataIndex: 'endTime', width: 90 },
    { title: '工时', dataIndex: 'workHours', width: 80 },
    {
      title: '跨天',
      dataIndex: 'isCrossDay',
      width: 80,
      render: (value) => <Tag color={value ? 'purple' : 'gray'}>{value ? '是' : '否'}</Tag>,
    },
    { title: '提前打卡', dataIndex: 'beginCheckinMinutes', width: 100, render: (value) => `${value} 分钟` },
    { title: '延后签退', dataIndex: 'allowCheckoutMinutes', width: 100, render: (value) => `${value} 分钟` },
    { title: '迟到宽限', dataIndex: 'lateGraceMinutes', width: 100, render: (value) => `${value} 分钟` },
    { title: '早退宽限', dataIndex: 'earlyGraceMinutes', width: 100, render: (value) => `${value} 分钟` },
    {
      title: '弹性',
      dataIndex: 'isFlexible',
      width: 80,
      render: (value) => <Tag color={value ? 'green' : 'gray'}>{value ? '是' : '否'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value) => <Tag color={value === 'active' ? 'green' : 'gray'}>{value === 'active' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_: unknown, record: Shift) => (
        <Space>
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该班次？" onOk={() => handleDelete(record.id)}>
            <Button type="text" size="small" status="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles['shift-list']}>
      <Card bordered={false} className={styles['shift-list__card']}>
        <PageHeader
          title="班次列表"
          description="配置班次上下班时间、弹性班、跨天班等参数。"
          extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>新增班次</Button>}
        />
      </Card>

      <Card bordered={false} className={styles['shift-list__card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="班次">
                <Input
                  className={styles['shift-list__toolbar-input']}
                  placeholder="名称/编码"
                  value={searchText}
                  onChange={setSearchText}
                  allowClear
                />
              </FormItem>
              <FormItem label="状态">
                <Select className={styles['shift-list__toolbar-select']} placeholder="全部" value={searchStatus} onChange={setSearchStatus} allowClear>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </>
          }
          onSearch={loadData}
          onReset={() => { setSearchText(''); setSearchStatus(undefined); loadData() }}
          searchText="搜索"
        />
      </Card>

      <Card bordered={false}>
        <div className={styles['shift-list__header']}>
          <div>
            <span className={styles['shift-list__title']}>班次列表</span>
            <Tag color="blue" className={styles['shift-list__tag']}>共 {total} 个班次</Tag>
          </div>
        </div>

        <DraggableTable
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1300 }}
          onReorder={handleReorder}
          draggable={true}
        />
      </Card>

      <Modal focusLock
        title={editing ? '编辑班次' : '新增班次'}
        visible={visible}
        onOk={handleSubmit}
        onCancel={() => setVisible(false)}
        className={styles['shift-list__modal']}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="班次名称" field="name" rules={[{ required: true, message: '请输入班次名称' }]}>
                <Input placeholder="例如：标准早班" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="班次编码" field="code" rules={[{ required: true, message: '请输入班次编码' }]}>
                <Input placeholder="例如：DAY_SHIFT" disabled={Boolean(editing)} />
              </FormItem>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <FormItem label="上班时间" field="startTime" rules={[{ required: true, message: '请输入上班时间' }]}>
                <Input placeholder="09:00" />
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="下班时间" field="endTime" rules={[{ required: true, message: '请输入下班时间' }]}>
                <Input placeholder="18:00" />
              </FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="工时" field="workHours" rules={[{ required: true, message: '请输入工时' }]}>
                <InputNumber min={0} className={styles['shift-list__input-full']} />
              </FormItem>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <FormItem label="提前打卡窗口" field="beginCheckinMinutes">
                <InputNumber min={0} className={styles['shift-list__input-full']} suffix="分钟" />
              </FormItem>
            </Col>
            <Col span={6}>
              <FormItem label="延后签退窗口" field="allowCheckoutMinutes">
                <InputNumber min={0} className={styles['shift-list__input-full']} suffix="分钟" />
              </FormItem>
            </Col>
            <Col span={6}>
              <FormItem label="迟到宽限" field="lateGraceMinutes">
                <InputNumber min={0} className={styles['shift-list__input-full']} suffix="分钟" />
              </FormItem>
            </Col>
            <Col span={6}>
              <FormItem label="早退宽限" field="earlyGraceMinutes">
                <InputNumber min={0} className={styles['shift-list__input-full']} suffix="分钟" />
              </FormItem>
            </Col>
          </Row>

          <Space size="large">
            <FormItem label="跨天班" field="isCrossDay" triggerPropName="checked">
              <Switch />
            </FormItem>
            <FormItem label="弹性班" field="isFlexible" triggerPropName="checked">
              <Switch />
            </FormItem>
            <FormItem label="状态" field="status">
              <Select className={styles['shift-list__select']}>
                <Option value="active">启用</Option>
                <Option value="inactive">停用</Option>
              </Select>
            </FormItem>
            <FormItem label="排序" field="sortOrder">
              <InputNumber min={0} className={styles['shift-list__select']} />
            </FormItem>
          </Space>

          <FormItem label="说明" field="description">
            <Input.TextArea placeholder="可填写班次适用说明" autoSize={{ minRows: 2, maxRows: 4 }} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default ShiftList
