import { useState, useEffect } from 'react';
import { getCompetencyAction } from '@/api/server-actions/competencies';
import type { UUID } from '@/api/types';

/**
 * Resolved ideal action structure
 */
export interface ResolvedIdealAction {
  /** Competency name */
  competencyName: string;
  /** Array of resolved action descriptions */
  actions: string[];
}

/**
 * Return type for the useIdealActionsResolver hook
 */
export interface UseIdealActionsResolverReturn {
  /** Array of resolved ideal actions */
  resolvedActions: ResolvedIdealAction[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Custom hook to resolve ideal action IDs to their descriptive texts
 * Fetches competency details and maps action IDs to descriptions
 *
 * Shared hook used across evaluation features:
 * - Employee goal-list (GoalCard)
 * - Supervisor goal-review (GoalApprovalCard)
 *
 * @param selectedIdealActions - Record of competency IDs to action IDs
 * @param competencyIds - Array of competency IDs for fallback names
 * @returns Object containing resolved actions, loading state, and error
 */
export function useIdealActionsResolver(
  selectedIdealActions?: Record<string, string[]> | null,
  competencyIds?: UUID[] | null
): UseIdealActionsResolverReturn {
  const [resolvedActions, setResolvedActions] = useState<ResolvedIdealAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when input changes
    setResolvedActions([]);
    setError(null);

    // Early return if no actions provided
    if (!selectedIdealActions || Object.keys(selectedIdealActions).length === 0) {
      setLoading(false);
      return;
    }

    const resolveIdealActions = async () => {
      setLoading(true);

      try {
        const resolved: ResolvedIdealAction[] = [];

        // Process each competency and its actions
        for (const [competencyKey, actionIds] of Object.entries(selectedIdealActions)) {
          let competencyName = competencyKey;
          let actionDescriptions: string[] = [];

          // Try to resolve competency name and action descriptions
          try {
            // If competencyKey looks like a UUID, fetch competency details
            if (competencyKey.length === 36 && competencyKey.includes('-')) {
              const competencyResult = await getCompetencyAction(competencyKey);

              if (competencyResult.success && competencyResult.data) {
                const competencyData = competencyResult.data;
                competencyName = competencyData.name;

                // Resolve action IDs to descriptions
                if (competencyData.description) {
                  actionDescriptions = actionIds
                    .map(actionId => competencyData.description?.[actionId])
                    .filter((desc): desc is string => Boolean(desc));
                }
              }
            }

            // Fallback: if no descriptions found, use the action IDs
            if (actionDescriptions.length === 0) {
              actionDescriptions = actionIds.map(id => `行動 ${id}`);
            }

            resolved.push({
              competencyName,
              actions: actionDescriptions
            });

          } catch (err) {
            console.warn(`Failed to resolve competency ${competencyKey}:`, err);
            // Fallback: use raw data
            resolved.push({
              competencyName: competencyKey,
              actions: actionIds.map(id => `行動 ${id}`)
            });
          }
        }

        setResolvedActions(resolved);

      } catch (err) {
        console.error('Error resolving ideal actions:', err);
        setError(err instanceof Error ? err.message : 'Failed to resolve ideal actions');

        // Fallback: use raw data structure
        const fallbackResolved = Object.entries(selectedIdealActions).map(([key, actions]) => ({
          competencyName: key,
          actions: actions.map(id => `行動 ${id}`)
        }));
        setResolvedActions(fallbackResolved);
      } finally {
        setLoading(false);
      }
    };

    resolveIdealActions();
  }, [selectedIdealActions, competencyIds]);

  return {
    resolvedActions,
    loading,
    error,
  };
}
