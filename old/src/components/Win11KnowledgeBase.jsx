import React from 'react';
import Win11KnowledgeFolderView from './Win11KnowledgeFolderView';

/**
 * 公共知识库 - 全员共享容器
 */
const Win11KnowledgeBase = () => {
  return (
    <Win11KnowledgeFolderView 
      viewMode="public" 
    />
  );
};

export default Win11KnowledgeBase;
