"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import type { UserDetailResponse, Department, Stage, Role } from '@/api/types';
import { getProfileOptionsAction } from '@/api/server-actions/users';

interface FilterBarProps {
  users: UserDetailResponse[];
  onFilter?: (filters: FilterState) => void;
}

export interface FilterState {
  search: string;
  department: string;
  stage: string;
  role: string;
  status: string;
}

export default function FilterBar({ users, onFilter }: FilterBarProps) {
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    department: 'all',
    stage: 'all',
    role: 'all',
    status: 'all'
  });

  // Profile options state for filter dropdowns
  const [profileOptions, setProfileOptions] = useState<{
    departments: Department[];
    stages: Stage[];
    roles: Role[];
  }>({
    departments: [],
    stages: [],
    roles: []
  });

  // Fetch profile options when component mounts
  useEffect(() => {
    const fetchProfileOptions = async () => {
      setIsLoadingOptions(true);
      try {
        console.log('FilterBar: Fetching profile options for dropdowns...');
        const result = await getProfileOptionsAction();
        console.log('FilterBar: Profile options result:', result);
        
        if (result.success && result.data) {
          setProfileOptions({
            departments: result.data.departments,
            stages: result.data.stages,
            roles: result.data.roles
          });
          console.log('FilterBar: Successfully loaded filter options:', {
            departments: result.data.departments.length,
            stages: result.data.stages.length,
            roles: result.data.roles.length
          });
        } else {
          console.error('FilterBar: Failed to load filter options:', result.error);
          toast.error('フィルターオプションの読み込みに失敗しました');
        }
      } catch (error) {
        console.error('FilterBar: Exception while fetching filter options:', error);
        toast.error('フィルターオプションの読み込み中にエラーが発生しました');
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchProfileOptions();
  }, []);

  // Handle filter changes
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilter?.(newFilters);
  };

  // Clear all filters
  const handleClearFilters = () => {
    const clearedFilters: FilterState = {
      search: '',
      department: 'all',
      stage: 'all',
      role: 'all',
      status: 'all'
    };
    setFilters(clearedFilters);
    onFilter?.(clearedFilters);
  };

  // Get available statuses from current users
  const availableStatuses = Array.from(new Set(users.map(user => user.status)));

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border">
      {/* 検索入力 */}
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="名前・従業員コード・メールアドレスで検索..."
          className="pl-10"
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
        />
      </div>

      {/* 部署フィルタ - Backend Connected */}
      <Select 
        value={filters.department} 
        onValueChange={(value) => handleFilterChange('department', value)}
        disabled={isLoadingOptions}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={isLoadingOptions ? "読み込み中..." : "部署を選択"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべての部署</SelectItem>
          {profileOptions.departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
          {isLoadingOptions && (
            <SelectItem value="loading" disabled>
              読み込み中...
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {/* ステージフィルタ - Backend Connected */}
      <Select 
        value={filters.stage} 
        onValueChange={(value) => handleFilterChange('stage', value)}
        disabled={isLoadingOptions}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={isLoadingOptions ? "読み込み中..." : "ステージを選択"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべてのステージ</SelectItem>
          {profileOptions.stages.map((stage) => (
            <SelectItem key={stage.id} value={stage.id}>
              {stage.name}
            </SelectItem>
          ))}
          {isLoadingOptions && (
            <SelectItem value="loading" disabled>
              読み込み中...
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {/* ロールフィルタ - Backend Connected */}
      <Select 
        value={filters.role} 
        onValueChange={(value) => handleFilterChange('role', value)}
        disabled={isLoadingOptions}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={isLoadingOptions ? "読み込み中..." : "ロールを選択"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべてのロール</SelectItem>
          {profileOptions.roles.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {role.name}
            </SelectItem>
          ))}
          {isLoadingOptions && (
            <SelectItem value="loading" disabled>
              読み込み中...
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {/* ステータスフィルタ - Local Data */}
      <Select 
        value={filters.status} 
        onValueChange={(value) => handleFilterChange('status', value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="ステータスを選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべてのステータス</SelectItem>
          {availableStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              {status === 'active' && 'アクティブ'}
              {status === 'inactive' && '非アクティブ'}
              {status === 'pending_approval' && '承認待ち'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* フィルタクリアボタン - Functional */}
      <Button 
        variant="outline" 
        size="sm" 
        className="flex items-center gap-2"
        onClick={handleClearFilters}
      >
        <X className="w-4 h-4" />
        クリア
      </Button>
    </div>
  );
}