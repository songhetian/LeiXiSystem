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

// ============================================================================
// 知识库「文件夹/浏览」视图（对齐旧项目：根视图=分类文件夹卡片 → 分类内=文章卡片）
// ============================================================================

export interface KnowledgeFolder {
  key: string; // String(category.id) | 'uncat'
  name: string;
  count: number;
}

export const FOLDER_ALL = 'all';
export const FOLDER_UNCAT = 'uncat';

/** 根视图：按分类生成文件夹卡片（含未分类文件夹），count 以实际文章统计 */
export function getKnowledgeFolders(
  categories: KnowledgeCategory[],
  articles: KnowledgeArticle[],
): KnowledgeFolder[] {
  const uncatCount = articles.filter(isUncategorized).length;
  return [
    ...categories.map((c) => {
      const count = articles.filter((a) => Number(a.categoryId) === Number(c.id)).length;
      return { key: String(c.id), name: c.name, count };
    }),
    { key: FOLDER_UNCAT, name: '未分类', count: uncatCount },
  ];
}

/**
 * 分类内文章列表：按所属文件夹过滤，并支持标题/摘要/正文关键字过滤。
 * activeFolder: FOLDER_ALL | FOLDER_UNCAT | 分类 id 字符串。
 */
export function getFolderArticles(
  categories: KnowledgeCategory[],
  articles: KnowledgeArticle[],
  activeFolder: string = FOLDER_ALL,
  keyword?: string,
): KnowledgeArticle[] {
  let filtered = articles;
  if (activeFolder === FOLDER_UNCAT) {
    filtered = filtered.filter(isUncategorized);
  } else if (activeFolder !== FOLDER_ALL) {
    const target = Number(activeFolder);
    if (!Number.isNaN(target)) {
      filtered = filtered.filter((a) => Number(a.categoryId) === target);
    }
  }

  if (keyword && keyword.trim()) {
    const lower = keyword.trim().toLowerCase();
    filtered = filtered.filter((a) =>
      [a.title, a.summary, a.content]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(lower)),
    );
  }
  return filtered;
}