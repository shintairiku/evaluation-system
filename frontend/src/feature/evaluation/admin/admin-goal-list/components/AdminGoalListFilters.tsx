import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GoalStatus, UserDetailResponse, DepartmentResponse } from '@/api/types';

/**
 * Props for AdminGoalListFilters component
 */
interface AdminGoalListFiltersProps {
  /** Currently selected status filters */
  selectedStatuses: GoalStatus[];
  /** Callback when status filter changes */
  onStatusChange: (statuses: GoalStatus[]) => void;
  /** Currently selected goal category */
  selectedGoalCategory: string;
  /** Callback when goal category changes */
  onGoalCategoryChange: (category: string) => void;
  /** Currently selected department ID */
  selectedDepartmentId: string;
  /** Callback when department changes */
  onDepartmentChange: (departmentId: string) => void;
  /** Currently selected user ID */
  selectedUserId: string;
  /** Callback when user changes */
  onUserChange: (userId: string) => void;
  /** List of all users */
  users: UserDetailResponse[];
  /** List of all departments */
  departments: DepartmentResponse[];
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
 * Available goal category options
 */
const GOAL_CATEGORY_OPTIONS = [
  { value: 'all', label: '全てのカテゴリ' },
  { value: '業績目標', label: '業績目標' },
  { value: 'コンピテンシー', label: 'コンピテンシー' },
  { value: 'コアバリュー', label: 'コアバリュー' },
];

/**
 * Admin filter component for goal list.
 *
 * Features:
 * - Multi-select status filter using checkboxes
 * - Goal category dropdown filter
 * - Department dropdown filter
 * - User dropdown filter (searchable)
 * - Active filter count badge
 * - Clear all filters button
 *
 * Component Reuse Strategy:
 * - Layout structure: Based on GoalListFilters component
 * - Filter count badge: Reused pattern from GoalListFilters
 * - User selection: Adapted from EmployeeSelector pattern
 *
 * @param props - Component props
 * @returns JSX element containing the filter controls
 */
export const AdminGoalListFilters = React.memo<AdminGoalListFiltersProps>(
  function AdminGoalListFilters({
    selectedStatuses,
    onStatusChange,
    selectedGoalCategory,
    onGoalCategoryChange,
    selectedDepartmentId,
    onDepartmentChange,
    selectedUserId,
    onUserChange,
    users,
    departments,
    className,
  }: AdminGoalListFiltersProps) {
    const handleStatusToggle = (status: GoalStatus) => {
      if (selectedStatuses.includes(status)) {
        onStatusChange(selectedStatuses.filter((s) => s !== status));
      } else {
        onStatusChange([...selectedStatuses, status]);
      }
    };

    const handleClearAll = () => {
      onStatusChange([]);
      onGoalCategoryChange('all');
      onDepartmentChange('all');
      onUserChange('all');
    };

    // Calculate active filter count (exclude 'all' values)
    const activeFilterCount =
      selectedStatuses.length +
      (selectedGoalCategory && selectedGoalCategory !== 'all' ? 1 : 0) +
      (selectedDepartmentId && selectedDepartmentId !== 'all' ? 1 : 0) +
      (selectedUserId && selectedUserId !== 'all' ? 1 : 0);

    return (
      <div className={className}>
        {/* Header with clear button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">フィルター</h3>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-primary rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-8 px-2"
            >
              すべてクリア
            </Button>
          )}
        </div>

        {/* Status filter - Checkboxes */}
        <div className="mb-4">
          <Label className="text-sm font-medium mb-2 block">ステータス</Label>
          <div className="flex flex-wrap gap-4">
            {STATUS_OPTIONS.map((option) => {
              const isChecked = selectedStatuses.includes(option.value);
              const checkboxId = `admin-status-${option.value}`;

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
        </div>

        {/* Grid layout for dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Goal Category filter */}
          <div>
            <Label htmlFor="goal-category-filter" className="text-sm font-medium mb-2 block">
              目標カテゴリ
            </Label>
            <Select
              value={selectedGoalCategory}
              onValueChange={onGoalCategoryChange}
            >
              <SelectTrigger id="goal-category-filter">
                <SelectValue placeholder="全てのカテゴリ" />
              </SelectTrigger>
              <SelectContent>
                {GOAL_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department filter */}
          <div>
            <Label htmlFor="department-filter" className="text-sm font-medium mb-2 block">
              部署
            </Label>
            <Select value={selectedDepartmentId} onValueChange={onDepartmentChange}>
              <SelectTrigger id="department-filter">
                <SelectValue placeholder="全ての部署" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全ての部署</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User filter */}
          <div>
            <Label htmlFor="user-filter" className="text-sm font-medium mb-2 block">
              ユーザー
            </Label>
            <Select value={selectedUserId} onValueChange={onUserChange}>
              <SelectTrigger id="user-filter">
                <SelectValue placeholder="全てのユーザー" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全てのユーザー</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                    {user.department && ` (${user.department.name})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active filters summary */}
        {activeFilterCount > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {activeFilterCount}件のフィルターで絞り込み中
            </p>
          </div>
        )}
      </div>
    );
  }
);
