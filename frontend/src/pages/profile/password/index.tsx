import { useState } from 'react'
import {
  Card,
  Button,
  Input,
  Form,
  Message,
  Grid,
} from '@arco-design/web-react'
import {
  IconLock,
} from '@arco-design/web-react/icon'
import { post } from '@/api/request'
import './index.css'

const { Row, Col } = Grid
const FormItem = Form.Item

function Password() {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      if (values.newPassword !== values.confirmPassword) {
        Message.error('两次输入的密码不一致')
        return
      }
      setLoading(true)
      const res = await post<{ code: 0; message?: string }>('/auth/change-password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      })
      if (res.code === 0) {
        Message.success('密码修改成功')
        form.resetFields()
      }
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="password-page">
      <Row justify="center">
        <Col span={12}>
          <Card bordered={false} title="修改密码">
            <Form form={form} layout="vertical">
              <FormItem
                label="当前密码"
                field="oldPassword"
                rules={[{ required: true, message: '请输入当前密码' }]}
              >
                <Input.Password placeholder="请输入当前密码" prefix={<IconLock />} />
              </FormItem>
              <FormItem
                label="新密码"
                field="newPassword"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { minLength: 8, message: '密码长度不能少于8位' },
                ]}
              >
                <Input.Password placeholder="请输入新密码" prefix={<IconLock />} />
              </FormItem>
              <FormItem
                label="确认新密码"
                field="confirmPassword"
                rules={[{ required: true, message: '请再次输入新密码' }]}
              >
                <Input.Password placeholder="请再次输入新密码" prefix={<IconLock />} />
              </FormItem>
              <FormItem>
                <Button type="primary" long onClick={handleSubmit} loading={loading}>
                  确认修改
                </Button>
              </FormItem>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Password
