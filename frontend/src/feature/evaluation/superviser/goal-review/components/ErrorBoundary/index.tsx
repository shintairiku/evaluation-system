'use client';

import React from 'react';

/**
 * Props for the ErrorBoundary component
 */
interface ErrorBoundaryProps {
  /** Child components to render */
  children: React.ReactNode;
  /** Optional fallback component to render on error */
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

/**
 * State for the ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Default error fallback component
 */
const DefaultErrorFallback: React.FC<{ error: Error; reset: () => void }> = ({ error, reset }) => (
  <div className="container mx-auto p-4 md:p-6">
    <div className="text-center space-y-4 py-12">
      <div className="text-6xl mb-4">💥</div>
      <h1 className="text-xl sm:text-2xl font-bold text-red-600">予期しないエラーが発生しました</h1>
      <p className="text-muted-foreground text-sm sm:text-base">
        アプリケーションでエラーが発生しました。再試行してください。
      </p>
      <details className="text-left bg-gray-100 p-4 rounded-md max-w-md mx-auto">
        <summary className="cursor-pointer font-medium">エラー詳細</summary>
        <pre className="mt-2 text-xs overflow-auto">{error.message}</pre>
      </details>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        再試行
      </button>
    </div>
  </div>
);

/**
 * Error boundary component to catch and handle React errors
 * Provides graceful error recovery for the goal review functionality
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}