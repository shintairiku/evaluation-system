import { z } from 'zod';
import { 
  uuidSchema, 
  emailSchema, 
  nonEmptyStringSchema, 
  optionalStringSchema,
  employeeCodeSchema,
  paginatedResponseSchema
} from './common';

// User status enum schema
export const userStatusSchema = z.enum(['pending_approval', 'active', 'inactive'], {
  message: '有効なユーザーステータスを選択してください',
});

// Department schemas
export const departmentSchema = z.object({
  id: uuidSchema,
  name: nonEmptyStringSchema,
  description: optionalStringSchema,
});

export const departmentCreateSchema = z.object({
  name: z.string().min(1, { message: '部署名は必須です' }),
  description: z.string().optional(),
});

export const departmentUpdateSchema = z.object({
  name: z.string().min(1, { message: '部署名は必須です' }).optional(),
  description: z.string().optional(),
});

export const departmentDetailSchema = departmentSchema.extend({
  created_at: z.string(),
  updated_at: z.string(),
  user_count: z.number().optional(),
  manager_id: uuidSchema.optional(),
  manager_name: z.string().optional(),
  users: paginatedResponseSchema(z.any()).optional(), // Will be defined with userDetailResponseSchema
});

// Stage schemas
export const stageSchema = z.object({
  id: uuidSchema,
  name: nonEmptyStringSchema,
  description: optionalStringSchema,
  quantitative_weight: z.number(),
  qualitative_weight: z.number(),
  competency_weight: z.number(),
});

export const stageCreateSchema = z.object({
  name: z.string().min(1, { message: 'ステージ名は必須です' }),
  description: z.string().optional(),
});

export const stageUpdateSchema = z.object({
  name: z.string().min(1, { message: 'ステージ名は必須です' }).optional(),
  description: z.string().optional(),
});

