import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LoginPage from '@/app/login/page';
import { authApi } from '@/services/auth';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/services/auth', () => ({
  authApi: {
    login: jest.fn(),
  },
}));

jest.mock('@arco-design/web-react', () => {
  const React = require('react');
  let inputCounter = 0;

  const FormItem = ({ label, children }: any) => {
    const id = `input-${inputCounter++}`;
    const childWithProps = React.cloneElement(children, { id, 'aria-label': label });
    return (
      <div>
        {label && <label htmlFor={id}>{label}</label>}
        {childWithProps}
      </div>
    );
  };

  const Form = ({ layout, children, onSubmit }: any) => (
    <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); onSubmit?.(); }}>
      {children}
    </form>
  );
  Form.Item = FormItem;

  const Input = ({ value, onChange, onPressEnter, placeholder, id, 'aria-label': ariaLabel }: any) => (
    <input
      id={id}
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter') onPressEnter?.();
      }}
    />
  );
  Input.Password = ({ value, onChange, onPressEnter, placeholder, id, 'aria-label': ariaLabel }: any) => (
    <input
      id={id}
      type="password"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter') onPressEnter?.();
      }}
    />
  );

  return {
    Form,
    Input,
    Button: ({ children, loading, disabled, htmlType, onClick }: any) => (
      <button
        type={htmlType || 'button'}
        disabled={disabled || loading}
        onClick={onClick}
        aria-label={loading ? '登录中' : children}
      >
        {loading ? '登录中...' : children}
      </button>
    ),
    Typography: {
      Title: ({ heading, style, children }: any) => <h4>{children}</h4>,
    },
    Message: { success: jest.fn(), error: jest.fn() },
  };
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('LoginPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
    (authApi.login as jest.Mock).mockReset();
  });

  it('renders login form with username, password and submit button', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/密码/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument();
    expect(screen.getByText('雷犀客服管理系统')).toBeInTheDocument();
  });

  it('logs in successfully with correct credentials and redirects to home', async () => {
    (authApi.login as jest.Mock).mockResolvedValue({ code: 0, data: { user: { id: 1, username: 'admin' } } });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/用户名/i), 'admin');
    await user.type(screen.getByLabelText(/密码/i), '123456');
    await user.click(screen.getByRole('button', { name: /登录/i }));

    expect(authApi.login).toHaveBeenCalledWith({ username: 'admin', password: '123456' });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message with wrong credentials', async () => {
    (authApi.login as jest.Mock).mockResolvedValue({ code: 1001, message: '用户名或密码错误' });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/用户名/i), 'admin');
    await user.type(screen.getByLabelText(/密码/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /登录/i }));

    await waitFor(() => {
      expect(screen.getByText(/用户名或密码错误/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('disables submit button when username or password is empty', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const btn = screen.getByRole('button', { name: /登录/i });
    expect(btn).toBeDisabled();

    await user.type(screen.getByLabelText(/用户名/i), 'admin');
    expect(btn).toBeDisabled();

    await user.type(screen.getByLabelText(/密码/i), '123456');
    expect(btn).not.toBeDisabled();
  });

  it('shows loading state during login request', async () => {
    (authApi.login as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ code: 0, data: {} }), 1000)),
    );

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/用户名/i), 'admin');
    await user.type(screen.getByLabelText(/密码/i), '123456');
    await user.click(screen.getByRole('button', { name: /登录/i }));

    expect(screen.getByRole('button', { name: /登录中/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登录中/i })).toBeDisabled();
  });
});
