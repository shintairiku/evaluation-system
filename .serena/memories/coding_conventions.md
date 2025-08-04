# Coding Conventions and Style Guidelines

## TypeScript/Frontend Conventions

### File Naming
- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Hooks**: camelCase starting with `use` (e.g., `useProfileRedirect.ts`)
- **Utilities**: camelCase (e.g., `error-handling.ts`)
- **Types**: camelCase (e.g., `user.ts`)

### Component Structure
- Use functional components with hooks
- Export as default for main components
- Use named exports for utilities and types
- Components use shadcn/ui library
- Follow React hooks best practices

### API Integration Patterns
```typescript
// 1:1 endpoint mapping example
export const usersApi = {
  getUsers: async (params?: PaginationParams): Promise<ApiResponse<UserList>> => {
    return httpClient.get<UserList>(endpoint);
  },
  // ... other methods
};
```

### Type Safety
- All API interactions use TypeScript interfaces
- Types defined in `/src/api/types/` match backend Pydantic schemas
- Use Zod for form validation
- Consistent `ApiResponse<T>` format

### Import Organization
- External libraries first
- Internal imports second
- Relative imports last

## Python/Backend Conventions

### Code Style
- Follow PEP 8 style guidelines
- Use type hints for all functions
- Service layer pattern for business logic

### Class Structure
```python
class UserService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo
    
    async def get_users(self, pagination: PaginationParams) -> UserList:
        # Business logic here
        return await self.user_repo.get_users(pagination)
```

### Async/Await
- Use async/await for database operations
- Services and repositories are async

## General Conventions

### Documentation
- Use JSDoc for TypeScript functions
- Python docstrings for complex functions
- README files in feature directories

### Error Handling
- Standardized error responses
- Proper HTTP status codes
- Client-side error boundaries

### Security
- Never log or expose secrets
- Clerk authentication throughout
- Proper input validation

### Testing
- Test files co-located with source when appropriate
- Use descriptive test names
- Mock external dependencies