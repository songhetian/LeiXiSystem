import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfirmButton } from '@/components/ConfirmButton';

// Modal 本体不渲染，只截获 confirm 的入参（要断言的是「确认弹窗怎么配」）
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  const confirm = jest.fn();
  return {
    ...actual,
    Modal: Object.assign((_props: any) => null, { confirm }),
    __modalConfirm: confirm,
  };
});

const { __modalConfirm } = jest.requireMock('@arco-design/web-react') as {
  __modalConfirm: jest.Mock;
};

describe('ConfirmButton（带二次确认的按钮）', () => {
  beforeEach(() => {
    __modalConfirm.mockClear();
  });

  it('点击后弹出确认框，确认时执行 onConfirm', async () => {
    const onConfirm = jest.fn();
    render(<ConfirmButton onConfirm={onConfirm}>删除</ConfirmButton>);

    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(__modalConfirm).toHaveBeenCalledTimes(1);

    await __modalConfirm.mock.calls[0][0].onOk();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('status=danger 时确认按钮同步标红（危险操作不能只红一个按钮）', () => {
    render(
      <ConfirmButton status="danger" onConfirm={jest.fn()}>
        删除
      </ConfirmButton>,
    );

    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(__modalConfirm.mock.calls[0][0].okButtonProps).toEqual({ status: 'danger' });
  });

  it('普通操作不把确认按钮标红', () => {
    render(<ConfirmButton onConfirm={jest.fn()}>提交</ConfirmButton>);

    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(__modalConfirm.mock.calls[0][0].okButtonProps).toBeUndefined();
  });

  it('disabled 时点击不弹确认框', () => {
    render(
      <ConfirmButton disabled onConfirm={jest.fn()}>
        删除
      </ConfirmButton>,
    );

    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(__modalConfirm).not.toHaveBeenCalled();
  });
});