export const competencySchema = z.object({
  id: uuidSchema,
  name: nonEmptyStringSchema,
  description: optionalStringSchema,
  stage_id: uuidSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const stageDetailSchema = stageSchema.extend({
  created_at: z.string(),
  updated_at: z.string(),
  user_count: z.number().optional(),
  competency_count: z.number().optional(),
  users: paginatedResponseSchema(z.any()).optional(), // Will be defined with userDetailResponseSchema
  competencies: z.array(competencySchema).optional(),
});

// Permission schema
export const permissionSchema = z.object({
  name: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
});

// Role schemas
export const roleSchema = z.object({
  id: uuidSchema,
  name: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  hierarchy_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const roleCreateSchema = z.object({
  name: z.string().min(1, { message: '役職名は必須です' }),
  description: z.string().min(1, { message: '役職の説明は必須です' }),
  hierarchy_order: z.number().optional(),
});

export const roleUpdateSchema = z.object({
  name: z.string().min(1, { message: '役職名は必須です' }).optional(),
  description: z.string().min(1, { message: '役職の説明は必須です' }).optional(),
});

export const roleDetailSchema = roleSchema.extend({
  permissions: z.array(permissionSchema),
  user_count: z.number().optional(),
});

export const roleReorderItemSchema = z.object({
  id: uuidSchema,
  hierarchy_order: z.number(),
});

export const roleReorderRequestSchema = z.object({
  roles: z.array(roleReorderItemSchema),
});

// User base schema
export const userBaseSchema = z.object({
  name: z.string().min(1, { message: '名前は必須です' }),
  email: emailSchema,
  employee_code: employeeCodeSchema,
  job_title: z.string().optional(),
});

// User create schema
export const userCreateSchema = userBaseSchema.extend({
  clerk_user_id: z.string().min(1, { message: 'Clerk User IDは必須です' }),
  department_id: uuidSchema.optional(),
  stage_id: uuidSchema.optional(),
  role_ids: z.array(uuidSchema).min(1, { message: '少なくとも1つの役職を選択してください' }),
  supervisor_id: uuidSchema.optional(),
  subordinate_ids: z.array(uuidSchema),
  status: userStatusSchema.optional(),
});

// User update schema
export const userUpdateSchema = z.object({
  name: z.string().min(1, { message: '名前は必須です' }).optional(),
  email: emailSchema.optional(),
  employee_code: employeeCodeSchema.optional(),
  job_title: z.string().optional(),
  department_id: uuidSchema.optional(),
  stage_id: uuidSchema.optional(),
  role_ids: z.array(uuidSchema).min(1, { message: '少なくとも1つの役職を選択してください' }).optional(),
  supervisor_id: uuidSchema.optional(),
  subordinate_ids: z.array(uuidSchema),
  status: userStatusSchema.optional(),
});

// User in database schema
export const userInDBSchema = userBaseSchema.extend({
  id: uuidSchema,
  clerk_user_id: z.string(),
  status: userStatusSchema,
  department_id: uuidSchema,
  stage_id: uuidSchema,
  created_at: z.string(),
  updated_at: z.string(),
  last_login_at: z.string().optional(),
});

// User schema (with relations)
export const userSchema = userInDBSchema.extend({
  department: departmentSchema,
  stage: stageSchema,
  roles: z.array(roleSchema),
});

export const goalWeightBudgetSchema = z.object({
  quantitative: z.number(),
  qualitative: z.number(),
  competency: z.number(),
  source: z.enum(['stage', 'user']),
});

// User detail response schema
export const userDetailResponseSchema = z.object({
  id: uuidSchema,
  clerk_user_id: z.string(),
  employee_code: employeeCodeSchema,
  name: z.string(),
  email: emailSchema,
  status: userStatusSchema,
  job_title: z.string().optional(),
  department: departmentSchema.optional(),
  stage: stageSchema.optional(),
  goalWeightBudget: goalWeightBudgetSchema.optional(),
  roles: z.array(roleSchema),
  supervisor: z.lazy(() => userSchema).optional(),
  subordinates: z.array(z.lazy(() => userSchema)).optional(),
});

// User list schema
export const userListSchema = z.object({
  users: z.array(userDetailResponseSchema),
  total: z.number(),
});

// User profile schema
export const userProfileSchema = userDetailResponseSchema.extend({
  last_login_at: z.string().optional(),
});

// User profile option schema
export const userProfileOptionSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  email: emailSchema,
  employee_code: employeeCodeSchema,
  job_title: z.string().optional(),
  roles: z.array(roleSchema),
});

// User exists response schema
export const userExistsResponseSchema = z.object({
  exists: z.boolean(),
  user_id: uuidSchema.optional(),
  name: z.string().optional(),
  email: emailSchema.optional(),
  status: userStatusSchema.optional(),
});

// Profile options response schema
export const profileOptionsResponseSchema = z.object({
  departments: z.array(departmentSchema),
  stages: z.array(stageSchema),
  roles: z.array(roleSchema),
  users: z.array(userProfileOptionSchema),
});

// Form validation schemas for UI components
export const profileFormSchema = z.object({
  name: z.string().min(1, { message: '名前は必須です' }),
  email: emailSchema,
  employee_code: z.string().min(1, { message: '従業員コードは必須です' }),
  job_title: z.string().optional(),
  department_id: z.string().min(1, { message: '部署を選択してください' }),
  stage_id: z.string().min(1, { message: 'ステージを選択してください' }),
  role_ids: z.array(z.string()).min(1, { message: '少なくとも1つの役職を選択してください' }),
  supervisor_id: z.string().optional(),
});

// Export types
export type UserStatus = z.infer<typeof userStatusSchema>;
export type Department = z.infer<typeof departmentSchema>;
export type DepartmentCreate = z.infer<typeof departmentCreateSchema>;
export type DepartmentUpdate = z.infer<typeof departmentUpdateSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type StageCreate = z.infer<typeof stageCreateSchema>;
export type StageUpdate = z.infer<typeof stageUpdateSchema>;
export type Role = z.infer<typeof roleSchema>;
export type RoleCreate = z.infer<typeof roleCreateSchema>;
export type RoleUpdate = z.infer<typeof roleUpdateSchema>;
export type UserBase = z.infer<typeof userBaseSchema>;
export type UserCreate = z.infer<typeof userCreateSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type User = z.infer<typeof userSchema>;
export type UserDetailResponse = z.infer<typeof userDetailResponseSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type ProfileFormData = z.infer<typeof profileFormSchema>;
