import { memo, useEffect } from 'react'
import { Form, Input, Modal, Select } from '@arco-design/web-react'
import './index.css'

const FormItem = Form.Item
const Option = Select.Option

export interface ApprovalActionOption {
  label: string
  value: string
}

interface ApprovalActionModalProps {
  visible: boolean
  title: string
  actionOptions?: ApprovalActionOption[]
  initialAction?: string
  commentLabel?: string
  commentPlaceholder?: string
  commentRequired?: boolean
  defaultComment?: string
  onOk: (values: { action?: string; comment?: string }) => Promise<void> | void
  onCancel: () => void
}

function ApprovalActionModal({
  visible,
  title,
  actionOptions,
  initialAction,
  commentLabel = '处理意见',
  commentPlaceholder = '请输入处理意见',
  commentRequired = true,
  defaultComment,
  onOk,
  onCancel,
}: ApprovalActionModalProps) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (!visible) return
    form.setFieldsValue({
      action: initialAction,
      comment: defaultComment,
    })
  }, [defaultComment, form, initialAction, visible])

  const handleOk = async () => {
    const values = await form.validate()
    await onOk(values)
  }

  return (
    <Modal title={title} visible={visible} onOk={handleOk} onCancel={onCancel} className="approval-action-modal">
      <Form form={form} layout="vertical">
        {actionOptions && actionOptions.length > 0 && (
          <FormItem label="处理结果" field="action" rules={[{ required: true, message: '请选择处理结果' }]}>
            <Select>
              {actionOptions.map((option) => (
                <Option key={option.value} value={option.value}>{option.label}</Option>
              ))}
            </Select>
          </FormItem>
        )}
        <FormItem
          label={commentLabel}
          field="comment"
          rules={commentRequired ? [{ required: true, message: `请输入${commentLabel}` }] : undefined}
        >
          <Input.TextArea placeholder={commentPlaceholder} autoSize={{ minRows: 3, maxRows: 6 }} />
        </FormItem>
      </Form>
    </Modal>
  )
}

export default memo(ApprovalActionModal)
