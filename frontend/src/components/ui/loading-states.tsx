/**
 * Consolidated Loading States - Uses existing project components
 *
 * This module re-exports existing loading components and adds minimal
 * error state components to avoid duplication and maintain consistency.
 */

import React from 'react';
import { AlertCircle, Wifi, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

// Re-export existing components from the project
export { LoadingSpinner, LoadingOverlay } from './loading-spinner';
export { LoadingButton } from './loading-button';

// Simple page loading with inline spinner (avoids import issues)
export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-lg text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// Error states - minimal and aligned with project patterns
export interface ErrorMessageProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'network' | 'permission';
  onRetry?: () => void;
  onGoBack?: () => void;
}

export function ErrorMessage({
  title,
  message,
  type = 'error',
  onRetry,
  onGoBack,
}: ErrorMessageProps) {
  const getIcon = () => {
    switch (type) {
      case 'network':
        return <Wifi className="h-8 w-8 text-orange-500" />;
      case 'permission':
        return <Shield className="h-8 w-8 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-8 w-8 text-yellow-500" />;
      default:
        return <AlertCircle className="h-8 w-8 text-red-500" />;
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'network':
        return 'Connection Error';
      case 'permission':
        return 'Access Denied';
      case 'warning':
        return 'Warning';
      default:
        return 'Error';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
      {getIcon()}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {title || getDefaultTitle()}
        </h3>
        <p className="text-gray-600 max-w-md">{message}</p>
      </div>
      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry} variant="default">
            Try Again
          </Button>
        )}
        {onGoBack && (
          <Button onClick={onGoBack} variant="outline">
            Go Back
          </Button>
        )}
      </div>
    </div>
  );
}

// Inline error for forms
export function InlineError({
  message,
  className
}: {
  message: string;
  className?: string;
}) {
  return (
    <div className={cn(
      'flex items-center gap-2 text-sm p-2 rounded-md text-red-700 bg-red-50 border border-red-200',
      className
    )}>
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}