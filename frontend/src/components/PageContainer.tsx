'use client';

import { Breadcrumb, Typography } from '@arco-design/web-react';

const Title = Typography.Title;

export interface PageContainerProps {
  title: string;
  breadcrumbs?: string[];
  action?: React.ReactNode;
  children?: React.ReactNode;
  extra?: React.ReactNode;
}

export default function PageContainer({
  title,
  breadcrumbs,
  action,
  children,
  extra,
}: PageContainerProps) {
  return (
    <div style={styles.container}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div style={styles.breadcrumb}>
          <Breadcrumb>
            {breadcrumbs.map((item, index) => (
              <Breadcrumb.Item key={index}>{item}</Breadcrumb.Item>
            ))}
          </Breadcrumb>
        </div>
      )}

      <div style={styles.header}>
        <div style={styles.titleWrapper}>
          <Title heading={3} style={{ margin: 0 }}>
            {title}
          </Title>
        </div>
        {action && <div style={styles.action}>{action}</div>}
      </div>

      {extra && <div style={styles.extra}>{extra}</div>}

      <div style={styles.content}>{children}</div>
    </div>
  );
}

const styles = {
  container: {
    padding: '0 0 24px 0',
  } as React.CSSProperties,
  breadcrumb: {
    marginBottom: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleWrapper: {
    flex: 1,
  },
  action: {
    flexShrink: 0,
  },
  extra: {
    marginBottom: 16,
  },
  content: {
    minHeight: 200,
  },
};
