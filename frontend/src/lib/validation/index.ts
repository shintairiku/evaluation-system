// Export all validation schemas and utilities
export * from './common';
export * from './user';
export * from './goals';
export * from './utils';

// Re-export commonly used Zod functions
export { z } from 'zod';
export { zodResolver } from '@hookform/resolvers/zod';

// Common validation patterns for quick access
export {
  uuidSchema,
  emailSchema,
  nonEmptyStringSchema,
  employeeCodeSchema,
  paginationParamsSchema,
  baseResponseSchema,
  errorResponseSchema,
  submissionStatusSchema,
  validateUUID,
  validateEmail,
  formatZodError,
} from './common';

// User validation quick access
export {
  userStatusSchema,
  departmentSchema,
  stageSchema,
  roleSchema,
  userSchema,
  userCreateSchema,
  userUpdateSchema,
  profileFormSchema,
  type ProfileFormData,
  type User,
  type Department,
  type Stage,
  type Role,
} from './user';

// Goal validation quick access
export {
  goalTypeSchema,
  performanceGoalSchema,
  competencyGoalSchema,
  coreValueGoalSchema,
  performanceGoalsFormSchema,
  competencyGoalsFormSchema,
  coreValueGoalsFormSchema,
  goalInputFormSchema,
  validatePerformanceGoalWeights,
  validateGoalRequiredFields,
  validateCompetencyGoal,
  validateCoreValueGoal,
  type PerformanceGoal,
  type CompetencyGoal,
  type CoreValueGoal,
  type PerformanceGoalsFormData,
  type CompetencyGoalsFormData,
  type CoreValueGoalsFormData,
  type GoalInputFormData,
} from './goals';

// Utility functions quick access
export {
  zodErrorToFormErrors,
  setFormErrors,
  validateFormData,
  createSafeParser,
  validateField,
  validateArray,
  createValidationResolver,
  localizeZodError,
  validateWithLocalization,
  type FormErrors,
} from './utils';