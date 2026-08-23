import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatusTag from '@/components/StatusTag';

describe('StatusTag', () => {
  describe('正常用例 - 内置状态映射', () => {
    it('renders success status with success color', () => {
      render(<StatusTag status="active" />);
      const tag = screen.getByTestId('status-tag');
      expect(tag).toHaveAttribute('data-color', 'success');
      expect(tag).toHaveTextContent('在职');
    });

    it('renders inactive status with default color', () => {
      render(<StatusTag status="inactive" />);
      const tag = screen.getByTestId('status-tag');
      expect(tag).toHaveAttribute('data-color', 'default');
      expect(tag).toHaveTextContent('离职');
    });

    it('renders pending status with info color', () => {
      render(<StatusTag status="pending" />);
      const tag = screen.getByTestId('status-tag');
      expect(tag).toHaveAttribute('data-color', 'info');
      expect(tag).toHaveTextContent('待审批');
    });

    it('renders error status with danger color', () => {
      render(<StatusTag status="error" />);
      const tag = screen.getByTestId('status-tag');
      expect(tag).toHaveAttribute('data-color', 'danger');
      expect(tag).toHaveTextContent('异常');
    });

    it('renders warning status with warning color', () => {
      render(<StatusTag status="warning" />);
      const tag = screen.getByTestId('status-tag');
      expect(tag).toHaveAttribute('data-color', 'warning');
      expect(tag).toHaveTextContent('警告');
    });
  });

  describe('边界用例', () => {
    it('uses default color for unknown status', () => {
      render(<StatusTag status="unknown_status_xyz" />);
      const tag = screen.getByTestId('status-tag');
      expect(tag).toHaveAttribute('data-color', 'default');
    });

    it('displays status value as text when no label found', () => {
      render(<StatusTag status="custom_status" />);
      expect(screen.getByTestId('status-tag')).toHaveTextContent('custom_status');
    });
  });

  describe('自定义映射', () => {
    it('supports custom status map', () => {
      const customMap = {
        approved: { label: '已通过', color: 'green' },
        rejected: { label: '已拒绝', color: 'red' },
      };
      render(<StatusTag status="approved" statusMap={customMap} />);
      const tag = screen.getByTestId('status-tag');
      expect(tag).toHaveAttribute('data-color', 'green');
      expect(tag).toHaveTextContent('已通过');
    });

    it('custom map overrides built-in map', () => {
      const customMap = {
        active: { label: '启用中', color: 'purple' },
      };
      render(<StatusTag status="active" statusMap={customMap} />);
      const tag = screen.getByTestId('status-tag');
      expect(tag).toHaveAttribute('data-color', 'purple');
      expect(tag).toHaveTextContent('启用中');
    });
  });
});
