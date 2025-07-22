import { z } from 'zod';
import { uuidSchema, nonEmptyStringSchema, submissionStatusSchema } from './common';

// Goal type enums
export const goalTypeSchema = z.enum(['performance', 'competency', 'core_value'], {
  errorMap: () => ({ message: '有効な目標タイプを選択してください' }),
});

export const performanceGoalTypeSchema = z.enum(['quantitative', 'qualitative'], {
  errorMap: () => ({ message: '有効なパフォーマンス目標タイプを選択してください' }),
});

// Performance Goal schema
export const performanceGoalSchema = z.object({
  id: z.string().min(1, { message: '目標IDは必須です' }),
  type: performanceGoalTypeSchema,
  title: z.string().min(1, { message: '目標タイトルは必須です' }),
  specificGoal: z.string().min(1, { message: '具体的な目標は必須です' }),
  achievementCriteria: z.string().min(1, { message: '達成基準は必須です' }),
  method: z.string().min(1, { message: '実行方法は必須です' }),
  weight: z.number()
    .min(1, { message: '重みは1%以上である必要があります' })
    .max(100, { message: '重みは100%以下である必要があります' }),
});

// Performance Goals Step form validation
export const performanceGoalsFormSchema = z.object({
  goals: z.array(performanceGoalSchema)
    .min(1, { message: '少なくとも1つの目標を設定してください' })
    .refine(
      (goals) => {
        const totalWeight = goals.reduce((sum, goal) => sum + goal.weight, 0);
        return totalWeight === 100;
      },
      { message: '重みの合計は100%である必要があります' }
    ),
});

// Competency Goal schema
export const competencyGoalSchema = z.object({
  selectedCompetencyId: z.string().min(1, { message: 'コンピテンシーを選択してください' }),
  actionPlan: z.string()
    .min(10, { message: 'アクションプランは10文字以上で入力してください' })
    .max(1000, { message: 'アクションプランは1000文字以内で入力してください' }),
});

// Competency Goals Step form validation
export const competencyGoalsFormSchema = z.object({
  goals: z.array(competencyGoalSchema)
    .min(1, { message: 'コンピテンシー目標を設定してください' }),
});

// Core Value Goal schema
export const coreValueGoalSchema = z.object({
  selectedCoreValueId: z.string().min(1, { message: 'コアバリューを選択してください' }),
  actionPlan: z.string()
    .min(10, { message: 'アクションプランは10文字以上で入力してください' })
    .max(1000, { message: 'アクションプランは1000文字以内で入力してください' }),
  specificBehaviors: z.string()
    .min(10, { message: '具体的な行動は10文字以上で入力してください' })
    .max(500, { message: '具体的な行動は500文字以内で入力してください' }),
});

// Core Value Goals Step form validation
export const coreValueGoalsFormSchema = z.object({
  goals: z.array(coreValueGoalSchema)
    .min(1, { message: 'コアバリュー目標を設定してください' }),
});

// Base Goal interface (for database storage)
export const baseGoalSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  goal_type: goalTypeSchema,
  title: nonEmptyStringSchema,
  description: z.string().optional(),
  status: submissionStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
  evaluation_period_id: uuidSchema.optional(),
});

// Goal with specific data based on type
export const goalWithDetailsSchema = baseGoalSchema.extend({
  // Performance goal specific fields
  performance_data: z.object({
    type: performanceGoalTypeSchema,
    specificGoal: nonEmptyStringSchema,
    achievementCriteria: nonEmptyStringSchema,
    method: nonEmptyStringSchema,
    weight: z.number().min(1).max(100),
  }).optional(),
  
  // Competency goal specific fields
  competency_data: z.object({
    competency_id: uuidSchema,
    actionPlan: nonEmptyStringSchema,
  }).optional(),
  
  // Core value goal specific fields
  core_value_data: z.object({
    core_value_id: uuidSchema,
    actionPlan: nonEmptyStringSchema,
    specificBehaviors: nonEmptyStringSchema,
  }).optional(),
});

// Goal creation schemas
export const createPerformanceGoalSchema = z.object({
  user_id: uuidSchema,
  goal_type: z.literal('performance'),
  title: z.string().min(1, { message: '目標タイトルは必須です' }),
  description: z.string().optional(),
  performance_data: z.object({
    type: performanceGoalTypeSchema,
    specificGoal: z.string().min(1, { message: '具体的な目標は必須です' }),
    achievementCriteria: z.string().min(1, { message: '達成基準は必須です' }),
    method: z.string().min(1, { message: '実行方法は必須です' }),
    weight: z.number().min(1).max(100),
  }),
  evaluation_period_id: uuidSchema.optional(),
});

