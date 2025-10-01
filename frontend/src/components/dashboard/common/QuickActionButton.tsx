'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuickActionButtonProps {
  /** Button label */
  label: string;
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Button click handler (for button mode) */
  onClick?: () => void;
  /** Navigation href (for link mode) */
  href?: string;
  /** Button variant */
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  /** Button size */
  size?: 'default' | 'sm' | 'lg';
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Optional badge count */
  badge?: number;
  /** Custom styling */
  className?: string;
  /** Icon position */
  iconPosition?: 'left' | 'right';
  /** Full width button */
  fullWidth?: boolean;
}

/**
 * QuickActionButton - Standardized action button with icon
 *
 * Features:
 * - Supports both button and link modes
 * - Icon positioning (left/right)
 * - Optional badge count
 * - Loading state
 * - Multiple variants and sizes
 *
 * Usage:
 * <QuickActionButton
 *   label="User Management"
 *   icon={Users}
 *   href="/users"
 * />
 * <QuickActionButton
 *   label="Refresh"
 *   icon={RefreshCw}
 *   onClick={handleRefresh}
 *   variant="outline"
 * />
 */
export const QuickActionButton = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  QuickActionButtonProps
>(({
  label,
  icon: Icon,
  onClick,
  href,
  variant = 'outline',
  size = 'default',
  disabled = false,
  isLoading = false,
  badge,
  className = '',
  iconPosition = 'left',
  fullWidth = false
}, ref) => {
  const iconElement = (
    <Icon className={cn(
      'transition-transform group-hover:scale-110',
      size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
    )} />
  );

  const content = (
    <>
      {iconPosition === 'left' && iconElement}
      <span className="font-medium">{label}</span>
      {iconPosition === 'right' && iconElement}
      {badge !== undefined && badge > 0 && (
        <span className={cn(
          'ml-auto flex items-center justify-center rounded-full',
          'bg-primary text-primary-foreground font-bold',
          size === 'sm' ? 'text-xs px-1.5 py-0.5 min-w-[1.25rem]' : 'text-sm px-2 py-0.5 min-w-[1.5rem]'
        )}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </>
  );

  const buttonClasses = cn(
    'group relative',
    fullWidth ? 'w-full justify-start' : 'justify-center',
    iconPosition === 'left' ? 'gap-2' : 'gap-2 flex-row-reverse',
    className
  );

  // Link mode
  if (href && !disabled && !isLoading) {
    return (
      <Button
        variant={variant}
        size={size}
        className={buttonClasses}
        asChild
      >
        <Link href={href} ref={ref as any}>
          {content}
        </Link>
      </Button>
    );
  }

  // Button mode
  return (
    <Button
      ref={ref as any}
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={buttonClasses}
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">読込中...</span>
        </>
      ) : (
        content
      )}
    </Button>
  );
});

QuickActionButton.displayName = 'QuickActionButton';

export default QuickActionButton;

/**
 * QuickActionButtonGroup - Groups multiple quick action buttons
 */
export interface QuickActionButtonGroupProps {
  actions: Array<Omit<QuickActionButtonProps, 'fullWidth'>>;
  layout?: 'horizontal' | 'vertical' | 'grid';
  columns?: 1 | 2 | 3;
  className?: string;
}

export function QuickActionButtonGroup({
  actions,
  layout = 'vertical',
  columns = 2,
  className = ''
}: QuickActionButtonGroupProps) {
  const layoutClasses = {
    horizontal: 'flex flex-wrap gap-2',
    vertical: 'flex flex-col gap-2',
    grid: `grid grid-cols-1 md:grid-cols-${columns} gap-2`
  };

  return (
    <div className={cn(layoutClasses[layout], className)}>
      {actions.map((action, index) => (
        <QuickActionButton
          key={index}
          {...action}
          fullWidth={layout === 'vertical' || layout === 'grid'}
        />
      ))}
    </div>
  );
}