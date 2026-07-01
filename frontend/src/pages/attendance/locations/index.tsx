import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Message,
  Tag,
  Grid,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEdit,
  IconDelete,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getAttendanceLocations,
  createAttendanceLocation,
  updateAttendanceLocation,
  deleteAttendanceLocation,
  LOCATION_TYPE_OPTIONS,
  type AttendanceLocation,
} from '@/api/attendance-location'
import { DraggableTable } from '@/components'
import styles from './locations.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

function AttendanceLocationsPage() {
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<AttendanceLocation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<AttendanceLocation | null>(null)
  const [form] = Form.useForm()

  const fetchLocations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAttendanceLocations({ page, pageSize })
      if (res.code === 0) {
        setLocations(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  const handleCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      type: 'gps',
      radiusMeters: 100,
      status: 'active',
      sortOrder: 0,
    })
    setModalVisible(true)
  }

  const handleEdit = (record: AttendanceLocation) => {
    setEditing(record)
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      latitude: record.latitude,
      longitude: record.longitude,
      radiusMeters: record.radiusMeters,
      wifiSsid: record.wifiSsid,
      wifiBssid: record.wifiBssid,
      address: record.address,
      status: record.status,
      sortOrder: record.sortOrder,
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      if (editing) {
        await updateAttendanceLocation(editing.id, values)
        Message.success('更新成功')
      } else {
        await createAttendanceLocation(values)
        Message.success('创建成功')
      }
      setModalVisible(false)
      fetchLocations()
    } catch {
      // handled
    }
  }

  const handleDelete = async (record: AttendanceLocation) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除「${record.name}」吗？`,
      onOk: async () => {
        await deleteAttendanceLocation(record.id)
        Message.success('删除成功')
        fetchLocations()
      },
    })
  }

  const handleReorder = useCallback(async (items: AttendanceLocation[], _oldIndex: number, newIndex: number) => {
    setLocations(items)
    try {
      const movedItem = items[newIndex]
      await updateAttendanceLocation(movedItem.id, { sortOrder: newIndex })
      Message.success('排序已更新')
      fetchLocations()
    } catch {
      fetchLocations()
    }
  }, [fetchLocations])

  const columns: TableProps<AttendanceLocation>['columns'] = [
    {
      title: '位置名称',
      dataIndex: 'name',
      render: (val) => <span className={styles['attendance-locations__text-bold']}>{val}</span>,
    },
    {
      title: '打卡方式',
      dataIndex: 'type',
      width: 120,
      render: (val: string) => {
        const type = LOCATION_TYPE_OPTIONS.find((t) => t.value === val)
        return <Tag>{type?.label || val}</Tag>
      },
    },
    {
      title: 'GPS范围',
      dataIndex: 'radiusMeters',
      width: 120,
      render: (val, record) => {
        if (record.type === 'wifi') return '-'
        return `半径 ${val} 米`
      },
    },
    {
      title: 'WiFi SSID',
      dataIndex: 'wifiSsid',
      width: 140,
      render: (val, record) => {
        if (record.type === 'gps') return '-'
        return val || '-'
      },
    },
    {
      title: '地址',
      dataIndex: 'address',
      render: (val) => val || '-',
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 120,
      render: (val) => val?.name || '全部',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (val: string) => (
        <Tag color={val === 'active' ? 'green' : 'gray'}>
          {val === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 160,
      render: (_: any, record) => (
        <Space>
          <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="text" size="small" status="danger" icon={<IconDelete />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles['attendance-locations']}>
      <Card
        bordered={false}
        title="打卡位置配置"
        extra={
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            新增位置
          </Button>
        }
      >
        <DraggableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          data={locations}
          pagination={{
            total,
            current: page,
            pageSize,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          onReorder={handleReorder}
          draggable={true}
        />
      </Card>

      <Modal focusLock
        title={editing ? '编辑打卡位置' : '新增打卡位置'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        className={styles['attendance-locations__modal']}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="位置名称" field="name" rules={[{ required: true, message: '请输入位置名称' }]}>
                <Input placeholder="例如：公司总部" maxLength={100} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="打卡方式" field="type" rules={[{ required: true, message: '请选择打卡方式' }]}>
                <Select placeholder="请选择">
                  {LOCATION_TYPE_OPTIONS.map((t) => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
          </Row>

          <FormItem shouldUpdate noStyle>
            {(values) => {
              const showGps = values.type === 'gps' || values.type === 'both'
              const showWifi = values.type === 'wifi' || values.type === 'both'
              return (
                <>
                  {showGps && (
                    <Row gutter={16}>
                      <Col span={8}>
                        <FormItem label="纬度" field="latitude">
                          <InputNumber className={styles['attendance-locations__input-full']} min={-90} max={90} precision={7} placeholder="例如：31.2304" />
                        </FormItem>
                      </Col>
                      <Col span={8}>
                        <FormItem label="经度" field="longitude">
                          <InputNumber className={styles['attendance-locations__input-full']} min={-180} max={180} precision={7} placeholder="例如：121.4737" />
                        </FormItem>
                      </Col>
                      <Col span={8}>
                        <FormItem label="有效半径(米)" field="radiusMeters">
                          <InputNumber className={styles['attendance-locations__input-full']} min={10} max={5000} defaultValue={100} />
                        </FormItem>
                      </Col>
                    </Row>
                  )}
                  {showWifi && (
                    <Row gutter={16}>
                      <Col span={12}>
                        <FormItem label="WiFi SSID" field="wifiSsid">
                          <Input placeholder="WiFi名称" maxLength={100} />
                        </FormItem>
                      </Col>
                      <Col span={12}>
                        <FormItem label="WiFi BSSID" field="wifiBssid">
                          <Input placeholder="可选，MAC地址" maxLength={50} />
                        </FormItem>
                      </Col>
                    </Row>
                  )}
                </>
              )
            }}
          </FormItem>

          <FormItem label="地址描述" field="address">
            <Input placeholder="请输入地址描述" maxLength={255} />
          </FormItem>

          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="状态" field="status">
                <Select style={{ width: '100%' }} defaultValue="active">
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="排序" field="sortOrder">
                <InputNumber className={styles['attendance-locations__input-full']} min={0} max={9999} defaultValue={0} />
              </FormItem>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default AttendanceLocationsPage
