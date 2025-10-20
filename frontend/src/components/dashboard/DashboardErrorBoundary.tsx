'use client';

import { Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for Dashboard components
 * Catches JavaScript errors anywhere in the dashboard component tree
 */
export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Dashboard Error:', error, errorInfo);
    }
    // In production, you could send this to an error reporting service
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="p-6 space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="flex flex-col gap-3">
              <div>
                <p className="font-semibold">ダッシュボードの読み込み中にエラーが発生しました</p>
                <p className="text-sm mt-1 opacity-90">
                  {this.state.error?.message || '予期しないエラーが発生しました'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleReset}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  再試行
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="gap-2"
                >
                  ページを再読み込み
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional wrapper for error boundary with hooks support
 */
export function withDashboardErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <DashboardErrorBoundary fallback={fallback}>
        <Component {...props} />
      </DashboardErrorBoundary>
    );
  };
}
