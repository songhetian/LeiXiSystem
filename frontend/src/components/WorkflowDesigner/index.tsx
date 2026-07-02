import { useState, useCallback, useMemo, Fragment, useEffect } from 'react'
import {
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Tag,
  Popconfirm,
  Dropdown,
  Message,
  Space,
  Badge,
  Avatar,
} from '@arco-design/web-react'
import {
  IconPlus,
  IconDelete,
  IconDragDotVertical,
  IconUser,
  IconSwap,
  IconClose,
  IconSettings,
  IconUserGroup,
  IconTag,
} from '@arco-design/web-react/icon'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { catchError } from '@/utils/catchError'
import { getRoles, Role } from '@/api/rbac'
import { getEmployees, Employee } from '@/api/personnel'
import styles from './index.module.css'

const FormItem = Form.Item
const Option = Select.Option

// ============================================================
// Types
// ============================================================

interface ConditionBranch {
  id: string
  label: string
  field: string
  operator: '>' | '<' | '=' | '>=' | '<=' | '!='
  value: string
  nodes: WorkflowNode[]
}

interface WorkflowNode {
  id: string
  type: 'start' | 'approval' | 'condition' | 'end'
  name: string
  approverType?: 'direct_superior' | 'role' | 'person' | 'dept_head' | 'applicant'
  approverValue?: string
  conditions?: ConditionBranch[]
}

interface WorkflowDesignerProps {
  initialNodes?: WorkflowNode[]
  onSave?: (nodes: WorkflowNode[]) => void
  onCancel?: () => void
}

// ============================================================
// Constants
// ============================================================

const APPROVER_TYPE_LABELS: Record<string, string> = {
  direct_superior: '直属上级',
  role: '指定角色',
  person: '指定人员',
  dept_head: '部门负责人',
  applicant: '申请人',
}

const OPERATOR_OPTIONS = ['>', '<', '=', '>=', '<=', '!=']

const FIELD_OPTIONS = [
  { value: 'amount', label: '金额' },
  { value: 'days', label: '天数' },
  { value: 'level', label: '级别' },
  { value: 'type', label: '类型' },
]

// ============================================================
// Helpers
// ============================================================

let idCounter = 0
function generateId(): string {
  return `node_${Date.now()}_${++idCounter}`
}

function getDefaultNodes(): WorkflowNode[] {
  return [
    { id: 'start', type: 'start', name: '开始' },
    { id: generateId(), type: 'approval', name: '直属上级审批', approverType: 'direct_superior' },
    { id: generateId(), type: 'approval', name: '部门负责人审批', approverType: 'dept_head' },
    { id: 'end', type: 'end', name: '结束' },
  ]
}

function normalizeNodes(input?: WorkflowNode[]): WorkflowNode[] {
  if (!input || input.length === 0) return getDefaultNodes()
  const result = [...input]
  if (!result.some((n) => n.type === 'start')) {
    result.unshift({ id: 'start', type: 'start', name: '开始' })
  }
  if (!result.some((n) => n.type === 'end')) {
    result.push({ id: 'end', type: 'end', name: '结束' })
  }
  return result
}

function getApproverLabel(node: WorkflowNode): string {
  if (!node.approverType) return '未配置'
  const typeLabel = APPROVER_TYPE_LABELS[node.approverType] ?? '未配置'
  
  if ((node.approverType === 'role' || node.approverType === 'person') && node.approverValue) {
    try {
      const parsed = JSON.parse(node.approverValue)
      if (parsed.name) {
        return `${typeLabel}：${parsed.name}`
      }
    } catch {
      return `${typeLabel}：${node.approverValue}`
    }
  }
  
  return typeLabel
}

// ============================================================
// Sortable Node Row
// ============================================================

interface SortableNodeRowProps {
  node: WorkflowNode
  isSelected: boolean
  onSelect: (node: WorkflowNode) => void
  onDelete: (id: string) => void
  onBranchSelect: (nodeId: string, branchIndex: number) => void
}