export const createCompetencyGoalSchema = z.object({
  user_id: uuidSchema,
  goal_type: z.literal('competency'),
  title: z.string().min(1, { message: '目標タイトルは必須です' }),
  description: z.string().optional(),
  competency_data: z.object({
    competency_id: uuidSchema,
    actionPlan: z.string().min(10, { message: 'アクションプランは10文字以上で入力してください' }),
  }),
  evaluation_period_id: uuidSchema.optional(),
});

export const createCoreValueGoalSchema = z.object({
  user_id: uuidSchema,
  goal_type: z.literal('core_value'),
  title: z.string().min(1, { message: '目標タイトルは必須です' }),
  description: z.string().optional(),
  core_value_data: z.object({
    core_value_id: uuidSchema,
    actionPlan: z.string().min(10, { message: 'アクションプランは10文字以上で入力してください' }),
    specificBehaviors: z.string().min(10, { message: '具体的な行動は10文字以上で入力してください' }),
  }),
  evaluation_period_id: uuidSchema.optional(),
});

// Union type for creating any goal
export const createGoalSchema = z.discriminatedUnion('goal_type', [
  createPerformanceGoalSchema,
  createCompetencyGoalSchema,
  createCoreValueGoalSchema,
]);

// Goal update schemas
export const updateGoalSchema = z.object({
  title: z.string().min(1, { message: '目標タイトルは必須です' }).optional(),
  description: z.string().optional(),
  status: submissionStatusSchema.optional(),
  performance_data: z.object({
    type: performanceGoalTypeSchema.optional(),
    specificGoal: z.string().min(1).optional(),
    achievementCriteria: z.string().min(1).optional(),
    method: z.string().min(1).optional(),
    weight: z.number().min(1).max(100).optional(),
  }).optional(),
  competency_data: z.object({
    competency_id: uuidSchema.optional(),
    actionPlan: z.string().min(10).optional(),
  }).optional(),
  core_value_data: z.object({
    core_value_id: uuidSchema.optional(),
    actionPlan: z.string().min(10).optional(),
    specificBehaviors: z.string().min(10).optional(),
  }).optional(),
});

// Goal list/response schemas
export const goalListSchema = z.object({
  goals: z.array(goalWithDetailsSchema),
  total: z.number(),
});

export const goalResponseSchema = z.object({
  success: z.boolean(),
  data: goalWithDetailsSchema.optional(),
  message: z.string().optional(),
});

// Utility validation functions
export const validatePerformanceGoalWeights = (goals: PerformanceGoal[]): boolean => {
  const totalWeight = goals.reduce((sum, goal) => sum + goal.weight, 0);
  return totalWeight === 100;
};

export const validateGoalRequiredFields = (goal: PerformanceGoal): boolean => {
  return !!(goal.title && goal.specificGoal && goal.achievementCriteria && goal.method);
};

export const validateCompetencyGoal = (goal: CompetencyGoal): boolean => {
  return !!(goal.selectedCompetencyId && goal.actionPlan && goal.actionPlan.length >= 10);
};

export const validateCoreValueGoal = (goal: CoreValueGoal): boolean => {
  return !!(
    goal.selectedCoreValueId && 
    goal.actionPlan && 
    goal.actionPlan.length >= 10 &&
    goal.specificBehaviors &&
    goal.specificBehaviors.length >= 10
  );
};

// Form validation for goal input steps
export const goalInputFormSchema = z.object({
  performanceGoals: performanceGoalsFormSchema.optional(),
  competencyGoals: competencyGoalsFormSchema.optional(),
  coreValueGoals: coreValueGoalsFormSchema.optional(),
}).refine(
  (data) => {
    // At least one type of goal must be provided
    return data.performanceGoals || data.competencyGoals || data.coreValueGoals;
  },
  { message: '少なくとも1つのタイプの目標を設定してください' }
);

// Export types
export type GoalType = z.infer<typeof goalTypeSchema>;
export type PerformanceGoalType = z.infer<typeof performanceGoalTypeSchema>;
export type PerformanceGoal = z.infer<typeof performanceGoalSchema>;
export type CompetencyGoal = z.infer<typeof competencyGoalSchema>;
export type CoreValueGoal = z.infer<typeof coreValueGoalSchema>;
export type BaseGoal = z.infer<typeof baseGoalSchema>;
export type GoalWithDetails = z.infer<typeof goalWithDetailsSchema>;
export type CreateGoal = z.infer<typeof createGoalSchema>;
export type UpdateGoal = z.infer<typeof updateGoalSchema>;
export type PerformanceGoalsFormData = z.infer<typeof performanceGoalsFormSchema>;
export type CompetencyGoalsFormData = z.infer<typeof competencyGoalsFormSchema>;
export type CoreValueGoalsFormData = z.infer<typeof coreValueGoalsFormSchema>;
export type GoalInputFormData = z.infer<typeof goalInputFormSchema>;