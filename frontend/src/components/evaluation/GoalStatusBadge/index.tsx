import React from 'react';
import { Badge } from '@/components/ui/badge';
import { createAriaLabel } from '@/utils/accessibility';

/**
 * Goal status type
 */
type GoalStatus = 'submitted' | 'approved' | 'rejected' | 'draft' | string;

/**
 * Props for GoalStatusBadge component
 */
interface GoalStatusBadgeProps {
  /** Current status of the goal */
  status: GoalStatus;
  /** Optional custom className */
  className?: string;
}

/**
 * Status information including display text and accessibility description
 */
interface StatusInfo {
  text: string;
  description: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}

/**
 * Get status information based on goal status
 */
const getStatusInfo = (status: GoalStatus): StatusInfo => {
  switch (status) {
    case 'submitted':
      return {
        text: '承認待ち',
        description: 'この目標は承認待ちの状態です',
        variant: 'secondary'
      };
    case 'approved':
      return {
        text: '承認済み',
        description: 'この目標は承認済みです',
        variant: 'default'
      };
    case 'rejected':
      return {
        text: '差し戻し',
        description: 'この目標は差し戻されました',
        variant: 'destructive'
      };
    case 'draft':
      return {
        text: '下書き',
        description: 'この目標は下書き状態です',
        variant: 'outline'
      };
    default:
      return {
        text: status,
        description: `この目標の状態は${status}です`,
        variant: 'outline'
      };
  }
};

/**
 * Reusable badge component for displaying goal status.
 * Provides consistent styling and accessibility across all goal status displays.
 *
 * Shared component used across evaluation features:
 * - Employee goal-list
 * - Employee goal-edit
 * - Supervisor goal-review
 *
 * @param props - Component props
 * @returns JSX element containing the status badge
 *
 * @example
 * ```tsx
 * <GoalStatusBadge status="submitted" />
 * <GoalStatusBadge status="approved" />
 * <GoalStatusBadge status="rejected" />
 * ```
 */
export const GoalStatusBadge = React.memo<GoalStatusBadgeProps>(
  function GoalStatusBadge({ status, className }: GoalStatusBadgeProps) {
    const statusInfo = getStatusInfo(status);
    const ariaLabel = createAriaLabel(
      `目標の状態: ${statusInfo.text}`,
      statusInfo.description
    );

    return (
      <Badge variant={statusInfo.variant} className={className} {...ariaLabel}>
        {statusInfo.text}
      </Badge>
    );
  }
);
