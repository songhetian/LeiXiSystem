import { getKnowledgeView } from '../view';
import type { KnowledgeCategory, KnowledgeArticle } from '@/services/knowledge';

const categories: KnowledgeCategory[] = [
  { id: 1, name: '公司制度', sort: 1, articleCount: 2, createdAt: '', updatedAt: '' },
  { id: 2, name: '培训资料', sort: 2, articleCount: 1, createdAt: '', updatedAt: '' },
];

const articles: KnowledgeArticle[] = [
  { id: 1, title: '员工手册', categoryId: 1, categoryName: '公司制度', status: 'published', viewCount: 10, createdAt: '', updatedAt: '' },
  { id: 2, title: '差旅报销制度', categoryId: 1, categoryName: '公司制度', status: 'published', viewCount: 5, createdAt: '', updatedAt: '' },
  { id: 3, title: '新员工入职指南', categoryId: 2, categoryName: '培训资料', status: 'published', viewCount: 8, createdAt: '', updatedAt: '' },
  { id: 4, title: '散落笔记', categoryId: 0, categoryName: '', status: 'published', viewCount: 3, createdAt: '', updatedAt: '' },
];

describe('getKnowledgeView', () => {
  describe('nodes', () => {
    it('生成 全部 + 分类 + 未分类 节点', () => {
      const { nodes } = getKnowledgeView(categories, articles);
      expect(nodes.map((n) => n.key)).toEqual(['all', '1', '2', 'uncat']);
      expect(nodes[0]).toMatchObject({ key: 'all', title: '全部', count: 4 });
      expect(nodes[1]).toMatchObject({ key: '1', title: '公司制度', count: 2 });
      expect(nodes[3]).toMatchObject({ key: 'uncat', title: '未分类', count: 1 });
    });
  });

  describe('过滤', () => {
    it('默认 all 返回全部文章', () => {
      const { filteredArticles } = getKnowledgeView(categories, articles);
      expect(filteredArticles).toHaveLength(4);
    });

    it('选中某分类只返回该分类文章', () => {
      const { filteredArticles } = getKnowledgeView(categories, articles, '1');
      expect(filteredArticles.map((a) => a.id)).toEqual([1, 2]);
    });

    it('选中未分类返回无分类文章', () => {
      const { filteredArticles } = getKnowledgeView(categories, articles, 'uncat');
      expect(filteredArticles.map((a) => a.id)).toEqual([4]);
    });

    it('支持关键字过滤（标题/摘要/正文，忽略大小写）', () => {
      const { filteredArticles } = getKnowledgeView(categories, articles, 'all', '制度');
      expect(filteredArticles.map((a) => a.id)).toEqual([2]);
    });

    it('分类与关键字组合过滤', () => {
      const { filteredArticles } = getKnowledgeView(categories, articles, '1', '员工');
      expect(filteredArticles.map((a) => a.id)).toEqual([1]);
    });

    it('无匹配时返回空数组', () => {
      const { filteredArticles } = getKnowledgeView(categories, articles, 'all', '不存在词');
      expect(filteredArticles).toHaveLength(0);
    });
  });
});