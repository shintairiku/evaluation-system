"use client";

import React, { useActionState, useEffect, useCallback, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import type { UserDetailResponse, Department, Stage, Role, UserList } from '@/api/types';
import { searchUsersAction, SearchUsersParams } from '@/api/server-actions/users';
import { useProfileOptions } from '@/context/ProfileOptionsContext';

interface UserSearchProps {
  onSearchResults: (users: UserDetailResponse[], total: number, isFiltered?: boolean) => void;
  initialUsers?: UserDetailResponse[];
  // When true, search uses org-chart dataset (readonly) for Organization Chart view
  useOrgChartDataset?: boolean;
}

interface SearchState {
  users: UserDetailResponse[];
  total: number;
  loading: boolean;
  error: string | null;
}

const initialState: SearchState = {
  users: [],
  total: 0,
  loading: false,
  error: null,
};

// Improved debounce utility function with minimum length validation
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function UserSearch({ onSearchResults, initialUsers = [], useOrgChartDataset = false }: UserSearchProps) {
  // ——————————————————————————————————————————————————————————
  // Helpers
  // ——————————————————————————————————————————————————————————
  const buildParamsFromForm = (formData: FormData): SearchUsersParams => ({
    query: (formData.get('query') as string) || '',
    department_id: (formData.get('department_id') as string) || 'all',
    stage_id: (formData.get('stage_id') as string) || 'all',
    role_id: (formData.get('role_id') as string) || 'all',
    status: (formData.get('status') as string) || 'all',
    page: parseInt((formData.get('page') as string) || '1', 10),
    limit: parseInt((formData.get('limit') as string) || '50', 10),
  });

  const hasActiveFilters = (p: SearchUsersParams): boolean => (
    (!!p.department_id && p.department_id !== 'all') ||
    (!!p.stage_id && p.stage_id !== 'all') ||
    (!!p.role_id && p.role_id !== 'all') ||
    (!!p.status && p.status !== 'all')
  );

  const [searchParams, setSearchParams] = React.useState<SearchUsersParams>({
    query: '',
    department_id: 'all',
    stage_id: 'all', 
    role_id: 'all',
    status: 'all',
    page: 1,
    limit: 50
  });

  // Use profile options from context
  const { options: profileOptions, isLoading: isLoadingOptions, error: optionsError } = useProfileOptions();
  const [isPending, startTransition] = useTransition();
  
  // Refs to avoid callback dependency issues
  const onSearchResultsRef = useRef(onSearchResults);
  onSearchResultsRef.current = onSearchResults;

  // Increased debounce delay to reduce API calls
  const debouncedQuery = useDebounce<string>(searchParams.query || '', 800);
  // Track if the last emitted results are considered filtered
  const [wasFiltered, setWasFiltered] = React.useState(false);

  // Server action wrapper for useActionState
  const searchActionWrapper = async (
    prevState: SearchState,
    formData: FormData
  ): Promise<SearchState> => {
    const params: SearchUsersParams = buildParamsFromForm(formData);

    try {
      if (useOrgChartDataset) {
        const { searchOrgChartUsersAction } = await import('@/api/server-actions/users');
        // Employee stage visibility constraint: only own stage is visible in org-chart mode
        if (params.stage_id && params.stage_id !== 'all') {
          const currentUser = (initialUsers && initialUsers.length > 0) ? initialUsers[0] : undefined;
          const currentStageId = currentUser?.stage?.id;
          if (!currentStageId || currentStageId !== params.stage_id) {
            return { users: [], total: 0, loading: false, error: null };
          }
          // If matches, show only self
          return { users: [currentUser as UserDetailResponse], total: 1, loading: false, error: null };
        }

        const orgResult = await searchOrgChartUsersAction({
          query: params.query,
          department_id: params.department_id,
          role_id: params.role_id,
          status: params.status,
          stage_id: params.stage_id,
          supervisor_id: params.supervisor_id,
          page: params.page,
          limit: params.limit,
        });

        if (!orgResult.success || !orgResult.data) {
          return { users: [], total: 0, loading: false, error: orgResult.error || 'Search failed' };
        }

        return { users: orgResult.data as unknown as UserDetailResponse[], total: orgResult.total || orgResult.data.length, loading: false, error: null };
      }

      const result = await searchUsersAction(params);
      
      if (result.success && result.data) {
        const searchResult = {
          users: result.data.items,
          total: result.data.total,
          loading: false,
          error: null,
        };
        return searchResult;
      } else {
        const errorResult = {
          users: [],
          total: 0,
          loading: false,
          error: result.error || 'Search failed',
        };
        return errorResult;
      }
    } catch (error) {
      return {
        users: [],
        total: 0,
        loading: false,
        error: 'An unexpected error occurred during search',
      };
    }
  };

  const [searchState, searchAction, isPendingAction] = useActionState(
    searchActionWrapper,
    initialState
  );

  // Show error from context if profile options failed to load
  useEffect(() => {
    if (optionsError) {
      console.error('UserSearch: Profile options error:', optionsError);
      toast.error('フィルターオプションの読み込みに失敗しました');
    }
  }, [optionsError]);

  // Initialize with initial users on component mount
  useEffect(() => {
    if (initialUsers.length > 0) {
      onSearchResultsRef.current(initialUsers, initialUsers.length, false);
    } else {
      onSearchResultsRef.current([], 0, false);
    }
  }, [initialUsers]);

  // Improved search trigger logic with minimum character validation
  useEffect(() => {
    // Only perform server search if there are meaningful search parameters
    const hasMinimumSearchQuery = (debouncedQuery || '').trim().length >= 2; // Minimum 2 characters
    const hasFilters = hasActiveFilters(searchParams);

    if (hasMinimumSearchQuery || hasFilters) {
      setWasFiltered(true);
      startTransition(() => {
        const formData = new FormData();
        formData.append('query', debouncedQuery || '');
        formData.append('department_id', searchParams.department_id || 'all');
        formData.append('stage_id', searchParams.stage_id || 'all');
        formData.append('role_id', searchParams.role_id || 'all');
        formData.append('status', searchParams.status || 'all');
        formData.append('page', searchParams.page?.toString() || '1');
        formData.append('limit', searchParams.limit?.toString() || '50');

        searchAction(formData);
      });
    } else if ((debouncedQuery || '').trim().length === 0 && !hasFilters) {
      // Clear search - show initial users
      setWasFiltered(false);
      onSearchResultsRef.current(initialUsers, initialUsers.length, false);
    }
    // If query is 1 character, do nothing (wait for more characters)
  }, [debouncedQuery, searchParams.department_id, searchParams.stage_id, searchParams.role_id, searchParams.status, initialUsers]);

  // Update parent with search results when search state changes
  useEffect(() => {
    if (searchState.users.length > 0 || (searchState.users.length === 0 && searchState.total === 0 && !searchState.loading)) {
      onSearchResultsRef.current(searchState.users, searchState.total, wasFiltered);
    }
  }, [searchState.users, searchState.total, searchState.loading, wasFiltered]);

  // Handle search errors with toast notifications
  useEffect(() => {
    if (searchState.error) {
      toast.error(searchState.error);
    }
  }, [searchState.error]);

  // Handle parameter changes
  const handleParamChange = useCallback((key: keyof SearchUsersParams, value: string | number) => {
    setSearchParams(prev => ({
      ...prev,
      [key]: value as any,
      page: key !== 'page' ? 1 : (typeof value === 'number' ? value : parseInt(String(value), 10) || 1)
    }));
  }, []);

  // Clear all filters and return to initial state
  const handleClearFilters = useCallback(() => {
    const clearedParams: SearchUsersParams = {
      query: '',
      department_id: 'all',
      stage_id: 'all',
      role_id: 'all',
      status: 'all',
      page: 1,
      limit: 50
    };
    setSearchParams(clearedParams);
    
    // Return to initial users immediately
    onSearchResultsRef.current(initialUsers, initialUsers.length);
  }, [initialUsers]);

  const isLoading = isPending || isPendingAction || searchState.loading;

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border">
      {/* Search Input with Improved Debounce */}
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 animate-spin" />
        )}
        <Input
          placeholder="名前・従業員コード・メールアドレスで検索... (2文字以上)"
          className="pl-10 pr-10"
          value={searchParams.query}
          onChange={(e) => handleParamChange('query', e.target.value)}
          disabled={isLoading}
        />
        {/* Show hint for minimum characters */}
        {(searchParams.query || '').length === 1 && (
          <div className="absolute top-full left-0 mt-1 text-xs text-muted-foreground">
            もう1文字入力してください (最小2文字)
          </div>
        )}
      </div>

      {/* Department Filter */}
      <Select 
        value={searchParams.department_id} 
        onValueChange={(value) => handleParamChange('department_id', value)}
        disabled={isLoadingOptions || isLoading}
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

      {/* Stage Filter */}
      <Select 
        value={searchParams.stage_id} 
        onValueChange={(value) => handleParamChange('stage_id', value)}
        disabled={isLoadingOptions || isLoading}
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

      {/* Role Filter */}
      <Select 
        value={searchParams.role_id} 
        onValueChange={(value) => handleParamChange('role_id', value)}
        disabled={isLoadingOptions || isLoading}
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

      {/* Status Filter */}
      <Select 
        value={searchParams.status} 
        onValueChange={(value) => handleParamChange('status', value)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="ステータスを選択" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべてのステータス</SelectItem>
          <SelectItem value="active">アクティブ</SelectItem>
          <SelectItem value="inactive">非アクティブ</SelectItem>
          <SelectItem value="pending_approval">承認待ち</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters Button */}
      <Button 
        variant="outline" 
        size="sm" 
        className="flex items-center gap-2"
        onClick={handleClearFilters}
        disabled={isLoading}
      >
        <X className="w-4 h-4" />
        クリア
      </Button>

    </div>
  );
}