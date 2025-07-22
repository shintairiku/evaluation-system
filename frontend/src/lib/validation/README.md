# Validation System Documentation

This directory contains a comprehensive validation system built with Zod and react-hook-form for the HR Evaluation System frontend. The validation system provides type-safe, localized (Japanese) validation for all forms and data structures.

## Overview

The validation system consists of:
- **Schema definitions** for all TypeScript interfaces
- **Form validation schemas** optimized for UI components
- **Utility functions** for validation operations
- **Japanese error messages** for user-friendly feedback
- **React Hook Form integration** for seamless form handling

## Directory Structure

```
src/lib/validation/
├── README.md              # This documentation
├── index.ts               # Main exports file
├── common.ts              # Common validation patterns and utilities
├── user.ts                # User, department, stage, role validation schemas
├── goals.ts               # Goal validation schemas (performance, competency, core value)
├── utils.ts               # Validation utility functions
└── messages.ts            # Japanese error messages and localization
```

## Quick Start

### 1. Basic Form Validation with react-hook-form

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileFormSchema, type ProfileFormData } from '@/lib/validation';

function MyForm() {
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      email: '',
      employee_code: '',
      // ... other fields
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    // data is fully validated and typed
    console.log(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
    </Form>
  );
}
```

### 2. Manual Data Validation

```typescript
import { validateFormData, userCreateSchema } from '@/lib/validation';

const userData = {
  name: '田中太郎',
  email: 'tanaka@company.com',
  employee_code: 'EMP001',
  // ... other fields
};

const result = validateFormData(userCreateSchema, userData);
if (result.success) {
  // result.data contains validated, typed data
  console.log('Valid user data:', result.data);
} else {
  // result.errors contains field-specific error messages
  console.log('Validation errors:', result.errors);
}
```

### 3. Real-time Field Validation

```typescript
import { validateField, profileFormSchema } from '@/lib/validation';

const handleEmailBlur = (email: string) => {
  const result = validateField(profileFormSchema, { email }, 'email');
  if (!result.success) {
    setEmailError(result.error);
  } else {
    setEmailError('');
  }
};
```

## Schema Categories

### Common Schemas (`common.ts`)

Base validation patterns used across the application:

- `uuidSchema` - UUID validation
- `emailSchema` - Email validation
- `nonEmptyStringSchema` - Required string validation
- `employeeCodeSchema` - Employee code validation
- `paginationParamsSchema` - Pagination parameters

### User Schemas (`user.ts`)

Complete validation for user management:

- `userCreateSchema` - User creation form validation
- `userUpdateSchema` - User update form validation
- `profileFormSchema` - Profile form validation (optimized for UI)
- `departmentSchema`, `stageSchema`, `roleSchema` - Related entity validation

### Goal Schemas (`goals.ts`)

Validation for all goal types in the evaluation system:

- `performanceGoalSchema` - Individual performance goal validation
- `performanceGoalsFormSchema` - Complete performance goals form (with weight validation)
- `competencyGoalSchema` - Competency goal validation
- `coreValueGoalSchema` - Core value goal validation
- `goalInputFormSchema` - Complete goal input form validation

## Advanced Features

### 1. Custom Validation with Business Logic

```typescript
import { z } from 'zod';
import { performanceGoalsFormSchema } from '@/lib/validation';

// Custom validation that checks if weights sum to 100%
const customGoalSchema = performanceGoalsFormSchema.refine(
  (data) => {
    const totalWeight = data.goals.reduce((sum, goal) => sum + goal.weight, 0);
    return totalWeight === 100;
  },
  { message: '重みの合計は100%である必要があります' }
);
```

### 2. Conditional Validation

```typescript
import { z } from 'zod';

const conditionalSchema = z.object({
  hasManager: z.boolean(),
  managerId: z.string().optional(),
}).refine(
  (data) => {
    if (data.hasManager) {
      return !!data.managerId;
    }
    return true;
  },
  {
    message: '上司を選択してください',
    path: ['managerId'], // Error will be attached to managerId field
  }
);
```

### 3. Array Validation with Custom Rules

```typescript
import { validateArray, performanceGoalSchema } from '@/lib/validation';

const goals = [
  { id: '1', type: 'quantitative', title: 'Goal 1', /* ... */ },
  { id: '2', type: 'qualitative', title: 'Goal 2', /* ... */ },
];

