'use client';

import { Typography, Breadcrumb } from '@arco-design/web-react';

const Title = Typography.Title;

export interface PageContainerProps {
  title: string;
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
      <div className="page-header">
        <div className="page-title-wrap">
          <Title heading={3} style={{ margin: 0, fontWeight: 500, fontSize: 18, letterSpacing: '-0.01em', color: '#1d2129' }}>
            {title}
          </Title>
          {subTitle && <div className="page-subtitle">{subTitle}</div>}
        </div>
        {action && <div className="page-action">{action}</div>}
      </div>

      {extra && <div className="page-extra">{extra}</div>}

      <div className={`page-content ${card ? 'page-content-card' : ''}`}>
        {children}
      </div>
    </div>
  );
}
