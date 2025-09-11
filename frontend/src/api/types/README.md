# API Types

This directory contains TypeScript interfaces and types that match the backend API schemas.

## Files

### `common.ts`
Common types used across multiple resources:
- `UUID`: String-based UUID type
- `SubmissionStatus`: Enum for draft/submitted states
- `Permission`: Permission interface
- `PaginationParams`: Pagination parameters
- `PaginatedResponse<T>`: Generic paginated response
- `BaseResponse`: Base API response structure
- `ErrorResponse`: Error response structure

### `auth.ts`
Authentication-related types:
- `SignInRequest`: Clerk token signin request
- `SignInResponse`: Signin response with user and tokens
- `TokenData`: Access and refresh token structure
- `UserAuthResponse`: Authenticated user information
- `TokenVerifyRequest/Response`: Token verification types
- `LogoutResponse`: Logout response

### Resource-Specific Type Files

#### Core Resources
- **`user.ts`** - User management and profile types
- **`department.ts`** - Department hierarchy types  
- **`role.ts`** - Role and permission types
- **`stage.ts`** - User stage/level types

#### Evaluation System  
- **`evaluation-period.ts`** - Evaluation period lifecycle types
- **`goal.ts`** - Goal setting and tracking types
- **`competency.ts`** - Competency framework types
- **`self-assessment.ts`** - Employee self-evaluation types
- **`supervisor-review.ts`** - Manager review types
- **`supervisor-feedback.ts`** - Feedback collection types
- **`evaluation.ts`** - Cross-cutting evaluation types

#### Authentication
- **`auth.ts`** - Authentication and session types

### `index.ts`
Re-exports all types for convenient importing

## Usage

### Import Specific Types
```typescript
import { UserDetailResponse, Department, UUID } from '@/api/types';
```

### Import All Types
```typescript
import type * as ApiTypes from '@/api/types';
```

### Type Usage Examples

#### User Creation
```typescript
import { UserCreate, UserStatus } from '@/api/types';

const newUser: UserCreate = {
  name: 'John Doe',
  email: 'john@example.com',
  employee_code: 'EMP001',
  clerk_user_id: 'clerk_123',
  department_id: 'dept-uuid',
  stage_id: 'stage-uuid',
  status: UserStatus.PENDING_APPROVAL
};
```

#### API Response Handling
```typescript
import { ApiResponse, UserDetailResponse } from '@/api/types';

function handleUserResponse(response: ApiResponse<UserDetailResponse>) {
  if (response.success && response.data) {
    console.log('User:', response.data.name);
    console.log('Department:', response.data.department.name);
  }
}
```

#### Pagination
```typescript
import { PaginationParams, PaginatedResponse, UserDetailResponse } from '@/api/types';

const params: PaginationParams = { page: 1, limit: 10 };
const response: PaginatedResponse<UserDetailResponse> = {
  items: users,
  total: 100,
  page: 1,
  limit: 10,
  pages: 10
};
```

## Type Safety Benefits

1. **Compile-time Validation**: Catch type errors before runtime
2. **IDE Support**: Auto-completion and IntelliSense
3. **Refactoring Safety**: Changes propagate throughout codebase
4. **Documentation**: Types serve as inline documentation
5. **Backend Consistency**: Types match backend schemas exactly

## Maintenance

When backend schemas change:
1. Update the corresponding TypeScript interfaces
2. Run type checking: `npm run type-check`
3. Update any affected code
4. Test the changes

The types in this directory should always match the backend Pydantic schemas to ensure consistency across the full stack.

## Type Organization

### Standardized Patterns

Each resource follows a consistent naming pattern:

```typescript
// Base resource type
export interface Resource {
  id: UUID;
  name: string;
  created_at: string;
  updated_at: string;
}

// Detailed view with relations
export interface ResourceDetail extends Resource {
  additional_field: string;
  related_data?: RelatedType[];
}

// Creation request (without generated fields)
export interface ResourceCreate {
  name: string;
  // No id, timestamps auto-generated
}

// Update request (partial fields)
export interface ResourceUpdate {
  name?: string;
  // Optional fields for partial updates
}

// List response with pagination
export interface ResourceList {
  items: Resource[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
```

### Common Type Utilities

```typescript
// UUID type for strong typing
export type UUID = string;

// Pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Standardized API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  errorMessage?: string;
  error?: string; // @deprecated Use errorMessage
}
```

## Integration with Backend

### Schema Synchronization

Our TypeScript types directly mirror the backend Pydantic schemas:

```python
# Backend (Python/Pydantic)
class DepartmentBase(BaseModel):
    name: str
    description: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class Department(DepartmentBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
```

```typescript
// Frontend (TypeScript)
export interface DepartmentBase {
  name: string;
  description?: string;
}

export interface DepartmentCreate extends DepartmentBase {}

export interface Department extends DepartmentBase {
  id: UUID;
  created_at: string;
  updated_at: string;
}
```

### Type Safety Benefits

1. **Compile-time Validation**: Catch mismatches before deployment
2. **IDE Support**: Auto-completion for all API responses  
3. **Refactoring Safety**: Changes propagate across the entire stack
4. **Documentation**: Types serve as living documentation
5. **Backend Consistency**: Guaranteed match with API schemas

## Adding New Types

When adding new resources or modifying existing ones:

1. **Match Backend Schema**: Ensure exact correspondence with Pydantic models
2. **Follow Naming Convention**: Use `Resource`, `ResourceDetail`, `ResourceCreate`, `ResourceUpdate` patterns
3. **Export from Index**: Add to `/types/index.ts` for convenient importing
4. **Update Documentation**: Document new types in this README
5. **Type Check**: Run `npm run type-check` to verify integration

### Example: Adding New Resource Types

```typescript
// /types/example.ts
export interface ExampleBase {
  title: string;
  description: string;
  status: 'draft' | 'published';
}

export interface Example extends ExampleBase {
  id: UUID;
  author_id: UUID;
  created_at: string;
  updated_at: string;
}

export interface ExampleDetail extends Example {
  author: SimpleUser;
  comments: ExampleComment[];
}

export interface ExampleCreate extends ExampleBase {
  author_id: UUID;
}

export interface ExampleUpdate {
  title?: string;
  description?: string;
  status?: 'draft' | 'published';
}

export interface ExampleList {
  items: Example[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
```

## Related Documentation

- [Server Actions](../server-actions/README.md) - How types are used in server actions
- [Endpoints](../endpoints/README.md) - Type usage in endpoint functions
- [Cache System](../README_CACHE.md) - Cached response types