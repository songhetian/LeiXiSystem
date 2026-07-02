import { useState, useEffect, useCallback } from 'react'
import {
  Tabs,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Upload,
  Button,
  Space,
  Checkbox,
  TimePicker,
  Link,
  Spin,
} from '@arco-design/web-react'
import { toast } from '@/utils/toast'
import {
  IconHome,
  IconLock,
  IconNotification,
  IconSettings,
  IconInfoCircle,
  IconUpload,
  IconCheckCircle,
} from '@arco-design/web-react/icon'
import {
  getSystemSettings,
  updateSystemSettings,
  type SystemSettings,
} from '@/api/settings'
import styles from './index.module.css'

const { TabPane } = Tabs
const { TextArea } = Input
const { Option } = Select
const FormItem = Form.Item

function Settings() {
  const [formCompany] = Form.useForm()
  const [formSecurity] = Form.useForm()
  const [formNotification] = Form.useForm()
  const [formParameters] = Form.useForm()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [healthStatus, setHealthStatus] = useState<'idle' | 'checking' | 'ok'>('idle')

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSystemSettings()
      setSettings(data)
      setLogoUrl(data.company.logo)

      formCompany.setFieldsValue({
        name: data.company.name,
        timezone: data.company.timezone,
        contactEmail: data.company.contactEmail,
        contactPhone: data.company.contactPhone,
        address: data.company.address,
      })

      formSecurity.setFieldsValue({
        passwordMinLength: data.security.passwordMinLength,
        passwordComplexity: data.security.passwordComplexity,
        passwordExpiryDays: data.security.passwordExpiryDays,
        loginFailureLockoutThreshold: data.security.loginFailureLockoutThreshold,
        lockoutDurationMinutes: data.security.lockoutDurationMinutes,
        sessionTimeoutMinutes: data.security.sessionTimeoutMinutes,
      })

      formNotification.setFieldsValue({
        siteEnabled: data.notification.siteEnabled,
        emailEnabled: data.notification.emailEnabled,
        smsEnabled: data.notification.smsEnabled,
        dndEnabled: data.notification.dndEnabled,
        approvalEnabled: data.notification.approvalEnabled,
        attendanceEnabled: data.notification.attendanceEnabled,
        systemEnabled: data.notification.systemEnabled,
        announcementEnabled: data.notification.announcementEnabled,
      })

      formParameters.setFieldsValue({
        dataRetentionDays: data.parameters.dataRetentionDays,
        auditLogRetentionDays: data.parameters.auditLogRetentionDays,
        defaultPageSize: data.parameters.defaultPageSize,
        maxUploadSizeMB: data.parameters.maxUploadSizeMB,
      })
    } catch {
      toast.error('加载设置失败')
    } finally {
      setLoading(false)
    }
  }, [formCompany, formSecurity, formNotification, formParameters])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleSaveCompany = async () => {
    try {
      await formCompany.validate()
      setSaving('company')
      const values = formCompany.getFieldsValue()
      const updated = await updateSystemSettings({
        company: { ...values, logo: logoUrl },
      } as Partial<SystemSettings>)
      setSettings(updated)
      toast.success('企业信息已保存')
    } catch (err: any) {
      if (err?.errors) return
      toast.error(err?.message || '保存失败')
    } finally {
      setSaving(null)
    }
  }

  const handleSaveSecurity = async () => {
    try {
      await formSecurity.validate()
      setSaving('security')
      const values = formSecurity.getFieldsValue()
      const updated = await updateSystemSettings({ security: values } as Partial<SystemSettings>)
      setSettings(updated)
      toast.success('安全设置已保存')
    } catch (err: any) {
      if (err?.errors) return
      toast.error(err?.message || '保存失败')
    } finally {
      setSaving(null)
    }
  }

  const handleSaveNotification = async () => {
    try {
      setSaving('notification')
      const values = formNotification.getFieldsValue()
      const updated = await updateSystemSettings({ notification: values } as Partial<SystemSettings>)
      setSettings(updated)
      toast.success('通知设置已保存')
    } catch (err: any) {
      toast.error(err?.message || '保存失败')
    } finally {
      setSaving(null)
    }
  }

  const handleSaveParameters = async () => {
    try {
      await formParameters.validate()
      setSaving('parameters')
      const values = formParameters.getFieldsValue()
      const updated = await updateSystemSettings({ parameters: values } as Partial<SystemSettings>)
      setSettings(updated)
      toast.success('系统参数已保存')
    } catch (err: any) {
      if (err?.errors) return
      toast.error(err?.message || '保存失败')
    } finally {
      setSaving(null)
    }
  }

  const handleHealthCheck = async () => {
    setHealthStatus('checking')
    await new Promise((r) => setTimeout(r, 1000))
    setHealthStatus('ok')
  }

  const handleLogoChange = (fileList: any[]) => {
    if (fileList.length > 0) {
      const file = fileList[0]
      if (file.originFile) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setLogoUrl(e.target?.result as string)
        }
        reader.readAsDataURL(file.originFile)
      }
    } else {
      setLogoUrl('')
    }
  }

  return (
    <Spin loading={loading} style={{ display: 'block' }}>
      <div className={styles['settings-page']}>
        <Tabs
          type="line"
          direction="vertical"
          defaultActiveTab="company"
          className={styles['settings-page__tabs']}
          size="large"
        >
          {/* Tab 1: 企业信息 */}
          <TabPane
            key="company"
            title={
              <span>
                <IconHome className={styles['settings-page__tab-icon']} />
                企业信息
              </span>
            }
          >
            <Card bordered={false} className={styles['settings-page__card']}>
              <Form form={formCompany} layout="vertical" className={styles['settings-page__form']}>
                <FormItem label="公司名称" field="name" rules={[{ required: true, message: '请输入公司名称' }]}>
                  <Input placeholder="请输入公司名称" />
                </FormItem>

                <FormItem label="公司Logo">
                  <Upload
                    listType="picture-card"
                    accept="image/*"
                    limit={1}
                    autoUpload={false}
                    onChange={handleLogoChange}
                    fileList={logoUrl ? [{ uid: '-1', url: logoUrl, name: 'logo' }] : []}
                  >
                    <div className={styles['settings-page__upload-center']}>
                      <IconUpload />
                      <div>上传Logo</div>
                    </div>
                  </Upload>
                  {logoUrl && (
                    <div className={styles['settings-page__logo-preview']}>
                      <img src={logoUrl} alt="公司Logo" className={styles['settings-page__logo-img']} />
                    </div>
                  )}
                </FormItem>

                <FormItem label="时区" field="timezone">
                  <Select placeholder="选择时区">
                    <Option value="Asia/Shanghai">亚洲/上海 (CST)</Option>
                    <Option value="Asia/Tokyo">亚洲/东京 (JST)</Option>
                    <Option value="Asia/Singapore">亚洲/新加坡 (SGT)</Option>
                    <Option value="Asia/Hong_Kong">亚洲/香港 (HKT)</Option>
                    <Option value="America/New_York">美洲/纽约 (EST)</Option>
                    <Option value="America/Los_Angeles">美洲/洛杉矶 (PST)</Option>
                    <Option value="Europe/London">欧洲/伦敦 (GMT)</Option>
                    <Option value="Europe/Berlin">欧洲/柏林 (CET)</Option>
                  </Select>
                </FormItem>

                <FormItem
                  label="联系邮箱"
                  field="contactEmail"
                  rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
                >
                  <Input placeholder="请输入联系邮箱" />
                </FormItem>

                <FormItem
                  label="联系电话"
                  field="contactPhone"
                  rules={[{ match: /^[\d\-+() ]+$/, message: '请输入有效的电话号码' }]}
                >
                  <Input placeholder="请输入联系电话" />
                </FormItem>

                <FormItem label="公司地址" field="address">
                  <TextArea
                    placeholder="请输入公司地址"
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    maxLength={200}
                    showWordLimit
                  />
                </FormItem>

                <Button type="primary" onClick={handleSaveCompany} loading={saving === 'company'}>
                  保存
                </Button>
              </Form>
            </Card>
          </TabPane>

          {/* Tab 2: 账号安全 */}
          <TabPane
            key="security"
            title={
              <span>
                <IconLock className={styles['settings-page__tab-icon']} />
                账号安全
              </span>
            }
          >
            <Card bordered={false} className={styles['settings-page__card']}>
              <Form form={formSecurity} layout="vertical" className={styles['settings-page__form']}>
                <FormItem label="密码最小长度" field="passwordMinLength">
                  <InputNumber min={6} max={20} placeholder="6-20" className={styles['settings-page__input-full']} />
                </FormItem>

                <FormItem label="密码复杂度要求" field="passwordComplexity">
                  <Checkbox.Group>
                    <Checkbox value="uppercase">大写字母</Checkbox>
                    <Checkbox value="lowercase">小写字母</Checkbox>
                    <Checkbox value="number">数字</Checkbox>
                    <Checkbox value="special">特殊字符</Checkbox>
                  </Checkbox.Group>
                </FormItem>

                <FormItem label="密码过期天数" field="passwordExpiryDays">
                  <InputNumber min={30} max={365} placeholder="30-365" className={styles['settings-page__input-full']} />
                </FormItem>

                <FormItem label="登录失败锁定次数" field="loginFailureLockoutThreshold">
                  <InputNumber min={3} max={10} placeholder="3-10" className={styles['settings-page__input-full']} />
                </FormItem>

                <FormItem label="锁定时长（分钟）" field="lockoutDurationMinutes">
                  <InputNumber min={5} max={60} placeholder="5-60" className={styles['settings-page__input-full']} />
                </FormItem>

                <FormItem label="会话超时时间（分钟）" field="sessionTimeoutMinutes">
                  <InputNumber min={15} max={480} placeholder="15-480" className={styles['settings-page__input-full']} />
                </FormItem>

                <Button type="primary" onClick={handleSaveSecurity} loading={saving === 'security'}>
                  保存
                </Button>
              </Form>
            </Card>
          </TabPane>

          {/* Tab 3: 通知设置 */}
          <TabPane
            key="notification"
            title={
              <span>
                <IconNotification className={styles['settings-page__tab-icon']} />
                通知设置
              </span>
            }
          >
            <Card bordered={false} className={styles['settings-page__card']}>
              <Form form={formNotification} layout="vertical" className={styles['settings-page__form']}>
                <FormItem label="站内通知" field="siteEnabled" triggerPropName="checked">
                  <Switch />
                </FormItem>

                <FormItem label="邮件通知" field="emailEnabled" triggerPropName="checked">
                  <Switch />
                </FormItem>

                <FormItem label="短信通知" field="smsEnabled" triggerPropName="checked">
                  <Switch />
                </FormItem>

                <FormItem label="免打扰模式" field="dndEnabled" triggerPropName="checked">
                  <Switch />
                </FormItem>

                <FormItem noStyle shouldUpdate={(prev, cur) => prev.dndEnabled !== cur.dndEnabled}>
                  {({ getFieldValue }) =>
                    getFieldValue('dndEnabled') ? (
                      <FormItem label="免打扰时段">
                        <div className={styles['settings-page__dnd-row']}>
                          <FormItem field="dndStart" noStyle>
                            <TimePicker format="HH:mm" placeholder="开始" />
                          </FormItem>
                          <span>至</span>
                          <FormItem field="dndEnd" noStyle>
                            <TimePicker format="HH:mm" placeholder="结束" />
                          </FormItem>
                        </div>
                      </FormItem>
                    ) : null
                  }
                </FormItem>

                <FormItem label="通知类型" className={styles['settings-page__mt-16']}>
                  <Space direction="vertical" size="small">
                    <FormItem field="approvalEnabled" triggerPropName="checked" noStyle>
                      <Switch checkedText="开" uncheckedText="关" />
                    </FormItem>
                    <span>审批通知</span>

                    <FormItem field="attendanceEnabled" triggerPropName="checked" noStyle>
                      <Switch checkedText="开" uncheckedText="关" />
                    </FormItem>
                    <span>考勤通知</span>

                    <FormItem field="systemEnabled" triggerPropName="checked" noStyle>
                      <Switch checkedText="开" uncheckedText="关" />
                    </FormItem>
                    <span>系统通知</span>

                    <FormItem field="announcementEnabled" triggerPropName="checked" noStyle>
                      <Switch checkedText="开" uncheckedText="关" />
                    </FormItem>
                    <span>公告通知</span>
                  </Space>
                </FormItem>

                <Button type="primary" onClick={handleSaveNotification} loading={saving === 'notification'} className={styles['settings-page__mt-16']}>
                  保存
                </Button>
              </Form>
            </Card>
          </TabPane>

          {/* Tab 4: 系统参数 */}
          <TabPane
            key="parameters"
            title={
              <span>
                <IconSettings className={styles['settings-page__tab-icon']} />
                系统参数
              </span>
            }
          >
            <Card bordered={false} className={styles['settings-page__card']}>
              <Form form={formParameters} layout="vertical" className={styles['settings-page__form']}>
                <FormItem label="数据保留天数" field="dataRetentionDays">
                  <InputNumber min={30} max={3650} placeholder="30-3650" className={styles['settings-page__input-full']} />
                </FormItem>

                <FormItem label="审计日志保留天数" field="auditLogRetentionDays">
                  <InputNumber min={30} max={3650} placeholder="30-3650" className={styles['settings-page__input-full']} />
                </FormItem>

                <FormItem label="默认分页大小" field="defaultPageSize">
                  <Select placeholder="选择默认分页大小">
                    <Option value={10}>10</Option>
                    <Option value={20}>20</Option>
                    <Option value={50}>50</Option>
                    <Option value={100}>100</Option>
                  </Select>
                </FormItem>

                <FormItem label="最大上传文件大小 (MB)" field="maxUploadSizeMB">
                  <InputNumber min={1} max={100} placeholder="1-100" className={styles['settings-page__input-full']} />
                </FormItem>

                <Button type="primary" onClick={handleSaveParameters} loading={saving === 'parameters'}>
                  保存
                </Button>
              </Form>
            </Card>
          </TabPane>

          {/* Tab 5: 关于系统 */}
          <TabPane
            key="about"
            title={
              <span>
                <IconInfoCircle className={styles['settings-page__tab-icon']} />
                关于系统
              </span>
            }
          >
            <Card bordered={false} className={styles['settings-page__card']}>
              <div className={styles['settings-page__about-section']}>
                <div className={styles['settings-page__about-row']}>
                  <span className={styles['settings-page__about-label']}>系统名称</span>
                  <span className={styles['settings-page__about-value']}>雷犀人事考勤系统</span>
                </div>
                <div className={styles['settings-page__about-row']}>
                  <span className={styles['settings-page__about-label']}>系统版本</span>
                  <span className={styles['settings-page__about-value']}>v1.0.0</span>
                </div>
                <div className={styles['settings-page__about-row']}>
                  <span className={styles['settings-page__about-label']}>构建日期</span>
                  <span className={styles['settings-page__about-value']}>2025-01-15</span>
                </div>
                <div className={styles['settings-page__about-row']}>
                  <span className={styles['settings-page__about-label']}>系统健康</span>
                  <span className={styles['settings-page__about-value']}>
                    {healthStatus === 'idle' && (
                      <Button size="small" type="outline" onClick={handleHealthCheck}>
                        检测系统健康
                      </Button>
                    )}
                    {healthStatus === 'checking' && <Spin size={16} />}
                    {healthStatus === 'ok' && (
                      <span className={styles['settings-page__health-status']}>
                        <span className={styles['settings-page__health-dot']} />
                        系统运行正常
                      </span>
                    )}
                  </span>
                </div>

                <div className={styles['settings-page__links']}>
                  <Link href="https://docs.leixi.com" target="_blank" icon>
                    使用文档
                  </Link>
                  <Link href="https://feedback.leixi.com" target="_blank" icon>
                    意见反馈
                  </Link>
                  <Link href="https://license.leixi.com" target="_blank" icon>
                    许可协议
                  </Link>
                </div>
              </div>
            </Card>
          </TabPane>
        </Tabs>
      </div>
    </Spin>
  )
}

export default Settings
