import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Message, Popconfirm, Tabs } from '@arco-design/web-react'
import { IconPlus } from '@arco-design/web-react/icon'
import PageContainer from '@/components/PageContainer'
import { getKbArticles, createKbArticle, updateKbArticle, deleteKbArticle, getKbCategories, getKbArticle } from '@/api/kb'
import type { KbArticle } from '@/api/kb'

export default function KbPage() {
  const [articles, setArticles] = useState<KbArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<KbArticle | null>(null)
  const [form] = Form.useForm()
  const [categories, setCategories] = useState<any[]>([])
  const [detail, setDetail] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('all')

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const res = activeTab === 'all'
        ? await getKbArticles({ keyword })
        : await getKbArticles({ keyword, categoryType: activeTab })
      setArticles(res.data?.list || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchArticles(); getKbCategories().then(r => setCategories(r.data || [])) }, [activeTab])

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ status: 'published' }); setModalVisible(true) }
  const openEdit = (r: KbArticle) => { setEditing(r); form.setFieldsValue(r); setModalVisible(true) }
  const handleSubmit = async () => {
    try {
      const v = await form.validate()
      editing ? await updateKbArticle(editing.id, v) : await createKbArticle(v)
      Message.success('保存成功'); setModalVisible(false); fetchArticles()
    } catch (e: any) { if (e.message) Message.error(e.message) }
  }

  const cols = [
    { title: '标题', dataIndex: 'title', width: 300, render: (v: string, r: KbArticle) => <Button type="text" onClick={async () => { const res = await getKbArticle(r.id); setDetail(res.data) }}>{v}</Button> },
    { title: '分类', dataIndex: 'category', width: 120, render: (v: any) => v?.name || '-' },
    { title: '阅读', dataIndex: 'viewCount', width: 80 },
    { title: '有帮助', dataIndex: 'helpfulCount', width: 90 },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag size="small" color={v === 'published' ? 'green' : 'gray'}>{v}</Tag> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 120, render: (v: string) => v?.split('T')[0] },
    { title: '操作', width: 120,
      render: (_: any, r: KbArticle) => (
        <Space><Button size="small" type="text" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="删除？" onOk={async () => { await deleteKbArticle(r.id); fetchArticles() }}>
            <Button size="small" type="text" status="danger">删除</Button></Popconfirm></Space>
      ),
    },
  ]

  return (
    <PageContainer title="知识库" description="客服知识文档与公司制度库"
      breadcrumbs={[{ label: '知识库' }]}
      extra={<Button type="primary" icon={<IconPlus />} onClick={openCreate}>新建文章</Button>}
      loading={loading && articles.length === 0}
      onRefresh={fetchArticles}
    >
      <Tabs activeTab={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane key="all" title="全部" />
        <Tabs.TabPane key="kb" title="客服知识" />
        <Tabs.TabPane key="doc" title="公司文档" />
      </Tabs>

      <div className="lx-toolbar">
        <Input.Search placeholder="搜索文章..." value={keyword} onChange={setKeyword} onSearch={fetchArticles} style={{ width: 280 }} />
      </div>

      <Card className="lx-fade-in">
        <Table columns={cols} data={articles} rowKey="id" pagination={false} />
      </Card>

      <Modal focusLock title={editing ? '编辑' : '新建'} visible={modalVisible} onOk={handleSubmit} onCancel={() => setModalVisible(false)} width={700}>
        <Form form={form} layout="vertical">
          <Form.Item field="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item field="categoryId" label="分类"><Select options={categories.map((c: any) => ({ label: c.name, value: c.id }))} allowClear /></Form.Item>
          <Form.Item field="content" label="内容" rules={[{ required: true }]}><Input.TextArea rows={10} /></Form.Item>
          <Form.Item field="tags" label="标签"><Input placeholder="逗号分隔" /></Form.Item>
          <Form.Item field="status" label="状态"><Select options={[{ label: '已发布', value: 'published' }, { label: '草稿', value: 'draft' }, { label: '归档', value: 'archived' }]} /></Form.Item>
        </Form>
      </Modal>

      <Modal focusLock title={detail?.title} visible={!!detail} onCancel={() => setDetail(null)} footer={null} width={600}>
        <div style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>{detail?.content}</div>
        <Space style={{ marginTop: 12 }}><Tag>阅读 {detail?.viewCount || 0}</Tag><Tag color="green">有帮助 {detail?.helpfulCount || 0}</Tag></Space>
      </Modal>
    </PageContainer>
  )
}
