import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MoneyText from '@/components/MoneyText';

describe('MoneyText（REFACTOR_PLAN 11.6-6：负数红色标注）', () => {
  it('正数按千分位 + 两位小数展示，不标红', () => {
    render(<MoneyText value={50000} />);
    const el = screen.getByText('50,000.00');
    expect(el).toBeInTheDocument();
    expect(el).not.toHaveClass('lx-money-negative');
    expect(el).not.toHaveAttribute('style');
  });

  it('负数渲染千分位负号并标红（class + --lx-danger token）', () => {
    render(<MoneyText value={-1234.5} />);
    const el = screen.getByText('-1,234.50');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('lx-money-negative');
    expect(el).toHaveAttribute('style', expect.stringContaining('--lx-danger'));
  });

  it('字符串数字的负数同样标红', () => {
    // 后端 decimal 序列化后可能是字符串，负号标注不能丢
    render(<MoneyText value="-88.20" />);
    expect(screen.getByText('-88.20')).toHaveClass('lx-money-negative');
  });

  it('0 不标红', () => {
    render(<MoneyText value={0} />);
    const el = screen.getByText('0.00');
    expect(el).not.toHaveClass('lx-money-negative');
    expect(el).not.toHaveAttribute('style');
  });

  it('非法值（null / 非数字串）输出 fallback，不标红', () => {
    render(
      <>
        <MoneyText value={null} fallback="--" />
        <MoneyText value="abc" />
      </>,
    );
    const placeholders = screen.getAllByText('--');
    expect(placeholders).toHaveLength(2);
    placeholders.forEach((el) => {
      expect(el).not.toHaveClass('lx-money-negative');
      expect(el).not.toHaveAttribute('style');
    });
  });

  it('透传 className（负数时追加在语义 class 之后）', () => {
    render(<MoneyText value={-1} className="font-medium" />);
    const el = screen.getByText('-1.00');
    expect(el).toHaveClass('lx-money-negative');
    expect(el).toHaveClass('font-medium');
  });
});
