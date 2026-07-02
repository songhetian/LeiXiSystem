import { useState, useRef, useCallback } from 'react'
import {
  Form,
  Input,
  Select,
  Button,
  Radio,
  DatePicker,
  Upload,
  Switch,
  Modal,
  Space,
  Tag,
  InputTag,
  Card,
  Avatar,
} from '@arco-design/web-react'
import {
  IconUpload,
  IconEye,
  IconBold,
  IconItalic,
  IconUnderline,
  IconList,
  IconOrderedList,
  IconLink,
  IconImage,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
} from '@arco-design/web-react/icon'
import { previewRecipients, sendMessage } from '@/api/message'
import { PageHeader } from '@/components'
import { toast } from '@/utils/toast'
import styles from './send.module.css'
const FormItem = Form.Item
const Option = Select.Option

const TARGET_TYPE_OPTIONS = [
  { value: 'all', label: '全部员工' },
  { value: 'department', label: '按部门' },
  { value: 'role', label: '按角色' },
  { value: 'position', label: '按职位' },
  { value: 'tag', label: '按标签' },
  { value: 'employee', label: '指定员工' },
]

const PRIORITY_OPTIONS = [
  { value: 'normal', label: '普通', color: 'gray' },
  { value: 'high', label: '高', color: 'orange' },
  { value: 'urgent', label: '紧急', color: 'red' },
]

const TYPE_OPTIONS = [
  { value: 'system', label: '系统通知' },
  { value: 'approval', label: '审批通知' },
  { value: 'attendance', label: '考勤通知' },
  { value: 'schedule', label: '排班通知' },
  { value: 'payroll', label: '薪资通知' },
]

const SEND_MODE_OPTIONS = [
  { value: 'immediate', label: '立即发送' },
  { value: 'scheduled', label: '定时发送' },
]

interface AttachmentItem {
  uid: string
  name: string
  url: string
  size?: number
  type?: string
}

