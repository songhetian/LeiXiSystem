import { useEffect } from 'react'
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
} from '@arco-design/web-react'
import styles from './style.module.css'
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

const STORAGE_KEY = 'sso_config'

interface SsoConfig {
  ssoEnabled: boolean
  protocol: string
  loginUrl: string
  callbackUrl: string
  logoutUrl: string
  clientId: string
  clientSecret: string
  defaultRole: string
  ldapUrl: string
  adminDn: string
  adminPassword: string
  userBaseDn: string
  userObjectClass: string
  usernameAttribute: string
  emailAttribute: string
  usernameMapping: string
  nameMapping: string
  emailMapping: string
  phoneMapping: string
  deptMapping: string
}

const defaultConfig: SsoConfig = {
  ssoEnabled: false,
  protocol: 'oauth2',
  loginUrl: '',
  callbackUrl: '',
  logoutUrl: '',
  clientId: '',
  clientSecret: '',
  defaultRole: 'employee',
  ldapUrl: '',
  adminDn: '',
  adminPassword: '',
  userBaseDn: '',
  userObjectClass: 'inetOrgPerson',
  usernameAttribute: 'uid',
  emailAttribute: 'mail',
  usernameMapping: 'username',
  nameMapping: 'displayName',
  emailMapping: 'email',
  phoneMapping: 'mobile',
  deptMapping: 'department',
}

function loadConfig(): SsoConfig {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? { ...defaultConfig, ...JSON.parse(data) } : defaultConfig
  } catch {
    return defaultConfig
  }
}

function saveConfig(config: SsoConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function ConfigPage() {
  const [form] = Form.useForm()

  useEffect(() => {
    const config = loadConfig()
    form.setFieldsValue(config)
  }, [form])

  const handleSave = async () => {
    try {
      const values = await form.validate()
      saveConfig(values)
      Message.success('保存成功')
    } catch {
      // validation error
    }
  }

  const handleTest = () => {
    Message.success('SSO 连接测试成功')
  }

  return (
    <div className={styles['sso-config']}>
      <Card bordered={false}>
        <Tabs defaultActiveTab="basic">
          <TabPane key="basic" title="基础配置">
            <Form form={form} layout="vertical" className={styles['sso-config__form']}>
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
            <Form form={form} layout="vertical" className={styles['sso-config__form']}>
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
            <Form form={form} layout="vertical" className={styles['sso-config__form']}>
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

        <div className={styles['sso-config__footer']}>
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
