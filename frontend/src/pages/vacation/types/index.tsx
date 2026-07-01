import { useState, useCallback } from 'react'
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Message,
  Tag,
  Card,
  Grid,
  Switch,
  Select,
  Space,
} from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getVacationTypesPage,
  createVacationType,
  updateVacationType,
  deleteVacationType,
} from '@/api/vacation'
import type { VacationType } from '@/api/vacation'
import { PageHeader, FilterBar, ActionButtons, BatchActions, PaginationJumper, TableSettingsButton, KeyboardShortcutsHelp, ImportButton, TableSkeleton } from '@/components'
import { useCrudModal } from '@/hooks/useCrudModal'
import { useTableHotkeys } from '@/hooks/useTableHotkeys'
import { useBatchSelection } from '@/hooks/useBatchSelection'
import { useTableSettings } from '@/hooks/useTableSettings'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { useServerPagination } from '@/hooks/useServerPagination'
import styles from './types.module.css'
const { Row, Col } = Grid
const Option = Select.Option
const FormItem = Form.Item

function Types() {
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const batch = useBatchSelection<VacationType>()

  const baseColumns: TableProps<VacationType>['columns'] = [
    { title: '假期名称', dataIndex: 'name', key: 'name', width: 120 },
    { title: '假期编码', dataIndex: 'code', key: 'code', width: 120, render: (value: string) => <Tag color="blue">{value}</Tag> },
    { title: '年度配额', key: 'totalDays', width: 120, render: (_: unknown, record: VacationType) => (
      <span>{record.totalDays} {record.unit === 'day' ? '天' : '小时'}</span>
    )},
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80, render: (value: string) => <Tag>{value === 'day' ? '按天' : '按小时'}</Tag> },
    { title: '带薪', dataIndex: 'isPaid', key: 'isPaid', width: 80, render: (value: boolean) => <Tag color={value ? 'green' : 'orange'}>{value ? '是' : '否'}</Tag> },
    { title: '可结转', dataIndex: 'isCarryOver', key: 'isCarryOver', width: 90, render: (value: boolean) => <Tag color={value ? 'blue' : 'gray'}>{value ? '是' : '否'}</Tag> },
    { title: '结转天数', dataIndex: 'carryOverDays', key: 'carryOverDays', width: 90, render: (value: number) => `${value}天` },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (value: string) => <Tag color={value === 'active' ? 'green' : 'gray'}>{value === 'active' ? '启用' : '停用'}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '操作', key: 'action', width: 150, fixed: 'right' as const, render: (_: unknown, record: VacationType) => (
      <ActionButtons
        onEdit={() => openEdit(record)}
        onDelete={() => handleDelete(record.id)}
        deleteContent="确定要删除该假期类型吗？"
      />
    )},
  ]

  const { visibleColumns, size, setSize: _setSize, settingsMenu } = useTableSettings({
    columns: baseColumns,
    storageKey: 'vacation-types-columns',
  })

  const fetchPage = useCallback(async (params: { page: number; pageSize: number; keyword?: string; status?: string }) => {
    const res = await getVacationTypesPage(params)
    return res.data
  }, [])

  const {
    data,
    total,
    loading,
    page,
    pageSize,
    reload,
    setFilters,
    pagination,
  } = useServerPagination<VacationType>({
    fetchFn: fetchPage,
    defaultPageSize: 10,
  })

  const { visible, editingId, saving, openCreate, openEdit, close, handleOk } = useCrudModal<VacationType>({
    form,
    onSubmit: async (values, id) => {
      if (id) {
        await updateVacationType(id, values)
        Message.success('修改成功')
      } else {
        await createVacationType(values)
        Message.success('新增成功')
      }
    },
    onSuccess: () => {
      reload()
      batch.clearSelection()
    },
  })

  // 表格快捷键
  useTableHotkeys({
    onNew: openCreate,
    onRefresh: reload,
  })

  // 命令面板
  const { open: _openCommandPalette, CommandPalette } = useCommandPalette({
    commands: [
      { key: 'new-vacation', title: '新增假期类型', icon: <IconPlus />, category: '操作', action: openCreate },
    ],
  })

  // 导入功能
  const handleImport = async (file: File) => {
    // TODO: 调用导入 API
    console.log('导入文件:', file.name)
  }

  const handleDownloadTemplate = () => {
    // TODO: 下载模板文件
    console.log('下载模板')
  }

  // 批量操作
  const handleBatchDelete = async () => {
    await Promise.all(batch.selectedIds.map((id) => deleteVacationType(id as number)))
  }

  const handleBatchEnable = async () => {
    await Promise.all(batch.selectedIds.map((id) => updateVacationType(id as number, { status: 'active' })))
  }

  const handleBatchDisable = async () => {
    await Promise.all(batch.selectedIds.map((id) => updateVacationType(id as number, { status: 'inactive' })))
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteVacationType(id)
      Message.success('删除成功')
      reload()
    } catch {
      // error handled by interceptor
    }
  }

  const handleSearch = () => {
    setFilters({
      keyword: searchText,
      status: statusFilter || undefined,
    })
  }

  const handleReset = () => {
    setSearchText('')
    setStatusFilter('')
    setFilters({})
  }

  const handlePageChange = (p: number) => {
    pagination.onChange(p, pageSize)
  }

  return (
    <div className={styles['vacation-types']}>
      <Card bordered={false} className={styles['vacation-types__card']}>
        <PageHeader
          title="假期类型"
          description="配置各类假期的名称、编码、年度配额、是否带薪、是否可结转等参数。"
          onRefresh={reload}
          extra={
            <Space>
              <ImportButton onImport={handleImport} onDownloadTemplate={handleDownloadTemplate} text="导入" />
              <Button type="primary" icon={<IconPlus />} onClick={openCreate}>新增类型</Button>
              <KeyboardShortcutsHelp />
            </Space>
          }
        />
      </Card>

      <Card bordered={false} className={styles['vacation-types__card']}>
        <FilterBar
          filters={
            <>
              <FormItem label="假期名称">
                <Input className={styles['vacation-types__search-input']} placeholder="请输入名称/编码" value={searchText} onChange={setSearchText} allowClear />
              </FormItem>
              <FormItem label="状态">
                <Select placeholder="全部" value={statusFilter || undefined} onChange={setStatusFilter} allowClear style={{ width: 120 }}>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
        />
      </Card>

      <Card bordered={false}>
        {/* 批量操作栏 */}
        <BatchActions
          selectedCount={batch.selectedCount}
          onClear={batch.clearSelection}
          onBatchDelete={handleBatchDelete}
          onBatchEnable={handleBatchEnable}
          onBatchDisable={handleBatchDisable}
        />

        {loading ? (
          <TableSkeleton columns={8} rows={8} />
        ) : (
          <Table
            columns={visibleColumns}
            data={data}
            rowKey="id"
            size={size}
            pagination={pagination}
            rowSelection={batch.getRowSelection(data)}
            scroll={{ x: 1100 }}
          />
        )}

        {/* 分页和设置工具栏 */}
        <div className={styles['vacation-types__footer']}>
          <PaginationJumper
            current={page}
            total={total}
            pageSize={pageSize}
            onChange={handlePageChange}
          />
          <TableSettingsButton settingsMenu={settingsMenu} />
        </div>
      </Card>

      <Modal focusLock title={editingId ? '编辑假期类型' : '新增假期类型'} visible={visible} onOk={handleOk} onCancel={close} confirmLoading={saving} className={styles['vacation-types__modal']}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="假期名称" field="name" rules={[{ required: true, message: '请输入假期名称' }]}>
                <Input placeholder="请输入假期名称" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="假期编码" field="code" rules={[{ required: true, message: '请输入假期编码' }]}>
                <Input placeholder="请输入假期编码" />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <FormItem label="年度配额" field="totalDays" initialValue={0}>
                <Input type="number" placeholder="请输入配额" />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem label="计算单位" field="unit" initialValue="day">
                <Select>
                  <Option value="day">天</Option>
                  <Option value="hour">小时</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <FormItem label="是否带薪" field="isPaid" initialValue={true}><Switch /></FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="可结转下年" field="isCarryOver" initialValue={false}><Switch /></FormItem>
            </Col>
            <Col span={8}>
              <FormItem label="状态" field="status" initialValue="active">
                <Select>
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </FormItem>
            </Col>
          </Row>
          <FormItem label="描述" field="description">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </FormItem>
        </Form>
      </Modal>

      {/* 命令面板 */}
      {CommandPalette}
    </div>
  )
}

export default Types
