import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
  type OnConnect,
  type OnNodeDrag,
} from '@xyflow/react'
import {
  Button,
  Input,
  Select,
  InputNumber,
  Switch,
  Message,
  Space,
} from '@arco-design/web-react'
import {
  IconUndo,
  IconRedo,
  IconSave,
  IconClose,
} from '@arco-design/web-react/icon'
import '@xyflow/react/dist/style.css'
import styles from './index.module.css'

const { TextArea } = Input
const { Option } = Select

// ============================================================
// 常量
// ============================================================

/** 在 React Flow 中注册的自定义节点类型标识 */
const CUSTOM_NODE_TYPE = 'customNode'
/** 拖拽时写入 dataTransfer 的格式键 */
const DND_FORMAT = 'application/reactflow'
/** 历史记录最大长度 */
const HISTORY_LIMIT = 50

// ============================================================
// 类型定义
// ============================================================

/** 节点属性面板字段配置 */
export interface NodeTypeField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number' | 'switch'
  options?: Array<{ label: string; value: string }>
  required?: boolean
  placeholder?: string
  min?: number
  max?: number
  /** 条件显示，返回 false 时隐藏该字段 */
  showWhen?: (data: Record<string, unknown>) => boolean
}

/** 节点类型配置 */
export interface NodeTypeConfig {
  /** 节点类型标识，如 'start', 'end', 'approval', 'task', 'condition', 'parallel' */
  type: string
  /** 显示名称 */
  label: string
  /** 图标 */
  icon: ReactNode
  /** 主题色 */
  color: string
  /** 默认数据 */
  defaultData: Record<string, unknown>
  /** 属性面板字段配置 */
  fields: NodeTypeField[]
}

/** 流程节点数据（基于 React Flow Node） */
export type FlowNodeData = Node<{
  nodeType: string
  label: string
  subtitle?: string
  /** 条件/并行节点的分支配置 */
  branches?: Array<{ id: string; label: string }>
  [key: string]: unknown
}>

/** 流程连线数据（基于 React Flow Edge） */
export type FlowEdgeData = Edge<Record<string, unknown>>

/** FlowCanvas 组件 Props */
export interface FlowCanvasProps {
  /** 初始节点数据 */
  initialNodes?: FlowNodeData[]
  /** 初始连线数据 */
  initialEdges?: FlowEdgeData[]
  /** 可用的节点类型配置 */
  nodeTypes: NodeTypeConfig[]
  /** 保存回调 */
  onSave?: (nodes: FlowNodeData[], edges: FlowEdgeData[]) => void
  /** 取消回调 */
  onCancel?: () => void
  /** 标题 */
  title?: string
  /** 是否只读 */
  readOnly?: boolean
}

// ============================================================
// 工具函数
// ============================================================

let nodeIdCounter = 0
function genNodeId(): string {
  return `fc_node_${Date.now()}_${++nodeIdCounter}`
}

let edgeIdCounter = 0
function genEdgeId(): string {
  return `fc_edge_${Date.now()}_${++edgeIdCounter}`
}

/** 深拷贝（节点/边数据均为可序列化结构） */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** 历史快照 */
interface Snapshot {
  nodes: FlowNodeData[]
  edges: FlowEdgeData[]
}

/**
 * 规范化初始节点：确保所有节点都使用统一的 React Flow 自定义节点类型，
 * 并将语义类型回填到 data.nodeType。
 */
function normalizeInitialNodes(nodes: FlowNodeData[]): FlowNodeData[] {
  return nodes.map((n) => {
    const semanticType =
      (n.data?.nodeType as string | undefined) ?? (n.type as string | undefined) ?? ''
    return {
      ...n,
      type: CUSTOM_NODE_TYPE,
      data: { ...n.data, nodeType: semanticType },
    }
  })
}

function normalizeInitialEdges(edges: FlowEdgeData[]): FlowEdgeData[] {
  return edges.map((e) => ({
    ...e,
    type: e.type ?? 'smoothstep',
  }))
}

