import { useState, useEffect } from 'react';
import { getCompetencyAction } from '@/api/server-actions/competencies';
import type { UUID } from '@/api/types';

/**
 * Return type for the useCompetencyNames hook
 */
export interface UseCompetencyNamesReturn {
  /** Array of competency names in the same order as input IDs */
  competencyNames: string[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Custom hook to resolve competency IDs to their display names
 * Uses existing server actions with optimized caching
 *
 * @param competencyIds - Array of competency UUIDs to resolve
 * @returns Object containing competency names, loading state, and error
 */
export function useCompetencyNames(competencyIds?: UUID[] | null): UseCompetencyNamesReturn {
  const [competencyNames, setCompetencyNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when input changes
    setCompetencyNames([]);
    setError(null);

    // Early return if no IDs provided
    if (!competencyIds || competencyIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchCompetencyNames = async () => {
      setLoading(true);

      try {
        // Fetch all competencies in parallel using existing server action
        const promises = competencyIds.map(id => getCompetencyAction(id));
        const results = await Promise.all(promises);

        // Extract names from successful responses
        const names: string[] = [];
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.success && result.data) {
            names.push(result.data.name);
          } else {
            // Fallback to ID if name fetch fails
            names.push(`Unknown (${competencyIds[i]})`);
          }
        }

        setCompetencyNames(names);
      } catch (err) {
        console.error('Error fetching competency names:', err);
        setError(err instanceof Error ? err.message : 'Failed to load competency names');
        // Fallback to IDs on error
        setCompetencyNames(competencyIds.map(id => `ID: ${id}`));
      } finally {
        setLoading(false);
      }
    };

    fetchCompetencyNames();
  }, [competencyIds]);

  return {
    competencyNames,
    loading,
    error,
  };
}