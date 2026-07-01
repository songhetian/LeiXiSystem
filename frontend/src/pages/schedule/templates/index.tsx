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
  InputNumber,
  Message,
  Tag,
  Grid,
  Tabs,
  DatePicker,
  Switch,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconEye,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getScheduleTemplates,
  getScheduleTemplate,
  createScheduleTemplate,
  updateScheduleTemplate,
  deleteScheduleTemplate,
  previewApplyTemplate,
  applyTemplate,
  type ScheduleTemplate,
  type TemplatePreviewItem,
} from '@/api/schedule'
import { getShifts, type Shift } from '@/api/shift'
import { getDepartmentsList, type Department } from '@/api/organization'
import { getEmployees, type Employee } from '@/api/personnel'
import styles from './style.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane
const TextArea = Input.TextArea

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function TemplatesPage() {
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [modalVisible, setModalVisible] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ScheduleTemplate | null>(null)
  const [form] = Form.useForm()

  const [applyVisible, setApplyVisible] = useState(false)
  const [applyForm] = Form.useForm()
  const [previewData, setPreviewData] = useState<TemplatePreviewItem[]>([])
  const [previewStats, setPreviewStats] = useState({ total: 0, willCreate: 0, willOverwrite: 0, willSkip: 0 })
  const [previewLoading, setPreviewLoading] = useState(false)
  const [applying, setApplying] = useState(false)

  const [shifts, setShifts] = useState<Shift[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const [templateItems, setTemplateItems] = useState<Array<{ dayIndex: number; shiftIds: string; weekday?: number }>>([])

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getScheduleTemplates({ page, pageSize })
      if (res.code === 0) {
        setTemplates(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  const fetchShifts = useCallback(async () => {
    const res = await getShifts()
    if (res.code === 0) setShifts(res.data.list)
  }, [])

  const fetchDepartments = useCallback(async () => {
    const res = await getDepartmentsList()
    if (res.code === 0) setDepartments(res.data || [])
  }, [])

  const fetchEmployees = useCallback(async () => {
    const res = await getEmployees({ page: 1, pageSize: 1000 })
    if (res.code === 0) setEmployees(res.data?.list || [])
  }, [])

  useEffect(() => {
    fetchTemplates()
    fetchShifts()
    fetchDepartments()
    fetchEmployees()
  }, [fetchTemplates, fetchShifts, fetchDepartments, fetchEmployees])

  const handleCreate = () => {
    setEditingTemplate(null)
    form.resetFields()
    setTemplateItems(Array.from({ length: 7 }, (_, i) => ({ dayIndex: i, shiftIds: '', weekday: i })))
    form.setFieldsValue({
      cycleDays: 7,
      repeatType: 'weekday',
      status: 'active',
      sortOrder: 0,
    })
    setModalVisible(true)
  }

  const handleEdit = async (template: ScheduleTemplate) => {
    setEditingTemplate(template)
    const res = await getScheduleTemplate(template.id)
    if (res.code === 0) {
      const data = res.data
      form.setFieldsValue({
        name: data.name,
        code: data.code,
        departmentId: data.departmentId,
        cycleDays: data.cycleDays,
        repeatType: data.repeatType,
        description: data.description,
        status: data.status,
        sortOrder: data.sortOrder,
      })
      const items = data.items.sort((a, b) => a.dayIndex - b.dayIndex)
      setTemplateItems(items.map((i) => ({ dayIndex: i.dayIndex, shiftIds: i.shiftIds, weekday: i.weekday ?? undefined })))
      setModalVisible(true)
    }
  }

  const handleDelete = async (template: ScheduleTemplate) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除模板「${template.name}」吗？`,
      onOk: async () => {
        await deleteScheduleTemplate(template.id)
        Message.success('删除成功')
        fetchTemplates()
      },
    })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      const items = templateItems.filter((i) => i.shiftIds.trim() !== '')
      if (items.length === 0) {
        Message.error('请至少配置一天的班次')
        return
      }
      const data = { ...values, items }
      if (editingTemplate) {
        await updateScheduleTemplate(editingTemplate.id, data)
        Message.success('更新成功')
      } else {
        await createScheduleTemplate(data)
        Message.success('创建成功')
      }
      setModalVisible(false)
      fetchTemplates()
    } catch {
      // handled
    }
  }

  const handlePreview = async () => {
    try {
      const values = await applyForm.validate()
      const [startDate, endDate] = values.dateRange || []
      if (!startDate || !endDate) {
        Message.error('请选择日期范围')
        return
      }
      setPreviewLoading(true)
      const res = await previewApplyTemplate({
        templateId: values.templateId,
        departmentId: values.departmentId,
        employeeIds: values.employeeIds?.join(','),
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        overwrite: values.overwrite,
      })
      if (res.code === 0) {
        setPreviewData(res.data.preview)
        setPreviewStats({
          total: res.data.total,
          willCreate: res.data.willCreate,
          willOverwrite: res.data.willOverwrite,
          willSkip: res.data.willSkip,
        })
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleApply = async () => {
    try {
      const values = await applyForm.validate()
      const [startDate, endDate] = values.dateRange || []
      setApplying(true)
      const res = await applyTemplate({
        templateId: values.templateId,
        departmentId: values.departmentId,
        employeeIds: values.employeeIds?.join(','),
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        overwrite: values.overwrite,
      })
      if (res.code === 0) {
        Message.success(res.message)
        setApplyVisible(false)
        setPreviewData([])
        applyForm.resetFields()
      }
    } finally {
      setApplying(false)
    }
  }

  const handleOpenApply = (template: ScheduleTemplate) => {
    applyForm.resetFields()
    applyForm.setFieldsValue({
      templateId: template.id,
      overwrite: false,
    })
    setPreviewData([])
    setApplyVisible(true)
  }

  const renderItemForm = () => {
    const repeatType = form.getFieldValue('repeatType') || 'weekday'
    const cycleDays = form.getFieldValue('cycleDays') || 7
    const days = repeatType === 'weekday' ? 7 : cycleDays

    return (
      <div className={styles['template-items']}>
        {Array.from({ length: days }, (_, i) => {
          const item = templateItems[i] || { dayIndex: i, shiftIds: '' }
          return (
            <div key={i} className={styles['template-item-row']}>
              <span className={styles['template-item-label']}>
                {repeatType === 'weekday' ? WEEKDAYS[i] : `第${i + 1}天`}
              </span>
              <Select
                mode="multiple"
                placeholder="选择班次"
                className={styles['template-item-select']}
                value={item.shiftIds ? item.shiftIds.split(',').map(Number).filter(Boolean) : []}
                onChange={(val: number[]) => {
                  const newItems = [...templateItems]
                  newItems[i] = {
                    dayIndex: i,
                    shiftIds: val.join(','),
                    weekday: repeatType === 'weekday' ? i : undefined,
                  }
                  setTemplateItems(newItems)
                }}
              >
                {shifts.map((s) => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
            </div>
          )
        })}
      </div>
    )
  }

  const columns: TableProps<ScheduleTemplate>['columns'] = [
    {
      title: '模板名称',
      dataIndex: 'name',
      render: (val) => <span className={styles['schedule-templates__cell-name']}>{val}</span>,
    },
    {
      title: '编码',
      dataIndex: 'code',
      width: 120,
      render: (val) => <Tag color="arcoblue">{val}</Tag>,
    },
    {
      title: '周期',
      width: 100,
      render: (_: any, record) => `${record.cycleDays}天/${record.repeatType === 'weekday' ? '按周' : '按天'}`,
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
      width: 220,
      render: (_: any, record) => (
        <Space>
          <Button type="text" size="small" icon={<IconEye />} onClick={() => handleOpenApply(record)}>
            应用
          </Button>
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
    <div className={styles['schedule-templates']}>
      <Card
        bordered={false}
        title="排班模板"
        extra={
          <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
            新建模板
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={templates}
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

      {/* 模板编辑弹窗 */}
      <Modal focusLock
        title={editingTemplate ? '编辑模板' : '新建模板'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        className={styles['schedule-templates__modal-large']}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="模板名称" field="name" rules={[{ required: true, message: '请输入模板名称' }]}>
                <Input placeholder="如：三班倒模板" maxLength={100} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="模板编码" field="code" rules={[{ required: true, message: '请输入编码' }]}>
                <Input placeholder="如 three_shift" maxLength={50} disabled={!!editingTemplate} />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="适用部门" field="departmentId">
                <Select placeholder="全部部门" allowClear>
                  {departments.map((d) => (
                    <Option key={d.id} value={d.id}>{d.name}</Option>
                  ))}
                </Select>
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="重复类型" field="repeatType">
                <Select>
                  <Option value="weekday">按星期循环</Option>
                  <Option value="day">按天数循环</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="周期天数" field="cycleDays" rules={[{ required: true }]}>
                <InputNumber min={1} max={30} className={styles['schedule-templates__input-number']} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="状态" field="status">
                <Select className={styles['schedule-templates__select-status']}>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <FormItem label="说明" field="description">
            <TextArea placeholder="模板说明" rows={2} maxLength={500} />
          </FormItem>
          <FormItem label="班次配置">
            {renderItemForm()}
          </FormItem>
        </Form>
      </Modal>

      {/* 应用模板弹窗 */}
      <Modal focusLock
        title="应用排班模板"
        visible={applyVisible}
        onOk={handleApply}
        onCancel={() => { setApplyVisible(false); setPreviewData([]) }}
        className={styles['schedule-templates__modal-xlarge']}
        okText="确认应用"
        cancelText="取消"
        confirmLoading={applying}
      >
        <Tabs defaultActiveTab="config">
          <TabPane title="配置参数" key="config">
            <Form form={applyForm} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <FormItem label="选择模板" field="templateId" rules={[{ required: true }]}>
                    <Select placeholder="请选择模板" disabled>
                      {templates.map((t) => (
                        <Option key={t.id} value={t.id}>{t.name}</Option>
                      ))}
                    </Select>
                  </FormItem>
                </Col>
                <Col span={12}>
                  <FormItem label="目标部门" field="departmentId">
                    <Select placeholder="全部部门" allowClear>
                      {departments.map((d) => (
                        <Option key={d.id} value={d.id}>{d.name}</Option>
                      ))}
                    </Select>
                  </FormItem>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <FormItem label="日期范围" field="dateRange" rules={[{ required: true, message: '请选择日期范围' }]}>
                    <DatePicker.RangePicker className={styles['schedule-templates__range-picker']} />
                  </FormItem>
                </Col>
                <Col span={12}>
                  <FormItem label="覆盖已有排班" field="overwrite" triggerPropName="checked">
                    <Switch />
                  </FormItem>
                </Col>
              </Row>
              <FormItem label="指定人员（可选，不选则应用到整个部门）" field="employeeIds">
                <Select mode="multiple" placeholder="选择人员" allowClear className={styles['schedule-templates__select-employees']}>
                  {employees.map((e) => (
                    <Option key={e.id} value={e.id}>{e.realName} ({e.employeeNo})</Option>
                  ))}
                </Select>
              </FormItem>
              <Button type="primary" loading={previewLoading} onClick={handlePreview}>
                生成预览
              </Button>
            </Form>
          </TabPane>
          <TabPane title="预览结果" key="preview">
            {previewData.length > 0 ? (
              <>
                <div className={styles['schedule-templates__preview-stats']}>
                  <Space>
                    <Tag color="blue">总计: {previewStats.total}</Tag>
                    <Tag color="green">新建: {previewStats.willCreate}</Tag>
                    <Tag color="orange">覆盖: {previewStats.willOverwrite}</Tag>
                    <Tag color="gray">跳过: {previewStats.willSkip}</Tag>
                  </Space>
                </div>
                <Table
                  data={previewData}
                  rowKey={(r) => `${r.employeeId}_${r.date}_${r.shiftId}`}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: '员工', dataIndex: 'employeeName', width: 100 },
                    { title: '日期', dataIndex: 'date', width: 110 },
                    { title: '班次', dataIndex: 'shiftName', width: 100, render: (v, r) => <Tag color={r.shiftColor || 'arcoblue'}>{v}</Tag> },
                    {
                      title: '操作',
                      width: 100,
                      render: (_: any, r: TemplatePreviewItem) => (
                        r.willSkip ? <Tag color="gray">跳过</Tag> :
                        r.willOverwrite ? <Tag color="orange">覆盖</Tag> :
                        <Tag color="green">新建</Tag>
                      ),
                    },
                  ]}
                  scroll={{ y: 300 }}
                />
              </>
            ) : (
              <div className={styles['schedule-templates__preview-empty']}>
                请先配置参数并点击"生成预览"
              </div>
            )}
          </TabPane>
        </Tabs>
      </Modal>
    </div>
  )
}

export default TemplatesPage
