import type { KnowledgeCategory, KnowledgeArticle } from '@/services/knowledge';

export interface CategoryTreeNode {
  key: string; // 'all' | String(category.id) | 'uncat'
  title: string;
  count: number;
}

export interface KnowledgeViewResult {
  nodes: CategoryTreeNode[];
  filteredArticles: KnowledgeArticle[];
}

const ALL = 'all';
const UNCAT = 'uncat';

const isUncategorized = (a: KnowledgeArticle) => !a.categoryId || a.categoryId === 0;

/** 根据分类列表与文章生成左侧树节点 */
export function buildCategoryNodes(
  categories: KnowledgeCategory[],
  articles: KnowledgeArticle[],
): CategoryTreeNode[] {
  const uncategorizedCount = articles.filter(isUncategorized).length;
  const nodes: CategoryTreeNode[] = [
    { key: ALL, title: '全部', count: articles.length },
    ...categories.map((c) => ({ key: String(c.id), title: c.name, count: c.articleCount ?? 0 })),
    { key: UNCAT, title: '未分类', count: uncategorizedCount },
  ];
  return nodes;
}

/**
 * 知识库左树导航的视图计算：分类树节点 + 按当前分类与关键字过滤后的文章列表。
 * activeCategoryId: 'all' | 'uncat' | 数字字符串。
 */
export function getKnowledgeView(
  categories: KnowledgeCategory[],
  articles: KnowledgeArticle[],
  activeCategoryId: string = ALL,
  keyword?: string,
): KnowledgeViewResult {
  const nodes = buildCategoryNodes(categories, articles);

  let filtered = articles;
  if (activeCategoryId === UNCAT) {
    filtered = filtered.filter(isUncategorized);
  } else if (activeCategoryId !== ALL) {
    const target = Number(activeCategoryId);
    filtered = filtered.filter((a) => Number(a.categoryId) === target);
  }

  if (keyword && keyword.trim()) {
    const lower = keyword.trim().toLowerCase();
    filtered = filtered.filter((a) =>
      [a.title, a.summary, a.content]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(lower)),
    );
  }

  return { nodes, filteredArticles: filtered };
}