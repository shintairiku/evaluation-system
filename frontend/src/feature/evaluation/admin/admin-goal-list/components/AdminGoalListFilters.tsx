import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import type { GoalStatus, UserDetailResponse, DepartmentResponse } from '@/api/types';

/**
 * Props for AdminGoalListFilters component
 */
interface AdminGoalListFiltersProps {
  /** Search query for filtering */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
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
    searchQuery,
    onSearchChange,
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
      onSearchChange('');
      onStatusChange([]);
      onGoalCategoryChange('all');
      onDepartmentChange('all');
      onUserChange('all');
    };

    // Calculate active filter count (exclude 'all' values)
    const activeFilterCount =
      (searchQuery.length > 0 ? 1 : 0) +
      selectedStatuses.length +
      (selectedGoalCategory && selectedGoalCategory !== 'all' ? 1 : 0) +
      (selectedDepartmentId && selectedDepartmentId !== 'all' ? 1 : 0) +
      (selectedUserId && selectedUserId !== 'all' ? 1 : 0);

    return (
      <div className={`flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border ${className || ''}`}>
        {/* Search Input */}
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="目標タイトル・ユーザー名で検索... (2文字以上)"
            className="pl-10 pr-10"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="検索クリア"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <Select
          value={selectedStatuses.length === 1 ? selectedStatuses[0] : selectedStatuses.length > 1 ? 'multiple' : 'all'}
          onValueChange={(value) => {
            if (value === 'all') {
              onStatusChange([]);
            } else if (value !== 'multiple') {
              onStatusChange([value as GoalStatus]);
            }
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="すべてのステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのステータス</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
            {selectedStatuses.length > 1 && (
              <SelectItem value="multiple" disabled>
                複数選択 ({selectedStatuses.length})
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        {/* Goal Category filter */}
        <Select
          value={selectedGoalCategory}
          onValueChange={onGoalCategoryChange}
        >
          <SelectTrigger className="w-[180px]">
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

        {/* Department filter */}
        <Select value={selectedDepartmentId} onValueChange={onDepartmentChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="全ての部署" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての部署</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* User filter */}
        <Select value={selectedUserId} onValueChange={onUserChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="全てのユーザー" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのユーザー</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
                {user.department && ` (${user.department.name})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters Button */}
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleClearAll}
          disabled={activeFilterCount === 0}
        >
          <X className="w-4 h-4" />
          クリア
        </Button>
      </div>
    );
  }
);
