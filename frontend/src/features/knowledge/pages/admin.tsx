'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  Upload,
  type TableColumnProps,
} from '@arco-design/web-react';
import {
  IconUpload,
  IconPlus,
  IconEdit,
  IconDelete,
  IconDragDotVertical,
  IconBook,
  IconFilePdf,
  IconFileImage,
  IconFile,
} from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import {
  knowledgeApi,
  KnowledgeCategory,
  KnowledgeArticle,
  KnowledgeAttachment,
} from '@/services/knowledge';
import useFetchState from '@/hooks/use-fetch-state';
import { formatDateTime } from '@/lib/format';

const { TabPane } = Tabs;
const { TextArea } = Input;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  published: { label: '已发布', color: 'green' },
  draft: { label: '草稿', color: 'gray' },
  archived: { label: '已归档', color: 'orange' },
};

/** 附件大小展示：B / KB / MB */
function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 附件类型图标 */
function getAttIcon(fileName: string) {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') {
    return (
      <span className="kb-att-icon pdf">
        <IconFilePdf />
      </span>
    );
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return (
      <span className="kb-att-icon image">
        <IconFileImage />
      </span>
    );
  }
  return (
    <span className="kb-att-icon other">
      <IconFile />
    </span>
  );
}

export default function KnowledgeAdminPage() {
  return (
    <PageContainer>
      <div className="kb-hero">
        <div className="kb-hero-left">
          <div className="kb-hero-icon">
            <IconBook />
          </div>
          <div>
            <h2 className="kb-hero-title">知识库管理</h2>
            <p className="kb-hero-desc">维护分类目录与文章内容，拖动分类即可调整顺序</p>
          </div>
        </div>
        <div className="kb-hero-badge">
          <IconDragDotVertical />
          拖拽排序 · 附件上限 200MB
        </div>
      </div>

      <div className="kb-tabs-wrap">
        <Tabs defaultActiveTab="categories">
          <TabPane key="categories" title="分类管理">
            <CategoryManage />
          </TabPane>
          <TabPane key="articles" title="文章管理">
            <ArticleManage />
          </TabPane>
        </Tabs>
      </div>
    </PageContainer>
  );
}

