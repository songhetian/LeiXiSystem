'use client';

import { Statistic, Card, Grid, Typography } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';

const { Row, Col } = Grid;

export default function HomePage() {
  return (
    <AppLayout title="工作台" activeMenu="dashboard">
      <Typography.Title heading={5} style={{ marginTop: 0 }}>
        S01 骨架验证 · Arco Pro 布局
      </Typography.Title>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="在职员工" value={0} suffix="人" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="今日出勤" value={0} suffix="人" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待审批" value={0} suffix="项" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="本月工资总额" value={0} precision={2} prefix="¥" />
          </Card>
        </Col>
      </Row>
      <div style={{ marginTop: 16, padding: 20, background: '#fff', borderRadius: 8, border: '1px solid #e5e6eb' }}>
        后端服务：<a href="http://localhost:3001/health" target="_blank" rel="noreferrer">GET /health</a>
      </div>
    </AppLayout>
  );
}
