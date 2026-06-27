import { memo } from 'react'
import { Tag } from '@arco-design/web-react'

type StatusPreset =
  | 'attendanceCorrection'
  | 'attendanceException'
  | 'payrollAdjustment'
  | 'payrollRun'
  | 'payslipDispute'
  | 'payslip'

interface StatusInfo {
  text: string
  color: string
}

const presetMaps: Record<StatusPreset, Record<string, StatusInfo>> = {
  attendanceCorrection: {
    pending: { text: '待审批', color: 'orange' },
    approved: { text: '已通过', color: 'green' },
    rejected: { text: '已驳回', color: 'red' },
  },
  attendanceException: {
    pending: { text: '待处理', color: 'orange' },
    resolved: { text: '已解决', color: 'green' },
    rejected: { text: '已驳回', color: 'red' },
    approved: { text: '已审批', color: 'blue' },
  },
  payrollAdjustment: {
    pending: { text: '待审批', color: 'orange' },
    approved: { text: '已通过', color: 'green' },
    rejected: { text: '已驳回', color: 'red' },
  },
  payrollRun: {
    draft: { text: '草稿', color: 'gray' },
    calculated: { text: '已计算', color: 'blue' },
    reviewed: { text: '已复核', color: 'purple' },
    approved: { text: '已审批', color: 'green' },
    published: { text: '已发布', color: 'arcoblue' },
    paid: { text: '已发放', color: 'green' },
    cancelled: { text: '已取消', color: 'red' },
  },
  payslipDispute: {
    pending: { text: '待处理', color: 'orange' },
    resolved: { text: '已解决', color: 'green' },
    rejected: { text: '已驳回', color: 'red' },
  },
  payslip: {
    draft: { text: '草稿', color: 'gray' },
    published: { text: '已发布', color: 'blue' },
    viewed: { text: '已查看', color: 'arcoblue' },
    confirmed: { text: '已确认', color: 'green' },
    disputed: { text: '有申诉', color: 'orange' },
    cancelled: { text: '已取消', color: 'red' },
  },
}

interface StatusTagProps {
  value?: string
  preset: StatusPreset
  fallbackColor?: string
}

function StatusTag({ value, preset, fallbackColor = 'gray' }: StatusTagProps) {
  const status = value || '-'
  const info = presetMaps[preset][status] || { text: status, color: fallbackColor }
  return <Tag color={info.color}>{info.text}</Tag>
}

export default memo(StatusTag)
