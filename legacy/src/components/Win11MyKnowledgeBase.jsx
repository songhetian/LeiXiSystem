import React from 'react';
import Win11KnowledgeFolderView from './Win11KnowledgeFolderView';

/**
 * 我的知识库 - 个人专属容器
 * 强制开启 isPersonal 模式，确保数据隔离
 */
const Win11MyKnowledgeBase = () => {
  return (
    <Win11KnowledgeFolderView 
      viewMode="personal" 
    />
  );
};

export default Win11MyKnowledgeBase;