/** 判断是否为终端节点（开始/结束） */
function isTerminalType(nodeType: string): boolean {
  return nodeType === 'start' || nodeType === 'end'
}

/** 判断是否为多分支节点（条件/并行） */
function isBranchType(nodeType: string): boolean {
  return nodeType === 'condition' || nodeType === 'parallel'
}

// ============================================================
// Context：向自定义节点注入节点类型配置
// ============================================================

const NodeTypeConfigContext = createContext<Record<string, NodeTypeConfig>>({})

// ============================================================
// 自定义节点组件
// ============================================================

interface CustomNodeProps extends NodeProps<FlowNodeData> {}

function CustomNode({ data, selected }: CustomNodeProps) {
  const configMap = useContext(NodeTypeConfigContext)
  const nodeType = (data.nodeType as string) ?? ''
  const config = configMap[nodeType]
  const color = config?.color ?? '#165dff'
  const label = (data.label as string) ?? config?.label ?? '未命名'
  const subtitle = data.subtitle as string | undefined

  const nodeStyle = { ['--node-color' as string]: color } as CSSProperties

  // 终端节点：圆形
  if (isTerminalType(nodeType)) {
    const className = [
      styles['terminal-node'],
      selected ? styles['terminal-node--selected'] : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={className} style={nodeStyle}>
        {nodeType === 'start' ? (
          <Handle
            type="source"
            position={Position.Right}
            className={styles['terminal-handle']}
          />
        ) : (
          <Handle
            type="target"
            position={Position.Left}
            className={styles['terminal-handle']}
          />
        )}
        <span className={styles['terminal-node__text']}>{label}</span>
      </div>
    )
  }

  // 普通节点 / 多分支节点
  const branchClassName = [
    styles['custom-node'],
    selected ? styles['custom-node--selected'] : '',
  ]
    .filter(Boolean)
    .join(' ')

  const branches =
    isBranchType(nodeType) && data.branches && (data.branches as unknown[]).length
      ? (data.branches as Array<{ id: string; label: string }>)
      : isBranchType(nodeType)
        ? [
            { id: 'branch-1', label: '分支1' },
            { id: 'branch-2', label: '分支2' },
          ]
        : []

  return (
    <div className={branchClassName} style={nodeStyle}>
      {/* 目标 Handle（左侧） */}
      <Handle
        type="target"
        position={Position.Left}
        className={styles['custom-handle']}
      />

      <div className={styles['custom-node__header']}>
        {config?.icon && (
          <span className={styles['custom-node__icon']}>{config.icon}</span>
        )}
        <span className={styles['custom-node__title']} title={label}>
          {label}
        </span>
      </div>

      {subtitle && (
        <div className={styles['custom-node__body']}>{subtitle}</div>
      )}

      {/* 多分支节点的多个 source Handle */}
      {isBranchType(nodeType) ? (
        <div className={styles['branch-handles']}>
          {branches.map((branch, idx) => {
            const top = ((idx + 1) / (branches.length + 1)) * 100
            return (
              <div
                key={branch.id}
                className={styles['branch-handle']}
                style={{ top: `${top}%` }}
              >
                <span className={styles['branch-handle__label']}>
                  {branch.label}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={branch.id}
                  className={styles['custom-handle']}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className={styles['custom-handle']}
        />
      )}
    </div>
  )
}

// ============================================================
// 属性面板组件
// ============================================================

interface PropertyPanelProps {
  node: FlowNodeData | null
  config: NodeTypeConfig | undefined
  readOnly: boolean
  onBeforeChange: () => void
  onChange: (id: string, patch: Record<string, unknown>) => void
}

function PropertyPanel({
  node,
  config,
  readOnly,
  onBeforeChange,
  onChange,
}: PropertyPanelProps) {
  if (!node || !config) {
    return (
      <div className={styles['flow-canvas__panel-empty']}>
        <p>选中一个节点以编辑其属性</p>
      </div>
    )
  }

  const data = node.data as Record<string, unknown>

  return (
    <div className={styles['flow-canvas__panel-body']}>
      <div className={styles['panel-header']}>
        <span
          className={styles['panel-header__dot']}
          style={{ background: config.color }}
        />
        <span className={styles['panel-header__title']}>{config.label}</span>
      </div>

      {config.fields.map((field) => {
        if (field.showWhen && !field.showWhen(data)) return null
        const value = data[field.key]
        const fieldId = `field-${node.id}-${field.key}`

        return (
          <div key={field.key} className={styles['form-field']}>
            <label className={styles['form-field__label']} htmlFor={fieldId}>
              {field.required && (
                <span className={styles['form-field__required']}>*</span>
              )}
              {field.label}
            </label>

            {field.type === 'text' && (
              <Input
                id={fieldId}
                placeholder={field.placeholder}
                value={(value as string) ?? ''}
                disabled={readOnly}
                onFocus={onBeforeChange}
                onChange={(val: string) => onChange(node.id, { [field.key]: val })}
              />
            )}

            {field.type === 'textarea' && (
              <TextArea
                id={fieldId}
                placeholder={field.placeholder}
                value={(value as string) ?? ''}
                disabled={readOnly}
                autoSize={{ minRows: 2, maxRows: 6 }}
                onFocus={onBeforeChange}
                onChange={(val: string) => onChange(node.id, { [field.key]: val })}
              />
            )}

            {field.type === 'number' && (
              <InputNumber
                id={fieldId}
                placeholder={field.placeholder}
                value={value as number | undefined}
                min={field.min}
                max={field.max}
                disabled={readOnly}
                onFocus={onBeforeChange}
                onChange={(val: number) =>
                  onChange(node.id, { [field.key]: val })
                }
              />
            )}

            {field.type === 'select' && (
              <Select
                id={fieldId}
                placeholder={field.placeholder ?? '请选择'}
                value={(value as string) ?? undefined}
                disabled={readOnly}
                showSearch
                onFocus={onBeforeChange}
                onChange={(val: string) =>
                  onChange(node.id, { [field.key]: val })
                }
              >
                {field.options?.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
            )}

            {field.type === 'switch' && (
              <Switch
                checked={Boolean(value)}
                disabled={readOnly}
                onChange={(checked: boolean) => {
                  onBeforeChange()
                  onChange(node.id, { [field.key]: checked })
                }}
              />
            )}
          </div>
        )
      })}

      <div className={styles['panel-footer']}>
        <span className={styles['panel-footer__id']}>节点 ID：{node.id}</span>
      </div>
    </div>
  )
}

// ============================================================
// 左侧节点选择面板
// ============================================================

interface SidebarProps {
  nodeTypes: NodeTypeConfig[]
  readOnly: boolean
}

function NodeSidebar({ nodeTypes, readOnly }: SidebarProps) {
  const handleDragStart = (event: React.DragEvent, type: string) => {
    event.dataTransfer.setData(DND_FORMAT, type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className={styles['flow-canvas__sidebar']}>
      <div className={styles['flow-canvas__sidebar-title']}>节点类型</div>
      <div className={styles['flow-canvas__sidebar-list']}>
        {nodeTypes.map((nt) => (
          <div
            key={nt.type}
            className={[
              styles['node-item'],
              readOnly ? styles['node-item--disabled'] : '',
            ]
              .filter(Boolean)
              .join(' ')}
            draggable={!readOnly}
            onDragStart={(e) => handleDragStart(e, nt.type)}
            style={{ ['--node-color' as string]: nt.color } as CSSProperties}
          >
            <span className={styles['node-item__icon']}>{nt.icon}</span>
            <div className={styles['node-item__info']}>
              <div className={styles['node-item__name']}>{nt.label}</div>
              <div className={styles['node-item__type']}>{nt.type}</div>
            </div>
          </div>
        ))}
      </div>
      {readOnly && (
        <div className={styles['flow-canvas__sidebar-tip']}>只读模式，不可编辑</div>
      )}
    </aside>
  )
}

// ============================================================
// 流程校验
// ============================================================

interface ValidationResult {
  valid: boolean
  message: string
}

function validateFlow(
  nodes: FlowNodeData[],
  edges: FlowEdgeData[],
): ValidationResult {
  if (!nodes.some((n) => (n.data.nodeType as string) === 'start')) {
    return { valid: false, message: '缺少开始节点' }
  }
  if (!nodes.some((n) => (n.data.nodeType as string) === 'end')) {
    return { valid: false, message: '缺少结束节点' }
  }

  const connectedIds = new Set<string>()
  edges.forEach((e) => {
    connectedIds.add(e.source)
    connectedIds.add(e.target)
  })

  const disconnected = nodes.filter((n) => !connectedIds.has(n.id))
  if (disconnected.length > 0) {
    const names = disconnected
      .map((n) => (n.data.label as string) || n.id)
      .join('、')
    return { valid: false, message: `存在断开的节点：${names}` }
  }

  return { valid: true, message: '' }
}

// ============================================================
// 主组件（内部，需在 ReactFlowProvider 内使用）
// ============================================================

interface FlowCanvasInnerProps extends FlowCanvasProps {
  configMap: Record<string, NodeTypeConfig>
}

function FlowCanvasInner({
  initialNodes,
  initialEdges,
  nodeTypes,
  onSave,
  onCancel,
  title,
  readOnly = false,
  configMap,
}: FlowCanvasInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>(
    useMemo(() => normalizeInitialNodes(initialNodes ?? []), [initialNodes]),
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeData>(
    useMemo(() => normalizeInitialEdges(initialEdges ?? []), [initialEdges]),
  )

  const reactFlow = useReactFlow()

  // 历史记录（撤销/重做）
  const pastRef = useRef<Snapshot[]>([])
  const futureRef = useRef<Snapshot[]>([])
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)

  // 始终持有最新的 nodes/edges，避免回调闭包过期
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  // 剪贴板（复制/粘贴）
  const clipboardRef = useRef<{
    nodes: FlowNodeData[]
    edges: FlowEdgeData[]
  } | null>(null)

  const pushHistory = useCallback(() => {
    pastRef.current.push({
      nodes: clone(nodesRef.current),
      edges: clone(edgesRef.current),
    })
    if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift()
    futureRef.current = []
    forceUpdate()
  }, [])

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return
    const prev = pastRef.current.pop()!
    futureRef.current.push({
      nodes: clone(nodesRef.current),
      edges: clone(edgesRef.current),
    })
    setNodes(prev.nodes)
    setEdges(prev.edges)
    forceUpdate()
  }, [setNodes, setEdges])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current.pop()!
    pastRef.current.push({
      nodes: clone(nodesRef.current),
      edges: clone(edgesRef.current),
    })
    setNodes(next.nodes)
    setEdges(next.edges)
    forceUpdate()
  }, [setNodes, setEdges])

  // ---- 连线 ----
  const handleConnect = useCallback<OnConnect>(
    (connection) => {
      if (!connection.source || !connection.target) return
      if (connection.source === connection.target) return
      const exists = edgesRef.current.some(
        (e) =>
          e.source === connection.source &&
          e.target === connection.target &&
          (e.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
          (e.targetHandle ?? null) === (connection.targetHandle ?? null),
      )
      if (exists) return
      pushHistory()
      setEdges((es) =>
        addEdge(
          {
            ...connection,
            id: genEdgeId(),
            type: 'smoothstep',
            animated: true,
          },
          es,
        ),
      )
    },
    [pushHistory, setEdges],
  )

  // ---- 拖拽添加节点 ----
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData(DND_FORMAT)
      if (!type) return
      const config = configMap[type]
      if (!config) return

      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      pushHistory()
      const newNode: FlowNodeData = {
        id: genNodeId(),
        type: CUSTOM_NODE_TYPE,
        position,
        data: {
          nodeType: type,
          label: config.label,
          ...config.defaultData,
        },
      }
      setNodes((ns) => ns.concat(newNode))
    },
    [configMap, reactFlow, pushHistory, setNodes],
  )

  // ---- 拖拽节点前快照（用于撤销位置变更） ----
  const handleNodeDragStart = useCallback<OnNodeDrag>(() => {
    pushHistory()
  }, [pushHistory])

  // ---- 删除选中元素 ----
  const deleteSelected = useCallback(() => {
    if (readOnly) return
    const selectedNodes = nodesRef.current.filter((n) => n.selected)
    const selectedEdges = edgesRef.current.filter((e) => e.selected)
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return

    pushHistory()
    const nodeIds = new Set(selectedNodes.map((n) => n.id))
    const edgeIdsToRemove = new Set<string>(selectedEdges.map((e) => e.id))
    edgesRef.current.forEach((e) => {
      if (nodeIds.has(e.source) || nodeIds.has(e.target)) {
        edgeIdsToRemove.add(e.id)
      }
    })

    setNodes((ns) => ns.filter((n) => !nodeIds.has(n.id)))
    setEdges((es) => es.filter((e) => !edgeIdsToRemove.has(e.id)))
  }, [readOnly, pushHistory, setNodes, setEdges])

  // ---- 复制 ----
  const copySelected = useCallback(() => {
    const selected = nodesRef.current.filter((n) => n.selected)
    if (selected.length === 0) return
    const ids = new Set(selected.map((n) => n.id))
    const innerEdges = edgesRef.current.filter(
      (e) => ids.has(e.source) && ids.has(e.target),
    )
    clipboardRef.current = {
      nodes: clone(selected),
      edges: clone(innerEdges),
    }
    Message.info({ content: `已复制 ${selected.length} 个节点`, duration: 1500 })
  }, [])

  // ---- 粘贴 ----
  const paste = useCallback(() => {
    if (readOnly) return
    const clip = clipboardRef.current
    if (!clip || clip.nodes.length === 0) return

    pushHistory()
    const idMap = new Map<string, string>()
    const newNodes: FlowNodeData[] = clip.nodes.map((n) => {
      const newId = genNodeId()
      idMap.set(n.id, newId)
      return {
        ...clone(n),
        id: newId,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        selected: true,
      }
    })
    const newEdges: FlowEdgeData[] = clip.edges.map((e) => ({
      ...clone(e),
      id: genEdgeId(),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: false,
    }))

    setNodes((ns) =>
      ns
        .map<FlowNodeData>((n) => ({ ...n, selected: false }))
        .concat(newNodes),
    )
    setEdges((es) =>
      es
        .map<FlowEdgeData>((e) => ({ ...e, selected: false }))
        .concat(newEdges),
    )
  }, [readOnly, pushHistory, setNodes, setEdges])

  // ---- 全选 ----
  const selectAll = useCallback(() => {
    setNodes((ns) => ns.map((n) => ({ ...n, selected: true })))
  }, [setNodes])

  // ---- 键盘快捷键 ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'z') {
        if (isEditable) return
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        if (isEditable) return
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'c') {
        if (isEditable) return
        e.preventDefault()
        copySelected()
        return
      }
      if (mod && e.key.toLowerCase() === 'v') {
        if (isEditable) return
        e.preventDefault()
        paste()
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        if (isEditable) return
        e.preventDefault()
        selectAll()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isEditable) return
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, copySelected, paste, selectAll, deleteSelected])

  // ---- 属性面板更新 ----
  const updateNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      )
    },
    [setNodes],
  )

  // ---- 保存 ----
  const handleSave = useCallback(() => {
    const result = validateFlow(nodes, edges)
    if (!result.valid) {
      Message.error(`保存失败：${result.message}`)
      return
    }
    onSave?.(nodes, edges)
  }, [nodes, edges, onSave])

  // ---- 当前选中节点（仅单选时显示属性面板） ----
  const selectedNodes = nodes.filter((n) => n.selected)
  const selectedNode =
    selectedNodes.length === 1 ? selectedNodes[0] : null
  const selectedConfig = selectedNode
    ? configMap[(selectedNode.data.nodeType as string) ?? '']
    : undefined

  const canUndo = pastRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  return (
    <NodeTypeConfigContext.Provider value={configMap}>
      <div className={styles['flow-canvas']}>
        <NodeSidebar nodeTypes={nodeTypes} readOnly={readOnly} />

        <section className={styles['flow-canvas__main']}>
          <header className={styles['flow-canvas__toolbar']}>
            <div className={styles['flow-canvas__toolbar-title']}>
              {title ?? '流程设计'}
              <span className={styles['flow-canvas__toolbar-count']}>
                {nodes.length} 节点 / {edges.length} 连线
              </span>
            </div>
            <div className={styles['flow-canvas__toolbar-actions']}>
              <Space size={8}>
                <Button
                  size="small"
                  icon={<IconUndo />}
                  disabled={!canUndo || readOnly}
                  onClick={undo}
                  title="撤销 (Ctrl+Z)"
                />
                <Button
                  size="small"
                  icon={<IconRedo />}
                  disabled={!canRedo || readOnly}
                  onClick={redo}
                  title="重做 (Ctrl+Shift+Z)"
                />
                {onCancel && (
                  <Button size="small" icon={<IconClose />} onClick={onCancel}>
                    取消
                  </Button>
                )}
                {onSave && !readOnly && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<IconSave />}
                    onClick={handleSave}
                  >
                    保存
                  </Button>
                )}
              </Space>
            </div>
          </header>

          <div className={styles['flow-canvas__canvas']}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onNodeDragStart={handleNodeDragStart}
              nodeTypes={flowNodeTypes}
              nodeOrigin={[0, 0]}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={2}
              deleteKeyCode={null}
              nodesDraggable={!readOnly}
              nodesConnectable={!readOnly}
              edgesReconnectable={!readOnly}
              elementsSelectable
              defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
              proOptions={{ hideAttribution: false }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={16}
                size={1.5}
                color="#c9cdd4"
              />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap
                position="bottom-right"
                pannable
                zoomable
                nodeColor={(n) =>
                  configMap[(n.data.nodeType as string) ?? '']?.color ?? '#c9cdd4'
                }
                nodeStrokeColor="transparent"
                nodeBorderRadius={6}
                maskColor="rgba(240, 242, 245, 0.6)"
              />
            </ReactFlow>
          </div>
        </section>

        <aside className={styles['flow-canvas__panel']}>
          <div className={styles['flow-canvas__panel-title']}>属性</div>
          <PropertyPanel
            node={selectedNode}
            config={selectedConfig}
            readOnly={readOnly}
            onBeforeChange={pushHistory}
            onChange={updateNodeData}
          />
        </aside>
      </div>
    </NodeTypeConfigContext.Provider>
  )
}

// 自定义节点类型映射（需保持稳定引用，避免 React Flow 性能告警）
const flowNodeTypes = { [CUSTOM_NODE_TYPE]: CustomNode } as unknown as NodeTypes

// ============================================================
// 对外导出组件（用 ReactFlowProvider 包裹）
// ============================================================

function FlowCanvas(props: FlowCanvasProps) {
  const configMap = useMemo(() => {
    const map: Record<string, NodeTypeConfig> = {}
    props.nodeTypes.forEach((nt) => {
      map[nt.type] = nt
    })
    return map
  }, [props.nodeTypes])

  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} configMap={configMap} />
    </ReactFlowProvider>
  )
}

export default FlowCanvas
