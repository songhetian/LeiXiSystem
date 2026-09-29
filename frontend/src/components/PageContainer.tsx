'use client';

import { Typography, Breadcrumb } from '@arco-design/web-react';

const Title = Typography.Title;

export interface PageContainerProps {
  title?: string;
  subTitle?: string;
  breadcrumbs?: string[];
  action?: React.ReactNode;
  children?: React.ReactNode;
  extra?: React.ReactNode;
  card?: boolean;
}

export default function PageContainer({
  title,
  subTitle,
  breadcrumbs,
  action,
  children,
  extra,
  card = false,
}: PageContainerProps) {
  return (
    <div className="page-container">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="page-breadcrumb">
          <Breadcrumb>
            {breadcrumbs.map((item, index) => (
              <Breadcrumb.Item key={index}>{item}</Breadcrumb.Item>
            ))}
          </Breadcrumb>
        </div>
      )}
      {/* 顶部已有全局面包屑时，可省略页面大标题（title 缺省则隐藏头部） */}
      {title || subTitle || action ? (
        <div className="page-header">
          <div className="page-title-wrap">
            {title && (
              <Title heading={3} className="page-title" style={{ margin: 0 }}>
                {title}
              </Title>
            )}
            {subTitle && <div className="page-subtitle">{subTitle}</div>}
          </div>
          {action && <div className="page-action">{action}</div>}
        </div>
      ) : null}

      {extra && <div className="page-extra">{extra}</div>}

      <div className={`page-content ${card ? 'page-content-card' : ''}`}>
        {children}
      </div>
    </div>
  );
}
