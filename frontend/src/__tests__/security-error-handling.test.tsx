/**
 * Security & Error Handling Integration Tests
 *
 * Tests for the security and error handling features implemented for issue #182
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ErrorBoundary, PageErrorBoundary } from '@/components/error-boundary';
import { LoadingSpinner, LoadingButton, ErrorMessage } from '@/components/ui/loading-states';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { securityAuditor } from '@/lib/security-audit';

// Mock console methods to avoid cluttering test output
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeEach(() => {
  console.error = jest.fn();
  console.log = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

// Component that throws an error for testing
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

// Component using async operation hook
const AsyncTestComponent = ({ asyncFn }: { asyncFn: () => Promise<string> }) => {
  const { state, execute } = useAsyncOperation(asyncFn);

  return (
    <div>
      <button onClick={() => execute()}>Execute</button>
      {state.loading && <LoadingSpinner data-testid="loading-spinner" />}
      {state.error && <div data-testid="error-message">{state.error}</div>}
      {state.data && <div data-testid="success-data">{state.data}</div>}
    </div>
  );
};

describe('Error Boundary', () => {
  it('should catch and display error with default UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/We apologize for the inconvenience/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
  });

  it('should show custom fallback UI when provided', () => {
    const customFallback = <div>Custom error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should call custom error handler when provided', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('should retry and reset error state', () => {
    let shouldThrow = true;

    const TestComponent = () => <ThrowError shouldThrow={shouldThrow} />;

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Simulate retry - change condition and click retry
    shouldThrow = false;
    const retryButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryButton);

    expect(screen.getByText('No error')).toBeInTheDocument();
  });
});

describe('Page Error Boundary', () => {
  it('should show page-specific error UI', () => {
    render(
      <PageErrorBoundary pageTitle="Test Page">
        <ThrowError />
      </PageErrorBoundary>
    );

    expect(screen.getByText('Test Page Error')).toBeInTheDocument();
    expect(screen.getByText(/Unable to load the test page page/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });
});

describe('Loading States', () => {
  it('should render loading spinner with text', () => {
    render(<LoadingSpinner size="md" text="Loading data..." />);

    expect(screen.getByText('Loading data...')).toBeInTheDocument();
    // Check for spinner element (using data-testid or class)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should render loading button with correct states', () => {
    const onClick = jest.fn();

    const { rerender } = render(
      <LoadingButton onClick={onClick} loading={false}>
        Submit
      </LoadingButton>
    );

    const button = screen.getByRole('button', { name: /submit/i });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalled();

    // Test loading state
    rerender(
      <LoadingButton onClick={onClick} loading={true} loadingText="Submitting...">
        Submit
      </LoadingButton>
    );

    expect(screen.getByText('Submitting...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should render error message with retry functionality', () => {
    const onRetry = jest.fn();
    const onGoBack = jest.fn();

    render(
      <ErrorMessage
        title="Connection Error"
        message="Failed to connect to server"
        type="network"
        onRetry={onRetry}
        onGoBack={onGoBack}
      />
    );

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /try again/i });
    const goBackButton = screen.getByRole('button', { name: /go back/i });

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();

    fireEvent.click(goBackButton);
    expect(onGoBack).toHaveBeenCalled();
  });
});

describe('Async Operation Hook', () => {
  it('should handle successful async operation', async () => {
    const successFn = jest.fn().mockResolvedValue('Success result');

    render(<AsyncTestComponent asyncFn={successFn} />);

    const executeButton = screen.getByRole('button', { name: /execute/i });
    fireEvent.click(executeButton);

    // Should show loading
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    // Wait for success
    await waitFor(() => {
      expect(screen.getByTestId('success-data')).toHaveTextContent('Success result');
    });

    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
  });

  it('should handle failed async operation', async () => {
    const errorFn = jest.fn().mockRejectedValue(new Error('Async operation failed'));

    render(<AsyncTestComponent asyncFn={errorFn} />);

    const executeButton = screen.getByRole('button', { name: /execute/i });
    fireEvent.click(executeButton);

    // Should show loading
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    // Wait for error
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Async operation failed');
    });

    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('success-data')).not.toBeInTheDocument();
  });
});

describe('Security Auditor', () => {
  it('should log security events', () => {
    const consoleSpy = jest.spyOn(console, 'log');

    securityAuditor.logSecurityEvent({
      action: 'test_action',
      resource: 'test_resource',
      success: true,
      reason: 'Test reason',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[SECURITY AUDIT]',
      expect.objectContaining({
        action: 'test_action',
        resource: 'test_resource',
        success: true,
        reason: 'Test reason',
        timestamp: expect.any(String),
      })
    );
  });

  it('should log permission checks', () => {
    const consoleSpy = jest.spyOn(console, 'log');

    securityAuditor.logPermissionCheck({
      requiredPermission: 'READ_USERS',
      resource: 'user',
      resourceId: 'user-123',
      granted: false,
      reason: 'Insufficient permissions',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[SECURITY AUDIT]',
      expect.objectContaining({
        action: 'permission_check',
        resource: 'user',
        success: false,
        reason: 'Insufficient permissions',
      })
    );
  });

  it('should log access attempts', () => {
    const consoleSpy = jest.spyOn(console, 'log');

    securityAuditor.logAccessAttempt({
      endpoint: '/api/users',
      method: 'GET',
      statusCode: 403,
      responseTime: 150,
      errorMessage: 'Access denied',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ACCESS AUDIT]',
      expect.objectContaining({
        endpoint: '/api/users',
        method: 'GET',
        statusCode: 403,
        responseTime: 150,
        errorMessage: 'Access denied',
        timestamp: expect.any(String),
      })
    );
  });
});

describe('Integration: Error Handling with Security Audit', () => {
  it('should log security events when error boundary catches errors', () => {
    const onError = jest.fn((error, errorInfo) => {
      // Simulate security logging in error handler
      securityAuditor.logSecurityEvent({
        action: 'component_error',
        resource: 'ui_component',
        success: false,
        reason: error.message,
        metadata: {
          componentStack: errorInfo.componentStack,
        },
      });
    });

    const consoleSpy = jest.spyOn(console, 'log');

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[SECURITY AUDIT]',
      expect.objectContaining({
        action: 'component_error',
        resource: 'ui_component',
        success: false,
        reason: 'Test error message',
      })
    );
  });
});

// Performance tests
describe('Performance', () => {
  it('should render error boundary without significant delay', () => {
    const startTime = performance.now();

    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Error boundary should not add significant overhead (arbitrary threshold)
    expect(renderTime).toBeLessThan(100); // 100ms threshold
  });

  it('should handle multiple security audit logs efficiently', () => {
    const startTime = performance.now();

    // Log multiple events rapidly
    for (let i = 0; i < 100; i++) {
      securityAuditor.logSecurityEvent({
        action: `test_action_${i}`,
        resource: 'test_resource',
        success: true,
      });
    }

    const endTime = performance.now();
    const loggingTime = endTime - startTime;

    // Should handle 100 logs in reasonable time
    expect(loggingTime).toBeLessThan(500); // 500ms threshold
  });
});