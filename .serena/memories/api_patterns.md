# API Integration Patterns

## Frontend API Architecture

### Directory Structure
```
src/api/
├── client/           # HTTP client with authentication
├── constants/        # API endpoints and configuration  
├── endpoints/        # 1:1 API endpoint functions
├── server-actions/   # Next.js server actions for SSR
├── types/           # TypeScript interfaces
└── hooks/           # Custom API hooks
```

### Usage Patterns

#### Server-Side First Approach
- **Priority**: Use server actions for server components and SSR
- **Client-side**: Use endpoint functions for client interactions
- **File**: `/src/api/server-actions/` for server-side
- **File**: `/src/api/endpoints/` for client-side

#### Type Safety Pattern
```typescript
// Types match backend Pydantic schemas
interface UserDetailResponse {
  id: UUID;
  email: string;
  // ... other fields
}

// Consistent API response format
interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}
```

#### HTTP Client Pattern
```typescript
// Automatic Clerk token injection
export const httpClient = {
  get: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
    // Implementation with Clerk auth
  },
  post: async <T>(endpoint: string, data: any): Promise<ApiResponse<T>> => {
    // Implementation with Clerk auth
  },
  // ... other methods
};
```

#### Endpoint Function Pattern
```typescript
// 1:1 mapping to backend endpoints
export const usersApi = {
  getUsers: async (params?: PaginationParams): Promise<ApiResponse<UserList>> => {
    return httpClient.get<UserList>(API_ENDPOINTS.USERS.LIST);
  },
  
  getUserById: async (userId: UUID): Promise<ApiResponse<UserDetailResponse>> => {
    return httpClient.get<UserDetailResponse>(API_ENDPOINTS.USERS.BY_ID(userId));
  },
  // ... other methods
};
```

## Backend API Architecture

### Logic Flow
1. **Endpoints** (`/app/api/`) - Handle HTTP requests, minimal logic
2. **Services** (`/app/services/`) - Business logic, orchestrate repositories  
3. **Repositories** (`/app/database/`) - Database operations only

### Service Pattern
```python
class UserService:
    def __init__(self, user_repo: UserRepository, dept_repo: DepartmentRepository):
        self.user_repo = user_repo
        self.dept_repo = dept_repo
    
    async def get_detailed_user(self, user_id: UUID) -> UserDetailResponse:
        # Business logic - orchestrate multiple repositories
        user = await self.user_repo.get_by_id(user_id)
        department = await self.dept_repo.get_by_id(user.department_id)
        return UserDetailResponse(user=user, department=department)
```

## Authentication Flow
- **Frontend**: Clerk provides tokens automatically
- **Backend**: Validates Clerk tokens
- **API Client**: Injects auth headers transparently

## Error Handling
- **Consistent Format**: All APIs return `ApiResponse<T>` format
- **Error Boundaries**: Client-side error handling
- **HTTP Status Codes**: Proper status codes from backend