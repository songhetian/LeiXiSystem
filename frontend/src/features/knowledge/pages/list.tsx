'use client';

import { useState, useEffect } from 'react';
import { Message, Modal, Descriptions, Tag, Space, Divider, List, Button } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { knowledgeApi, KnowledgeArticle, KnowledgeCategory, KnowledgeAttachment } from '@/services/knowledge';
import { SearchFieldConfig } from '@/components/SearchForm';

export default function KnowledgeListPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<KnowledgeArticle[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<KnowledgeArticle | null>(null);
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>([]);

  // KKFileView 在线预览（iframe 内嵌）
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');

  const fetchCategories = async () => {
    try {
      const result = await knowledgeApi.getCategories({ page: 1, pageSize: 100 });
      if (result.code === 0 && result.data) {
        setCategories(result.data.list);
      }
    } catch (e) {
      Message.error('获取分类失败');
    }
  };

  const fetchArticles = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const result = await knowledgeApi.getArticles({
        page,
        pageSize,
        ...params,
      });
      if (result.code === 0 && result.data) {
        setData(result.data.list);
        setPagination({
          current: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchArticles(1, 20, searchParams);
  }, []);

  const getSearchFields = (): SearchFieldConfig[] => [
    { key: 'keyword', label: '关键词', type: 'input', placeholder: '请输入关键词' },
    {
      key: 'categoryId',
      label: '分类',
      type: 'select',
      placeholder: '请选择分类',
      options: categories.map((c) => ({ value: String(c.id), label: c.name })),
    },
  ];

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    fetchArticles(1, pagination.pageSize, values);
  };

  const handleReset = () => {
    setSearchParams({});
    fetchArticles(1, pagination.pageSize, {});
  };

  const handlePageChange = (page: number, pageSize: number) => {
    fetchArticles(page, pageSize, searchParams);
  };

  const handleViewDetail = async (record: KnowledgeArticle) => {
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
    try {
      const result = await knowledgeApi.getPreviewUrl(attachment.id);
      if (result.code === 0 && result.data) {
        setPreviewUrl(result.data.previewUrl);
        setPreviewFileName(result.data.fileName || attachment.fileName);
        setPreviewVisible(true);
      } else {
        Message.error(result.message || '获取预览地址失败');
      }
    } catch (e) {
      Message.error('获取预览地址失败');
    }
  };

  const columns: ProTableColumn[] = [
    { title: '标题', dataIndex: 'title', width: 240 },
    { title: '分类', dataIndex: 'categoryName', width: 120 },
    { title: '摘要', dataIndex: 'summary', width: 300, ellipsis: true },
    { title: '作者', dataIndex: 'authorName', width: 120 },
    {
      title: '阅读量',
      dataIndex: 'viewCount',
      width: 100,
      render: (value: number) => (
        <Tag color="arcoblue">{value}</Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 200 },
  ];

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
            <div
              dangerouslySetInnerHTML={{ __html: currentArticle.content }}
              style={{ lineHeight: 1.8 }}
            />
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
                    <div style={{ fontSize: 12, color: '#86909c' }}>
                      {(item.fileSize / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <Button size="mini" type="primary" onClick={() => handlePreview(item)}>
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
    <AppLayout title="知识库" activeMenu="knowledge">
      <PageContainer title="知识库">
        <ProTable
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          searchFields={getSearchFields()}
          onSearch={handleSearch}
          onReset={handleReset}
          pagination={pagination}
          onPageChange={handlePageChange}
          onRowClick={handleViewDetail}
        />
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

        {/* KKFileView 在线预览（iframe 内嵌，URL 由后端签发签名时效） */}
        <Modal
          title={previewFileName || '附件预览'}
          visible={previewVisible}
          onCancel={() => setPreviewVisible(false)}
          footer={null}
          style={{ width: 960 }}
        >
          <iframe
            src={previewUrl}
            title={previewFileName}
            style={{ width: '100%', height: 560, border: '1px solid #e5e6eb', borderRadius: 4 }}
          />
        </Modal>
      </PageContainer>
    </AppLayout>
  );
}
