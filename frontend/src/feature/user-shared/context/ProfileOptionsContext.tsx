"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { getDepartmentsAction } from '@/api/server-actions/departments';
import { getStagesAction } from '@/api/server-actions/stages';
import { getRolesAction } from '@/api/server-actions/roles';
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
  initialOptions?: ProfileOptions;
}

export function ProfileOptionsProvider({ children, initialOptions }: ProfileOptionsProviderProps) {
  const hasInitialOptions = Boolean(
    initialOptions &&
      (initialOptions.departments.length > 0 ||
        initialOptions.stages.length > 0 ||
        initialOptions.roles.length > 0),
  );

  const [options, setOptions] = useState<ProfileOptions>(
    initialOptions ?? {
      departments: [],
      stages: [],
      roles: [],
    },
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(hasInitialOptions ? Date.now() : 0);
  const hasFetchedRef = useRef(hasInitialOptions);

  const fetchOptions = async () => {
    const now = Date.now();

    // Check if cache is still valid
    if (lastFetch && (now - lastFetch) < CACHE_DURATION && options.departments.length > 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch data from individual organization-scoped endpoints
      const [departmentsResult, stagesResult, rolesResult] = await Promise.all([
        getDepartmentsAction(),
        getStagesAction(),
        getRolesAction()
      ]);

      // Check if all requests were successful
      if (departmentsResult.success && stagesResult.success && rolesResult.success) {
        // Map RoleDetail[] to Role[] by adding missing hierarchy_order field
        const rolesWithHierarchy = (rolesResult.data || []).map((role, index) => ({
          ...role,
          hierarchy_order: index // Use index as fallback hierarchy_order
        }));

        setOptions({
          departments: departmentsResult.data || [],
          stages: stagesResult.data || [],
          roles: rolesWithHierarchy
        });
        setLastFetch(now);
      } else {
        // Collect all errors
        const errors = [
          !departmentsResult.success ? `Departments: ${departmentsResult.error}` : null,
          !stagesResult.success ? `Stages: ${stagesResult.error}` : null,
          !rolesResult.success ? `Roles: ${rolesResult.error}` : null
        ].filter(Boolean);

        setError(errors.join(', ') || 'Failed to load profile options');
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

  // Auto-fetch on mount (with protection against React Strict Mode double-mount)
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

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
