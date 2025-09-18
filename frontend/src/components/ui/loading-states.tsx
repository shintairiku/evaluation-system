import React from 'react';
import { Loader2, AlertCircle, Wifi, Shield, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

// Loading Spinner Component
export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export function LoadingSpinner({ size = 'md', text, className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-blue-600', sizeClasses[size])} />
      {text && (
        <span className={cn('text-gray-600', {
          'text-sm': size === 'sm',
          'text-base': size === 'md',
          'text-lg': size === 'lg',
        })}>
          {text}
        </span>
      )}
    </div>
  );
}

// Page Loading Component
export interface PageLoadingProps {
  message?: string;
  showSpinner?: boolean;
}

export function PageLoading({ message = 'Loading...', showSpinner = true }: PageLoadingProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center space-y-4">
        {showSpinner && <LoadingSpinner size="lg" />}
        <p className="text-lg text-gray-600">{message}</p>
      </div>
    </div>
  );
}

// Button Loading State
export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function LoadingButton({
  loading = false,
  loadingText,
  children,
  disabled,
  className,
  variant = 'default',
  size = 'default',
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      disabled={loading || disabled}
      variant={variant}
      size={size}
      className={className}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {loading ? loadingText || 'Loading...' : children}
    </Button>
  );
}

// Card Loading Skeleton
export function CardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="border rounded-lg p-4 space-y-3 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      ))}
    </>
  );
}

// Table Loading Skeleton
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid gap-4 animate-pulse" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={`header-${index}`} className="h-6 bg-gray-200 rounded"></div>
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="grid gap-4 animate-pulse" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={`cell-${rowIndex}-${colIndex}`} className="h-4 bg-gray-100 rounded"></div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Error States
export interface ErrorMessageProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'network' | 'permission' | 'timeout';
  onRetry?: () => void;
  onGoBack?: () => void;
  retryText?: string;
  showDetails?: boolean;
  details?: string;
}

export function ErrorMessage({
  title,
  message,
  type = 'error',
  onRetry,
  onGoBack,
  retryText = 'Try Again',
  showDetails = false,
  details,
}: ErrorMessageProps) {
  const getIcon = () => {
    switch (type) {
      case 'network':
        return <Wifi className="h-8 w-8 text-orange-500" />;
      case 'permission':
        return <Shield className="h-8 w-8 text-red-500" />;
      case 'timeout':
        return <Clock className="h-8 w-8 text-yellow-500" />;
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
      case 'timeout':
        return 'Request Timeout';
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

      {showDetails && details && (
        <details className="w-full max-w-md">
          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
            Show technical details
          </summary>
          <pre className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded overflow-auto">
            {details}
          </pre>
        </details>
      )}

      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry} variant="default">
            {retryText}
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

// Inline Error Component
export interface InlineErrorProps {
  message: string;
  type?: 'error' | 'warning';
  className?: string;
}

export function InlineError({ message, type = 'error', className }: InlineErrorProps) {
  return (
    <div className={cn(
      'flex items-center gap-2 text-sm p-2 rounded-md',
      {
        'text-red-700 bg-red-50 border border-red-200': type === 'error',
        'text-yellow-700 bg-yellow-50 border border-yellow-200': type === 'warning',
      },
      className
    )}>
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// Loading Overlay
export interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
}

export function LoadingOverlay({ isLoading, message = 'Loading...', children }: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/75 backdrop-blur-sm flex items-center justify-center z-10">
          <LoadingSpinner size="lg" text={message} />
        </div>
      )}
    </div>
  );
}

// Progress Loading
export interface ProgressLoadingProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function ProgressLoading({ steps, currentStep, className }: ProgressLoadingProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={index}
            className={cn('flex items-center gap-2 text-sm', {
              'text-blue-600 font-medium': index === currentStep,
              'text-green-600': index < currentStep,
              'text-gray-400': index > currentStep,
            })}
          >
            <div className={cn('w-2 h-2 rounded-full', {
              'bg-blue-600 animate-pulse': index === currentStep,
              'bg-green-600': index < currentStep,
              'bg-gray-300': index > currentStep,
            })} />
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}