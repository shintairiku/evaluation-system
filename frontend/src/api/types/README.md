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

### `user.ts`
User management types:
- `UserStatus`: Enum for user status (active, inactive, pending)
- `Department`, `DepartmentDetail`: Department information
- `Stage`, `StageDetail`: User stage/level information
- `Role`, `RoleDetail`: Role and permission information
- `User*`: Various user-related interfaces (create, update, detail, etc.)

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