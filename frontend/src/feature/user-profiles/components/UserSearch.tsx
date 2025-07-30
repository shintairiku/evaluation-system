"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { searchUsersAction } from '@/api/server-actions/users';
import { useProfileOptions } from '@/context/ProfileOptionsContext';
import type { UserDetailResponse } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, X, Loader2 } from 'lucide-react';

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

interface SearchUsersParams {
  query: string;
  department_id: string;
  stage_id: string;
  role_id: string;
  status: string;
  page: number;
  limit: number;
}

// Debounce hook for search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
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
  const { options, isLoading: isLoadingOptions, error: optionsError } = useProfileOptions();
  
  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useState<SearchUsersParams>({
    query: '',
    department_id: 'all',
    stage_id: 'all',
    role_id: 'all',
    status: 'all',
    page: 1,
    limit: 50
  });

  const [searchState, setSearchState] = useState<SearchState>({
    users: [],
    total: 0,
    loading: false,
    error: null
  });

  const [isPending, startTransition] = useTransition();
  
  // Refs to avoid callback dependency issues
  const onSearchResultsRef = useRef(onSearchResults);
  onSearchResultsRef.current = onSearchResults;

  // Increased debounce delay to reduce API calls
  const debouncedQuery = useDebounce(query, 800);

  // Server action wrapper
  const searchActionWrapper = async (formData: FormData): Promise<SearchState> => {
    const params: SearchUsersParams = {
      query: formData.get('query') as string || '',
      department_id: formData.get('department_id') as string || 'all',
      stage_id: formData.get('stage_id') as string || 'all',
      role_id: formData.get('role_id') as string || 'all',
      status: formData.get('status') as string || 'all',
      page: parseInt(formData.get('page') as string || '1', 10),
      limit: parseInt(formData.get('limit') as string || '50', 10)
    };

    try {
      const result = await searchUsersAction(params);
      
      if (result.success && result.data) {
        return {
          users: result.data.items,
          total: result.data.total,
          loading: false,
          error: null,
        };
      } else {
        return {
          users: [],
          total: 0,
          loading: false,
          error: result.error || 'Search failed',
        };
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

  // FIXED: Properly initialize with initial users on component mount
  useEffect(() => {
    if (initialUsers.length > 0) {
      onSearchResultsRef.current(initialUsers, initialUsers.length);
    } else {
      onSearchResultsRef.current([], 0);
    }
  }, [initialUsers]);

  // FIXED: Improved search trigger logic with minimum character validation
  useEffect(() => {
    // Only perform server search if there are meaningful search parameters
    const hasMinimumSearchQuery = debouncedQuery.trim().length >= 2; // Minimum 2 characters
    const hasFilters = searchParams.department_id !== 'all' || 
                      searchParams.stage_id !== 'all' || 
                      searchParams.role_id !== 'all' || 
                      searchParams.status !== 'all';

    if (hasMinimumSearchQuery || hasFilters) {
      startTransition(async () => {
        setSearchState(prev => ({ ...prev, loading: true }));
        
        const formData = new FormData();
        formData.append('query', debouncedQuery);
        formData.append('department_id', searchParams.department_id || 'all');
        formData.append('stage_id', searchParams.stage_id || 'all');
        formData.append('role_id', searchParams.role_id || 'all');
        formData.append('status', searchParams.status || 'all');
        formData.append('page', searchParams.page?.toString() || '1');
        formData.append('limit', searchParams.limit?.toString() || '50');

        const result = await searchActionWrapper(formData);
        setSearchState(result);
      });
    } else if (debouncedQuery.trim().length === 0 && !hasFilters) {
      // Clear search - show initial users
      onSearchResultsRef.current(initialUsers, initialUsers.length);
    }
    // If query is 1 character, do nothing (wait for more characters)
  }, [debouncedQuery, searchParams.department_id, searchParams.stage_id, searchParams.role_id, searchParams.status, initialUsers]);

  // Update parent with search results when search state changes
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

  // Handle profile options errors
  useEffect(() => {
    if (optionsError) {
      toast.error('フィルターオプションの読み込みに失敗しました');
    }
  }, [optionsError]);

  // Handle parameter changes
  const handleParamChange = useCallback((key: keyof SearchUsersParams, value: string | number) => {
    setSearchParams(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : (typeof value === 'number' ? value : 1) // Reset to page 1 when changing filters
    }));
  }, []);

  // Clear all filters and return to initial state
  const handleClearFilters = useCallback(() => {
    setQuery('');
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

  const isLoading = isPending || searchState.loading;

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border">
      {/* Search Input with Improved Debounce */}
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="ユーザーを検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10"
            disabled={isLoading}
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQuery('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Department Filter */}
      <div className="w-[180px]">
        <Select
          value={searchParams.department_id}
          onValueChange={(value) => handleParamChange('department_id', value)}
          disabled={isLoadingOptions}
        >
          <SelectTrigger>
            <SelectValue placeholder="部署" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての部署</SelectItem>
            {options.departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stage Filter */}
      <div className="w-[180px]">
        <Select
          value={searchParams.stage_id}
          onValueChange={(value) => handleParamChange('stage_id', value)}
          disabled={isLoadingOptions}
        >
          <SelectTrigger>
            <SelectValue placeholder="ステージ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのステージ</SelectItem>
            {options.stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Role Filter */}
      <div className="w-[180px]">
        <Select
          value={searchParams.role_id}
          onValueChange={(value) => handleParamChange('role_id', value)}
          disabled={isLoadingOptions}
        >
          <SelectTrigger>
            <SelectValue placeholder="役職" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての役職</SelectItem>
            {options.roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status Filter */}
      <div className="w-[120px]">
        <Select
          value={searchParams.status}
          onValueChange={(value) => handleParamChange('status', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="active">アクティブ</SelectItem>
            <SelectItem value="inactive">非アクティブ</SelectItem>
            <SelectItem value="pending_approval">承認待ち</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters Button */}
      <Button
        variant="outline"
        onClick={handleClearFilters}
        disabled={isLoading}
        className="flex items-center gap-2"
      >
        <X className="h-4 w-4" />
        クリア
      </Button>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          検索中...
        </div>
      )}
    </div>
  );
}