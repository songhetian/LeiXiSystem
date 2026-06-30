import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button, Card, DatePicker, Form, Input, InputNumber, Message, Modal,
  Popconfirm, Select, Space, Table, Tabs, Tag, Typography,
} from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import { IconDelete, IconEdit, IconPlus } from '@arco-design/web-react/icon'
import {
  getAssetCategories, createAssetCategory, deleteAssetCategory,
  getAssetItems, getAssetItemDetail, createAssetItem, updateAssetItem,
  assignAsset, returnAsset, transferAsset, retireAsset, deleteAssetItem,
  batchDeleteAssetItems, batchUpdateAssetStatus,
  getAssetAssignments,
} from '@/api/asset'
import { getEmployees, type Employee } from '@/api/personnel'
import './items.css'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane
const { Text } = Typography

type AssetItem = {
  id: number
  assetNo: string
  name: string
  brand?: string
  model?: string
  serialNo?: string
  status: string
  location?: string
  purchaseDate?: string
  purchaseAmount?: number
  remark?: string
  category?: { id: number; name: string; code: string }
  currentEmployee?: { id?: number; employeeNo: string; user?: { realName: string } }
  assignments?: { id: number; action: string; assignedAt: string; returnedAt?: string; note?: string; employee?: { id?: number; employeeNo: string; user?: { realName: string } } }[]
}

type AssetCategory = {
  id: number
  name: string
  code: string
  description?: string
  status: string
  sortOrder: number
}

type AssignmentRecord = {
  id: number
  action: string
  assignedAt: string
  returnedAt?: string
  note?: string
  asset?: { assetNo: string; name: string }
  employee?: { id?: number; employeeNo: string; user?: { realName: string } }
  operator?: { realName: string }
}

const statusMap: Record<string, { text: string; color: string }> = {
  idle: { text: '闲置', color: 'green' },
  assigned: { text: '已领用', color: 'blue' },
  maintenance: { text: '维修中', color: 'orange' },
  retired: { text: '已报废', color: 'red' },
}

const actionMap: Record<string, { text: string; color: string }> = {
  assign: { text: '领用', color: 'green' },
  return: { text: '归还', color: 'gray' },
  transfer: { text: '转移', color: 'blue' },
  repair: { text: '维修', color: 'orange' },
}

function StatusTag({ value }: { value: string }) {
  const info = statusMap[value] || { text: value, color: 'gray' }
  return <Tag color={info.color}>{info.text}</Tag>
}

