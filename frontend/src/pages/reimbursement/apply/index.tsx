import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Space,
  Message,
  Tag,
  Grid,
  Upload,
  Steps,
  Tabs,
  Alert,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconUpload,
} from '@arco-design/web-react/icon'
import {
  applyReimbursement,
  validateExpenseStandard,
  checkBudget,
  saveReimbursementDraft,
  getReimbursementDraft,
} from '@/api/reimbursement'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '@/store/user'
import './apply.css'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TextArea = Input.TextArea
const TabPane = Tabs.TabPane

interface ValidationWarning {
  type: 'expense' | 'budget'
  level: 'warning' | 'error'
  message: string
}

function Apply() {
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('basic')
  const [submitting, setSubmitting] = useState(false)
  const [warnings, setWarnings] = useState<ValidationWarning[]>([])
  const [checking, setChecking] = useState(false)
  const navigate = useNavigate()
  const { user } = useUserStore()

  const expenseTypes = [
    { value: '差旅费', label: '差旅费' },
    { value: '餐饮费', label: '餐费' },
    { value: '交通费', label: '交通费' },
    { value: '办公用品', label: '办公用品' },
    { value: '招待费', label: '招待费' },
    { value: '其他', label: '其他' },
  ]

  // 加载草稿
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const res = await getReimbursementDraft()
        if (res.code === 0 && res.data) {
          const draft = res.data
          form.setFieldsValue({
            title: draft.title,
            expenseType: draft.type,
            amount: draft.amount,
            expenseDate: draft.expenseDate ? new Date(draft.expenseDate) : undefined,
            description: draft.description,
          })
          Message.info('已自动恢复草稿')
        }
      } catch {
        // ignore
      }
    }
    loadDraft()
  }, [form])

  // 校验费用标准和预算
  const validateAll = useCallback(async (type: string, amount: number) => {
    if (!type || !amount || amount <= 0) {
      setWarnings([])
      return
    }

    setChecking(true)
    const newWarnings: ValidationWarning[] = []

    try {
      // 费用标准校验
      const expenseRes = await validateExpenseStandard({
        type,
        amount,
        departmentId: user?.departmentId,
      })

      if (expenseRes.code === 0 && !expenseRes.data.passed) {
        expenseRes.data.warnings.forEach((w) => {
          newWarnings.push({
            type: 'expense',
            level: 'error',
            message: w,
          })
        })
      }

      // 预算预警检查
      if (user?.departmentId) {
        const budgetRes = await checkBudget({
          type,
          amount,
          departmentId: user.departmentId,
        })

        if (budgetRes.code === 0) {
          const { status, message } = budgetRes.data
          if (status === 'overdraft') {
            newWarnings.push({
              type: 'budget',
              level: 'error',
              message,
            })
          } else if (status === 'warning') {
            newWarnings.push({
              type: 'budget',
              level: 'warning',
              message,
            })
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setChecking(false)
    }

    setWarnings(newWarnings)
  }, [user?.departmentId])

  // 表单值变化时触发校验
  const handleValuesChange = useCallback((values: Record<string, unknown>) => {
    const type = values.expenseType as string
    const amount = values.amount as number

    if (type && amount) {
      validateAll(type, amount)
    } else {
      setWarnings([])
    }
  }, [validateAll])

  const handleSubmit = async () => {
    try {
      const values = await form.validate()

      // 如果有错误级别的警告，阻止提交
      const hasError = warnings.some((w) => w.level === 'error')
      if (hasError) {
        Message.error('存在校验失败的項目，请修正后再提交')
        return
      }

      setSubmitting(true)

      // 提交时再次检查
      await validateAll(values.expenseType, values.amount)
      const currentWarnings = warnings.filter((w) => w.level === 'error')
      if (currentWarnings.length > 0) {
        Message.error('存在校验失败的項目，请修正后再提交')
        setSubmitting(false)
        return
      }

      await applyReimbursement({
        title: values.title,
        type: values.expenseType,
        amount: values.amount,
        expenseDate: values.expenseDate
          ? new Date(values.expenseDate).toISOString().split('T')[0]
          : '',
        description: values.description,
      })

      // 提交成功后清除草稿
      await saveReimbursementDraft({})
      Message.success('报销申请提交成功')
      navigate('/reimbursement/list')
    } catch {
      // error handled by interceptor
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveDraft = async () => {
    try {
      const values = form.getFieldsValue()
      await saveReimbursementDraft({
        title: values.title,
        type: values.expenseType,
        amount: values.amount,
        expenseDate: values.expenseDate
          ? new Date(values.expenseDate).toISOString().split('T')[0]
          : '',
        description: values.description,
      })
      Message.success('草稿已保存')
    } catch {
      Message.error('保存草稿失败')
    }
  }

  return (
    <div className="reimbursement-apply">
      <Row justify="center">
        <Col span={18}>
          <Card bordered={false} className="reimbursement-apply__card">
            <div className="reimbursement-apply__header">
              <h2 className="reimbursement-apply__title">费用报销申请</h2>
              <p className="reimbursement-apply__subtitle">填写报销信息并上传凭证</p>
            </div>

            <Steps current={0} className="reimbursement-apply__steps">
              <Steps.Step title="填写信息" />
              <Steps.Step title="提交审批" />
              <Steps.Step title="财务审核" />
              <Steps.Step title="完成支付" />
            </Steps>

            {warnings.length > 0 && (
              <div className="reimbursement-apply__warnings">
                {warnings.map((w, i) => (
                  <Alert
                    key={i}
                    type={w.level === 'error' ? 'error' : 'warning'}
                    content={w.message}
                    className="reimbursement-apply__form-item-gap"
                  />
                ))}
              </div>
            )}

            <Tabs activeTab={activeTab} onChange={setActiveTab}>
              <TabPane key="basic" title="基本信息">
                <Form
                  form={form}
                  layout="vertical"
                  onValuesChange={handleValuesChange}
                >
                  <FormItem
                    label="报销标题"
                    field="title"
                    rules={[{ required: true, message: '请输入报销标题' }]}
                  >
                    <Input placeholder="请输入报销标题" />
                  </FormItem>
                  <Row gutter={16}>
                    <Col span={12}>
                      <FormItem
                        label="报销类型"
                        field="expenseType"
                        rules={[{ required: true, message: '请选择报销类型' }]}
                      >
                        <Select placeholder="请选择报销类型">
                          {expenseTypes.map((item) => (
                            <Option key={item.value} value={item.value}>
                              {item.label}
                            </Option>
                          ))}
                        </Select>
                      </FormItem>
                    </Col>
                    <Col span={12}>
                      <FormItem
                        label="报销金额"
                        field="amount"
                        rules={[{ required: true, message: '请输入报销金额' }]}
                      >
                        <InputNumber
                          className="reimbursement-apply__form-item-full"
                          placeholder="请输入金额"
                          prefix="¥"
                          min={0}
                        />
                      </FormItem>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <FormItem
                        label="费用发生日期"
                        field="expenseDate"
                        rules={[{ required: true, message: '请选择日期' }]}
                      >
                        <DatePicker className="reimbursement-apply__form-item-full" />
                      </FormItem>
                    </Col>
                    <Col span={12}>
                      <FormItem
                        label="费用发生地点"
                        field="location"
                      >
                        <Input placeholder="请输入地点" />
                      </FormItem>
                    </Col>
                  </Row>

                  <FormItem
                    label="报销说明"
                    field="description"
                    rules={[{ required: true, message: '请输入报销说明' }]}
                  >
                    <TextArea placeholder="请详细说明报销事由" rows={4} />
                  </FormItem>
                </Form>
              </TabPane>

              <TabPane key="detail" title="费用明细">
                <Form form={form} layout="vertical">
                  <FormItem label="费用明细">
                    <div className="reimbursement-apply__expense-detail-box">
                      <div className="reimbursement-apply__expense-detail-header">
                        <span className="reimbursement-apply__expense-detail-title">明细列表</span>
                        <Button type="text" size="small" icon={<IconPlus />}>添加明细</Button>
                      </div>
                      <div className="reimbursement-apply__expense-detail-empty">
                        暂无明细，点击上方按钮添加
                      </div>
                    </div>
                  </FormItem>
                </Form>
              </TabPane>

              <TabPane key="voucher" title="凭证上传">
                <Form form={form} layout="vertical">
                  <FormItem label="报销凭证">
                    <Upload
                      multiple
                      accept="image/*,.pdf"
                      listType="picture-card"
                      customRequest={() => {}}
                      tip="支持 jpg、png、pdf 格式，单个文件不超过 10MB"
                    />
                  </FormItem>
                </Form>
              </TabPane>
            </Tabs>

            <div className="reimbursement-apply__form-footer">
              <Space size="large">
                <Button onClick={handleSaveDraft}>保存草稿</Button>
                <Button
                  type="primary"
                  onClick={handleSubmit}
                  loading={submitting || checking}
                  disabled={checking}
                >
                  提交审批
                </Button>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Apply