export default function MessageSend() {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [targetType, setTargetType] = useState('all')
  const [sendMode, setSendMode] = useState('immediate')
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState<{ total: number; list: any[] }>({ total: 0, list: [] })
  const [previewPage, _setPreviewPage] = useState(1)
  const editorRef = useRef<HTMLDivElement>(null)
  const [editorContent, setEditorContent] = useState('')

  const handleTargetTypeChange = (value: string) => {
    setTargetType(value)
    form.setFieldsValue({ targetConfig: undefined })
  }

  const handleSendModeChange = (value: string) => {
    setSendMode(value)
  }

  const execCommand = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    if (editorRef.current) {
      setEditorContent(editorRef.current.innerHTML)
    }
  }

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      setEditorContent(editorRef.current.innerHTML)
    }
  }, [])

  const handleInsertImage = () => {
    const url = prompt('请输入图片地址：')
    if (url) {
      execCommand('insertImage', url)
    }
  }

  const handleInsertLink = () => {
    const url = prompt('请输入链接地址：', 'https://')
    if (url) {
      execCommand('createLink', url)
    }
  }

  const handleUploadChange = (fileList: any[]) => {
    const newAttachments: AttachmentItem[] = fileList.map(f => ({
      uid: f.uid,
      name: f.name,
      url: f.url || URL.createObjectURL(f.originFile),
      size: f.size,
      type: f.type,
    }))
    setAttachments(newAttachments)
  }

  const handlePreviewRecipients = async () => {
    const values = form.getFieldsValue()
    const targetConfig = values.targetConfig || {}

    let config: any = {}
    if (targetType === 'department') {
      config.departmentIds = (targetConfig.departmentIds || []).map(Number)
    } else if (targetType === 'role') {
      config.roleIds = (targetConfig.roleIds || []).map(Number)
    } else if (targetType === 'position') {
      config.positionIds = (targetConfig.positionIds || []).map(Number)
    } else if (targetType === 'tag') {
      config.tagIds = (targetConfig.tagIds || []).map(Number)
    } else if (targetType === 'employee') {
      config.userIds = (targetConfig.userIds || []).map(Number)
    }

    setPreviewLoading(true)
    try {
      const res = await previewRecipients({
        targetType,
        targetConfig: config,
        page: previewPage,
        pageSize: 10,
      })
      if (res.code === 0) {
        setPreviewData(res.data)
      }
    } finally {
      setPreviewLoading(false)
    }
    setPreviewVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validate()
      if (!editorContent || editorContent === '<br>') {
        toast.error('请输入消息内容')
        return
      }

      const targetConfig = values.targetConfig || {}
      let config: any = {}
      if (targetType === 'department') {
        config.departmentIds = (targetConfig.departmentIds || []).map(Number)
      } else if (targetType === 'role') {
        config.roleIds = (targetConfig.roleIds || []).map(Number)
      } else if (targetType === 'position') {
        config.positionIds = (targetConfig.positionIds || []).map(Number)
      } else if (targetType === 'tag') {
        config.tagIds = (targetConfig.tagIds || []).map(Number)
      } else if (targetType === 'employee') {
        config.userIds = (targetConfig.userIds || []).map(Number)
      }

      setSubmitting(true)
      const res = await sendMessage({
        title: values.title,
        content: editorContent,
        type: values.type,
        priority: values.priority,
        targetType,
        targetConfig: config,
        requiresConfirm: values.requiresConfirm,
        sendMode: sendMode as any,
        scheduledAt: values.scheduledAt,
        attachments: attachments.map(a => ({
          fileName: a.name,
          fileUrl: a.url,
          fileSize: a.size,
          fileType: a.type,
        })),
      })

      if (res.code === 0) {
        if (sendMode === 'immediate') {
          toast.success(`发送成功，共发送 ${res.data.sentCount} 人`)
        } else {
          toast.success('定时任务创建成功')
        }
        form.resetFields()
        setEditorContent('')
        setAttachments([])
        if (editorRef.current) {
          editorRef.current.innerHTML = ''
        }
      }
    } catch (err: any) {
      if (err?.errorFields) {
        toast.error('请检查表单填写是否完整')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const getTargetConfigLabel = () => {
    switch (targetType) {
      case 'department': return '部门ID（多个用逗号分隔）'
      case 'role': return '角色ID（多个用逗号分隔）'
      case 'position': return '职位ID（多个用逗号分隔）'
      case 'tag': return '标签ID（多个用逗号分隔）'
      case 'employee': return '员工用户ID（多个用逗号分隔）'
      default: return ''
    }
  }

  const getTargetConfigField = () => {
    switch (targetType) {
      case 'department': return 'departmentIds'
      case 'role': return 'roleIds'
      case 'position': return 'positionIds'
      case 'tag': return 'tagIds'
      case 'employee': return 'userIds'
      default: return ''
    }
  }

  return (
    <div className={styles['message-send']}>
      <PageHeader title="发送消息" description="按范围向员工发送系统通知，支持富文本、附件、定时发送等功能。" />

      <Card style={{ marginTop: 16 }}>
        <Form form={form} layout="vertical">
          <FormItem
            label="消息标题"
            field="title"
            rules={[{ required: true, message: '请输入消息标题' }]}
          >
            <Input placeholder="请输入消息标题" maxLength={200} showWordLimit />
          </FormItem>

          <div style={{ display: 'flex', gap: 16 }}>
            <FormItem label="消息类型" field="type" style={{ flex: 1 }}>
              <Select defaultValue="system">
                {TYPE_OPTIONS.map(opt => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
            </FormItem>

            <FormItem label="优先级" field="priority" style={{ flex: 1 }}>
              <Select defaultValue="normal">
                {PRIORITY_OPTIONS.map(opt => (
                  <Option key={opt.value} value={opt.value}>
                    <Tag color={opt.color}>{opt.label}</Tag>
                  </Option>
                ))}
              </Select>
            </FormItem>

            <FormItem label="需确认已读" field="requiresConfirm" style={{ flex: 0, width: 120 }}>
              <Switch defaultChecked={false} />
            </FormItem>
          </div>

          <div className={styles['message-send__form-item']}>
            <div className={styles['message-send__label'] + ' ' + styles['message-send__required']}>消息内容</div>
            <div className={styles['message-send__editor']}>
              <div className={styles['message-send__editor-toolbar']}>
                <button
                  type="button"
                  className={styles['message-send__editor-btn']}
                  onClick={() => execCommand('bold')}
                  title="加粗"
                >
                  <IconBold />
                </button>
                <button
                  type="button"
                  className={styles['message-send__editor-btn']}
                  onClick={() => execCommand('italic')}
                  title="斜体"
                >
                  <IconItalic />
                </button>
                <button
                  type="button"
                  className={styles['message-send__editor-btn']}
                  onClick={() => execCommand('underline')}
                  title="下划线"
                >
                  <IconUnderline />
                </button>
                <span style={{ width: 1, height: 16, background: 'var(--color-border-2)', margin: '0 4px' }} />
                <button
                  type="button"
                  className={styles['message-send__editor-btn']}
                  onClick={() => execCommand('insertUnorderedList')}
                  title="无序列表"
                >
                  <IconList />
                </button>
                <button
                  type="button"
                  className={styles['message-send__editor-btn']}
                  onClick={() => execCommand('insertOrderedList')}
                  title="有序列表"
                >
                  <IconOrderedList />
                </button>
                <span style={{ width: 1, height: 16, background: 'var(--color-border-2)', margin: '0 4px' }} />
                <button
                  type="button"
                  className={styles['message-send__editor-btn']}
                  onClick={() => execCommand('justifyLeft')}
                  title="左对齐"
                >
                  <IconAlignLeft />
                </button>
                <button
                  type="button"
                  className={styles['message-send__editor-btn']}
                  onClick={() => execCommand('justifyCenter')}
                  title="居中对齐"
                >
                  <IconAlignCenter />
                </button>
                <button
                  type="button"
                  className={styles['message-send__editor-btn']}
                  onClick={() => execCommand('justifyRight')}
                  title="右对齐"
                >
                  <IconAlignRight />
                </button>
                <span style={{ width: 1, height: 16, background: 'var(--color-border-2)', margin: '0 4px' }} />
                <button
                  type="button"
                  className={styles['message-send__editor-btn']}
                  onClick={handleInsertLink}
                  title="插入链接"
                >
                  <IconLink />
                </button>
                <button
                  type="button"
                  className={styles['message-send__editor-btn']}
                  onClick={handleInsertImage}
                  title="插入图片"
                >
                  <IconImage />
                </button>
              </div>
              <div
                ref={editorRef}
                className={styles['message-send__editor-content']}
                contentEditable
                data-placeholder="请输入消息内容，支持富文本格式..."
                onInput={handleEditorInput}
              />
            </div>
          </div>

          <div className={styles['message-send__form-item']}>
            <div className={styles['message-send__label']}>附件</div>
            <Upload
              multiple
              fileList={attachments.map(a => ({ uid: a.uid, name: a.name, url: a.url, size: a.size }))}
              onChange={(fileList) => handleUploadChange(fileList)}
              customRequest={() => {}}
            >
              <Button icon={<IconUpload />}>上传附件</Button>
            </Upload>
          </div>

          <div className={styles['message-send__form-item']}>
            <div className={styles['message-send__label'] + ' ' + styles['message-send__required']}>接收范围</div>
            <div className={styles['message-send__range-row']}>
              <div className={styles['message-send__range-select']}>
                <Select value={targetType} onChange={handleTargetTypeChange} style={{ width: '100%' }}>
                  {TARGET_TYPE_OPTIONS.map(opt => (
                    <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                  ))}
                </Select>
              </div>
              {targetType !== 'all' && (
                <div className={styles['message-send__range-config']} style={{ flex: 1 }}>
                  <FormItem field={`targetConfig.${getTargetConfigField()}`}>
                    <InputTag
                      placeholder={getTargetConfigLabel()}
                      style={{ width: '100%' }}
                    />
                  </FormItem>
                </div>
              )}
              <Button type="outline" icon={<IconEye />} onClick={handlePreviewRecipients}>
                预览接收人
              </Button>
            </div>
          </div>

          <div className={styles['message-send__form-item']}>
            <div className={styles['message-send__label']}>发送方式</div>
            <Radio.Group value={sendMode} onChange={handleSendModeChange} type="button">
              {SEND_MODE_OPTIONS.map(opt => (
                <Radio key={opt.value} value={opt.value}>{opt.label}</Radio>
              ))}
            </Radio.Group>

            {sendMode === 'scheduled' && (
              <div className={styles['message-send__schedule-section']}>
                <FormItem
                  label="发送时间"
                  field="scheduledAt"
                  rules={[{ required: true, message: '请选择发送时间' }]}
                  style={{ marginBottom: 0 }}
                >
                  <DatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm:ss"
                    placeholder="选择发送时间"
                    style={{ width: 300 }}
                  />
                </FormItem>
              </div>
            )}
          </div>

          <div className={styles['message-send__footer']}>
            <Button onClick={() => form.resetFields()}>重置</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              {sendMode === 'immediate' ? '立即发送' : '创建定时任务'}
            </Button>
          </div>
        </Form>
      </Card>

      <Modal focusLock
        title="接收人预览"
        visible={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        style={{ width: 600 }}
      >
        <div style={{ marginBottom: 12 }}>
          <Tag color="blue">共 {previewData.total} 人</Tag>
        </div>
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {previewLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
          ) : previewData.list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-3)' }}>
              暂无数据
            </div>
          ) : (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {previewData.list.map((user: any) => (
                <div key={user.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  background: 'var(--color-fill-2)',
                  borderRadius: 4,
                }}>
                  <Avatar size={32}>{user.realName?.[0]}</Avatar>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{user.realName}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                      {user.department?.name || '-'} · {user.position?.name || '-'}
                    </div>
                  </div>
                </div>
              ))}
            </Space>
          )}
        </div>
        {previewData.total > 10 && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Button size="small" onClick={handlePreviewRecipients}>
              仅显示前 10 人
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
