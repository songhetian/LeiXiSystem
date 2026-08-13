import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PageContainer from '@/components/PageContainer';

jest.mock('@arco-design/web-react', () => {
  const Breadcrumb = ({ children }: any) => <nav data-testid="breadcrumb">{children}</nav>;
  Breadcrumb.Item = ({ children }: any) => <span data-testid="breadcrumb-item">{children}</span>;

  const Typography = {
    Title: ({ heading, children, style }: any) => (
      <h2 data-testid="page-title" style={style}>{children}</h2>
    ),
  };

  return { Breadcrumb, Typography };
});

describe('PageContainer', () => {
  describe('正常用例', () => {
    it('renders page title', () => {
      render(<PageContainer title="员工管理">内容</PageContainer>);
      expect(screen.getByTestId('page-title')).toHaveTextContent('员工管理');
    });

    it('renders children content', () => {
      render(
        <PageContainer title="测试">
          <div data-testid="child-content">Hello World</div>
        </PageContainer>,
      );
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('renders breadcrumb when provided', () => {
      render(
        <PageContainer title="员工列表" breadcrumbs={['组织人事', '员工列表']}>
          内容
        </PageContainer>,
      );
      expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    });

    it('renders action area when provided', () => {
      render(
        <PageContainer
          title="员工管理"
          action={<button data-testid="add-btn">新增员工</button>}
        >
          内容
        </PageContainer>,
      );
      expect(screen.getByTestId('add-btn')).toBeInTheDocument();
    });
  });

  describe('边界用例', () => {
    it('does not render breadcrumb when not provided', () => {
      render(<PageContainer title="测试">内容</PageContainer>);
      expect(screen.queryByTestId('breadcrumb')).not.toBeInTheDocument();
    });

    it('works without action prop', () => {
      render(<PageContainer title="测试">内容</PageContainer>);
      const title = screen.getByTestId('page-title');
      expect(title).toBeInTheDocument();
    });

    it('handles empty children', () => {
      render(<PageContainer title="空页面" />);
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });
  });

  describe('结构验证', () => {
    it('has header section with title and action', () => {
      render(
        <PageContainer
          title="测试"
          action={<button data-testid="action-btn">操作</button>}
        >
          内容
        </PageContainer>,
      );
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
      expect(screen.getByTestId('action-btn')).toBeInTheDocument();
    });
  });
});
