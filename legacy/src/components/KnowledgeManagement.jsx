import React from 'react';
import Win11KnowledgeFolderView from './Win11KnowledgeFolderView';

/**
 * 知识库管理中心
 * 逻辑：管理 type='common' 且 owner_id = 自己的内容
 * 权限：支持分类操作、文档上传、公开性切换
 */
const KnowledgeManagement = () => {
  return (
    <Win11KnowledgeFolderView 
      viewMode="management" 
    />
  );
};

export default KnowledgeManagement;
