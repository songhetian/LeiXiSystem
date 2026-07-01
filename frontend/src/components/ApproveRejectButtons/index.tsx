import { Button, Space } from '@arco-design/web-react'

interface ApproveRejectButtonsProps {
  onApprove: () => void
  onReject: () => void
  disabled?: boolean
  size?: 'small' | 'mini' | 'medium' | 'large'
}

function ApproveRejectButtons({ onApprove, onReject, disabled = false, size = 'small' }: ApproveRejectButtonsProps) {
  return (
    <Space size="mini">
      <Button type="text" size={size} disabled={disabled} onClick={onApprove}>
        通过
      </Button>
      <Button type="text" size={size} status="danger" disabled={disabled} onClick={onReject}>
        驳回
      </Button>
    </Space>
  )
}

export default ApproveRejectButtons
