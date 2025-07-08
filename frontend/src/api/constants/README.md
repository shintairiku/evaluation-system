# API Constants

This directory contains configuration constants and endpoint definitions.

## Files

### `config.ts`
Central configuration for all API-related constants including:

- **API_CONFIG**: Base configuration (URLs, timeouts, retry settings)
- **API_ENDPOINTS**: All backend endpoint paths organized by resource
- **HTTP_STATUS**: HTTP status code constants
- **ERROR_MESSAGES**: Standardized error messages

## Usage

### API Endpoints
```typescript
import { API_ENDPOINTS } from '@/api/constants/config';

// Use endpoint constants
const userEndpoint = API_ENDPOINTS.USERS.BY_ID('user-123');
// Results in: '/users/user-123'

const listEndpoint = API_ENDPOINTS.USERS.LIST;
// Results in: '/users'
```

### Configuration
```typescript
import { API_CONFIG } from '@/api/constants/config';

// Access configuration
console.log(API_CONFIG.BASE_URL); // http://localhost:8000/api/v1
console.log(API_CONFIG.TIMEOUT);  // 30000
```

### HTTP Status Codes
```typescript
import { HTTP_STATUS } from '@/api/constants/config';

if (response.status === HTTP_STATUS.UNAUTHORIZED) {
  // Handle unauthorized
}
```

### Error Messages
```typescript
import { ERROR_MESSAGES } from '@/api/constants/config';

return {
  success: false,
  error: ERROR_MESSAGES.UNAUTHORIZED
};
```

## Endpoint Organization

Endpoints are organized by resource type:

- `AUTH`: Authentication endpoints
- `USERS`: User management endpoints  
- `DEPARTMENTS`: Department endpoints
- `ROLES`: Role management endpoints
- `STAGES`: Stage/level endpoints
- `EVALUATION_PERIODS`: Evaluation period endpoints
- `GOALS`: Goal management endpoints
- `GOAL_CATEGORIES`: Goal category endpoints
- `COMPETENCIES`: Competency endpoints
- `SELF_ASSESSMENTS`: Self-assessment endpoints
- `SUPERVISOR_REVIEWS`: Supervisor review endpoints
- `SUPERVISOR_FEEDBACKS`: Supervisor feedback endpoints

## Dynamic Endpoints

Many endpoints accept parameters:

```typescript
// Static endpoint
API_ENDPOINTS.USERS.LIST // '/users'

// Dynamic endpoint with ID
API_ENDPOINTS.USERS.BY_ID('123') // '/users/123'

// Dynamic endpoint with multiple params
API_ENDPOINTS.GOALS.BY_USER('user-123') // '/goals/user/user-123'
```