const results = validateArray(performanceGoalSchema, goals);
results.forEach((result, index) => {
  if (!result.success) {
    console.log(`Goal ${index + 1} validation error:`, result.error);
  }
});
```

## Error Handling and Localization

### Japanese Error Messages

All validation errors are automatically localized to Japanese:

```typescript
import { setJapaneseErrorMap } from '@/lib/validation/messages';

// Set Japanese as default error language (typically in app initialization)
setJapaneseErrorMap();

// Now all Zod validation errors will be in Japanese
const schema = z.string().min(1); // Error: "この項目は必須です"
```

### Custom Error Messages

```typescript
import { VALIDATION_MESSAGES } from '@/lib/validation/messages';

const customSchema = z.string().min(1, { 
  message: VALIDATION_MESSAGES.REQUIRED_FIELD('社員番号') 
});
```

### Error Message Utilities

```typescript
import { formatZodError, zodErrorToFormErrors } from '@/lib/validation';

try {
  schema.parse(invalidData);
} catch (error) {
  if (error instanceof z.ZodError) {
    // Convert to field-specific errors for forms
    const fieldErrors = zodErrorToFormErrors(error);
    
    // Or format for display
    const formattedErrors = formatZodError(error);
  }
}
```

## Integration with React Hook Form

### Complete Form Example

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileFormSchema, type ProfileFormData } from '@/lib/validation';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

function UserProfileForm() {
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      email: '',
      employee_code: '',
      job_title: '',
      department_id: '',
      stage_id: '',
      role_ids: [],
      supervisor_id: '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      // Data is guaranteed to be valid and typed
      const result = await createUser(data);
      console.log('User created:', result);
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>名前 *</FormLabel>
              <FormControl>
                <Input placeholder="山田太郎" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>メールアドレス *</FormLabel>
              <FormControl>
                <Input placeholder="yamada@company.com" {...field} />
              </FormControl>
              <FormDescription>
                会社のメールアドレスを入力してください
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Additional fields... */}
        
        <Button type="submit" disabled={!form.formState.isValid}>
          保存
        </Button>
      </form>
    </Form>
  );
}
```

## Performance Considerations

### 1. Schema Reuse

Schemas are designed to be reusable and performant:

```typescript
// ✅ Good: Reuse schemas
const userSchema = getUserSchema(); // Cached and reused

// ❌ Avoid: Creating schemas repeatedly
const schema = z.object({ name: z.string() }); // New schema each time
```

### 2. Lazy Validation

For complex forms, use lazy validation for better performance:

```typescript
import { z } from 'zod';

const lazyUserSchema = z.lazy(() => userSchema);
```

### 3. Partial Validation

Validate only what's needed for real-time feedback:

```typescript
import { validateField } from '@/lib/validation';

// Validate single field instead of entire form
const result = validateField(userSchema, formData, 'email');
```

## Testing Validation

### Unit Testing Schemas

```typescript
import { describe, test, expect } from 'vitest';
import { profileFormSchema } from '@/lib/validation';

describe('Profile Form Validation', () => {
  test('should validate valid profile data', () => {
    const validData = {
      name: '田中太郎',
      email: 'tanaka@company.com',
      employee_code: 'EMP001',
      department_id: 'dept-123',
      stage_id: 'stage-456',
      role_ids: ['role-789'],
    };

    const result = profileFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('should reject invalid email', () => {
    const invalidData = {
      // ... other fields
      email: 'invalid-email',
    };

    const result = profileFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('メールアドレス');
    }
  });
});
```

## Migration Guide

### From Manual Validation

**Before:**
```typescript
const validateUser = (userData) => {
  const errors = {};
  
  if (!userData.name) {
    errors.name = '名前は必須です';
  }
  
  if (!userData.email || !userData.email.includes('@')) {
    errors.email = '有効なメールアドレスを入力してください';
  }
  
  return { isValid: Object.keys(errors).length === 0, errors };
};
```

**After:**
```typescript
import { validateFormData, userCreateSchema } from '@/lib/validation';

const result = validateFormData(userCreateSchema, userData);
// Automatic validation with type safety and localized messages
```

### From Basic Zod

