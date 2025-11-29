import React, { useState, useEffect, useRef } from 'react';
import { TagsOutlined, SearchOutlined, CloseOutlined } from '@ant-design/icons';
import qualityAPI from '../api/qualityAPI';
import './TagSelector.css';

const TagSelector = ({
  selectedTags = [],
  onTagsChange,
  placeholder = '选择标签...',
  maxTags = 10,
  showSearch = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tags, setTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const [tagsRes, categoriesRes] = await Promise.all([
        qualityAPI.getTags({ tag_type: 'quality' }),
        qualityAPI.getTagCategories()
      ]);
      setTags(tagsRes.data.data || []);
      setCategories(categoriesRes.data.data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagToggle = (tag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);

    if (isSelected) {
      onTagsChange(selectedTags.filter(t => t.id !== tag.id));
    } else {
      if (selectedTags.length >= maxTags) {
        return; // Max tags reached
      }
      onTagsChange([...selectedTags, tag]);
    }
  };

  const handleRemoveTag = (tagId, e) => {
    e.stopPropagation();
    onTagsChange(selectedTags.filter(t => t.id !== tagId));
  };

  const flattenTags = (tagList) => {
    let result = [];
    tagList.forEach(tag => {
      result.push(tag);
      if (tag.children && tag.children.length > 0) {
        result = result.concat(flattenTags(tag.children));
      }
    });
    return result;
  };

  const filteredTags = flattenTags(tags).filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tag.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedTags = categories.reduce((acc, category) => {
    const categoryTags = filteredTags.filter(tag => tag.category_id === category.id);
    if (categoryTags.length > 0) {
      acc[category.name] = categoryTags;
    }
    return acc;
  }, {});

  // Uncategorized tags
  const uncategorizedTags = filteredTags.filter(tag => !tag.category_id);
  if (uncategorizedTags.length > 0) {
    groupedTags['未分类'] = uncategorizedTags;
  }

  return (
    <div className="tag-selector" ref={dropdownRef}>
      <div
        className="tag-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="tag-selector-content">
          {selectedTags.length === 0 ? (
            <span className="tag-selector-placeholder">
              <TagsOutlined /> {placeholder}
            </span>
          ) : (
            <div className="selected-tags-display">
              {selectedTags.map(tag => (
                <span
                  key={tag.id}
                  className="selected-tag"
                  style={{ backgroundColor: tag.color, color: '#fff' }}
                >
                  {tag.name}
                  <CloseOutlined
                    className="tag-remove-icon"
                    onClick={(e) => handleRemoveTag(tag.id, e)}
                  />
                </span>
              ))}
              {selectedTags.length < maxTags && (
                <span className="add-more-hint">
                  <TagsOutlined /> 添加更多...
                </span>
              )}
            </div>
          )}
        </div>
        <svg
          className={`tag-selector-arrow ${isOpen ? 'open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </div>

      {isOpen && (
        <div className="tag-selector-dropdown">
          {showSearch && (
            <div className="tag-selector-search">
              <SearchOutlined className="search-icon" />
              <input
                type="text"
                placeholder="搜索标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="tag-selector-list">
            {loading ? (
              <div className="tag-selector-loading">加载中...</div>
            ) : Object.keys(groupedTags).length === 0 ? (
              <div className="tag-selector-empty">
                {searchQuery ? '未找到匹配的标签' : '暂无可用标签'}
              </div>
            ) : (
              Object.entries(groupedTags).map(([categoryName, categoryTags]) => (
                <div key={categoryName} className="tag-category-group">
                  <div className="tag-category-header">{categoryName}</div>
                  <div className="tag-category-items">
                    {categoryTags.map(tag => {
                      const isSelected = selectedTags.some(t => t.id === tag.id);
                      return (
                        <div
                          key={tag.id}
                          className={`tag-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleTagToggle(tag)}
                        >
                          <span
                            className="tag-color-indicator"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="tag-name">{tag.name}</span>
                          {tag.description && (
                            <span className="tag-description">{tag.description}</span>
                          )}
                          {isSelected && (
                            <svg className="tag-check-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedTags.length >= maxTags && (
            <div className="tag-selector-footer">
              已达到最大标签数量 ({maxTags})
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagSelector;