function ActionTag({ value }: { value: string }) {
  const info = actionMap[value] || { text: value, color: 'gray' }
  return <Tag color={info.color}>{info.text}</Tag>
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

// ===== Categories Tab =====

function CategoriesTab() {
  const [data, setData] = useState<AssetCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<AssetCategory | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAssetCategories()
      setData(res?.data || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openModal = (record?: AssetCategory) => {
    setEditing(record || null)
    if (record) {
      form.setFieldsValue({ name: record.name, code: record.code, description: record.description, status: record.status, sortOrder: record.sortOrder })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'active', sortOrder: 0 })
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    const values = await form.validate()
    setSubmitting(true)
    try {
      if (editing) {
        Message.info('分类不支持编辑，请删除后重新创建')
        setModalVisible(false)
      } else {
        await createAssetCategory(values)
        Message.success('创建成功')
        setModalVisible(false)
        load()
      }
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteAssetCategory(id)
      Message.success('删除成功')
      load()
    } catch (e: any) {
      Message.error(e?.response?.data?.message || '删除失败')
    }
  }

  const columns: TableProps<AssetCategory>['columns'] = useMemo(() => [
    { title: '分类编码', dataIndex: 'code', width: 150 },
    { title: '分类名称', dataIndex: 'name' },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
    { title: '状态', dataIndex: 'status', width: 80, render: (v) => <Tag color={v === 'active' ? 'green' : 'gray'}>{v === 'active' ? '有效' : '无效'}</Tag> },
    {
      title: '操作', width: 100,
      render: (_: any, r) => (
        <Space>
          <Popconfirm title="确定删除该分类？" onOk={() => handleDelete(r.id)}>
            <Button size="small" type="text" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ], [load])

  return (
    <>
      <div className="helpdesk-tickets__tickets-actions">
        <Button type="primary" icon={<IconPlus />} onClick={() => openModal()}>新增分类</Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data} pagination={false} />
      <Modal title="新增资产分类" visible={modalVisible} onOk={handleSubmit}
        onCancel={() => setModalVisible(false)} confirmLoading={submitting}>
        <Form form={form} layout="vertical">
          <FormItem label="分类编码" field="code" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="如：LAPTOP, PHONE" />
          </FormItem>
          <FormItem label="分类名称" field="name" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="如：笔记本电脑" />
          </FormItem>
          <FormItem label="描述" field="description">
            <Input.TextArea rows={2} />
          </FormItem>
          <div className="asset-items__form-grid">
            <FormItem label="排序" field="sortOrder">
              <InputNumber min={0} max={9999} className="asset-items__form-grid-item" />
            </FormItem>
            <FormItem label="状态" field="status">
              <Select>
                <Option value="active">有效</Option>
                <Option value="inactive">无效</Option>
              </Select>
            </FormItem>
          </div>
        </Form>
      </Modal>
    </>
  )
}

// ===== Assets Tab =====

function AssetsTab() {
  const [data, setData] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<Record<string, string | number | undefined>>({})
  const [assetModal, setAssetModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [assignModal, setAssignModal] = useState(false)
  const [transferModal, setTransferModal] = useState(false)
  const [editing, setEditing] = useState<AssetItem | null>(null)
  const [detailData, setDetailData] = useState<AssetItem | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null)
  const [form] = Form.useForm()
  const [assignForm] = Form.useForm()
  const [transferForm] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<(string | number)[]>([])

  const hasSelected = selectedRowKeys.length > 0

  const load = useCallback(async (p = page, f = filters) => {
    setLoading(true)
    try {
      const res = await getAssetItems({ page: p, pageSize: 10, ...f })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    Promise.all([getAssetCategories(), getEmployees({ page: 1, pageSize: 200 })]).then(([catRes, empRes]: any[]) => {
      setCategories(catRes?.data || [])
      setEmployees(empRes?.data?.list || [])
    })
  }, [])

  const handleFilter = (key: string, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const openAssetModal = (record?: AssetItem) => {
    setEditing(record || null)
    if (record) {
      form.setFieldsValue({
        assetNo: record.assetNo, name: record.name, categoryId: record.category?.id,
        brand: record.brand, model: record.model, serialNo: record.serialNo,
        purchaseDate: record.purchaseDate ? new Date(record.purchaseDate) : undefined,
        purchaseAmount: record.purchaseAmount, location: record.location,
        status: record.status, remark: record.remark,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'idle' })
    }
    setAssetModal(true)
  }

  const openDetail = async (id: number) => {
    const res = await getAssetItemDetail(id)
    setDetailData(res?.data || null)
    setDetailModal(true)
  }

  const handleAssetSubmit = async () => {
    const values = await form.validate()
    const data = {
      ...values,
      purchaseDate: values.purchaseDate instanceof Date
        ? values.purchaseDate.toISOString().split('T')[0]
        : values.purchaseDate,
    }
    setSubmitting(true)
    try {
      if (editing) {
        await updateAssetItem(editing.id, data)
        Message.success('更新成功')
      } else {
        await createAssetItem(data)
        Message.success('创建成功')
      }
      setAssetModal(false)
      load()
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteAssetItem(id)
      Message.success('删除成功')
      load()
    } catch (e: any) {
      Message.error(e?.response?.data?.message || '删除失败')
    }
  }

  const openAssign = (asset: AssetItem) => {
    setSelectedAsset(asset)
    assignForm.resetFields()
    setAssignModal(true)
  }

  const handleAssign = async () => {
    const values = await assignForm.validate()
    setSubmitting(true)
    try {
      await assignAsset(selectedAsset!.id, values)
      Message.success('领用成功')
      setAssignModal(false)
      load()
    } finally { setSubmitting(false) }
  }

  const openTransfer = (asset: AssetItem) => {
    setSelectedAsset(asset)
    transferForm.resetFields()
    setTransferModal(true)
  }

  const handleTransfer = async () => {
    const values = await transferForm.validate()
    setSubmitting(true)
    try {
      await transferAsset(selectedAsset!.id, values)
      Message.success('转移成功')
      setTransferModal(false)
      load()
    } finally { setSubmitting(false) }
  }

  const handleReturn = async (id: number) => {
    await returnAsset(id)
    Message.success('归还成功')
    load()
  }

  const handleRetire = async (id: number) => {
    await retireAsset(id)
    Message.success('报废成功')
    load()
  }

  const handleBatchDelete = async () => {
    try {
      const ids = selectedRowKeys.map(Number)
      await batchDeleteAssetItems(ids)
      Message.success(`批量删除成功（${ids.length} 条）`)
      setSelectedRowKeys([])
      load()
    } catch (e: any) {
      Message.error(e?.response?.data?.message || '批量删除失败')
    }
  }

  const handleBatchStatus = async (status: string) => {
    try {
      const ids = selectedRowKeys.map(Number)
      await batchUpdateAssetStatus(ids, status)
      Message.success(`状态更新成功（${ids.length} 条）`)
      setSelectedRowKeys([])
      load()
    } catch (e: any) {
      Message.error(e?.response?.data?.message || '批量更新失败')
    }
  }

  const columns: TableProps<AssetItem>['columns'] = useMemo(() => [
    { title: '资产编号', dataIndex: 'assetNo', width: 140 },
    { title: '资产名称', dataIndex: 'name', ellipsis: true },
    { title: '分类', width: 110, render: (_: any, r) => r.category?.name || '-' },
    { title: '品牌型号', width: 130, render: (_: any, r) => r.brand && r.model ? `${r.brand}/${r.model}` : r.brand || r.model || '-' },
    { title: '使用人', width: 110, render: (_: any, r) => r.currentEmployee?.user?.realName || '-' },
    { title: '存放地点', dataIndex: 'location', width: 100, ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 90, render: (v) => <StatusTag value={v} /> },
    {
      title: '操作', width: 200,
      render: (_: any, r) => (
        <Space>
          <Button size="small" type="text" onClick={() => openDetail(r.id)}>详情</Button>
          <Button size="small" type="text" icon={<IconEdit />} onClick={() => openAssetModal(r)} />
          {r.status === 'idle' && (
            <Button size="small" type="text" onClick={() => openAssign(r)}>领用</Button>
          )}
          {r.status === 'assigned' && (
            <>
              <Button size="small" type="text" onClick={() => openTransfer(r)}>转移</Button>
              <Button size="small" type="text" onClick={() => handleReturn(r.id)}>归还</Button>
            </>
          )}
          {r.status !== 'retired' && (
            <Popconfirm title="确定报废？" onOk={() => handleRetire(r.id)}>
              <Button size="small" type="text" status="danger">报废</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确定删除？" onOk={() => handleDelete(r.id)}>
            <Button size="small" type="text" icon={<IconDelete />} status="danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ], [load])

  return (
    <>
      <div className="asset-items__actions-bar">
        <Space>
          {hasSelected && (
            <>
              <span className="asset-items__selected-info">
                已选 <b className="asset-items__selected-count">{selectedRowKeys.length}</b> 项
              </span>
              <Select placeholder="批量改状态" className="asset-items__batch-select"
                onChange={(v) => handleBatchStatus(v as string)}>
                {Object.entries(statusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
              </Select>
              <Popconfirm title="确定删除选中的资产吗？" onOk={handleBatchDelete}>
                <Button status="danger" icon={<IconDelete />}>批量删除</Button>
              </Popconfirm>
            </>
          )}
        </Space>
        <Space>
          <Select placeholder="分类筛选" allowClear className="asset-items__filter-select"
            onChange={(v) => handleFilter('categoryId', v)}>
            {categories.map((c) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>
          <Select placeholder="状态筛选" allowClear className="asset-items__filter-select--sm"
            onChange={(v) => handleFilter('status', v)}>
            {Object.entries(statusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <Button type="primary" icon={<IconPlus />} onClick={() => openAssetModal()}>新增资产</Button>
        </Space>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => { setPage(p); setSelectedRowKeys([]) } }} />

      {/* Asset Form Modal */}
      <Modal title={editing ? '编辑资产' : '新增资产'} visible={assetModal}
        onOk={handleAssetSubmit} onCancel={() => setAssetModal(false)}
        confirmLoading={submitting} className="asset-items__modal">
        <Form form={form} layout="vertical">
          <div className="asset-items__form-grid">
            <FormItem label="资产编号" field="assetNo" rules={[{ required: true, message: '请输入' }]}>
              <Input placeholder="如：A-2024-001" />
            </FormItem>
            <FormItem label="资产名称" field="name" rules={[{ required: true, message: '请输入' }]}>
              <Input placeholder="如：MacBook Pro 16寸" />
            </FormItem>
          </div>
          <div className="asset-items__form-grid">
            <FormItem label="资产分类" field="categoryId" rules={[{ required: true, message: '请选择' }]}>
              <Select placeholder="选择分类">
                {categories.map((c) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
            </FormItem>
            <FormItem label="存放地点" field="location">
              <Input placeholder="如：总部3楼" />
            </FormItem>
          </div>
          <div className="asset-items__form-grid">
            <FormItem label="品牌" field="brand">
              <Input placeholder="如：Apple" />
            </FormItem>
            <FormItem label="型号" field="model">
              <Input placeholder="如：MacBook Pro" />
            </FormItem>
          </div>
          <div className="asset-items__form-grid">
            <FormItem label="序列号" field="serialNo">
              <Input placeholder="产品序列号" />
            </FormItem>
            <FormItem label="购买日期" field="purchaseDate">
              <DatePicker className="asset-items__form-grid-item" />
            </FormItem>
          </div>
          <div className="asset-items__form-grid">
            <FormItem label="购买金额" field="purchaseAmount">
              <InputNumber min={0} className="asset-items__form-grid-item" prefix="¥" />
            </FormItem>
            <FormItem label="状态" field="status">
              <Select>
                {Object.entries(statusMap).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
              </Select>
            </FormItem>
          </div>
          <FormItem label="备注" field="remark">
            <Input.TextArea rows={2} />
          </FormItem>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal title="资产详情" visible={detailModal}
        onOk={() => setDetailModal(false)} onCancel={() => setDetailModal(false)}
        footer={null} className="asset-items__modal--wide">
        {detailData ? (
          <div className="asset-items__form-grid--detail">
            <div><Text type="secondary">资产编号</Text><div className="asset-items__detail-value">{detailData.assetNo}</div></div>
            <div><Text type="secondary">资产名称</Text><div className="asset-items__detail-value">{detailData.name}</div></div>
            <div><Text type="secondary">分类</Text><div>{detailData.category?.name}</div></div>
            <div><Text type="secondary">品牌型号</Text><div>{[detailData.brand, detailData.model].filter(Boolean).join(' / ') || '-'}</div></div>
            <div><Text type="secondary">序列号</Text><div>{detailData.serialNo || '-'}</div></div>
            <div><Text type="secondary">状态</Text><div><StatusTag value={detailData.status} /></div></div>
            <div><Text type="secondary">使用人</Text><div>{detailData.currentEmployee?.user?.realName || '-'}</div></div>
            <div><Text type="secondary">存放地点</Text><div>{detailData.location || '-'}</div></div>
            <div><Text type="secondary">购买日期</Text><div>{formatDate(detailData.purchaseDate)}</div></div>
            <div><Text type="secondary">购买金额</Text><div>{detailData.purchaseAmount ? `¥${detailData.purchaseAmount.toLocaleString()}` : '-'}</div></div>
            {detailData.assignments && detailData.assignments.length > 0 && (
              <div className="asset-items__detail-grid-full">
                <Text type="secondary" className="asset-items__detail-grid-label">领用历史</Text>
                {detailData.assignments.map((a: any, idx: number) => (
                  <div key={a.id} className="asset-items__history-item">
                    <Space>
                      <ActionTag value={a.action} />
                      <Text type="secondary">{a.employee?.user?.realName || '-'}</Text>
                      <Text type="secondary">{formatDate(a.assignedAt)}</Text>
                      {a.returnedAt && <Text type="secondary">归还：{formatDate(a.returnedAt)}</Text>}
                    </Space>
                    {a.note && <div className="asset-items__history-note">{a.note}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : <div className="asset-items__empty">未找到数据</div>}
      </Modal>

      {/* Assign Modal */}
      <Modal title="资产领用" visible={assignModal} onOk={handleAssign}
        onCancel={() => setAssignModal(false)} confirmLoading={submitting}>
        <Form form={assignForm} layout="vertical">
          <div className="asset-items__asset-info">
            资产：<strong>{selectedAsset?.name}</strong> ({selectedAsset?.assetNo})
          </div>
          <FormItem label="领用人" field="employeeId" rules={[{ required: true, message: '请选择领用人' }]}>
            <Select placeholder="选择员工" showSearch
              filterOption={(input, option) =>
                (option?.props?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }>
              {employees.map((e) => <Option key={e.id} value={e.id}>{e.realName}({e.employeeNo})</Option>)}
            </Select>
          </FormItem>
          <FormItem label="备注" field="note">
            <Input.TextArea rows={2} placeholder="领用说明" />
          </FormItem>
        </Form>
      </Modal>

      {/* Transfer Modal */}
      <Modal title="资产转移" visible={transferModal} onOk={handleTransfer}
        onCancel={() => setTransferModal(false)} confirmLoading={submitting}>
        <Form form={transferForm} layout="vertical">
          <div className="asset-items__asset-info">
            资产：<strong>{selectedAsset?.name}</strong> ({selectedAsset?.assetNo})<br />
            当前使用人：{selectedAsset?.currentEmployee?.user?.realName || '-'}
          </div>
          <FormItem label="新使用人" field="employeeId" rules={[{ required: true, message: '请选择新使用人' }]}>
            <Select placeholder="选择员工" showSearch>
              {employees.filter((e) => e.id !== selectedAsset?.currentEmployee?.id).map((e) =>
                <Option key={e.id} value={e.id}>{e.realName}({e.employeeNo})</Option>
              )}
            </Select>
          </FormItem>
          <FormItem label="备注" field="note">
            <Input.TextArea rows={2} placeholder="转移原因" />
          </FormItem>
        </Form>
      </Modal>
    </>
  )
}

// ===== Assignments Tab =====

function AssignmentsTab() {
  const [data, setData] = useState<AssignmentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [employeeFilter, setEmployeeFilter] = useState<string | undefined>()
  const [employees, setEmployees] = useState<Employee[]>([])

  const load = useCallback(async (p = page, e = employeeFilter) => {
    setLoading(true)
    try {
      const res = await getAssetAssignments({ page: p, pageSize: 10, ...(e ? { employeeId: e } : {}) })
      setData(res?.data?.list || [])
      setTotal(res?.data?.total || 0)
    } finally { setLoading(false) }
  }, [page, employeeFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getEmployees({ page: 1, pageSize: 200 }).then((res: any) => {
      setEmployees(res?.data?.list || [])
    })
  }, [])

  const columns: TableProps<AssignmentRecord>['columns'] = useMemo(() => [
    { title: '资产', width: 200, render: (_: any, r) => `${r.asset?.name}(${r.asset?.assetNo})` },
    { title: '员工', width: 110, render: (_: any, r) => r.employee?.user?.realName || '-' },
    { title: '操作类型', dataIndex: 'action', width: 90, render: (v) => <ActionTag value={v} /> },
    { title: '操作人', dataIndex: 'operator', width: 90, render: (_: any, r) => r.operator?.realName || '-' },
    { title: '领用时间', dataIndex: 'assignedAt', width: 120, render: formatDate },
    { title: '归还时间', dataIndex: 'returnedAt', width: 120, render: formatDate },
    { title: '备注', dataIndex: 'note', ellipsis: true },
  ], [])

  return (
    <>
      <div className="helpdesk-tickets__tickets-actions">
        <Select placeholder="筛选员工" allowClear className="asset-items__assignments-select"
          onChange={(v) => { setEmployeeFilter(v); setPage(1) }}>
          {employees.map((e) => <Option key={e.id} value={e.id}>{e.realName}({e.employeeNo})</Option>)}
        </Select>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} data={data}
        pagination={{ total, current: page, pageSize: 10, onChange: (p) => setPage(p) }} />
    </>
  )
}

// ===== Main Page =====

export default function AssetManagementPage() {
  const [activeTab, setActiveTab] = useState('items')

  return (
    <div className="asset-items">
      <Card bordered={false}>
        <div className="asset-items__header">
          <span className="asset-items__title">资产管理</span>
          <Tag color="arcoblue" className="asset-items__tag">
            资产分类 · 资产台账 · 领用/转移/归还 · 领用记录
          </Tag>
        </div>
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="items" title="资产台账">
            <AssetsTab />
          </TabPane>
          <TabPane key="categories" title="资产分类">
            <CategoriesTab />
          </TabPane>
          <TabPane key="assignments" title="领用记录">
            <AssignmentsTab />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}
