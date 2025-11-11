import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import type { Department, Stage } from '@/api/types';
import type { StatusFilterOption } from '../types';

interface AdminUsersGoalsFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedDepartmentId: string;
  onDepartmentChange: (id: string) => void;
  selectedStageId: string;
  onStageChange: (id: string) => void;
  selectedStatusFilter: StatusFilterOption;
  onStatusFilterChange: (filter: StatusFilterOption) => void;
  departments: Department[];
  stages: Stage[];
}

/**
 * Filter controls for user-centric admin goals view
 */
export function AdminUsersGoalsFilters({
  searchQuery,
  onSearchChange,
  selectedDepartmentId,
  onDepartmentChange,
  selectedStageId,
  onStageChange,
  selectedStatusFilter,
  onStatusFilterChange,
  departments,
  stages,
}: AdminUsersGoalsFiltersProps) {
  const hasActiveFilters =
    searchQuery ||
    selectedDepartmentId !== 'all' ||
    selectedStageId !== 'all' ||
    selectedStatusFilter !== 'all';

  const handleClearFilters = () => {
    onSearchChange('');
    onDepartmentChange('all');
    onStageChange('all');
    onStatusFilterChange('all');
  };

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-lg border">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ユーザー名または部署で検索..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Department Filter */}
        <Select value={selectedDepartmentId} onValueChange={onDepartmentChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="部署" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての部署</SelectItem>
            {departments.map(dept => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Stage Filter */}
        <Select value={selectedStageId} onValueChange={onStageChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="ステージ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのステージ</SelectItem>
            {stages.map(stage => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={selectedStatusFilter}
          onValueChange={value => onStatusFilterChange(value as StatusFilterOption)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのステータス</SelectItem>
            <SelectItem value="no-goals">目標未設定</SelectItem>
            <SelectItem value="has-drafts">設定中（下書きあり）</SelectItem>
            <SelectItem value="all-submitted">提出済み（下書きなし）</SelectItem>
            <SelectItem value="all-approved">すべて承認済み</SelectItem>
            <SelectItem value="has-rejected">差し戻しあり</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            <X className="h-4 w-4 mr-1" />
            フィルタークリア
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex gap-2 flex-wrap text-sm text-muted-foreground">
          <span>アクティブなフィルター:</span>
          {searchQuery && (
            <span className="font-medium">
              検索: &quot;{searchQuery}&quot;
            </span>
          )}
          {selectedDepartmentId !== 'all' && (
            <span className="font-medium">
              部署:{' '}
              {departments.find(d => d.id === selectedDepartmentId)?.name || selectedDepartmentId}
            </span>
          )}
          {selectedStageId !== 'all' && (
            <span className="font-medium">
              ステージ: {stages.find(s => s.id === selectedStageId)?.name || selectedStageId}
            </span>
          )}
          {selectedStatusFilter !== 'all' && (
            <span className="font-medium">
              ステータス:{' '}
              {
                {
                  'no-goals': '目標未設定',
                  'has-drafts': '設定中',
                  'all-submitted': '提出済み',
                  'all-approved': 'すべて承認済み',
                  'has-rejected': '差し戻しあり',
                }[selectedStatusFilter]
              }
            </span>
          )}
        </div>
      )}
    </div>
  );
}
