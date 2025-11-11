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
