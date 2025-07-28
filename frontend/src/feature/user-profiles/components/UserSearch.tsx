"use client";

import React, { useActionState, useEffect, useCallback, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import type { UserDetailResponse, Department, Stage, Role, UserList } from '@/api/types';
import { searchUsersAction, getProfileOptionsAction, SearchUsersParams } from '@/api/server-actions/users';

interface UserSearchProps {
  onSearchResults: (users: UserDetailResponse[], total: number) => void;
  initialUsers?: UserDetailResponse[];
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

// Debounce utility function
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

export default function UserSearch({ onSearchResults, initialUsers = [] }: UserSearchProps) {
  const [searchParams, setSearchParams] = React.useState<SearchUsersParams>({
    query: '',
    department_id: 'all',
    stage_id: 'all', 
    role_id: 'all',
    status: 'all',
    page: 1,
    limit: 50
  });

  const [profileOptions, setProfileOptions] = React.useState<{
    departments: Department[];
    stages: Stage[];
    roles: Role[];
  }>({
    departments: [],
    stages: [],
    roles: []
  });

  const [isLoadingOptions, setIsLoadingOptions] = React.useState(true);
  const [isPending, startTransition] = useTransition();

  // Debounce search query to avoid excessive API calls
  const debouncedQuery = useDebounce(searchParams.query, 300);

  // Server action wrapper for useActionState
  const searchActionWrapper = async (
    prevState: SearchState,
    formData: FormData
  ): Promise<SearchState> => {
    const params: SearchUsersParams = {
      query: formData.get('query') as string || '',
      department_id: formData.get('department_id') as string || 'all',
      stage_id: formData.get('stage_id') as string || 'all',
      role_id: formData.get('role_id') as string || 'all',
      status: formData.get('status') as string || 'all',
      page: parseInt(formData.get('page') as string || '1', 10),
      limit: parseInt(formData.get('limit') as string || '50', 10)
    };

    console.log('UserSearch: Executing search with params:', params);

    try {
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
      console.error('UserSearch: Search error:', error);
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

  // Load profile options on mount
  useEffect(() => {
    const fetchProfileOptions = async () => {
      setIsLoadingOptions(true);
      try {
        console.log('UserSearch: Fetching profile options...');
        const result = await getProfileOptionsAction();
        
        if (result.success && result.data) {
          setProfileOptions({
            departments: result.data.departments,
            stages: result.data.stages,
            roles: result.data.roles
          });
          console.log('UserSearch: Profile options loaded successfully');
        } else {
          console.error('UserSearch: Failed to load profile options:', result.error);
          toast.error('フィルターオプションの読み込みに失敗しました');
        }
      } catch (error) {
        console.error('UserSearch: Exception while fetching profile options:', error);
        toast.error('フィルターオプションの読み込み中にエラーが発生しました');
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchProfileOptions();
  }, []);

  // Initialize with initial users only on first load
  useEffect(() => {
    if (initialUsers.length > 0 && searchState.users.length === 0 && 
        !searchParams.query && searchParams.department_id === 'all' && 
        searchParams.stage_id === 'all' && searchParams.role_id === 'all' && 
        searchParams.status === 'all') {
      onSearchResults(initialUsers, initialUsers.length);
    }
  }, [initialUsers]); // Remove dependencies that cause re-triggering

  // Trigger search when debounced query changes or filters change
  useEffect(() => {
    // Only perform server search if there are actual search parameters
    const hasSearchQuery = debouncedQuery.trim().length > 0;
    const hasFilters = searchParams.department_id !== 'all' || 
                      searchParams.stage_id !== 'all' || 
                      searchParams.role_id !== 'all' || 
                      searchParams.status !== 'all';

    if (hasSearchQuery || hasFilters) {
      startTransition(() => {
        const formData = new FormData();
        formData.append('query', debouncedQuery);
        formData.append('department_id', searchParams.department_id || 'all');
        formData.append('stage_id', searchParams.stage_id || 'all');
        formData.append('role_id', searchParams.role_id || 'all');
        formData.append('status', searchParams.status || 'all');
        formData.append('page', searchParams.page?.toString() || '1');
        formData.append('limit', searchParams.limit?.toString() || '50');

        searchAction(formData);
      });
    } else {
      // No search/filters active, show initial users
      onSearchResults(initialUsers, initialUsers.length);
    }
  }, [debouncedQuery, searchParams.department_id, searchParams.stage_id, searchParams.role_id, searchParams.status]);

  // Update parent with search results when search state changes (without causing loops)
  const onSearchResultsRef = useRef(onSearchResults);
  onSearchResultsRef.current = onSearchResults;
  
  useEffect(() => {
    if (searchState.users.length > 0 || (searchState.users.length === 0 && searchState.total === 0 && !searchState.loading)) {
      onSearchResultsRef.current(searchState.users, searchState.total);
    }
  }, [searchState.users, searchState.total, searchState.loading]);

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
      [key]: value,
      page: key !== 'page' ? 1 : value // Reset to page 1 when changing filters
    }));
  }, []);

  // Clear all filters
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
    
    // Trigger immediate search with cleared params
    startTransition(() => {
      const formData = new FormData();
      Object.entries(clearedParams).forEach(([key, value]) => {
        formData.append(key, value?.toString() || '');
      });
      searchAction(formData);
    });
  }, [searchAction]);

  const isLoading = isPending || isPendingAction || searchState.loading;

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border">
      {/* Search Input with Debounce */}
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 animate-spin" />
        )}
        <Input
          placeholder="名前・従業員コード・メールアドレスで検索..."
          className="pl-10 pr-10"
          value={searchParams.query}
          onChange={(e) => handleParamChange('query', e.target.value)}
          disabled={isLoading}
        />
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