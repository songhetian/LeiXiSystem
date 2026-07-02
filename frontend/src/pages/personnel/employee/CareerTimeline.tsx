import { useState, useEffect } from 'react'
import { Timeline, Spin, Button, Modal, Tag, Typography } from '@arco-design/web-react'
import { getCareerTimeline, type CareerTimelineItem } from '@/api/personnel'
import styles from './CareerTimeline.module.css'

const { Text, Paragraph } = Typography

// 类型标签映射
const typeTagMap: Record<string, { text: string; color: string }> = {
  onboarding: { text: '入职', color: 'green' },
  probation: { text: '转正', color: 'arcoblue' },
  transfer: { text: '调动', color: 'orange' },
  promotion: { text: '晋升', color: 'red' },
  salary_adjustment: { text: '调薪', color: 'purple' },
  offboarding: { text: '离职', color: 'gray' },
  rehire: { text: '再入职', color: 'green' },
  basic_info: { text: '信息变更', color: 'blue' },
  contact_info: { text: '联系变更', color: 'blue' },
  position_info: { text: '职位变更', color: 'orange' },
  other: { text: '其他变更', color: 'blue' },
  current: { text: '当前', color: 'green' },
}

// 时间线图标颜色
const timelineDotColor: Record<string, string> = {
  onboarding: '#00b42a',
  probation: '#10B981',
  transfer: '#ff7d00',
  promotion: '#f53f3f',
  salary_adjustment: '#722ed1',
  offboarding: '#86909c',
  rehire: '#00b42a',
  current: '#00b42a',
  default: '#10B981',
}

interface CareerTimelineProps {
  employeeId: number
  visible: boolean
  onClose: () => void
}

// 字段名中文映射
const fieldLabels: Record<string, string> = {
  departmentId: '部门',
  positionId: '岗位',
  salary: '薪资',
  status: '状态',
  gender: '性别',
  phone: '手机号',
  email: '邮箱',
  address: '地址',
  emergencyContact: '紧急联系人',
  emergencyPhone: '紧急电话',
  bankAccountNo: '银行账号',
  bankName: '开户银行',
  idCardNo: '身份证号',
  nationality: '国籍',
  maritalStatus: '婚姻状况',
  education: '学历',
  skills: '技能',
  remark: '备注',
}

// 状态值中文映射
const statusLabels: Record<string, string> = {
  probation: '试用期',
  formal: '正式',
  contract: '合同工',
  terminated: '已离职',
  active: '在职',
  left: '离职',
  inactive: '停用',
}

function formatValue(key: string, val: unknown): string {
  if (val === undefined || val === null) return '-'
  if (key === 'status') return statusLabels[String(val)] || String(val)
  return String(val)
}

function formatKeyValue(data: Record<string, unknown> | undefined): string {
  if (!data || Object.keys(data).length === 0) return '-'
  return Object.entries(data)
    .map(([k, v]) => `${fieldLabels[k] || k}: ${formatValue(k, v)}`)
    .join('；')
}

export default function CareerTimeline({ employeeId, visible, onClose }: CareerTimelineProps) {
  const [loading, setLoading] = useState(false)
  const [timeline, setTimeline] = useState<CareerTimelineItem[]>([])
  const [employee, setEmployee] = useState<{ name: string; employeeNo: string; department: string; position: string } | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailItem, setDetailItem] = useState<CareerTimelineItem | null>(null)

  useEffect(() => {
    if (visible && employeeId) {
      fetchTimeline()
    }
  }, [visible, employeeId])

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      const res = await getCareerTimeline(employeeId)
      setTimeline(res.data.timeline)
      setEmployee(res.data.employee)
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const showDetail = (item: CareerTimelineItem) => {
    setDetailItem(item)
    setDetailVisible(true)
  }

  // 判断一个条目是否有详情
  const hasDetail = (item: CareerTimelineItem) => {
    return !!(item.oldData || item.newData || item.description || item.operator)
  }

  // 判断是否显示"查看详情"按钮——主要针对 major_events 之外的有 oldData/newData 的条目
  const showDetailButton = (item: CareerTimelineItem) => {
    return !!(item.oldData || item.newData)
  }

  const getTag = (type: string) => {
    const tag = typeTagMap[type] || { text: type, color: 'blue' }
    return <Tag color={tag.color}>{tag.text}</Tag>
  }

  return (
    <Modal
      title={`${employee?.name || ''} — 员工履历`}
      visible={visible}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      style={{ width: 700 }}
      focusLock
    >
      {employee && (
        <div className={styles.header}>
          <Text type="secondary">工号：{employee.employeeNo} &nbsp;|&nbsp; 当前部门：{employee.department} &nbsp;|&nbsp; 当前岗位：{employee.position}</Text>
        </div>
      )}

      <Spin loading={loading} className={styles.timelineWrap}>
        {timeline.length === 0 ? (
          <div className={styles.empty}>暂无履历数据</div>
        ) : (
          <Timeline>
            {timeline.map((item, idx) => (
              <Timeline.Item
                key={idx}
                label={item.date}
                dotColor={timelineDotColor[item.type] || timelineDotColor.default}
              >
                <div
                  className={`${styles.item} ${hasDetail(item) ? styles.itemClickable : ''}`}
                  onClick={() => showDetail(item)}
                >
                  <span className={styles.itemTitle}>
                    {getTag(item.type)}
                    <span style={{ marginLeft: 8, fontWeight: 500 }}>{item.title}</span>
                  </span>
                  {item.description && (
                    <div className={styles.itemDesc}>{item.description}</div>
                  )}
                  {showDetailButton(item) && (
                    <Text type="primary" style={{ fontSize: 12, cursor: 'pointer' }}>
                      查看详情 →
                    </Text>
                  )}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Spin>

      {/* 变更详情弹窗 */}
      <Modal
        title="变更详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        style={{ width: 500 }}
        focusLock
      >
        {detailItem && (
          <div className={styles.detail}>
            <div className={styles.detailRow}>
              <Text type="secondary">事件类型：</Text>
              {getTag(detailItem.type)}
            </div>
            <div className={styles.detailRow}>
              <Text type="secondary">日期：</Text>
              <span>{detailItem.date}</span>
            </div>
            <div className={styles.detailRow}>
              <Text type="secondary">标题：</Text>
              <span>{detailItem.title}</span>
            </div>
            {detailItem.description && (
              <div className={styles.detailRow}>
                <Text type="secondary">说明：</Text>
                <span>{detailItem.description}</span>
              </div>
            )}
            {detailItem.operator && (
              <div className={styles.detailRow}>
                <Text type="secondary">操作人：</Text>
                <span>{detailItem.operator}</span>
              </div>
            )}
            {detailItem.oldData && Object.keys(detailItem.oldData).length > 0 && (
              <div className={styles.detailRow}>
                <Text type="secondary">变更前：</Text>
                <Paragraph className={styles.detailValue} ellipsis={{ rows: 2, expandable: true }}>
                  {formatKeyValue(detailItem.oldData)}
                </Paragraph>
              </div>
            )}
            {detailItem.newData && Object.keys(detailItem.newData).length > 0 && (
              <div className={styles.detailRow}>
                <Text type="secondary">变更后：</Text>
                <Paragraph className={styles.detailValue} ellipsis={{ rows: 2, expandable: true }}>
                  {formatKeyValue(detailItem.newData)}
                </Paragraph>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Modal>
  )
}
