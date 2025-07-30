"use client";

import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProfileOptions } from '@/context/ProfileOptionsContext';

interface OrganizationFiltersProps {
  onFiltersChange: (filters: OrganizationFilters) => void;
  filters: OrganizationFilters;
}

export interface OrganizationFilters {
  search: string;
  departmentId: string;
  stageId: string;
  roleId: string;
}

export default function OrganizationFilters({ onFiltersChange, filters }: OrganizationFiltersProps) {
  const { options, isLoading } = useProfileOptions();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key: keyof OrganizationFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      departmentId: '',
      stageId: '',
      roleId: ''
    });
  };

  const hasActiveFilters = filters.search || filters.departmentId || filters.stageId || filters.roleId;

  return (
    <div className="space-y-4">
      {/* Search and Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ユーザー名、メールアドレスで検索..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          フィルター
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1">
              {Object.values(filters).filter(Boolean).length}
            </Badge>
          )}
        </Button>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            クリア
          </Button>
        )}
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
          {/* Department Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">部署</label>
            <Select
              value={filters.departmentId}
              onValueChange={(value) => handleFilterChange('departmentId', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="部署を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">すべての部署</SelectItem>
                {options.departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stage Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">ステージ</label>
            <Select
              value={filters.stageId}
              onValueChange={(value) => handleFilterChange('stageId', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="ステージを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">すべてのステージ</SelectItem>
                {options.stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Role Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">役割</label>
            <Select
              value={filters.roleId}
              onValueChange={(value) => handleFilterChange('roleId', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="役割を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">すべての役割</SelectItem>
                {options.roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="flex items-center gap-1">
              検索: {filters.search}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => handleFilterChange('search', '')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.departmentId && (
            <Badge variant="secondary" className="flex items-center gap-1">
              部署: {options.departments.find(d => d.id === filters.departmentId)?.name}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => handleFilterChange('departmentId', '')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.stageId && (
            <Badge variant="secondary" className="flex items-center gap-1">
              ステージ: {options.stages.find(s => s.id === filters.stageId)?.name}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => handleFilterChange('stageId', '')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.roleId && (
            <Badge variant="secondary" className="flex items-center gap-1">
              役割: {options.roles.find(r => r.id === filters.roleId)?.name}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => handleFilterChange('roleId', '')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
} 