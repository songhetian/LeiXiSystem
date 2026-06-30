import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Table,
  Tag,
  Typography,
  Alert,
  Progress,
  Divider,
  Grid,
} from '@arco-design/web-react'
import {
  IconRefresh,
  IconCheck,
  IconClose,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import dayjs from 'dayjs'
import { toast } from '@/utils/toast'
import {
  getScheduleRules,
  generateRecommendations,
  applyRecommendations,
  batchApplyRecommendations,
  type ScheduleRule,
  type ScheduleRecommendation,
  type ConflictWarning,
} from '@/api/schedule'
import { getDepartmentsList, Department } from '@/api/organization'
import './style.css'

const { Row, Col } = Grid

const { Text } = Typography
const FormItem = Form.Item
const Option = Select.Option
const RangePicker = DatePicker.RangePicker

function RecommendPage() {
  const [rules, setRules] = useState<ScheduleRule[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [form] = Form.useForm()

  const [result, setResult] = useState<{
    recommendations: ScheduleRecommendation[]
    warnings: ConflictWarning[]
    statistics: { total: number; byShift: Record<string, number>; byEmployee: Record<string, number> }
  } | null>(null)

  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [applyVisible, setApplyVisible] = useState(false)

  const loadRules = useCallback(async () => {
    try {
      const res = await getScheduleRules({ page: 1, pageSize: 100, status: 'active' })
      setRules(res.data?.list || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    }
  }, [])

  const loadDepartments = useCallback(async () => {
    try {
      const res = await getDepartmentsList()
      setDepartments(res.data || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    }
  }, [])

  useEffect(() => {
    loadRules()
    loadDepartments()
  }, [loadRules, loadDepartments])

  const handleGenerate = async () => {
    try {
      const values = await form.validate()
      const [startDate, endDate] = values.dateRange || []
      if (!startDate || !endDate) {
        toast.error('请选择日期范围')
        return
      }

      const loading = toast.loading('正在生成推荐排班，请稍候...')
      setLoading(true)
      const res = await generateRecommendations({
        departmentId: values.departmentId,
        ruleId: values.ruleId,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
      })

      if (res.code === 0) {
        setResult(res.data)
        setSelectedKeys([])
        toast.success(`生成完成，共 ${res.data.recommendations.length} 条推荐`)
      }
      loading()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    form.resetFields()
    setResult(null)
    setSelectedKeys([])
  }

  const handleApplySelected = () => {
    if (selectedKeys.length === 0) {
      toast.error('请先选择要应用的推荐')
      return
    }
    setApplyVisible(true)
  }

  const handleApply = async () => {
    try {
      const loading = toast.loading('正在应用排班...')
      setApplying(true)
      const recommendations = selectedKeys.map((key) => {
        const [employeeId, scheduleDate] = key.split('_')
        const rec = result!.recommendations.find(
          (r) => r.employeeId === Number(employeeId) && r.scheduleDate === scheduleDate
        )!
        return {
          employeeId: rec.employeeId,
          scheduleDate: rec.scheduleDate,
          shiftId: rec.shiftId,
          confidence: rec.confidence,
          conflicts: rec.conflicts,
        }
      })

      await applyRecommendations(recommendations)
      toast.success(`成功应用 ${recommendations.length} 条排班`)
      setApplyVisible(false)
      setSelectedKeys([])
      loading()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setApplying(false)
    }
  }

  const handleBatchApply = async () => {
    try {
      const values = await form.validate()
      const [startDate, endDate] = values.dateRange || []

      const loading = toast.loading('正在应用排班...')
      setApplying(true)
      const res = await batchApplyRecommendations({
        departmentId: values.departmentId,
        ruleId: values.ruleId,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
      })

      if (res.code === 0) {
        toast.success(`批量应用完成：成功 ${res.data.successCount} 条，失败 ${res.data.failedCount} 条`)
        setResult(null)
        form.resetFields()
      }
      loading()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setApplying(false)
    }
  }

  const columns: TableProps<ScheduleRecommendation>['columns'] = [
    {
      title: '员工',
      dataIndex: 'realName',
      width: 100,
    },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 100,
    },
    {
      title: '日期',
      dataIndex: 'scheduleDate',
      width: 120,
    },
    {
      title: '推荐班次',
      dataIndex: 'shiftName',
      width: 120,
      render: (value, record) => (
        <Tag color={record.shiftColor || 'arcoblue'}>{value}</Tag>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      width: 100,
      render: (val) => (
        <Progress percent={Math.round(val * 100)} size="small" />
      ),
    },
    {
      title: '冲突警告',
      dataIndex: 'conflicts',
      width: 200,
      render: (val: string[]) => (
        val?.length > 0 ? (
          <Space wrap size="small">
            {val.map((c, i) => (
              <Tag key={i} color="red" className="schedule-recommend__text-ellipsis">
                {c}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">无</Text>
        )
      ),
    },
  ]

  const rowSelection = useMemo(() => ({
    type: 'checkbox' as const,
    selectedRowKeys: selectedKeys,
    onChange: (keys: (string | number)[]) => setSelectedKeys(keys.map(String)),
  }), [selectedKeys])

  const hardConflicts = result?.warnings.filter((w) => w.type === 'hard') || []
  const softConflicts = result?.warnings.filter((w) => w.type === 'soft') || []

  return (
    <div className="schedule-recommend">
      <Card bordered={false} className="schedule-recommend__toolbar">
        <Form form={form} layout="inline">
          <FormItem label="部门" field="departmentId">
            <Select
              className="schedule-recommend__select-dept"
              placeholder="全部部门"
              allowClear
            >
              {departments.map((d) => (
                <Option key={d.id} value={d.id}>{d.name}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="排班规则" field="ruleId">
            <Select
              className="schedule-recommend__select-rule"
              placeholder="默认规则"
              allowClear
            >
              {rules.map((r) => (
                <Option key={r.id} value={r.id}>{r.name}</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="日期范围" field="dateRange" rules={[{ required: true, message: '请选择日期范围' }]}>
            <RangePicker className="schedule-recommend__range-picker" />
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button type="primary" loading={loading} onClick={handleGenerate}>
                生成推荐
              </Button>
              <Button icon={<IconRefresh />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      {result && (
        <>
          {/* 统计卡片 */}
          <Row gutter={16} className="schedule-recommend__row-margin">
            <Col span={6}>
              <Card bordered={false}>
                <Text type="secondary">推荐总数</Text>
                <div className="schedule-recommend__stat-value">{result.statistics.total}</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false}>
                <Text type="secondary">硬约束冲突</Text>
                <div className={`schedule-recommend__stat-value ${hardConflicts.length > 0 ? 'schedule-recommend__stat-value-danger' : 'schedule-recommend__stat-value-success'}`}>
                  {hardConflicts.length}
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false}>
                <Text type="secondary">软约束冲突</Text>
                <div className={`schedule-recommend__stat-value ${softConflicts.length > 0 ? 'schedule-recommend__stat-value-warning' : 'schedule-recommend__stat-value-success'}`}>
                  {softConflicts.length}
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false}>
                <Text type="secondary">已选择</Text>
                <div className="schedule-recommend__stat-value">
                  {selectedKeys.length} / {result.statistics.total}
                </div>
              </Card>
            </Col>
          </Row>

          {/* 班次分布 */}
          <Card bordered={false} className="schedule-recommend__preview-margin">
            <Text type="secondary">班次分布：</Text>
            <Space wrap className="schedule-recommend__space-top">
              {Object.entries(result.statistics.byShift).map(([shift, count]) => (
                <Tag key={shift} color="arcoblue">{shift}: {count}人</Tag>
              ))}
            </Space>
          </Card>

          {/* 冲突警告 */}
          {hardConflicts.length > 0 && (
            <Alert
              type="error"
              title="硬约束冲突（这些员工将被跳过）"
              className="schedule-recommend__alert-margin"
              content={
                <Space wrap>
                  {hardConflicts.slice(0, 10).map((c, i) => (
                    <Tag key={i} color="red">
                      {c.employeeName} - {c.date}: {c.message}
                    </Tag>
                  ))}
                  {hardConflicts.length > 10 && <Tag>+{hardConflicts.length - 10} 更多</Tag>}
                </Space>
              }
            />
          )}

          {softConflicts.length > 0 && (
            <Alert
              type="warning"
              title="软约束冲突（仅供参考）"
              className="schedule-recommend__alert-margin"
              content={
                <Space wrap>
                  {softConflicts.slice(0, 5).map((c, i) => (
                    <Tag key={i} color="orange">
                      {c.employeeName} - {c.date}
                    </Tag>
                  ))}
                  {softConflicts.length > 5 && <Tag>+{softConflicts.length - 5} 更多</Tag>}
                </Space>
              }
            />
          )}

          {/* 操作按钮 */}
          <Card bordered={false}>
            <div className="schedule-recommend__actions">
              <Space>
                <Button
                  type="primary"
                  icon={<IconCheck />}
                  disabled={selectedKeys.length === 0}
                  onClick={handleApplySelected}
                >
                  应用选中 ({selectedKeys.length})
                </Button>
                <Button
                  icon={<IconCheck />}
                  disabled={result.statistics.total === 0}
                  loading={applying}
                  onClick={handleBatchApply}
                >
                  一键全部应用
                </Button>
              </Space>
            </div>
          </Card>

          {/* 推荐列表 */}
          <Card bordered={false} className="schedule-recommend__table-margin">
            <Table
              columns={columns}
              data={result.recommendations}
              rowKey={(record) => `${record.employeeId}_${record.scheduleDate}`}
              rowSelection={rowSelection}
              pagination={{ pageSize: 20, showTotal: true }}
              scroll={{ x: 900 }}
            />
          </Card>
        </>
      )}

      {!result && !loading && (
        <Card bordered={false}>
          <div className="schedule-recommend__empty">
            <Text type="secondary">请选择部门和日期范围，点击"生成推荐"开始智能排班</Text>
          </div>
        </Card>
      )}

      {/* 确认应用弹窗 */}
      <Modal
        title="确认应用"
        visible={applyVisible}
        onOk={handleApply}
        onCancel={() => setApplyVisible(false)}
        confirmLoading={applying}
      >
        <Text>确定要应用选中的 {selectedKeys.length} 条排班推荐吗？</Text>
        <Divider />
        <Text type="secondary">
          注意：已存在的排班将被覆盖。硬约束冲突的记录不会被应用。
        </Text>
      </Modal>
    </div>
  )
}

export default RecommendPage
