export interface StageWeightBudget {
  quantitative: number;
  qualitative: number;
  competency: number;
  stageName?: string;
}

export const DEFAULT_STAGE_WEIGHT_BUDGET: StageWeightBudget = {
  quantitative: 70,
  qualitative: 30,
  competency: 10,
};

export const DEFAULT_ACHIEVEMENT_CRITERIA_EXAMPLE = [
  'SS：上位3%以内に入っている',
  'S：上位10%以内に入っている',
  'A：上位20%以内に入っている',
  'B：上位40%以内に入っている',
  'C：上位60%以内に入っている',
  'D：上位60%未満',
].join('\n');
