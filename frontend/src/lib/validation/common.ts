import { z } from 'zod';

// Common validation patterns
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Base schemas for common types
export const uuidSchema = z.string().regex(UUID_REGEX, {
  message: '有効なUUIDを入力してください',
});

export const emailSchema = z.string().email({
  message: '有効なメールアドレスを入力してください',
});

export const nonEmptyStringSchema = z.string().min(1, {
  message: 'この項目は必須です',
});

export const optionalStringSchema = z.string().optional();

export const employeeCodeSchema = z.string().min(1, {
  message: '従業員コードは必須です',
});

// Pagination schemas
export const paginationParamsSchema = z.object({
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    pages: z.number(),
  });

// Base response schemas
export const baseResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const errorResponseSchema = z.object({
  error: z.boolean(),
  message: z.string(),
  status_code: z.number(),
});

// Common validation utilities
export const validateUUID = (value: string): boolean => {
  return UUID_REGEX.test(value);
};

export const validateEmail = (value: string): boolean => {
  return emailSchema.safeParse(value).success;
};

// Custom validation helpers
export const createOptionalSchema = <T extends z.ZodType>(schema: T) => {
  return schema.optional();
};

export const createArraySchema = <T extends z.ZodType>(itemSchema: T) => {
  return z.array(itemSchema);
};

// Form validation utilities
export const createFormErrorMessage = (field: string, error: string): string => {
  return `${field}: ${error}`;
};

export const formatZodError = (error: z.ZodError): Record<string, string> => {
  const formattedErrors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    formattedErrors[path] = err.message;
  });
  
  return formattedErrors;
};

// Status enums
export const submissionStatusSchema = z.enum(['draft', 'submitted'], {
  errorMap: () => ({ message: '有効なステータスを選択してください' }),
});