# 知识库多维度搜索 API 文档

## 概述

知识库搜索 API 提供强大的多维度搜索功能，支持关键词搜索、分类筛选、类型筛选、状态筛选、作者筛选和日期范围筛选。

## API 端点

### POST /api/knowledge/articles/search

多维度搜索知识库文档

## 请求参数

### 请求体 (JSON)

```json
{
  "keyword": "搜索关键词",
  "categories": [1, 2, 3],
  "types": ["company", "personal", "shared"],
  "statuses": ["draft", "published", "archived"],
  "authors": [1, 2, 3],
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31",
    "field": "created_at"
  },
  "sortBy": "created_at",
  "sortOrder": "desc",
  "page": 1,
  "pageSize": 20
}
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 否 | 搜索关键词，将在标题、内容、摘要中搜索 |
| categories | array | 否 | 分类 ID 数组，支持多选 |
| types | array | 否 | 文档类型数组，可选值: `company`, `personal`, `shared` |
| statuses | array | 否 | 文档状态数组，可选值: `draft`, `published`, `archived` |
| authors | array | 否 | 作者 ID 数组，支持多选 |
| dateRange | object | 否 | 日期范围筛选 |
| dateRange.start | string | 否 | 开始日期 (YYYY-MM-DD) |
| dateRange.end | string | 否 | 结束日期 (YYYY-MM-DD) |
| dateRange.field | string | 否 | 日期字段，可选值: `created_at`, `updated_at`，默认 `created_at` |
| sortBy | string | 否 | 排序字段，可选值: `created_at`, `updated_at`, `view_count`, `like_count`, `title`，默认 `created_at` |
| sortOrder | string | 否 | 排序方向，可选值: `asc`, `desc`，默认 `desc` |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页数量，默认 20 |

## 响应格式

### 成功响应 (200 OK)

```json
{
  "success": true,
  "data": {
    "articles": [
      {
        "id": 1,
        "title": "文档标题",
        "summary": "文档摘要",
        "content": "文档内容",
        "type": "company",
        "status": "published",
        "icon": "📄",
        "view_count": 100,
        "like_count": 10,
        "category_id": 1,
        "category_name": "分类名称",
        "category_icon": "📚",
        "created_by": 1,
        "author_name": "作者姓名",
        "created_at": "2024-11-11T10:00:00.000Z",
        "updated_at": "2024-11-11T10:00:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "statistics": {
      "byCategory": {
        "分类1": {
          "count": 10,
          "id": 1,
          "icon": "📚"
        },
        "分类2": {
          "count": 5,
          "id": 2,
          "icon": "📖"
        }
      },
      "byType": {
        "company": 8,
        "personal": 7,
        "shared": 5
      },
      "byAuthor": {
        "作者1": {
          "count": 5,
          "id": 1
        },
        "作者2": {
          "count": 10,
          "id": 2
        }
      }
    }
  }
}
```

### 错误响应 (500 Internal Server Error)

```json
{
  "error": "搜索失败: 错误详情"
}
```

## 使用示例

### 示例 1: 简单关键词搜索

```javascript
const response = await fetch('http://localhost:3001/api/knowledge/articles/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    keyword: '客服',
    page: 1,
    pageSize: 20
  })
})

const data = await response.json()
console.log('搜索结果:', data.data.articles)
console.log('总数:', data.data.total)
```

### 示例 2: 多条件组合搜索

```javascript
const response = await fetch('http://localhost:3001/api/knowledge/articles/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    keyword: '培训',
    categories: [1, 2],
    types: ['company'],
    statuses: ['published'],
    dateRange: {
      start: '2024-01-01',
      end: '2024-12-31',
      field: 'created_at'
    },
    sortBy: 'view_count',
    sortOrder: 'desc',
    page: 1,
    pageSize: 20
  })
})

const data = await response.json()
```

### 示例 3: 按作者筛选

```javascript
const response = await fetch('http://localhost:3001/api/knowledge/articles/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    authors: [1, 2, 3],
    statuses: ['published'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  })
})

const data = await response.json()
```

### 示例 4: 日期范围搜索

```javascript
const response = await fetch('http://localhost:3001/api/knowledge/articles/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    dateRange: {
      start: '2024-11-01',
      end: '2024-11-30',
      field: 'updated_at'
    },
    sortBy: 'updated_at',
    sortOrder: 'desc'
  })
})

