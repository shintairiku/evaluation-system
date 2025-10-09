import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { GoalStatus } from '@/api/types';

/**
 * Props for GoalListFilters component
 */
interface GoalListFiltersProps {
  /** Currently selected status filters */
  selectedStatuses: GoalStatus[];
  /** Callback when status filter changes */
  onStatusChange: (statuses: GoalStatus[]) => void;
  /** Show only resubmissions flag */
  showResubmissionsOnly: boolean;
  /** Callback when resubmissions filter changes */
  onResubmissionsOnlyChange: (value: boolean) => void;
  /** Count of goals with previousGoalId (for display) */
  resubmissionCount?: number;
  /** Optional custom className */
  className?: string;
}

/**
 * Available goal status options for filtering
 */
const STATUS_OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: 'draft', label: '下書き' },
  { value: 'submitted', label: '承認待ち' },
  { value: 'approved', label: '承認済み' },
  { value: 'rejected', label: '差し戻し' },
];

/**
 * Filter component for goal list.
 *
 * Features:
 * - Multi-select status filter using checkboxes
 * - Reset button to clear all filters
 * - Accessible with proper labels
 *
 * @param props - Component props
 * @returns JSX element containing the filter controls
 *
 * @example
 * ```tsx
 * <GoalListFilters
 *   selectedStatuses={['draft', 'rejected']}
 *   onStatusChange={(statuses) => setFilters(statuses)}
 * />
 * ```
 */
export const GoalListFilters = React.memo<GoalListFiltersProps>(
  function GoalListFilters({
    selectedStatuses,
    onStatusChange,
    showResubmissionsOnly,
    onResubmissionsOnlyChange,
    resubmissionCount = 0,
    className
  }: GoalListFiltersProps) {

    const handleStatusToggle = (status: GoalStatus) => {
      if (selectedStatuses.includes(status)) {
        onStatusChange(selectedStatuses.filter(s => s !== status));
      } else {
        onStatusChange([...selectedStatuses, status]);
      }
    };

    const handleReset = () => {
      onStatusChange([]);
      onResubmissionsOnlyChange(false);
    };

    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">ステータスで絞り込み</h3>
          {selectedStatuses.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 px-2"
            >
              リセット
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          {STATUS_OPTIONS.map((option) => {
            const isChecked = selectedStatuses.includes(option.value);
            const checkboxId = `status-${option.value}`;

            return (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={checkboxId}
                  checked={isChecked}
                  onCheckedChange={() => handleStatusToggle(option.value)}
                />
                <Label
                  htmlFor={checkboxId}
                  className="text-sm font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            );
          })}
        </div>

        {/* Resubmissions filter */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="resubmissions-only"
              checked={showResubmissionsOnly}
              onCheckedChange={(checked) => onResubmissionsOnlyChange(checked === true)}
            />
            <Label
              htmlFor="resubmissions-only"
              className="text-sm font-normal cursor-pointer"
            >
              再提出が必要な目標のみ表示
              {resubmissionCount > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({resubmissionCount}件)
                </span>
              )}
            </Label>
          </div>
        </div>

        {(selectedStatuses.length > 0 || showResubmissionsOnly) && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {selectedStatuses.length > 0 && `${selectedStatuses.length}件のステータス`}
              {selectedStatuses.length > 0 && showResubmissionsOnly && ' + '}
              {showResubmissionsOnly && '再提出のみ'}
              で絞り込み中
            </p>
          </div>
        )}
      </div>
    );
  }
);
