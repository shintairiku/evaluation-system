"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getProfileOptionsAction } from '@/api/server-actions/users';
import type { Department, Stage, Role } from '@/api/types';

interface ProfileOptions {
  departments: Department[];
  stages: Stage[];
  roles: Role[];
}

interface ProfileOptionsContextType {
  options: ProfileOptions;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ProfileOptionsContext = createContext<ProfileOptionsContextType | undefined>(undefined);

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface ProfileOptionsProviderProps {
  children: ReactNode;
}

export function ProfileOptionsProvider({ children }: ProfileOptionsProviderProps) {
  const [options, setOptions] = useState<ProfileOptions>({
    departments: [],
    stages: [],
    roles: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchOptions = async () => {
    const now = Date.now();
    
    // Check if cache is still valid
    if (lastFetch && (now - lastFetch) < CACHE_DURATION && options.departments.length > 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getProfileOptionsAction();
      
      if (result.success && result.data) {
        setOptions({
          departments: result.data.departments,
          stages: result.data.stages,
          roles: result.data.roles
        });
        setLastFetch(now);
      } else {
        setError(result.error || 'Failed to load profile options');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = async () => {
    setLastFetch(0); // Force refresh
    await fetchOptions();
  };

  // Auto-fetch on mount
  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const value: ProfileOptionsContextType = {
    options,
    isLoading,
    error,
    refetch
  };

  return (
    <ProfileOptionsContext.Provider value={value}>
      {children}
    </ProfileOptionsContext.Provider>
  );
}

export function useProfileOptions(): ProfileOptionsContextType {
  const context = useContext(ProfileOptionsContext);
  if (context === undefined) {
    throw new Error('useProfileOptions must be used within a ProfileOptionsProvider');
  }
  return context;
} 