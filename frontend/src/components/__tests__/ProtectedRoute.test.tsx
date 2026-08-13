import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuthStore } from '@/store/auth';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('renders children when authenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      checkAuth: () => true,
    });

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to login when not authenticated', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      checkAuth: () => false,
    });

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret</div>
      </ProtectedRoute>,
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('shows loading state while checking auth', () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      checkAuth: () => false,
    });

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText(/加载中/i)).toBeInTheDocument();
  });
});
