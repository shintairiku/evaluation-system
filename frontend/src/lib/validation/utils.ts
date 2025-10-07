import { z } from 'zod';
import { UseFormSetError, FieldValues } from 'react-hook-form';

/**
 * Utility functions for form validation with Zod and react-hook-form
 */

// Type for form field errors
export type FormErrors<T> = Partial<Record<keyof T, string>>;

/**
 * Convert Zod validation error to form field errors
 * @param error - Zod validation error
 * @returns Object with field names as keys and error messages as values
 */
export const zodErrorToFormErrors = <T>(error: z.ZodError<T>): FormErrors<T> => {
  const formErrors: FormErrors<T> = {};

  error.issues.forEach((err) => {
    const fieldName = err.path.join('.') as keyof T;
    if (!formErrors[fieldName]) {
      formErrors[fieldName] = err.message;
    }
  });

  return formErrors;
};

/**
 * Set form errors using react-hook-form's setError function
 * @param error - Zod validation error
 * @param setError - react-hook-form setError function
 */
export const setFormErrors = <T extends FieldValues>(
  error: z.ZodError<T>,
  setError: UseFormSetError<T>
): void => {
  error.issues.forEach((err) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldName = err.path.join('.') as any;
    setError(fieldName, {
      type: 'manual',
      message: err.message,
    });
  });
};

/**
 * Validate form data with Zod schema and handle errors
 * @param schema - Zod schema
 * @param data - Form data to validate
 * @param setError - Optional react-hook-form setError function
 * @returns Validation result with success flag and parsed data or errors
 */
export const validateFormData = <T, U extends FieldValues>(
  schema: z.ZodSchema<T>,
  data: U,
  setError?: UseFormSetError<U>
): { success: true; data: T } | { success: false; errors: FormErrors<U> } => {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formErrors = zodErrorToFormErrors(error as z.ZodError<U>);
      
      if (setError) {
        setFormErrors(error as z.ZodError<U>, setError);
      }
      
      return { success: false, errors: formErrors };
    }
    
    throw error; // Re-throw non-Zod errors
  }
};

/**
 * Create a safe parse function that returns typed results
 * @param schema - Zod schema
 * @returns Function that safely parses data
 */
export const createSafeParser = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): { success: true; data: T } | { success: false; error: z.ZodError<T> } => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  };
};

/**
 * Validate partial form data (useful for real-time validation)
 * @param schema - Zod schema
 * @param data - Partial form data
 * @param field - Specific field to validate
 * @returns Validation result for the field
 */
export const validateField = <T>(
  schema: z.ZodSchema<T>,
  data: Partial<T>,
  field: keyof T
): { success: true } | { success: false; error: string } => {
  try {
    // Validate the entire data object and check for field-specific errors
    schema.parse(data as T);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldError = error.issues.find(err => err.path.includes(field as string));
      if (fieldError) {
        return {
          success: false,
          error: fieldError.message
        };
      }
      return { success: true }; // Field itself is valid
    }
    return { success: false, error: '予期しないエラーが発生しました' };
  }
};

/**
 * Validate array of items with a schema
 * @param schema - Zod schema for individual items
 * @param items - Array of items to validate
 * @returns Validation results for each item
 */
export const validateArray = <T>(
  schema: z.ZodSchema<T>,
  items: unknown[]
): Array<{ success: true; data: T; index: number } | { success: false; error: z.ZodError<T>; index: number }> => {
  return items.map((item, index) => {
    const result = schema.safeParse(item);
    if (result.success) {
      return { success: true, data: result.data, index };
    } else {
      return { success: false, error: result.error, index };
    }
  });
};

/**
 * Create validation resolver for react-hook-form
 * @param schema - Zod schema
 * @returns Resolver function for react-hook-form
 */
export const createValidationResolver = <T>(schema: z.ZodSchema<T>) => {
  return async (data: T) => {
    try {
      const parsed = await schema.parseAsync(data);
      return { values: parsed, errors: {} };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          values: {},
          errors: zodErrorToFormErrors(error),
        };
      }
      throw error;
    }
  };
};

/**
 * Transform error messages to Japanese
 * @param error - Zod error
 * @returns Error with Japanese messages
 */
export const localizeZodError = <T = unknown>(error: z.ZodError<T>): z.ZodError<T> => {
  const localizedErrors = error.issues.map(err => {
    // Map common Zod error types to Japanese messages
    switch (err.code) {
      case 'invalid_type':
        return { ...err, message: 'この項目は必須です' };

      case 'too_small':
        return { ...err, message: '値が小さすぎます' };

      case 'too_big':
        return { ...err, message: '値が大きすぎます' };

      case 'invalid_format':
        return { ...err, message: '無効な形式です' };

      default:
        return err;
    }
  });

  return new z.ZodError(localizedErrors) as z.ZodError<T>;
};

/**
 * Enhanced validate function with Japanese error messages
 * @param schema - Zod schema
 * @param data - Data to validate
 * @returns Validation result with localized errors
 */
export const validateWithLocalization = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError<T> } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: localizeZodError(result.error) };
  }
};