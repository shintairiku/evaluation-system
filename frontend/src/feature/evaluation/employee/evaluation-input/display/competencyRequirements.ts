import type { Competency, GoalResponse } from "@/api/types";

function normalizeActionIndexes(actionIndexes?: string[] | null): string[] {
  const unique = Array.from(
    new Set(
      (actionIndexes ?? [])
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0)
    )
  );

  return unique.sort((a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);
    const aIsNumeric = Number.isFinite(aNum);
    const bIsNumeric = Number.isFinite(bNum);

    if (aIsNumeric && bIsNumeric) {
      return aNum - bNum;
    }

    return a.localeCompare(b);
  });
}

function getStageActionMap(stageCompetencies: Competency[]): Record<string, string[]> {
  return stageCompetencies.reduce<Record<string, string[]>>((acc, competency) => {
    const actionIndexes = normalizeActionIndexes(Object.keys(competency.description || {}));
    if (actionIndexes.length > 0) {
      acc[competency.id] = actionIndexes;
    }
    return acc;
  }, {});
}

export function getGoalCompetencyIds(goal: GoalResponse, stageCompetencies: Competency[] = []): string[] {
  const stageCompetencyIds = stageCompetencies.map((competency) => competency.id);
  if (stageCompetencyIds.length > 0) {
    return stageCompetencyIds;
  }

  const goalCompetencyIds = Array.from(new Set((goal.competencyIds || []).map((id) => String(id))));
  if (goalCompetencyIds.length > 0) {
    return goalCompetencyIds;
  }

  const selectedActionCompetencyIds = Object.keys(goal.selectedIdealActions || {});
  if (selectedActionCompetencyIds.length > 0) {
    return selectedActionCompetencyIds;
  }

  return stageCompetencies.map((competency) => competency.id);
}

export function getSelectedCompetencyIdsForReference(goal: GoalResponse): string[] {
  const goalCompetencyIds = Array.from(new Set((goal.competencyIds || []).map((id) => String(id))));
  if (goalCompetencyIds.length > 0) {
    return goalCompetencyIds;
  }

  return Object.keys(goal.selectedIdealActions || {});
}

/**
 * Resolve required action indexes for a competency goal.
 *
 * Priority:
 * 1) Stage competency action definitions (all competencies for the user's stage)
 * 2) Goal-specific selected ideal actions (fallback only when stage data is unavailable)
 */
export function getGoalRequiredCompetencyActions(
  goal: GoalResponse,
  stageCompetencies: Competency[] = []
): Record<string, string[]> {
  const selectedIdealActions = goal.selectedIdealActions || {};
  const stageActionMap = getStageActionMap(stageCompetencies);
  if (Object.keys(stageActionMap).length > 0) {
    return stageActionMap;
  }

  const competencyIds = getGoalCompetencyIds(goal, stageCompetencies);

  return competencyIds.reduce<Record<string, string[]>>((acc, competencyId) => {
    const goalSelectedActions = normalizeActionIndexes(selectedIdealActions[competencyId]);
    if (goalSelectedActions.length > 0) {
      acc[competencyId] = goalSelectedActions;
      return acc;
    }

    const stageActions = stageActionMap[competencyId];
    if (stageActions && stageActions.length > 0) {
      acc[competencyId] = stageActions;
    }

    return acc;
  }, {});
}
