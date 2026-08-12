import { Statistic, Card, Grid, Typography } from '@arco-design/web-react';
const { Row, Col } = Grid;

export default function HomePage() {
  return (
    <div className="skeleton-shell">
      <aside className="skeleton-sider">
        <div className="logo">雷犀管理系统</div>
        <div className="menu-item active">工作台</div>
        <div className="menu-item">考勤</div>
        <div className="menu-item">薪资</div>
        <div className="menu-item">员工</div>
      </aside>
      <main className="skeleton-main">
        <header className="skeleton-header">
          <span>工作台</span>
          <span>管理员</span>
        </header>
        <div className="skeleton-content">
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
          <div className="skeleton-card" style={{ marginTop: 16 }}>
            后端服务：<a href="http://localhost:3001/health" target="_blank" rel="noreferrer">GET /health</a>
          </div>
        </div>
      </main>
    </div>
  );
}
