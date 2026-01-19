import type { UUID } from '@/api/types';

export function resolveCompetencyNamesForDisplay(
  competencyIds?: UUID[] | null,
  competencyNames?: Record<string, string> | null,
): string[] | null {
  if (!competencyIds || competencyIds.length === 0) return null;
  if (!competencyNames) return null;

  const names = competencyIds
    .map(id => competencyNames[id])
    .filter((name): name is string => Boolean(name));

  if (names.length !== competencyIds.length) return null;
  return names;
}

