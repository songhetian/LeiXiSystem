'use client';

import { useState, useEffect } from 'react';
import { Message, Modal, Descriptions, Tag, Divider, List, Button, Tree, Input, Empty, Spin, Badge } from '@arco-design/web-react';
import { IconEye, IconSearch } from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import { knowledgeApi, KnowledgeArticle, KnowledgeCategory, KnowledgeAttachment } from '@/services/knowledge';
import { sanitizeHtml } from '@/lib/sanitize';
import { getKnowledgeView, CategoryTreeNode } from '../view';
import FilePreviewModal, { PreviewFile } from '../components/FilePreviewModal';

const PAGE_SIZE = 20;

/** 从 preview-url 返回的前端路由中提取预览 token，用于下载附件 blob */
async function fetchAttachmentBlob(attachmentId: number): Promise<{ url: string; name: string; mimeType: string }> {
  const previewResult = await knowledgeApi.getPreviewUrl(attachmentId);
  if (previewResult.code !== 0 || !previewResult.data) {
    throw new Error(previewResult.message || '获取预览地址失败');
  }
  const token = previewResult.data.previewUrl.match(/[?&]token=([^&]+)/)?.[1];
  const res = await fetch(`/api/v1/knowledge/attachments/${attachmentId}/download?token=${token ?? ''}`);
  if (!res.ok) throw new Error('加载附件失败');
  const cd = res.headers.get('content-disposition');
  let name = '附件';
  if (cd) {
    const m = cd.match(/filename="?(.+?)"?(?:;|$)/);
    if (m) {
      try {
        name = decodeURIComponent(m[1]);
      } catch {
        name = m[1];
      }
    }
  }
  return {
    url: URL.createObjectURL(await res.blob()),
    name,
    mimeType: res.headers.get('content-type') ?? '',
  };
}

