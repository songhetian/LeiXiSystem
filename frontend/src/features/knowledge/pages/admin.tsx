'use client';

import { useState, useEffect } from 'react';
import {
  Message,
  Tabs,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Table,
  Tag,
  Popconfirm,
  InputNumber,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import {
  knowledgeApi,
  KnowledgeCategory,
  KnowledgeArticle,
  KnowledgeAttachment,
} from '@/services/knowledge';
import { usePermission } from '@/hooks/use-permission';
import useFetchState from '@/hooks/use-fetch-state';

const { TabPane } = Tabs;
const { TextArea } = Input;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  published: { label: '已发布', color: 'green' },
  draft: { label: '草稿', color: 'gray' },
  archived: { label: '已归档', color: 'orange' },
};

export default function KnowledgeAdminPage() {
  const { can } = usePermission();

  return (
    <PageContainer title="知识库管理">
      <Tabs defaultActiveTab="categories">
        <TabPane key="categories" title="分类管理">
          <CategoryManage />
        </TabPane>
        <TabPane key="articles" title="文章管理">
          <ArticleManage />
        </TabPane>
      </Tabs>
    </PageContainer>
);
}

// ====== 分类管理 ======
function CategoryManage() {
const { data: list, loading, error, run: runFetch, setData: setList } = useFetchState<KnowledgeCategory[]>([]);
const [modalVisible, setModalVisible] = useState(false);
const [isEdit, setIsEdit] = useState(false);
const [editItem, setEditItem] = useState<KnowledgeCategory | null>(null);
const [form] = Form.useForm();
const [submitting, setSubmitting] = useState(false);

const fetchList = async () => {
  await runFetch(async () => {
    const res = await knowledgeApi.getCategories({ page: 1, pageSize: 100 });
    if (res.code === 0 && res.data) {
      const data = Array.isArray(res.data) ? res.data : (res.data as any).list || [];
      return data;
    }
    throw new Error(res.message || '获取分类失败');
  });
};

useEffect(() => {
  fetchList();
}, []);

const openCreate = () => {
  setIsEdit(false);
  setEditItem(null);
  form.resetFields();
  setModalVisible(true);
};

const openEdit = (item: KnowledgeCategory) => {
  setIsEdit(true);
  setEditItem(item);
  form.setFieldsValue({ name: item.name, sort: item.sort });
  setModalVisible(true);
};

const handleSubmit = async () => {
  const values = await form.validate();
  setSubmitting(true);
  try {
    if (isEdit && editItem) {
      const res = await knowledgeApi.updateCategory(editItem.id, values);
      if (res.code === 0) {
        Message.success('更新成功');
        setModalVisible(false);
        fetchList();
      } else {
        Message.error(res.message || '更新失败');
      }
    } else {
      const res = await knowledgeApi.createCategory(values);
      if (res.code === 0) {
        Message.success('创建成功');
        setModalVisible(false);
        fetchList();
      } else {
        Message.error(res.message || '创建失败');
      }
    }
  } catch (e) {
    Message.error('操作失败');
  } finally {
    setSubmitting(false);
  }
};

const handleDelete = async (item: KnowledgeCategory) => {
  try {
    const res = await knowledgeApi.deleteCategory(item.id);
    if (res.code === 0) {
      Message.success('删除成功');
      fetchList();
    } else {
      Message.error(res.message || '删除失败');
    }
  } catch (e) {
    Message.error('删除失败');
  }
};

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '分类名称', dataIndex: 'name' },
  { title: '排序', dataIndex: 'sort', width: 80 },
  {
    title: '操作',
    width: 180,
    render: (_v: any, record: KnowledgeCategory) => (
      <Space>
        <Button size="mini" onClick={() => openEdit(record)}>
          编辑
        </Button>
        <Popconfirm title="确定删除吗？" onOk={() => handleDelete(record)}>
          <Button size="mini" status="danger">
            删除
          </Button>
        </Popconfirm>
      </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" onClick={openCreate}>
          新增分类
        </Button>
      </div>
      <DataState loading={loading} error={error} onRetry={fetchList} isEmpty={!list || list.length === 0}>
        <Table
          columns={columns as any}
          data={list || []}
          pagination={false}
        />
      </DataState>

      <Modal
        title={isEdit ? '编辑分类' : '新增分类'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="分类名称" field="name" rules={[{ required: true }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item label="排序" field="sort">
            <InputNumber style={{ width: '100%' }} min={0} defaultValue={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ====== 文章管理 ======
interface ArticleListResult {
  list: KnowledgeArticle[];
  page: number;
  pageSize: number;
  total: number;
}

function ArticleManage() {
  const { data: listResult, loading, error, run: runFetch, setData: setListResult } = useFetchState<ArticleListResult>();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editItem, setEditItem] = useState<KnowledgeArticle | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 附件管理（对齐参考文章附件）
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [addForm] = Form.useForm();

  const fetchCategories = async () => {
    try {
      const res = await knowledgeApi.getCategories({ page: 1, pageSize: 100 });
      if (res.code === 0 && res.data) {
        const data = Array.isArray(res.data) ? res.data : (res.data as any).list || [];
        setCategories(data);
      }
    } catch (e) {}
  };

  const fetchList = async (page = 1, pageSize = 20) => {
    await runFetch(async () => {
      const res = await knowledgeApi.getArticles({ page, pageSize });
      if (res.code === 0 && res.data) {
        const list = (res.data as any).list || res.data || [];
        const result = {
          list,
          page: (res.data as any).page || 1,
          pageSize: (res.data as any).pageSize || 20,
          total: (res.data as any).total || 0,
        };
        setPagination({
          current: result.page,
          pageSize: result.pageSize,
          total: result.total,
        });
        return result;
      }
      throw new Error(res.message || '获取文章列表失败');
    });
  };

  useEffect(() => {
    fetchCategories();
    fetchList();
  }, []);

  const openCreate = () => {
    setIsEdit(false);
    setEditItem(null);
    form.resetFields();
    form.setFieldsValue({ status: 'draft' });
    setAttachments([]);
    addForm.resetFields();
    setModalVisible(true);
  };

  const openEdit = (item: KnowledgeArticle) => {
    setIsEdit(true);
    setEditItem(item);
    form.setFieldsValue({
      title: item.title,
      categoryId: item.categoryId,
      summary: item.summary || '',
      content: item.content || '',
      status: item.status,
    });
    setAttachments([]);
    addForm.resetFields();
    fetchAttachments(item.id);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (isEdit && editItem) {
        const res = await knowledgeApi.updateArticle(editItem.id, values);
        if (res.code === 0) {
          Message.success('更新成功');
          setModalVisible(false);
          fetchList();
        } else {
          Message.error(res.message || '更新失败');
        }
      } else {
        const res = await knowledgeApi.createArticle(values);
        if (res.code === 0) {
          Message.success('创建成功');
          setModalVisible(false);
          fetchList();
        } else {
          Message.error(res.message || '创建失败');
        }
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: KnowledgeArticle) => {
    try {
      const res = await knowledgeApi.deleteArticle(item.id);
      if (res.code === 0) {
        Message.success('删除成功');
        fetchList();
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e) {
      Message.error('删除失败');
    }
  };

  const fetchAttachments = async (articleId: number) => {
    setAttLoading(true);
    try {
      const res = await knowledgeApi.getAttachments(articleId);
      if (res.code === 0 && res.data) setAttachments(res.data);
    } catch (e) {
      Message.error('获取附件失败');
    } finally {
      setAttLoading(false);
    }
  };

  const handleAddAttachment = async () => {
    if (!editItem) return;
    try {
      const values = await addForm.validate();
      const res = await knowledgeApi.addAttachment(editItem.id, {
        fileName: values.fileName,
        fileUrl: values.fileUrl,
        fileSize: values.fileSize ?? 0,
        mimeType: values.mimeType,
      });
      if (res.code === 0) {
        Message.success('添加成功');
        addForm.resetFields();
        fetchAttachments(editItem.id);
      } else {
        Message.error(res.message || '添加失败');
      }
    } catch (e) {
      Message.error('添加失败');
    }
  };

  const handleDeleteAttachment = async (att: KnowledgeAttachment) => {
    if (!editItem) return;
    try {
      const res = await knowledgeApi.deleteAttachment(editItem.id, att.id);
      if (res.code === 0) {
        Message.success('删除成功');
        setAttachments((prev) => prev.filter((a) => a.id !== att.id));
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e) {
      Message.error('删除失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '标题', dataIndex: 'title' },
    {
      title: '分类',
      dataIndex: 'categoryId',
      width: 120,
      render: (v: number) => categories.find((c) => c.id === v)?.name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const info = STATUS_MAP[v] || STATUS_MAP.draft;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    { title: '浏览量', dataIndex: 'viewCount', width: 100 },
    { title: '创建时间', dataIndex: 'createdAt', width: 180 },
    {
      title: '操作',
      width: 180,
      render: (_v: any, record: KnowledgeArticle) => (
        <Space>
          <Button size="mini" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除吗？" onOk={() => handleDelete(record)}>
            <Button size="mini" status="danger">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" onClick={openCreate}>
          新增文章
        </Button>
      </div>
      <DataState
        loading={loading}
        error={error}
        onRetry={() => fetchList(pagination.current, pagination.pageSize)}
        isEmpty={!listResult || listResult.list.length === 0}
      >
        <Table
          columns={columns as any}
          data={listResult?.list || []}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: true,
            onChange: (page, pageSize) => fetchList(page, pageSize),
          }}
        />
      </DataState>

      <Modal
        title={isEdit ? '编辑文章' : '新增文章'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="确定"
        cancelText="取消"
        style={{ width: 640 }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="标题" field="title" rules={[{ required: true }]}>
            <Input placeholder="请输入文章标题" />
          </Form.Item>
          <Form.Item label="分类" field="categoryId" rules={[{ required: true }]}>
            <Select
              placeholder="请选择分类"
              options={categories.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          <Form.Item label="摘要" field="summary">
            <TextArea rows={2} placeholder="请输入摘要" />
          </Form.Item>
          <Form.Item label="内容" field="content" rules={[{ required: true }]}>
            <TextArea rows={6} placeholder="请输入文章内容" />
          </Form.Item>
          <Form.Item label="状态" field="status">
            <Select
              options={[
                { label: '草稿', value: 'draft' },
                { label: '已发布', value: 'published' },
              ]}
            />
          </Form.Item>

          {isEdit && editItem && (
            <Form.Item label="附件">
              <div>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
                    {attLoading ? '加载中…' : attachments.length === 0 ? '暂无附件' : `共 ${attachments.length} 个附件`}
                  </span>
                </div>
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 8px',
                      border: '1px solid var(--color-border-2)',
                      borderRadius: 4,
                      marginBottom: 6,
                    }}
                  >
                    <Space>
                      <Tag color="arcoblue">附件</Tag>
                      <span style={{ fontSize: 13 }}>{att.fileName}</span>
                    </Space>
                    <Button
                      size="mini"
                      status="danger"
                      onClick={() => handleDeleteAttachment(att)}
                    >
                      删除
                    </Button>
                  </div>
                ))}
                <Form form={addForm} layout="inline" style={{ marginTop: 8 }}>
                  <Form.Item field="fileName" rules={[{ required: true, message: '请输入文件名' }]} style={{ marginBottom: 8 }}>
                    <Input placeholder="文件名，如 a.pdf" style={{ width: 180 }} />
                  </Form.Item>
                  <Form.Item field="fileUrl" rules={[{ required: true, message: '请输入文件地址' }]} style={{ marginBottom: 8 }}>
                    <Input placeholder="文件地址" style={{ width: 220 }} />
                  </Form.Item>
                  <Form.Item field="fileSize" style={{ marginBottom: 8 }}>
                    <InputNumber placeholder="大小(字节)" style={{ width: 140 }} />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 8 }}>
                    <Button size="small" type="primary" onClick={handleAddAttachment}>
                      添加附件
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