**Before:**
```typescript
const userSchema = z.object({
  name: z.string().min(1, '名前は必須です'),
  email: z.string().email('有効なメールアドレスを入力してください'),
});
```

**After:**
```typescript
import { userCreateSchema } from '@/lib/validation';
// Pre-built, comprehensive validation with all business rules
```

## Best Practices

### 1. Always Use TypeScript Types

```typescript
import { type ProfileFormData } from '@/lib/validation';

// ✅ Good: Fully typed
const handleSubmit = (data: ProfileFormData) => {
  // TypeScript knows the exact shape of data
};

// ❌ Avoid: Untyped
const handleSubmit = (data: any) => {
  // No type safety
};
```

### 2. Validate Early and Often

```typescript
// Validate on form submission
const onSubmit = form.handleSubmit(async (data) => {
  // data is already validated by react-hook-form + zod
});

// Validate on field blur for immediate feedback
const onBlur = (fieldName: string, value: any) => {
  const result = validateField(schema, { [fieldName]: value }, fieldName);
  if (!result.success) {
    setFieldError(fieldName, result.error);
  }
};
```

### 3. Use Appropriate Schema Granularity

```typescript
// ✅ Good: Specific schemas for specific use cases
import { profileFormSchema } from '@/lib/validation'; // For forms
import { userCreateSchema } from '@/lib/validation';  // For API calls

// ❌ Avoid: One schema for everything
const genericUserSchema = z.object({ /* everything */ });
```

### 4. Handle Errors Gracefully

```typescript
import { zodErrorToFormErrors } from '@/lib/validation';

try {
  const validData = schema.parse(formData);
  // Process valid data
} catch (error) {
  if (error instanceof z.ZodError) {
    const fieldErrors = zodErrorToFormErrors(error);
    // Show field-specific errors to user
  } else {
    // Handle unexpected errors
    console.error('Unexpected validation error:', error);
  }
}
```

## Common Patterns

### 1. Conditional Required Fields

```typescript
const conditionalSchema = z.object({
  type: z.enum(['individual', 'team']),
  individual_id: z.string().optional(),
  team_id: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === 'individual') return !!data.individual_id;
    if (data.type === 'team') return !!data.team_id;
    return true;
  },
  { message: '選択されたタイプに応じて必要な項目を入力してください' }
);
```

### 2. Cross-field Validation

```typescript
const passwordSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  }
);
```

### 3. Dynamic Validation

```typescript
const createDynamicSchema = (config: ValidationConfig) => {
  const baseSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
  });

  if (config.requirePhoneNumber) {
    return baseSchema.extend({
      phone: z.string().min(10),
    });
  }

  return baseSchema;
};
```

## Troubleshooting

### Common Issues

1. **TypeScript Errors with Schema Types**
   ```typescript
   // Make sure to import types correctly
   import { type ProfileFormData } from '@/lib/validation';
   ```

2. **Japanese Characters Not Displaying**
   ```typescript
   // Ensure Japanese error map is set
   import { setJapaneseErrorMap } from '@/lib/validation/messages';
   setJapaneseErrorMap();
   ```

3. **React Hook Form Not Validating**
   ```typescript
   // Make sure zodResolver is properly configured
   const form = useForm({
     resolver: zodResolver(schema), // Must include this
   });
   ```

4. **Performance Issues with Large Forms**
   ```typescript
   // Use mode: 'onBlur' for better performance
   const form = useForm({
     resolver: zodResolver(schema),
     mode: 'onBlur', // Instead of 'onChange'
   });
   ```

## Contributing

When adding new validation schemas:

1. **Follow naming conventions**: `[entity][Action]Schema` (e.g., `userCreateSchema`)
2. **Include Japanese error messages**: Use the message utilities
3. **Add TypeScript types**: Export inferred types for each schema
4. **Update index.ts**: Add exports to the main index file
5. **Add tests**: Include unit tests for new validation logic
6. **Update documentation**: Add examples to this README

## API Reference

See the individual files for detailed API documentation:
- [`common.ts`](./common.ts) - Base validation utilities
- [`user.ts`](./user.ts) - User entity validation
- [`goals.ts`](./goals.ts) - Goal validation schemas
- [`utils.ts`](./utils.ts) - Validation utility functions
- [`messages.ts`](./messages.ts) - Localization and error messages