export default function KnowledgeListPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allArticles, setAllArticles] = useState<KnowledgeArticle[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [nodes, setNodes] = useState<CategoryTreeNode[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<KnowledgeArticle | null>(null);
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>([]);

  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catResult, artResult] = await Promise.all([
        knowledgeApi.getCategories({ page: 1, pageSize: 100 }),
        knowledgeApi.getArticles({ page: 1, pageSize: 200 }),
      ]);
      if (catResult.code === 0 && catResult.data) {
        const raw: any = catResult.data;
        setCategories(Array.isArray(raw) ? raw : raw?.list ?? []);
      }
      if (artResult.code === 0 && artResult.data) {
        setAllArticles(artResult.data.list);
      }
    } catch (e: any) {
      setError(e?.message || '加载失败');
      notifyError(e, '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { filteredArticles } = getKnowledgeView(categories, allArticles, activeCategoryId, keyword);

  useEffect(() => {
    const { nodes: n } = getKnowledgeView(categories, allArticles, activeCategoryId, keyword);
    setNodes(n);
  }, [categories, allArticles]);

  // 切换分类/搜索时回到第一页
  useEffect(() => {
    setPage(1);
  }, [activeCategoryId, keyword]);

  const paged = filteredArticles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));

  const treeData = [
    {
      key: 'all',
      title: '全部',
      children: [
        ...categories.map((c) => ({ key: String(c.id), title: c.name })),
        { key: 'uncat', title: '未分类' },
      ],
    },
  ];

  const nodeCount = (key: string) => nodes.find((n) => n.key === key)?.count ?? 0;

  const handleOpenDetail = async (record: KnowledgeArticle) => {
    setDetailLoading(true);
    setDetailVisible(true);
    try {
      const [articleResult, attachmentsResult] = await Promise.all([
        knowledgeApi.getArticleDetail(record.id),
        knowledgeApi.getAttachments(record.id),
      ]);
      if (articleResult.code === 0 && articleResult.data) {
        setCurrentArticle(articleResult.data);
      } else {
        Message.error(articleResult.message || '获取文章详情失败');
      }
      if (attachmentsResult.code === 0 && attachmentsResult.data) {
        setAttachments(attachmentsResult.data);
      }
    } catch (e) {
      Message.error('获取文章详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDetailCancel = () => {
    setDetailVisible(false);
    setCurrentArticle(null);
    setAttachments([]);
  };

  const handlePreview = async (attachment: KnowledgeAttachment) => {
    setPreviewLoading(true);
    try {
      const blob = await fetchAttachmentBlob(attachment.id);
      setPreview({
        url: blob.url,
        name: blob.name || attachment.fileName,
        mimeType: blob.mimeType || attachment.fileType,
        size: attachment.fileSize,
      });
    } catch (e: any) {
      Message.error(e?.message || '预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewClose = () => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const renderDetailContent = () => {
    if (!currentArticle) return null;

    return (
      <div>
        <Descriptions
          title="基本信息"
          column={2}
          data={[
            { label: '标题', value: currentArticle.title },
            { label: '分类', value: currentArticle.categoryName },
            { label: '作者', value: currentArticle.authorName },
            { label: '阅读量', value: currentArticle.viewCount },
            { label: '创建时间', value: currentArticle.createdAt, span: 2 },
          ]}
        />
        {currentArticle.summary && (
          <>
            <Divider />
            <h4>摘要</h4>
            <p>{currentArticle.summary}</p>
          </>
        )}
        {currentArticle.content && (
          <>
            <Divider />
            <h4>正文</h4>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentArticle.content) }} style={{ lineHeight: 1.8 }} />
          </>
        )}
        {attachments.length > 0 && (
          <>
            <Divider />
            <h4>附件</h4>
            <List
              size="small"
              dataSource={attachments}
              render={(item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 4px',
                    borderBottom: '1px solid var(--color-border-2)',
                  }}
                >
                  <div>
                    <div>{item.fileName}</div>
                    <div style={{ fontSize: 12, color: '#86909c' }}>{(item.fileSize / 1024).toFixed(1)} KB</div>
                  </div>
                  <Button
                    size="mini"
                    type="primary"
                    icon={<IconEye />}
                    loading={previewLoading}
                    onClick={() => handlePreview(item)}
                  >
                    预览
                  </Button>
                </div>
              )}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <PageContainer title="知识库">
      <div style={{ display: 'flex', gap: 16, minHeight: '70vh' }}>
        {/* 左侧分类树 */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            borderRight: '1px solid var(--color-border-2)',
            paddingRight: 8,
          }}
        >
          <Tree
            treeData={treeData}
            selectedKeys={[activeCategoryId]}
            onSelect={(keys) => setActiveCategoryId(String(keys[0]))}
            renderTitle={(node) => (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 170 }}>
                <span>{node.title}</span>
                <Badge count={nodeCount(String(node._key))} />
              </div>
            )}
          />
        </div>

        {/* 右侧内容区 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1d2129' }}>
              共 {filteredArticles.length} 篇
            </div>
            <Input.Search
              allowClear
              prefix={<IconSearch />}
              placeholder="搜索标题 / 摘要 / 正文"
              style={{ width: 280 }}
              onChange={(val) => setKeyword(val)}
              onSearch={(val) => setKeyword(val)}
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : error ? (
            <Empty description={error} />
          ) : paged.length > 0 ? (
            <List
              bordered
              dataSource={paged}
              style={{ marginBottom: 16 }}
              render={(item) => (
                <List.Item
                  key={item.id}
                  actions={[<Tag color="arcoblue" key="views">{item.viewCount}</Tag>]}
                  onClick={() => handleOpenDetail(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <List.Item.Meta
                    title={<span>{item.title}</span>}
                    description={
                      <span
                        style={{ color: '#86909c', fontSize: 13, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {item.summary || '(无摘要)'} · {item.categoryName} · {item.authorName}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="当前分类下暂无文档" />
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <span style={{ alignSelf: 'center', margin: '0 12px', color: '#86909c' }}>
                {page} / {totalPages}
              </span>
              <Button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                下一页
              </Button>
            </div>
          )}
        </div>
      </div>

      <Modal
        title="文章详情"
        visible={detailVisible}
        onCancel={handleDetailCancel}
        confirmLoading={detailLoading}
        okText={null}
        cancelText="关闭"
        footer={null}
        style={{ width: 720 }}
      >
        {renderDetailContent()}
      </Modal>

      {preview && <FilePreviewModal file={preview} onClose={handlePreviewClose} />}
    </PageContainer>
  );
}