function SortableNodeRow({
  node,
  isSelected,
  onSelect,
  onDelete,
  onBranchSelect,
}: SortableNodeRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isCondition = node.type === 'condition'
  const cardClasses = [
    styles['node-card'],
    isSelected ? styles['node-card--selected'] : '',
    isDragging ? styles['node-card--dragging'] : '',
  ]
    .filter(Boolean)
    .join(' ')

  const iconClasses = [
    styles['node-card__icon'],
    isCondition ? styles['node-card__icon--condition'] : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles['node-row']} ref={setNodeRef} style={style}>
      <div
        className={cardClasses}
        onClick={() => onSelect(node)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect(node)
        }}
      >
        {/* Drag handle */}
        <span
          className={styles['node-card__drag-handle']}
          {...attributes}
          {...listeners}
        >
          <IconDragDotVertical />
        </span>

        {/* Icon */}
        <div className={iconClasses}>
          {isCondition ? <IconSwap /> : <IconUser />}
        </div>

        {/* Info */}
        <div className={styles['node-card__info']}>
          <div className={styles['node-card__name']}>{node.name}</div>
          <div className={styles['node-card__badge']}>
            {isCondition ? (
              <Tag size="small" color="orangered">
                {node.conditions?.length ?? 0} 个条件
              </Tag>
            ) : (
              <span className={styles['node-card__badge-text']}>
                {getApproverLabel(node)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className={styles['node-card__actions']}>
          <Popconfirm
            title="确认删除此节点？"
            onOk={() => onDelete(node.id)}
            position="top"
          >
            <button
              className={`${styles['node-card__action-btn']} ${styles['node-card__action-btn--danger']}`}
              onClick={(e) => e.stopPropagation()}
            >
              <IconDelete />
            </button>
          </Popconfirm>
        </div>
      </div>

      {/* Condition branches */}
      {isCondition && node.conditions && node.conditions.length > 0 && (
        <div className={styles['condition-group']}>
          <div className={styles['condition-branches']}>
            {node.conditions.map((branch, idx) => (
              <div key={branch.id} className={styles['condition-branch']}>
                <div className={styles['branch-label']}>
                  分支 {idx + 1}
                </div>
                <div
                  className={styles['branch-card']}
                  onClick={() => onBranchSelect(node.id, idx)}
                >
                  <div className={styles['branch-card__label']}>
                    {branch.label}
                  </div>
                  <div className={styles['branch-card__condition']}>
                    {FIELD_OPTIONS.find((f) => f.value === branch.field)?.label ??
                      branch.field}{' '}
                    {branch.operator} {branch.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Add Node Button
// ============================================================

interface AddNodeButtonProps {
  insertIndex: number
  onAdd: (type: 'approval' | 'condition', index: number) => void
}

function AddNodeButton({ insertIndex, onAdd }: AddNodeButtonProps) {
  const droplist = (
    <div className={styles['add-node-menu']}>
      <button
        className={styles['add-node-menu__item']}
        onClick={() => onAdd('approval', insertIndex)}
      >
        <IconUser className={styles['add-node-menu__icon']} />
        审批节点
      </button>
      <button
        className={styles['add-node-menu__item']}
        onClick={() => onAdd('condition', insertIndex)}
      >
        <IconSwap
          className={`${styles['add-node-menu__icon']} ${styles['add-node-menu__icon--condition']}`}
        />
        条件分支
      </button>
    </div>
  )

  return (
    <Dropdown droplist={droplist} trigger="click" position="bottom">
      <button className={styles['add-node-btn']}>
        <IconPlus />
      </button>
    </Dropdown>
  )
}

// ============================================================
// Terminal Node (Start / End)
// ============================================================

function TerminalNode({ type }: { type: 'start' | 'end' }) {
  const circleClass =
    type === 'start'
      ? styles['terminal-circle--start']
      : styles['terminal-circle--end']

  return (
    <div className={styles['terminal-node']}>
      <div className={`${styles['terminal-circle']} ${circleClass}`}>
        {type === 'start' ? '开始' : '结束'}
      </div>
      <span className={styles['terminal-label']}>
        {type === 'start' ? '提交申请' : '流程结束'}
      </span>
    </div>
  )
}

// ============================================================
// Connector Line
// ============================================================

function Connector() {
  return <div className={styles['connector']} />
}

// ============================================================
// Node Config Drawer
// ============================================================

interface NodeConfigDrawerProps {
  visible: boolean
  node: WorkflowNode | null
  editingBranches: ConditionBranch[]
  onBranchesChange: (branches: ConditionBranch[]) => void
  onClose: () => void
  onSave: (values: { name: string; approverType?: string; approverValue?: string }) => void
}

function NodeConfigDrawer({
  visible,
  node,
  editingBranches,
  onBranchesChange,
  onClose,
  onSave,
}: NodeConfigDrawerProps) {
  const [form] = Form.useForm()
  const [approverType, setApproverType] = useState<string>('')
  const [roleOptions, setRoleOptions] = useState<Role[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<Employee[]>([])
  const [roleLoading, setRoleLoading] = useState(false)
  const [employeeLoading, setEmployeeLoading] = useState(false)

  const loadRoles = useCallback(async () => {
    setRoleLoading(true)
    try {
      const res = await getRoles({ page: 1, pageSize: 1000 })
      setRoleOptions(res.data?.list || [])
    } catch (e) {
      catchError(e, { component: 'WorkflowDesigner', operation: '加载角色列表' })
    } finally {
      setRoleLoading(false)
    }
  }, [])

  const loadEmployees = useCallback(async () => {
    setEmployeeLoading(true)
    try {
      const res = await getEmployees({ page: 1, pageSize: 1000, status: 'active' })
      setEmployeeOptions(res.data?.list || [])
    } catch (e) {
      catchError(e, { component: 'WorkflowDesigner', operation: '加载人员列表' })
    } finally {
      setEmployeeLoading(false)
    }
  }, [])

  useEffect(() => {
    if (visible && approverType === 'role') {
      loadRoles()
    }
  }, [visible, approverType, loadRoles])

  useEffect(() => {
    if (visible && approverType === 'person') {
      loadEmployees()
    }
  }, [visible, approverType, loadEmployees])

  const handleVisibleChange = useCallback(
    (isVisible: boolean) => {
      if (isVisible && node) {
        setTimeout(() => {
          try {
            let approverVal = node.approverValue ?? ''
            if (node.approverValue) {
              try {
                const parsed = JSON.parse(node.approverValue)
                if (parsed.id) {
                  approverVal = String(parsed.id)
                }
              } catch {
                // 不是JSON，保持原值
              }
            }
            form.setFieldsValue({
              name: node.name,
              approverType: node.approverType ?? 'direct_superior',
              approverValue: approverVal,
            })
            setApproverType(node.approverType ?? 'direct_superior')
          } catch (e) {
            catchError(e, {
              component: 'WorkflowDesigner',
              operation: '设置表单值',
            })
          }
        }, 50)
      }
    },
    [node, form],
  )

  useMemo(() => {
    handleVisibleChange(visible)
  }, [visible, handleVisibleChange])

  const handleSave = useCallback(() => {
    form
      .validate()
      .then((values: Record<string, any>) => {
        let approverValue = values.approverValue
        if (values.approverType === 'role') {
          const role = roleOptions.find((r) => String(r.id) === String(values.approverValue))
          approverValue = role ? JSON.stringify({ id: role.id, name: role.name }) : values.approverValue
        } else if (values.approverType === 'person') {
          const emp = employeeOptions.find((e) => String(e.id) === String(values.approverValue))
          approverValue = emp ? JSON.stringify({ id: emp.id, name: emp.realName }) : values.approverValue
        }
        onSave({
          name: values.name,
          approverType: values.approverType,
          approverValue,
        })
      })
      .catch((err: unknown) => {
        catchError(err, {
          component: 'WorkflowDesigner',
          operation: '表单校验',
        })
      })
  }, [form, onSave, roleOptions, employeeOptions])

  const updateBranch = useCallback(
    (index: number, field: keyof ConditionBranch, value: string) => {
      const updated = editingBranches.map((b, i) =>
        i === index ? { ...b, [field]: value } : b,
      )
      onBranchesChange(updated)
    },
    [editingBranches, onBranchesChange],
  )

  const addBranch = useCallback(() => {
    const newBranch: ConditionBranch = {
      id: generateId(),
      label: `条件${editingBranches.length + 1}`,
      field: 'amount',
      operator: '>',
      value: '',
      nodes: [],
    }
    onBranchesChange([...editingBranches, newBranch])
  }, [editingBranches, onBranchesChange])

  const removeBranch = useCallback(
    (index: number) => {
      onBranchesChange(editingBranches.filter((_, i) => i !== index))
    },
    [editingBranches, onBranchesChange],
  )

  return (
    <Drawer
      title={
        node?.type === 'condition' ? '条件节点配置' : '审批节点配置'
      }
      visible={visible}
      onCancel={onClose}
      width={480}
      unmountOnExit
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            确定
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        <div className={styles['config-drawer__section']}>
          <div className={styles['config-drawer__section-title']}>
            <IconPlus className={styles['section-title-icon']} />
            基本信息
          </div>
          <FormItem
            label="节点名称"
            field="name"
            rules={[{ required: true, message: '请输入节点名称' }]}
          >
            <Input placeholder="请输入节点名称" />
          </FormItem>
        </div>

        {/* Approval node fields */}
        {node?.type === 'approval' && (
          <div className={styles['config-drawer__section']}>
            <div className={styles['config-drawer__section-title']}>
              <IconSettings className={styles['section-title-icon']} />
              审批人设置
            </div>
            <FormItem
              label="审批人类型"
              field="approverType"
              rules={[{ required: true, message: '请选择审批人类型' }]}
            >
              <Select
                placeholder="请选择审批人类型"
                onChange={(val: string) => setApproverType(val)}
                style={{ width: '100%' }}
              >
                <Option value="direct_superior">
                  <div className={styles['select-option']}>
                    <IconUser className={styles['select-option-icon']} />
                    <span>直属上级</span>
                  </div>
                </Option>
                <Option value="role">
                  <div className={styles['select-option']}>
                    <IconTag className={styles['select-option-icon']} />
                    <span>指定角色</span>
                  </div>
                </Option>
                <Option value="person">
                  <div className={styles['select-option']}>
                    <IconUserGroup className={styles['select-option-icon']} />
                    <span>指定人员</span>
                  </div>
                </Option>
                <Option value="dept_head">
                  <div className={styles['select-option']}>
                    <IconUser className={styles['select-option-icon']} />
                    <span>部门负责人</span>
                  </div>
                </Option>
                <Option value="applicant">
                  <div className={styles['select-option']}>
                    <IconUser className={styles['select-option-icon']} />
                    <span>申请人</span>
                  </div>
                </Option>
              </Select>
            </FormItem>

            {approverType === 'role' && (
              <FormItem
                label="选择角色"
                field="approverValue"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select
                  placeholder="搜索并选择角色"
                  showSearch
                  loading={roleLoading}
                  style={{ width: '100%' }}
                  filterOption={(inputValue, option) => {
                    const label = option.props.children
                    if (typeof label === 'string') {
                      return label.toLowerCase().includes(inputValue.toLowerCase())
                    }
                    return true
                  }}
                >
                  {roleOptions.map((role) => (
                    <Option key={role.id} value={String(role.id)}>
                      <div className={styles['role-option']}>
                        <span className={styles['role-option-name']}>{role.name}</span>
                        <Badge
                          className={styles['role-option-badge']}
                          color={role.isSystem ? 'gold' : 'blue'}
                          text={role.isSystem ? '系统' : '自定义'}
                        />
                      </div>
                    </Option>
                  ))}
                </Select>
              </FormItem>
            )}

            {approverType === 'person' && (
              <FormItem
                label="选择人员"
                field="approverValue"
                rules={[{ required: true, message: '请选择人员' }]}
              >
                <Select
                  placeholder="搜索并选择人员"
                  showSearch
                  loading={employeeLoading}
                  style={{ width: '100%' }}
                  filterOption={(inputValue, option) => {
                    const label = option.props.children
                    if (typeof label === 'string') {
                      return label.toLowerCase().includes(inputValue.toLowerCase())
                    }
                    return true
                  }}
                >
                  {employeeOptions.map((emp) => (
                    <Option key={emp.id} value={String(emp.id)}>
                      <div className={styles['employee-option']}>
                        <Avatar size={24} className={styles['employee-option-avatar']}>
                          {emp.realName?.charAt(0)}
                        </Avatar>
                        <div className={styles['employee-option-info']}>
                          <span className={styles['employee-option-name']}>{emp.realName}</span>
                          <span className={styles['employee-option-sub']}>
                            {emp.employeeNo} · {emp.department}
                          </span>
                        </div>
                      </div>
                    </Option>
                  ))}
                </Select>
              </FormItem>
            )}
          </div>
        )}

        {/* Condition node fields */}
        {node?.type === 'condition' && (
          <div className={styles['config-drawer__section']}>
            <div className={styles['config-drawer__section-title']}>
              <IconSwap className={styles['section-title-icon']} />
              条件分支
            </div>
            {editingBranches.map((branch, index) => (
              <div key={branch.id} className={styles['condition-form']}>
                <div className={styles['condition-form__row']}>
                  <div className={styles['condition-form__field']}>
                    <FormItem label="条件标签" style={{ marginBottom: 8 }}>
                      <Input
                        size="small"
                        value={branch.label}
                        onChange={(val: string) =>
                          updateBranch(index, 'label', val)
                        }
                        placeholder="条件名称"
                      />
                    </FormItem>
                  </div>
                  <div className={styles['condition-form__remove']}>
                    <Button
                      icon={<IconClose />}
                      size="small"
                      status="danger"
                      onClick={() => removeBranch(index)}
                      disabled={editingBranches.length <= 1}
                    />
                  </div>
                </div>
                <div className={styles['condition-form__row']}>
                  <div className={styles['condition-form__field']}>
                    <Select
                      size="small"
                      value={branch.field}
                      onChange={(val: string) =>
                        updateBranch(index, 'field', val)
                      }
                      placeholder="字段"
                    >
                      {FIELD_OPTIONS.map((opt) => (
                        <Option key={opt.value} value={opt.value}>
                          {opt.label}
                        </Option>
                      ))}
                    </Select>
                  </div>
                  <div className={styles['condition-form__field']}>
                    <Select
                      size="small"
                      value={branch.operator}
                      onChange={(val: string) =>
                        updateBranch(index, 'operator', val)
                      }
                    >
                      {OPERATOR_OPTIONS.map((op) => (
                        <Option key={op} value={op}>
                          {op}
                        </Option>
                      ))}
                    </Select>
                  </div>
                  <div className={styles['condition-form__field']}>
                    <Input
                      size="small"
                      value={branch.value}
                      onChange={(val: string) =>
                        updateBranch(index, 'value', val)
                      }
                      placeholder="值"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button className={styles['add-branch-btn']} onClick={addBranch}>
              <IconPlus /> 添加条件
            </button>
          </div>
        )}
      </Form>
    </Drawer>
  )
}

// ============================================================
// Main Component
// ============================================================

function WorkflowDesigner({
  initialNodes,
  onSave,
  onCancel,
}: WorkflowDesignerProps) {
  // --- State ---
  const [nodes, setNodes] = useState<WorkflowNode[]>(() =>
    normalizeNodes(initialNodes),
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingBranches, setEditingBranches] = useState<ConditionBranch[]>([])

  // --- Derived ---
  const middleNodes = useMemo(
    () => nodes.filter((n) => n.type !== 'start' && n.type !== 'end'),
    [nodes],
  )
  const middleNodeIds = useMemo(
    () => middleNodes.map((n) => n.id),
    [middleNodes],
  )
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )
  const activeNode = useMemo(
    () => (activeId ? nodes.find((n) => n.id === activeId) ?? null : null),
    [nodes, activeId],
  )

  // --- DnD Sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  // --- Handlers ---
  const handleSelectNode = useCallback((node: WorkflowNode) => {
    if (node.type === 'start' || node.type === 'end') return
    setSelectedNodeId(node.id)
    setEditingBranches(
      node.conditions ? node.conditions.map((c) => ({ ...c })) : [],
    )
    setDrawerVisible(true)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setDrawerVisible(false)
    setSelectedNodeId(null)
    setEditingBranches([])
  }, [])

  const handleSaveNodeConfig = useCallback(
    (values: { name: string; approverType?: string; approverValue?: string }) => {
      try {
        setNodes((prev) =>
          prev.map((node) => {
            if (node.id !== selectedNodeId) return node
            if (node.type === 'approval') {
              return {
                ...node,
                name: values.name,
                approverType: values.approverType as WorkflowNode['approverType'],
                approverValue: values.approverValue,
              }
            }
            if (node.type === 'condition') {
              return {
                ...node,
                name: values.name,
                conditions: editingBranches,
              }
            }
            return node
          }),
        )
        setDrawerVisible(false)
        setSelectedNodeId(null)
      } catch (e) {
        catchError(e, {
          component: 'WorkflowDesigner',
          operation: '保存节点配置',
        })
        Message.error('保存节点配置失败')
      }
    },
    [selectedNodeId, editingBranches],
  )

  const handleAddNode = useCallback(
    (type: 'approval' | 'condition', insertIndex: number) => {
      const newNode: WorkflowNode =
        type === 'approval'
          ? {
              id: generateId(),
              type: 'approval',
              name: '新审批节点',
              approverType: 'direct_superior',
            }
          : {
              id: generateId(),
              type: 'condition',
              name: '条件分支',
              conditions: [
                {
                  id: generateId(),
                  label: '条件1',
                  field: 'amount',
                  operator: '>',
                  value: '1000',
                  nodes: [],
                },
                {
                  id: generateId(),
                  label: '默认条件',
                  field: 'amount',
                  operator: '<=',
                  value: '1000',
                  nodes: [],
                },
              ],
            }

      setNodes((prev) => {
        const startNode = prev.find((n) => n.type === 'start')!
        const endNode = prev.find((n) => n.type === 'end')!
        const middle = prev.filter(
          (n) => n.type !== 'start' && n.type !== 'end',
        )
        middle.splice(insertIndex, 0, newNode)
        return [startNode, ...middle, endNode]
      })
    },
    [],
  )

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== id))
      if (selectedNodeId === id) {
        setSelectedNodeId(null)
        setDrawerVisible(false)
      }
    },
    [selectedNodeId],
  )

  const handleBranchSelect = useCallback(
    (nodeId: string, _branchIndex: number) => {
      setSelectedNodeId(nodeId)
      const node = nodes.find((n) => n.id === nodeId)
      if (node?.conditions) {
        setEditingBranches(node.conditions.map((c) => ({ ...c })))
      }
      setDrawerVisible(true)
    },
    [nodes],
  )

  // --- DnD Handlers ---
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      if (!over || active.id === over.id) return

      const oldIndex = middleNodes.findIndex((n) => n.id === active.id)
      const newIndex = middleNodes.findIndex((n) => n.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(middleNodes, oldIndex, newIndex)
      setNodes((prev) => {
        const startNode = prev.find((n) => n.type === 'start')!
        const endNode = prev.find((n) => n.type === 'end')!
        return [startNode, ...reordered, endNode]
      })
    },
    [middleNodes],
  )

  const handleSave = useCallback(() => {
    try {
      onSave?.(nodes)
    } catch (e) {
      catchError(e, {
        component: 'WorkflowDesigner',
        operation: '保存工作流',
      })
      Message.error('保存失败，请重试')
    }
  }, [nodes, onSave])

  const handleCancel = useCallback(() => {
    onCancel?.()
  }, [onCancel])

  // --- Render ---
  return (
    <div className={styles['designer']}>
      <div className={styles['canvas']}>
        {/* Toolbar */}
        <div className={styles['canvas-toolbar']}>
          <span className={styles['canvas-toolbar__info']}>
            <span className={styles['canvas-toolbar__node-count']}>
              {middleNodes.length}
            </span>
            个流程节点
            <span className={styles['canvas-toolbar__zoom']}>100%</span>
          </span>
          <Space>
            <Button size="small" onClick={handleCancel}>
              取消
            </Button>
            <Button
              size="small"
              type="secondary"
              onClick={() => Message.info('预览功能开发中')}
            >
              预览
            </Button>
            <Button size="small" type="primary" onClick={handleSave}>
              保存
            </Button>
          </Space>
        </div>

        {/* Flow Canvas */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Start */}
          <TerminalNode type="start" />
          <Connector />

          {/* Empty state: add button when no middle nodes */}
          {middleNodes.length === 0 && (
            <>
              <AddNodeButton insertIndex={0} onAdd={handleAddNode} />
              <Connector />
            </>
          )}

          {/* Sortable middle nodes */}
          <SortableContext
            items={middleNodeIds}
            strategy={verticalListSortingStrategy}
          >
            {middleNodes.map((node, index) => (
              <Fragment key={node.id}>
                {/* Add button before first node */}
                {index === 0 && (
                  <>
                    <AddNodeButton
                      insertIndex={0}
                      onAdd={handleAddNode}
                    />
                    <Connector />
                  </>
                )}

                <SortableNodeRow
                  node={node}
                  isSelected={node.id === selectedNodeId}
                  onSelect={handleSelectNode}
                  onDelete={handleDeleteNode}
                  onBranchSelect={handleBranchSelect}
                />
                <Connector />

                {/* Add button after each node */}
                <AddNodeButton
                  insertIndex={index + 1}
                  onAdd={handleAddNode}
                />
                <Connector />
              </Fragment>
            ))}
          </SortableContext>

          {/* End */}
          <TerminalNode type="end" />

          {/* Drag Overlay */}
          <DragOverlay dropAnimation={null}>
            {activeNode ? (
              <div className={styles['drag-overlay']}>
                <span
                  className={[
                    styles['drag-overlay__icon'],
                    activeNode.type === 'condition'
                      ? styles['drag-overlay__icon--condition']
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {activeNode.type === 'condition' ? (
                    <IconSwap />
                  ) : (
                    <IconUser />
                  )}
                </span>
                {activeNode.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Node Config Drawer */}
      <NodeConfigDrawer
        visible={drawerVisible}
        node={selectedNode}
        editingBranches={editingBranches}
        onBranchesChange={setEditingBranches}
        onClose={handleCloseDrawer}
        onSave={handleSaveNodeConfig}
      />
    </div>
  )
}

export type { WorkflowNode, ConditionBranch, WorkflowDesignerProps }
export default WorkflowDesigner
