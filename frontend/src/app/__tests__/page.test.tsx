import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '@/app/page';

jest.mock('@/components/AppLayout', () => ({
  __esModule: true,
  default: ({ children, title, activeMenu }: any) => (
    <div data-testid="app-layout" data-title={title} data-active-menu={activeMenu}>
      {children}
    </div>
  ),
}));

jest.mock('@arco-design/web-react', () => ({
  Statistic: ({ title, value, suffix, prefix }: any) => (
    <div data-testid="statistic">
      <span>{title}</span>
      <span>{value}</span>
      {suffix && <span>{suffix}</span>}
      {prefix && <span>{prefix}</span>}
    </div>
  ),
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  Grid: { Row: ({ children }: any) => <div>{children}</div>, Col: ({ children }: any) => <div>{children}</div> },
  Typography: { Title: ({ heading, style, children }: any) => <h5>{children}</h5> },
}));

describe('HomePage', () => {
  it('wraps content with AppLayout', () => {
    render(<HomePage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('passes correct title and active menu', () => {
    render(<HomePage />);
    const layout = screen.getByTestId('app-layout');
    expect(layout).toHaveAttribute('data-title', '工作台');
    expect(layout).toHaveAttribute('data-active-menu', 'dashboard');
  });

  it('shows dashboard statistics', () => {
    render(<HomePage />);
    expect(screen.getByText('在职员工')).toBeInTheDocument();
    expect(screen.getByText('今日出勤')).toBeInTheDocument();
    expect(screen.getByText('待审批')).toBeInTheDocument();
    expect(screen.getByText('本月工资总额')).toBeInTheDocument();
  });
});
