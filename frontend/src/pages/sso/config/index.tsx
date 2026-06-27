import { useState } from 'react'
import {
  Card,
  Form,
  Switch,
  Button,
  Space,
  Message,
  Tabs,
  Input,
  Select,
  Tag,
} from '@arco-design/web-react'
import {
  IconSettings,
} from '@arco-design/web-react/icon'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

function ConfigPage() {
  const [form] = Form.useForm()

  const handleSave = async () => {
    try {
      const values = await form.validate()
      console.log('SSO配置:', values)
      Message.success('保存成功')
    } catch (e) {
      console.error(e)
    }
  }

  const handleTest = () => {
    Message.success('SSO 连接测试成功')
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false}>
        <Tabs defaultActiveTab="basic">
          <TabPane key="basic" title="基础配置">
            <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
              <FormItem label="SSO 开关" field="ssoEnabled" initialValue={false}>
                <Switch />
              </FormItem>
              <FormItem label="协议类型" field="protocol" initialValue="oauth2">
                <Select>
                  <Option value="oauth2">OAuth 2.0</Option>
                  <Option value="saml">SAML 2.0</Option>
                  <Option value="ldap">LDAP</Option>
                  <Option value="cas">CAS</Option>
                </Select>
              </FormItem>
              <FormItem label="登录地址" field="loginUrl">
                <Input placeholder="https://sso.example.com/login" />
              </FormItem>
              <FormItem label="回调地址" field="callbackUrl">
                <Input placeholder="https://hr.example.com/api/sso/callback" />
              </FormItem>
              <FormItem label="登出地址" field="logoutUrl">
                <Input placeholder="https://sso.example.com/logout" />
              </FormItem>
              <FormItem label="客户端ID" field="clientId">
                <Input placeholder="Client ID" />
              </FormItem>
              <FormItem label="客户端密钥" field="clientSecret">
                <Input.Password placeholder="Client Secret" />
              </FormItem>
              <FormItem label="默认角色" field="defaultRole">
                <Select>
                  <Option value="employee">普通员工</Option>
                  <Option value="hr">人事专员</Option>
                  <Option value="manager">部门经理</Option>
                </Select>
              </FormItem>
            </Form>
          </TabPane>

          <TabPane key="ldap" title="LDAP配置">
            <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
              <FormItem label="LDAP 服务器地址" field="ldapUrl">
                <Input placeholder="ldap://ldap.example.com:389" />
              </FormItem>
              <FormItem label="管理员DN" field="adminDn">
                <Input placeholder="cn=admin,dc=example,dc=com" />
              </FormItem>
              <FormItem label="管理员密码" field="adminPassword">
                <Input.Password placeholder="请输入密码" />
              </FormItem>
              <FormItem label="用户搜索基础DN" field="userBaseDn">
                <Input placeholder="ou=users,dc=example,dc=com" />
              </FormItem>
              <FormItem label="用户对象类" field="userObjectClass">
                <Input placeholder="inetOrgPerson" />
              </FormItem>
              <FormItem label="用户名属性" field="usernameAttribute">
                <Input placeholder="uid" />
              </FormItem>
              <FormItem label="邮箱属性" field="emailAttribute">
                <Input placeholder="mail" />
              </FormItem>
            </Form>
          </TabPane>

          <TabPane key="mapping" title="属性映射">
            <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
              <FormItem label="用户名映射" field="usernameMapping">
                <Input placeholder="username" />
              </FormItem>
              <FormItem label="姓名映射" field="nameMapping">
                <Input placeholder="displayName" />
              </FormItem>
              <FormItem label="邮箱映射" field="emailMapping">
                <Input placeholder="email" />
              </FormItem>
              <FormItem label="手机号映射" field="phoneMapping">
                <Input placeholder="mobile" />
              </FormItem>
              <FormItem label="部门映射" field="deptMapping">
                <Input placeholder="department" />
              </FormItem>
            </Form>
          </TabPane>
        </Tabs>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Space size="large">
            <Button onClick={handleTest}>测试连接</Button>
            <Button type="primary" onClick={handleSave}>保存配置</Button>
          </Space>
        </div>
      </Card>
    </div>
  )
}

export default ConfigPage
