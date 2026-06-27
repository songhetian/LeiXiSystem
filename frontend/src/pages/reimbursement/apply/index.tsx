import { useState } from 'react'
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
} from '@arco-design/web-react'
import {
  IconPlus,
  IconUpload,
} from '@arco-design/web-react/icon'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TextArea = Input.TextArea
const TabPane = Tabs.TabPane

function Apply() {
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('basic')

  const expenseTypes = [
    { value: 'travel', label: '差旅费' },
    { value: 'meal', label: '餐费' },
    { value: 'transport', label: '交通费' },
    { value: 'office', label: '办公用品' },
    { value: 'entertainment', label: '招待费' },
    { value: 'other', label: '其他' },
  ]

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      console.log('表单值:', values)
      Message.success('报销申请提交成功')
      form.resetFields()
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveDraft = async () => {
    try {
      Message.success('已保存为草稿')
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Row justify="center">
        <Col span={18}>
          <Card bordered={false}>
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <h2 style={{ marginBottom: 4 }}>费用报销申请</h2>
              <p style={{ color: '#86909C' }}>填写报销信息并上传凭证</p>
            </div>

            <Steps current={0} style={{ marginBottom: 32 }}>
              <Steps.Step title="填写信息" />
              <Steps.Step title="提交审批" />
              <Steps.Step title="财务审核" />
              <Steps.Step title="完成支付" />
            </Steps>

            <Tabs activeTab={activeTab} onChange={setActiveTab}>
              <TabPane key="basic" title="基本信息">
                <Form form={form} layout="vertical">
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
                          style={{ width: '100%' }}
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
                        <DatePicker style={{ width: '100%' }} />
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
                    <div style={{ border: '1px solid var(--color-border-2)', borderRadius: 8, padding: 16 }}>
                      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>明细列表</span>
                        <Button type="text" size="small" icon={<IconPlus />}>添加明细</Button>
                      </div>
                      <div style={{ textAlign: 'center', color: '#86909C', padding: '40px 0' }}>
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

            <div style={{ marginTop: 32, textAlign: 'center' }}>
              <Space size="large">
                <Button onClick={handleSaveDraft}>保存草稿</Button>
                <Button type="primary" onClick={handleSubmit}>
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
