'use client';

import { useState } from 'react';
import {
  Message,
  Modal,
  Tag,
  Divider,
  Button,
  Input,
  Empty,
  Spin,
  List,
  Typography,
} from '@arco-design/web-react';
import { IconFolder, IconFile, IconLeft, IconSearch, IconEye } from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import { knowledgeApi, KnowledgeArticle, KnowledgeCategory, KnowledgeAttachment } from '@/services/knowledge';
import { sanitizeHtml } from '@/lib/sanitize';
import { getApiErrorMessage } from '@/lib/api-error';
import { getKnowledgeFolders, getFolderArticles, FOLDER_UNCAT } from '../view';
import FilePreviewModal, { PreviewFile } from '../components/FilePreviewModal';
import { useCachedData } from '@/hooks/use-cached-data';

/** 空回退引用（保持稳定，避免每次渲染生成新数组触发依赖 effect 死循环） */
const EMPTY_CATEGORIES: KnowledgeCategory[] = [];
const EMPTY_ARTICLES: KnowledgeArticle[] = [];

const { Text } = Typography;

/** 从 preview-url 返回的前端路由中提取预览 token，用于下载附件 blob */
async function fetchAttachmentBlob(attachmentId: number): Promise<{ blob: Blob; url: string; name: string; mimeType: string }> {
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
  const blob = await res.blob();
  return {
    blob,
    url: URL.createObjectURL(blob),
    name,
    mimeType: res.headers.get('content-type') ?? '',
  };
}

/**
 * 知识库浏览页：对齐旧项目的「文件夹/卡片」体验 ——
 * 根视图展示分类文件夹卡片，点进分类后展示文章卡片网格，点开文章在预览弹窗查看正文与附件。
 */
