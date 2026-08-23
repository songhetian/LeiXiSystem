import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataState from '@/components/DataState';

describe('DataState', () => {
  describe('loading 状态', () => {
    it('显示加载动画和文案', () => {
      render(<DataState loading>内容</DataState>);
      expect(screen.getByText('加载中...')).toBeInTheDocument();
      expect(screen.queryByText('内容')).not.toBeInTheDocument();
    });

    it('支持自定义加载文案', () => {
      render(<DataState loading loadingText="正在获取数据...">内容</DataState>);
      expect(screen.getByText('正在获取数据...')).toBeInTheDocument();
    });
  });

  describe('empty 状态', () => {
    it('数据为空时显示空状态', () => {
      render(
        <DataState isEmpty>
          <div>内容</div>
        </DataState>,
      );
      expect(screen.getByText('暂无数据')).toBeInTheDocument();
      expect(screen.queryByText('内容')).not.toBeInTheDocument();
    });

    it('支持自定义空状态描述', () => {
      render(
        <DataState isEmpty emptyText="还没有记录哦">
          <div>内容</div>
        </DataState>,
      );
      expect(screen.getByText('还没有记录哦')).toBeInTheDocument();
    });

    it('支持自定义空状态操作按钮', () => {
      const handleClick = jest.fn();
      render(
        <DataState
          isEmpty
          emptyActionLabel="去创建"
          onEmptyAction={handleClick}
        >
          <div>内容</div>
        </DataState>,
      );
      const btn = screen.getByRole('button', { name: '去创建' });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('error 状态', () => {
    it('发生错误时显示错误信息', () => {
      render(
        <DataState error="网络连接失败">
          <div>内容</div>
        </DataState>,
      );
      expect(screen.getByText('加载失败')).toBeInTheDocument();
      expect(screen.getByText('网络连接失败')).toBeInTheDocument();
      expect(screen.queryByText('内容')).not.toBeInTheDocument();
    });

    it('显示重试按钮并可触发重试', () => {
      const handleRetry = jest.fn();
      render(
        <DataState error="出错了" onRetry={handleRetry}>
          <div>内容</div>
        </DataState>,
      );
      const btn = screen.getByRole('button', { name: '重试' });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('error 优先级高于 empty', () => {
      render(
        <DataState error="出错了" isEmpty>
          <div>内容</div>
        </DataState>,
      );
      expect(screen.getByText('加载失败')).toBeInTheDocument();
      expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
    });

    it('loading 优先级最高', () => {
      render(
        <DataState loading error="出错了" isEmpty>
          <div>内容</div>
        </DataState>,
      );
      expect(screen.getByText('加载中...')).toBeInTheDocument();
      expect(screen.queryByText('加载失败')).not.toBeInTheDocument();
      expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
    });
  });

  describe('content 正常状态', () => {
    it('无 loading/empty/error 时渲染子内容', () => {
      render(
        <DataState>
          <div data-testid="content">正常内容</div>
        </DataState>,
      );
      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.getByText('正常内容')).toBeInTheDocument();
    });

    it('isEmpty 为 false 时渲染内容', () => {
      render(
        <DataState isEmpty={false}>
          <div>有数据</div>
        </DataState>,
      );
      expect(screen.getByText('有数据')).toBeInTheDocument();
    });
  });

  describe('优先级', () => {
    it('loading > error > empty > content', () => {
      const { rerender } = render(
        <DataState loading error="e" isEmpty>
          <span>内容</span>
        </DataState>,
      );
      expect(screen.getByText('加载中...')).toBeInTheDocument();

      rerender(
        <DataState loading={false} error="e" isEmpty>
          <span>内容</span>
        </DataState>,
      );
      expect(screen.getByText('加载失败')).toBeInTheDocument();

      rerender(
        <DataState loading={false} error="" isEmpty>
          <span>内容</span>
        </DataState>,
      );
      expect(screen.getByText('暂无数据')).toBeInTheDocument();

      rerender(
        <DataState loading={false} error="" isEmpty={false}>
          <span>内容</span>
        </DataState>,
      );
      expect(screen.getByText('内容')).toBeInTheDocument();
    });
  });
});
