import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SalaryComposition from '@/features/payroll/components/SalaryComposition';

const items = [
  { code: 'base', name: '基础工资', amount: 36000 },
  { code: 'meal', name: '餐补', amount: 300 },
];

const adjustments = [
  { id: 1, itemCode: 'penalty', amount: -100, reason: '迟到扣款', createdAt: '2026-08-01T00:00:00+08:00' },
  { id: 2, itemCode: 'bonus', amount: 800, reason: '项目奖金', createdAt: '2026-08-02T00:00:00+08:00' },
];

describe('SalaryComposition', () => {
  it('明细项逐条展示，金额千分位 + 两位小数', () => {
    render(<SalaryComposition items={items} adjustments={[]} total={36300} />);
    expect(screen.getByText('基础工资')).toBeInTheDocument();
    expect(screen.getByText('36,000.00')).toBeInTheDocument();
    expect(screen.getByText('餐补')).toBeInTheDocument();
    expect(screen.getByText('300.00')).toBeInTheDocument();
    expect(screen.getByText('36,300.00')).toBeInTheDocument();
  });

  it('调整项按增减带符号并区分语义色', () => {
    render(<SalaryComposition items={items} adjustments={adjustments} total={37000} />);
    const minus = screen.getByText('−100.00');
    const plus = screen.getByText('+800.00');
    expect(minus).toHaveClass('is-minus');
    expect(plus).toHaveClass('is-plus');
    // 原因作为标签展示，便于核对调整来源
    expect(screen.getByText('迟到扣款')).toBeInTheDocument();
    expect(screen.getByText('项目奖金')).toBeInTheDocument();
  });

  it('有调整项时显示调整数量徽标，无调整项时不显示', () => {
    const { rerender } = render(
      <SalaryComposition items={items} adjustments={adjustments} total={37000} />,
    );
    expect(screen.getByText('调整 2 项')).toBeInTheDocument();

    rerender(<SalaryComposition items={items} adjustments={[]} total={36300} />);
    expect(screen.queryByText(/调整 \d+ 项/)).not.toBeInTheDocument();
  });

  it('收入项数量徽标与合计始终渲染', () => {
    render(<SalaryComposition items={items} adjustments={[]} total={36300} />);
    expect(screen.getByText('收入 2 项')).toBeInTheDocument();
    expect(screen.getByText('合计')).toBeInTheDocument();
  });

  it('合计为负时红色标注（11.6-6，MoneyText）', () => {
    render(
      <SalaryComposition
        items={[{ code: 'base', name: '基础工资', amount: 100 }]}
        adjustments={[{ id: 9, itemCode: 'penalty', amount: -150, reason: '扣款冲减', createdAt: '2026-08-03T00:00:00+08:00' }]}
        total={-50}
      />,
    );
    const neg = screen.getByText('-50.00');
    expect(neg).toHaveClass('lx-money-negative');
  });
});
