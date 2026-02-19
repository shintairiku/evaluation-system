import type { Competency, CompetencyRatingData, GoalResponse } from "@/api/types";

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

function appendUnique(target: string[], seen: Set<string>, values: string[]) {
  values.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      target.push(value);
    }
  });
}

export function buildStageCompetencyMap(stageCompetencies: Competency[] = []): Map<string, Competency> {
  return new Map(stageCompetencies.map((competency) => [competency.id, competency]));
}

export function resolveDisplayCompetencyIds({
  goal,
  stageCompetencies = [],
  assessmentRatingData = {},
  supervisorRatingData = {},
}: {
  goal: GoalResponse;
  stageCompetencies?: Competency[];
  assessmentRatingData?: CompetencyRatingData;
  supervisorRatingData?: CompetencyRatingData;
}): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  appendUnique(ids, seen, stageCompetencies.map((competency) => competency.id));
  appendUnique(ids, seen, (goal.competencyIds || []).map((id) => String(id)));
  appendUnique(ids, seen, Object.keys(goal.selectedIdealActions || {}));
  appendUnique(ids, seen, Object.keys(assessmentRatingData || {}));
  appendUnique(ids, seen, Object.keys(supervisorRatingData || {}));

  return ids;
}

export function resolveDisplayActionIndexes({
  competencyId,
  stageCompetency,
  selectedIdealActions = {},
  assessmentRatings = {},
  supervisorRatings = {},
}: {
  competencyId: string;
  stageCompetency?: Competency;
  selectedIdealActions?: Record<string, string[]> | null;
  assessmentRatings?: Record<string, string>;
  supervisorRatings?: Record<string, string>;
}): string[] {
  const indexes: string[] = [];
  const seen = new Set<string>();

  appendUnique(
    indexes,
    seen,
    normalizeActionIndexes(Object.keys(stageCompetency?.description || {}))
  );
  appendUnique(
    indexes,
    seen,
    normalizeActionIndexes(selectedIdealActions?.[competencyId])
  );
  appendUnique(indexes, seen, normalizeActionIndexes(Object.keys(assessmentRatings || {})));
  appendUnique(indexes, seen, normalizeActionIndexes(Object.keys(supervisorRatings || {})));

  return indexes;
}

export function resolveCompetencyName({
  competencyId,
  stageCompetency,
  competencyNames = {},
}: {
  competencyId: string;
  stageCompetency?: Competency;
  competencyNames?: Record<string, string> | null;
}): string {
  return stageCompetency?.name || competencyNames[competencyId] || "コンピテンシー";
}

export function resolveActionDescription({
  competencyId,
  actionIndex,
  stageCompetency,
  selectedIdealActions = {},
  idealActionTexts = {},
}: {
  competencyId: string;
  actionIndex: string;
  stageCompetency?: Competency;
  selectedIdealActions?: Record<string, string[]> | null;
  idealActionTexts?: Record<string, string[]> | null;
}): string {
  const stageActionText = stageCompetency?.description?.[actionIndex];
  if (stageActionText) {
    return stageActionText;
  }

  const selectedActions = (selectedIdealActions?.[competencyId] || []).map((value) => String(value));
  const actionTexts = idealActionTexts?.[competencyId] || [];
  const actionPosition = selectedActions.findIndex((value) => value === actionIndex);

  if (actionPosition >= 0 && actionTexts[actionPosition]) {
    return actionTexts[actionPosition];
  }

  const numericIndex = Number(actionIndex);
  if (Number.isInteger(numericIndex)) {
    if (numericIndex >= 0 && actionTexts[numericIndex]) {
      return actionTexts[numericIndex];
    }
    if (numericIndex > 0 && actionTexts[numericIndex - 1]) {
      return actionTexts[numericIndex - 1];
    }
  }

  return `行動 ${actionIndex}`;
}