export default function KnowledgeListPage() {
  // 当前所在文件夹：null=根视图；'uncat'=未分类；数字字符串=分类 id
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<KnowledgeArticle | null>(null);
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>([]);

  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 分类参考数据：共享缓存，跨组件去重
  const { data: catsRes, loading: catLoading } = useCachedData<{ code: number; data?: KnowledgeCategory[] }>(
    'knowledge:categories',
    () => knowledgeApi.getCategories({ page: 1, pageSize: 100 }),
    { staleTime: 60_000 },
  );
  const categories = catsRes?.code === 0 && catsRes.data ? catsRes.data : EMPTY_CATEGORIES;

  // 文章列表
  const { data: artsRes, loading: artLoading, error } = useCachedData<{ code: number; data?: { list: KnowledgeArticle[] } }>(
    'knowledge:articles',
    async () => {
      const res = await knowledgeApi.getArticles({ page: 1, pageSize: 200 });
      return { code: res.code, data: res.data ?? undefined };
    },
    { staleTime: 30_000 },
  );
  const allArticles = artsRes?.code === 0 && artsRes.data ? artsRes.data.list : EMPTY_ARTICLES;
  const loading = catLoading || artLoading;

  // 根视图文件夹 + 分类内文章
  const folders = getKnowledgeFolders(categories, allArticles);
  const folderArticles = activeFolder
    ? getFolderArticles(categories, allArticles, activeFolder, keyword)
    : [];

  const folderName =
    activeFolder === FOLDER_UNCAT
      ? '未分类'
      : categories.find((c) => String(c.id) === activeFolder)?.name ?? '';

  const enterFolder = (key: string) => {
    setActiveFolder(key);
    setKeyword('');
  };

  const backToRoot = () => {
    setActiveFolder(null);
    setKeyword('');
  };

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
        blob: blob.blob,
        url: blob.url,
        name: blob.name || attachment.fileName,
        mimeType: blob.mimeType || attachment.fileType,
        size: attachment.fileSize,
      });
    } catch (e) {
      Message.error(getApiErrorMessage(e, '预览失败'));
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

  return (
    <PageContainer>
      {/* 顶部：返回/面包屑 + 搜索 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {activeFolder ? (
            <>
              <Button size="small" icon={<IconLeft />} onClick={backToRoot}>
                返回
              </Button>
              <Text style={{ fontSize: 14, color: 'var(--lx-text-3)' }}>知识库</Text>
              <Text style={{ color: 'var(--lx-text-4)' }}>/</Text>
              <Text bold style={{ fontSize: 14 }}>
                {folderName}
              </Text>
            </>
          ) : (
            <>
              <Text bold style={{ fontSize: 15 }}>
                知识库
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                共 {folders.length} 个分类 · {allArticles.length} 篇文档
              </Text>
            </>
          )}
        </div>
        <Input.Search
          allowClear
          prefix={<IconSearch />}
          placeholder={activeFolder ? '搜索分类内文档' : '进入分类后可按标题/摘要/正文搜索'}
          style={{ width: 300 }}
          value={keyword}
          onChange={setKeyword}
          onSearch={setKeyword}
          disabled={!activeFolder}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 56 }}>
          <Spin />
        </div>
      ) : error ? (
        <Empty description={error} />
      ) : activeFolder ? (
        /* 分类内：文章卡片网格 */
        folderArticles.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 16 }}>
            {folderArticles.map((item) => (
              <button
                type="button"
                key={item.id}
                className="lx-clickable"
                onClick={() => handleOpenDetail(item)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  padding: '20px 12px',
                  background: 'var(--lx-bg-card)',
                  border: '1px solid var(--lx-border-1)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all var(--lx-transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--lx-shadow-card)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <IconFile style={{ fontSize: 34, color: 'var(--lx-primary)' }} />
                <Text
                  ellipsis={{ rows: 2 }}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: 13,
                    lineHeight: 1.4,
                    color: 'var(--lx-text-1)',
                  }}
                >
                  {item.title}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {item.authorName || '—'} · {item.viewCount ?? 0} 阅
                </Text>
              </button>
            ))}
          </div>
        ) : (
          <Empty description="当前分类下暂无文档" />
        )
      ) : (
        /* 根视图：分类文件夹卡片网格 */
        folders.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 16 }}>
            {folders.map((folder) => (
              <button
                type="button"
                key={folder.key}
                className="lx-clickable"
                onClick={() => enterFolder(folder.key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  minHeight: 128,
                  padding: 20,
                  background: 'var(--lx-bg-card)',
                  border: '1px solid var(--lx-border-1)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all var(--lx-transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--lx-shadow-card)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <IconFolder style={{ fontSize: 42, color: 'var(--lx-primary)' }} />
                <Text bold style={{ fontSize: 14, color: 'var(--lx-text-1)' }}>
                  {folder.name}
                </Text>
                <Tag size="small" color="arcoblue" style={{ margin: 0 }}>
                  {folder.count} 篇
                </Tag>
              </button>
            ))}
          </div>
        ) : (
          <Empty description="当前暂无分类与文档" />
        )
      )}

      {/* 文章预览弹窗 */}
      <Modal
        title={currentArticle?.title || '文章详情'}
        visible={detailVisible}
        onCancel={handleDetailCancel}
        footer={
          <Button type="primary" onClick={handleDetailCancel}>
            关闭
          </Button>
        }
        style={{ width: 760 }}
      >
        {currentArticle && (
          <div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                color: 'var(--lx-text-3)',
                fontSize: 13,
                paddingBottom: 12,
                borderBottom: '1px solid var(--lx-border-1)',
                marginBottom: 16,
              }}
            >
              <span>分类：{currentArticle.categoryName || '-'}</span>
              <span>作者：{currentArticle.authorName || '-'}</span>
              <span>阅读：{currentArticle.viewCount ?? 0}</span>
              <span>创建：{currentArticle.createdAt}</span>
            </div>

            {currentArticle.summary && (
              <>
                <Text bold>摘要</Text>
                <p style={{ color: 'var(--lx-text-2)', fontSize: 14, lineHeight: 1.7 }}>{currentArticle.summary}</p>
              </>
            )}

            {currentArticle.content && (
              <div
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentArticle.content) }}
                style={{ lineHeight: 1.8, color: 'var(--lx-text-1)', fontSize: 14 }}
              />
            )}

            {attachments.length > 0 && (
              <>
                <Divider />
                <Text bold>附件</Text>
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
                        borderBottom: '1px solid var(--lx-border-1)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.fileName}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--lx-text-3)' }}>
                          {(item.fileSize / 1024).toFixed(1)} KB
                        </div>
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
        )}
      </Modal>

      {preview && <FilePreviewModal file={preview} onClose={handlePreviewClose} />}
    </PageContainer>
  );
}