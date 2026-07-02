import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react'
import {
  getSalaryStructures,
  getStructureVersions,
  createStructureVersion,
  getStructureVersion,
  activateStructureVersion,
  SalaryStructure,
  SalaryStructureVersion,
  SalaryStructureItem,
  SalaryComponent,
  getSalaryComponents,
} from '@/api/payroll'
import { PageHeader } from '@/components'
import { getToday } from '@/utils/date'
import { toast } from '@/utils/toast'
import styles from './index.module.css'
const { Text, Paragraph } = Typography
const FormItem = Form.Item
const Option = Select.Option

function StructureVersionsPage() {
  const [structures, setStructures] = useState<SalaryStructure[]>([])
  const [components, setComponents] = useState<SalaryComponent[]>([])
  const [selectedStructureId, setSelectedStructureId] = useState<number | null>(null)
  const [data, setData] = useState<SalaryStructureVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [createVisible, setCreateVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailVersion, setDetailVersion] = useState<SalaryStructureVersion | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [form] = Form.useForm()

  const loadStructures = useCallback(async () => {
    try {
      const res = await getSalaryStructures()
      const structureList = (res as { data: SalaryStructure[] }).data || []
      setStructures(structureList)
      if (structureList.length > 0 && !selectedStructureId) {
        setSelectedStructureId(structureList[0].id)
      }
    } catch (err) {
      console.error('加载薪资结构失败', err)
    }
  }, [selectedStructureId])

  const loadComponents = useCallback(async () => {
    try {
      const res = await getSalaryComponents()
      setComponents((res as { data: SalaryComponent[] }).data || [])
    } catch (err) {
      console.error('加载薪资组件失败', err)
    }
  }, [])

  const loadVersions = useCallback(async () => {
    if (!selectedStructureId) return
    setLoading(true)
    try {
      const res = await getStructureVersions(selectedStructureId, { page, pageSize })
      setData(res.data.list || [])
      setTotal(res.data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [selectedStructureId, page, pageSize])

  useEffect(() => {
    loadStructures()
    loadComponents()
  }, [loadStructures, loadComponents])

  useEffect(() => {
    if (selectedStructureId) {
      setPage(1)
    }
  }, [selectedStructureId])

  useEffect(() => {
    if (selectedStructureId) {
      loadVersions()
    }
  }, [selectedStructureId, loadVersions])

  const openCreate = () => {
    form.resetFields()
    form.setFieldsValue({
      effectiveFrom: getToday(),
    })
    setCreateVisible(true)
  }

  const handleCreateSubmit = async () => {
    if (!selectedStructureId) return
    const values = await form.validate()
    const currentVersion = data.find((v) => v.status === 'active')
    const items = currentVersion?.items || []
    try {
      await createStructureVersion(selectedStructureId, {
        versionName: values.versionName,
        effectiveFrom: values.effectiveFrom,
        effectiveTo: values.effectiveTo,
        changeDescription: values.changeDescription,
        items,
        baseOnVersionId: currentVersion?.id,
      })
      toast.success('版本创建成功')
      setCreateVisible(false)
      loadVersions()
    } catch (err) {
      console.error('创建版本失败', err)
    }
  }

  const openDetail = async (record: SalaryStructureVersion) => {
    if (!selectedStructureId) return
    setDetailLoading(true)
    setDetailVisible(true)
    try {
      const res = await getStructureVersion(selectedStructureId, record.id)
      setDetailVersion(res.data)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleActivate = async (record: SalaryStructureVersion) => {
    Modal.confirm({
      title: '确认激活',
      content: `确定要激活版本「${record.versionName}」吗？激活后该版本将成为当前版本。`,
      onOk: async () => {
        try {
          await activateStructureVersion(record.id)
          toast.success('版本激活成功')
          loadVersions()
        } catch (err) {
          console.error('激活版本失败', err)
        }
      },
    })
  }

  const getComponentName = (componentId?: number) => {
    if (!componentId) return '-'
    const comp = components.find((c) => c.id === componentId)
    return comp?.name || `组件#${componentId}`
  }

  return (
    <div className={styles['structure-versions']}>
      <Card bordered={false} className={styles['structure-versions__card']}>
        <PageHeader
          title="薪资结构版本管理"
          description="管理薪资结构的历史版本，支持版本查看、激活和新建。"
        />
      </Card>

      <Card bordered={false}>
        <div className={styles['structure-versions__toolbar']}>
          <Space size="large">
            <div className={styles['structure-versions__selector']}>
              <Text className={styles['structure-versions__selector-label']}>薪资结构：</Text>
              <Select
                style={{ width: 280 }}
                value={selectedStructureId ?? undefined}
                onChange={(value) => setSelectedStructureId(value as number)}
                placeholder="请选择薪资结构"
              >
                {structures.map((s) => (
                  <Option key={s.id} value={s.id}>
                    {s.name}
                  </Option>
                ))}
              </Select>
            </div>
          </Space>
          <Button type="primary" onClick={openCreate} disabled={!selectedStructureId}>
            新建版本
          </Button>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={[
            {
              title: '版本号',
              dataIndex: 'version',
              width: 100,
              render: (value) => `v${value}`,
            },
            {
              title: '版本名称',
              dataIndex: 'versionName',
              render: (value, record) => (
                <Space size="small" direction="vertical" className={styles['structure-versions__name-cell']}>
                  <b>{value}</b>
                  {record.status === 'active' && (
                    <Tag color="green" size="small">
                      当前版本
                    </Tag>
                  )}
                </Space>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (value) => {
                const statusMap: Record<string, { color: string; text: string }> = {
                  active: { color: 'green', text: '生效中' },
                  inactive: { color: 'gray', text: '已失效' },
                  draft: { color: 'gold', text: '草稿' },
                }
                const status = statusMap[value] || { color: 'default', text: value }
                return <Tag color={status.color}>{status.text}</Tag>
              },
            },
            {
              title: '生效日期',
              dataIndex: 'effectiveFrom',
              width: 120,
            },
            {
              title: '失效日期',
              dataIndex: 'effectiveTo',
              width: 120,
              render: (value) => value || '-',
            },
            {
              title: '变更原因',
              dataIndex: 'changeDescription',
              ellipsis: true,
              render: (value) => value || '-',
            },
            {
              title: '创建人',
              dataIndex: 'creatorName',
              width: 100,
              render: (value) => value || '-',
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 160,
            },
            {
              title: '操作',
              width: 180,
              fixed: 'right',
              render: (_: unknown, record: SalaryStructureVersion) => (
                <Space size="small">
                  <Button type="text" size="small" onClick={() => openDetail(record)}>
                    查看详情
                  </Button>
                  {record.status !== 'active' && (
                    <Button type="text" size="small" status="success" onClick={() => handleActivate(record)}>
                      激活
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      <Modal focusLock
        title="新建版本"
        visible={createVisible}
        onOk={handleCreateSubmit}
        onCancel={() => setCreateVisible(false)}
        okText="创建"
        className={styles['structure-versions__modal']}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="版本名称"
            field="versionName"
            rules={[{ required: true, message: '请输入版本名称' }]}
          >
            <Input placeholder="例如：2024年Q2调薪版" />
          </FormItem>
          <Space size="large" className={styles['structure-versions__space']}>
            <FormItem
              label="生效日期"
              field="effectiveFrom"
              rules={[{ required: true, message: '请选择生效日期' }]}
            >
              <DatePicker style={{ width: 200 }} format="YYYY-MM-DD" />
            </FormItem>
            <FormItem label="失效日期" field="effectiveTo">
              <DatePicker style={{ width: 200 }} format="YYYY-MM-DD" />
            </FormItem>
          </Space>
          <FormItem label="变更原因" field="changeDescription">
            <Input.TextArea
              placeholder="请描述本次版本变更的原因..."
              autoSize={{ minRows: 3, maxRows: 5 }}
            />
          </FormItem>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            提示：新版本将基于当前生效版本的组件配置创建，创建后可在详情中查看。
          </Paragraph>
        </Form>
      </Modal>

      <Modal focusLock
        title={detailVersion ? `版本详情 - ${detailVersion.versionName}` : '版本详情'}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        className={styles['structure-versions__detail-modal']}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>加载中...</div>
        ) : detailVersion ? (
          <div className={styles['structure-versions__detail']}>
            <div className={styles['structure-versions__detail-info']}>
              <Space size="large" wrap>
                <div>
                  <Text type="secondary">版本号：</Text>
                  <b>v{detailVersion.version}</b>
                </div>
                <div>
                  <Text type="secondary">状态：</Text>
                  <Tag color={detailVersion.status === 'active' ? 'green' : 'gray'}>
                    {detailVersion.status === 'active' ? '生效中' : '已失效'}
                  </Tag>
                </div>
                <div>
                  <Text type="secondary">生效日期：</Text>
                  <Text>{detailVersion.effectiveFrom}</Text>
                </div>
                <div>
                  <Text type="secondary">失效日期：</Text>
                  <Text>{detailVersion.effectiveTo || '-'}</Text>
                </div>
                <div>
                  <Text type="secondary">创建人：</Text>
                  <Text>{detailVersion.creatorName || '-'}</Text>
                </div>
                <div>
                  <Text type="secondary">创建时间：</Text>
                  <Text>{detailVersion.createdAt}</Text>
                </div>
              </Space>
              {detailVersion.changeDescription && (
                <div className={styles['structure-versions__detail-reason']}>
                  <Text type="secondary">变更原因：</Text>
                  <Paragraph>{detailVersion.changeDescription}</Paragraph>
                </div>
              )}
            </div>

            <div className={styles['structure-versions__detail-section']}>
              <b className={styles['structure-versions__detail-section-title']}>
                组件配置快照
              </b>
              <Table
                rowKey={(record: SalaryStructureItem) => `${record.componentId}-${record.sortOrder}`}
                pagination={false}
                size="small"
                data={detailVersion.items || []}
                columns={[
                  {
                    title: '序号',
                    width: 60,
                    render: (_: unknown, __: SalaryStructureItem, index: number) => index + 1,
                  },
                  {
                    title: '组件名称',
                    dataIndex: 'componentId',
                    render: (value) => getComponentName(value),
                  },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    width: 100,
                    render: (value) => (value !== undefined ? `¥${value}` : '-'),
                  },
                  {
                    title: '公式',
                    dataIndex: 'formula',
                    render: (value) => value || '-',
                  },
                  {
                    title: '排序',
                    dataIndex: 'sortOrder',
                    width: 80,
                  },
                ]}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default StructureVersionsPage