// ===== 分类管理 =====
function CategoryManage() {
  const { data: list, loading, error, run: runFetch, setData: setList } = useFetchState<KnowledgeCategory[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editItem, setEditItem] = useState<KnowledgeCategory | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 拖拽排序：记录当前拖拽的分类 id
  const dragId = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const fetchList = async () => {
    await runFetch(async () => {
      const res = await knowledgeApi.getCategories({ page: 1, pageSize: 100 });
      if (res.code === 0 && res.data) {
        return res.data;
      }
      throw new Error(res.message || '获取分类失败');
    });
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    form.setFieldsValue({ name: item.name });
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

  // 拖拽完成后：本地重排 + 持久化顺序
  const handleDrop = async (fromId: number, toId: number) => {
    if (fromId === toId) return;
    const current = list || [];
    const fromIndex = current.findIndex((c) => c.id === fromId);
    const toIndex = current.findIndex((c) => c.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setList(next);

    try {
      const res = await knowledgeApi.reorderCategories(next.map((c) => c.id));
      if (res.code === 0) {
        Message.success('排序已保存');
      } else {
        Message.error(res.message || '排序保存失败');
        fetchList();
      }
    } catch (e) {
      Message.error('排序保存失败');
      fetchList();
    }
  };

  return (
    <div>
      <div className="kb-toolbar">
        <div className="kb-hint">
          <IconDragDotVertical />
          拖动卡片可调整分类顺序
        </div>
        <Button type="primary" icon={<IconPlus />} onClick={openCreate}>
          新增分类
        </Button>
      </div>

      <DataState loading={loading} error={error} onRetry={fetchList} isEmpty={!list || list.length === 0}>
        <div className="kb-cat-list">
          {(list || []).map((cat) => (
            <div
              key={cat.id}
              data-testid={`cat-${cat.id}`}
              className={`kb-cat-item${draggingId === cat.id ? ' dragging' : ''}`}
              draggable
              onDragStart={() => {
                dragId.current = cat.id;
                setDraggingId(cat.id);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId.current != null && dragId.current !== cat.id) {
                  handleDrop(dragId.current, cat.id);
                }
              }}
              onDragEnd={() => {
                dragId.current = null;
                setDraggingId(null);
              }}
            >
              <span className="kb-cat-drag">
                <IconDragDotVertical />
              </span>
              <span className="kb-cat-name">{cat.name}</span>
              <div className="kb-cat-actions">
                <Button size="mini" type="text" icon={<IconEdit />} onClick={() => openEdit(cat)}>
                  编辑
                </Button>
                <Popconfirm title="确定删除该分类吗？删除后该分类下的文章也会被移除" onOk={() => handleDelete(cat)}>
                  <Button size="mini" type="text" status="danger" icon={<IconDelete />}>
                    删除
                  </Button>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
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
        <Form form={form} layout="vertical" style={{ paddingTop: 8 }}>
          <Form.Item label="分类名称" field="name" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ===== 文章管理 =====
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

  // 附件管理（编辑弹窗内，置顶展示）
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>([]);
  const [attLoading, setAttLoading] = useState(false);

  const fetchCategories = async () => {
    try {
      const res = await knowledgeApi.getCategories({ page: 1, pageSize: 100 });
      if (res.code === 0 && res.data) {
        setCategories(res.data);
      }
    } catch (e) {}
  };

  const fetchList = async (page = 1, pageSize = 20) => {
    await runFetch(async () => {
      const res = await knowledgeApi.getArticles({ page, pageSize, includeUnpublished: true });
      if (res.code === 0 && res.data) {
        const result = {
          list: res.data.list || [],
          page: res.data.page || 1,
          pageSize: res.data.pageSize || 20,
          total: res.data.total || 0,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setIsEdit(false);
    setEditItem(null);
    form.resetFields();
    form.setFieldsValue({ status: 'draft' });
    setAttachments([]);
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
          if (res.data?.id) {
            // 创建后停留在编辑态，弹窗底部即可立即上传附件
            setIsEdit(true);
            setEditItem(res.data as KnowledgeArticle);
            setAttachments([]);
          } else {
            setModalVisible(false);
            fetchList();
          }
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

  const columns = useMemo<TableColumnProps<KnowledgeArticle>[]>(
    () => [
      {
        title: '标题',
        dataIndex: 'title',
        render: (_v, record) => (
          <div>
            <div className="kb-art-title">{record.title}</div>
            {record.summary ? <div className="kb-art-summary">{record.summary}</div> : null}
          </div>
        ),
      },
      {
        title: '分类',
        dataIndex: 'categoryId',
        width: 130,
        render: (v) => {
          const name = categories.find((c) => c.id === v)?.name || '-';
          return <Tag color="arcoblue">{name}</Tag>;
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (v) => {
          const info = STATUS_MAP[v] || STATUS_MAP.draft;
          return <Tag color={info.color}>{info.label}</Tag>;
        },
      },
      { title: '浏览量', dataIndex: 'viewCount', width: 90 },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 160,
        render: (v) => <span style={{ color: 'var(--lx-text-3)' }}>{formatDateTime(v)}</span>,
      },
      {
        title: '操作',
        width: 170,
        render: (_v, record) => (
          <Space>
            <Button size="mini" icon={<IconEdit />} onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Popconfirm title="确定删除吗？" onOk={() => handleDelete(record)}>
              <Button size="mini" status="danger" icon={<IconDelete />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, listResult],
  );

  return (
    <div>
      <div className="kb-toolbar">
        <div className="kb-hint">共 {pagination.total} 篇文章</div>
        <Button type="primary" icon={<IconPlus />} onClick={openCreate}>
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
          columns={columns}
          data={listResult?.list || []}
          scroll={{ x: true }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: true,
            onChange: (page, pageSize) => fetchList(page, pageSize),
          }}
          rowKey="id"
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
        style={{ width: 680 }}
      >
        <Form form={form} layout="vertical" style={{ paddingTop: 8 }}>
          {isEdit && editItem && (
            <Form.Item label="附件上传">
              <div>
                {attLoading ? (
                  <div style={{ fontSize: 13, color: 'var(--lx-text-3)', padding: '12px 0' }}>加载附件中…</div>
                ) : attachments.length > 0 ? (
                  <div className="kb-att-list">
                    {attachments.map((att) => (
                      <div key={att.id} className="kb-att-item">
                        {getAttIcon(att.fileName)}
                        <span className="kb-att-name">{att.fileName}</span>
                        <span className="kb-att-size">{formatFileSize(att.fileSize)}</span>
                        <Button size="mini" type="text" status="danger" icon={<IconDelete />} onClick={() => handleDeleteAttachment(att)}>
                          删除
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--lx-text-3)', padding: '12px 0' }}>暂无附件</div>
                )}
                <Upload
                  drag
                  multiple
                  name="file"
                  action={`/api/v1/knowledge/articles/${editItem.id}/attachments/upload`}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.jpg,.jpeg,.png,.gif,.webp"
                  showUploadList
                  onChange={(_fileList, file) => {
                    if (file.status === 'done') {
                      const resp = (file.response ?? {}) as { code?: number; message?: string };
                      if (resp.code === 0) {
                        Message.success('上传成功');
                        fetchAttachments(editItem.id);
                      } else {
                        Message.error(resp.message || '上传失败');
                      }
                    } else if (file.status === 'error') {
                      Message.error(`${file.name} 上传失败，请重试`);
                    }
                  }}
                >
                  <div className="kb-upload-zone">
                    <span className="kb-upload-icon">
                      <IconUpload />
                    </span>
                    <div className="kb-upload-main">点击或拖拽文件到此区域，可一次选择多个</div>
                    <div className="kb-upload-sub">
                      支持 PDF / Office / 图片 / 文本，单个文件不超过 <b>200MB</b>
                    </div>
                  </div>
                </Upload>
              </div>
            </Form.Item>
          )}
          <Form.Item label="标题" field="title" rules={[{ required: true, message: '请输入文章标题' }]}>
            <Input placeholder="请输入文章标题" />
          </Form.Item>
          <Form.Item label="分类" field="categoryId" rules={[{ required: true, message: '请选择分类' }]}>
            <Select
              placeholder="请选择分类"
              options={categories.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          <Form.Item label="摘要" field="summary">
            <TextArea rows={2} placeholder="请输入摘要，将展示在文章列表与卡片中" />
          </Form.Item>
          <Form.Item label="内容" field="content" rules={[{ required: true, message: '请输入文章内容' }]}>
            <TextArea rows={6} placeholder="请输入文章内容" />
          </Form.Item>
          <Form.Item label="状态" field="status">
            <Select
              options={[
                { label: '草稿', value: 'draft' },
                { label: '已发布', value: 'published' },
                { label: '已归档', value: 'archived' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