const data = await response.json()
```

## 性能优化

为了提供最佳的搜索性能，系统已添加以下数据库索引：

1. **全文索引**: `ft_articles_search` - 用于关键词搜索
2. **组合索引**: `idx_category_status` - 用于分类和状态筛选
3. **组合索引**: `idx_type_status` - 用于类型和状态筛选
4. **单列索引**: `idx_created_at` - 用于创建时间排序
5. **单列索引**: `idx_updated_at` - 用于更新时间排序
6. **单列索引**: `idx_created_by` - 用于作者筛选
7. **单列索引**: `idx_view_count` - 用于浏览量排序
8. **单列索引**: `idx_like_count` - 用于点赞数排序
9. **单列索引**: `idx_status` - 用于状态筛选

### 添加索引

运行以下命令添加搜索优化索引：

```bash
# Windows
add-search-indexes.bat

# 或直接运行 Node.js 脚本
node database/migrations/run-search-indexes.js
```

## 注意事项

1. **关键词搜索**: 支持模糊匹配，会在标题、内容和摘要中搜索
2. **多选筛选**: categories、types、statuses、authors 都支持多选，使用 OR 逻辑
3. **组合条件**: 不同维度的筛选条件使用 AND 逻辑组合
4. **已删除文档**: 搜索结果自动排除 status 为 'deleted' 的文档
5. **分页**: 建议每页显示 20-50 条记录以获得最佳性能
6. **排序**: 支持按多个字段排序，默认按创建时间降序
7. **统计信息**: 每次搜索都会返回按分类、类型、作者分组的统计信息

## 搜索策略建议

### 1. 快速搜索
- 只使用 keyword 参数
- 适合用户快速查找文档

### 2. 精确筛选
- 组合使用 categories、types、statuses
- 适合在特定范围内查找文档

### 3. 时间范围查询
- 使用 dateRange 参数
- 适合查找特定时间段的文档

### 4. 热门文档
- 使用 sortBy: 'view_count' 或 'like_count'
- 适合展示热门内容

## 错误处理

```javascript
try {
  const response = await fetch('http://localhost:3001/api/knowledge/articles/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(searchParams)
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || '搜索失败')
  }

  // 处理搜索结果
  console.log('搜索成功:', data.data)

} catch (error) {
  console.error('搜索出错:', error.message)
  // 显示错误提示给用户
}
```

## 前端集成示例

### React Hook 示例

```javascript
import { useState, useCallback } from 'react'

function useKnowledgeSearch() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [statistics, setStatistics] = useState(null)
  const [error, setError] = useState(null)

  const search = useCallback(async (params) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:3001/api/knowledge/articles/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      })

      const data = await response.json()

      if (data.success) {
        setResults(data.data.articles)
        setTotal(data.data.total)
        setStatistics(data.data.statistics)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      setError(err.message)
      setResults([])
      setTotal(0)
      setStatistics(null)
    } finally {
      setLoading(false)
    }
  }, [])

  return { search, loading, results, total, statistics, error }
}

export default useKnowledgeSearch
```

## 测试

### 测试脚本

创建 `test-search-api.js`:

```javascript
const axios = require('axios')

async function testSearch() {
  const API_URL = 'http://localhost:3001'

  console.log('测试 1: 关键词搜索')
  const result1 = await axios.post(`${API_URL}/api/knowledge/articles/search`, {
    keyword: '客服',
    page: 1,
    pageSize: 10
  })
  console.log('结果数:', result1.data.data.total)

  console.log('\n测试 2: 多条件搜索')
  const result2 = await axios.post(`${API_URL}/api/knowledge/articles/search`, {
    keyword: '培训',
    types: ['company'],
    statuses: ['published'],
    sortBy: 'view_count',
    sortOrder: 'desc'
  })
  console.log('结果数:', result2.data.data.total)
  console.log('统计信息:', result2.data.data.statistics)

  console.log('\n✅ 所有测试通过！')
}

testSearch().catch(console.error)
```

运行测试：
```bash
node test-search-api.js
```
