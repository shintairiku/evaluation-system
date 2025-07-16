# Clerk Authentication Middleware Implementation

## Overview

This document describes the implementation of Clerk authentication middleware for the HR Evaluation System backend (Issue #13). The middleware provides JWT token verification, role-based access control, and authentication dependencies for FastAPI endpoints.

## Branch Information

- **Branch:** `feature/clerk-auth-middleware`
- **Issue:** [#13] Backend Clerk Authentication Middleware Setup
- **Implementation Date:** June 2024
- **Status:** ✅ Complete - Production Ready

## Architecture Overview

The authentication middleware follows a layered architecture:

```
┌─────────────────────────────────────────┐
│            API Endpoints                │
│        (app/api/v1/auth.py)            │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         Dependencies Layer              │
│      (app/dependencies/auth.py)         │
│  - get_current_user()                   │
│  - get_admin_user()                     │
│  - get_supervisor_or_admin_user()       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         Service Layer                   │
│     (app/services/auth_service.py)      │
│  - Token verification                   │
│  - Permission management                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         Core Layer                      │
│       (app/core/auth.py)                │
│  - ClerkAuth class                      │
│  - JWT verification                     │
│  - AuthUser model                       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         Configuration                   │
│     (app/core/clerk_config.py)          │
│  - Environment variable loading         │
│  - Clerk credentials management         │
└─────────────────────────────────────────┘
```

## File Structure

### New Files Created

```
backend/
├── app/
│   ├── core/
│   │   ├── clerk_config.py          # Clerk configuration management
│   │   ├── auth.py                  # Core authentication logic
│   │   └── exceptions.py            # Custom HTTP exceptions
│   ├── dependencies/
│   │   └── auth.py                  # FastAPI authentication dependencies
│   ├── services/
│   │   └── auth_service.py          # Authentication service layer
│   ├── schemas/
│   │   └── auth.py                  # Pydantic schemas for auth
│   └── api/v1/
│       └── auth.py                  # Authentication endpoints
└── tests/
    └── test_auth.py                 # Comprehensive test suite (23 tests)
```

### Modified Files

```
backend/
├── requirements.txt                 # Added Clerk dependencies
├── app/
│   ├── main.py                     # Enhanced FastAPI app with auth
│   └── api/v1/__init__.py          # API router configuration
└── docs/
    └── endpoints.md                # Added /auth/verify documentation
```

## Implementation Details

### 1. Configuration Management (`app/core/clerk_config.py`)

```python
class ClerkConfig:
    def __init__(self, skip_validation: bool = False):
        # Load environment variables from .env file
        self.secret_key = os.getenv("CLERK_SECRET_KEY")
        self.publishable_key = os.getenv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
```

**Features:**
- Loads real Clerk credentials from environment variables
- Validates required configuration on startup
- Supports test mode with `skip_validation=True`
- Uses `python-dotenv` for `.env` file loading

**Environment Variables Required:**
- `CLERK_SECRET_KEY` - Clerk secret key for JWT verification
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key

### 2. Core Authentication (`app/core/auth.py`)

```python
class AuthUser(BaseModel):
    user_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "employee"

class ClerkAuth:
    def verify_token(self, token: str) -> AuthUser:
        payload = jwt.decode(token, self.config.jwt_verification_key, algorithms=["HS256"])
        return AuthUser(...)
```

**Features:**
- JWT token verification using Clerk secret key
- Extracts user information from JWT claims
- Type-safe user model with Pydantic
- Comprehensive error handling

### 3. FastAPI Dependencies (`app/dependencies/auth.py`)

```python
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Basic authentication dependency"""

async def get_admin_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Admin-only access control"""

async def get_supervisor_or_admin_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Supervisor/admin access control"""
```

**Features:**
- Bearer token authentication
- Role-based access control
- Dependency injection for FastAPI endpoints
- Automatic HTTP 401/403 responses for unauthorized access

### 4. Authentication Endpoints (`app/api/v1/auth.py`)

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/auth/signin` | POST | 501 (Not Implemented) | Full signin logic (Issue #36) |
| `/auth/me` | GET | ✅ Working | Get current user info using middleware |
| `/auth/verify` | POST | ✅ Working | JWT token verification |
| `/auth/logout` | POST | 501 (Not Implemented) | Session management (Issue #36) |

**Working Endpoints:**
- `GET /auth/me` - Demonstrates middleware functionality
- `POST /auth/verify` - Validates JWT tokens and returns user info

**Placeholder Endpoints:**
- Return HTTP 501 to indicate implementation needed
- Tracked in separate GitHub issues (#36, #37)

## Dependencies Added

The following packages were added to `requirements.txt`:

```txt
python-jose[cryptography]    # JWT token handling
python-multipart            # Form data parsing
python-dotenv               # Environment variable loading
clerk-backend-sdk           # Official Clerk backend SDK
pydantic[email]             # Email validation
pytest                      # Testing framework
pytest-asyncio              # Async test support
```

## Testing Strategy

### Test Coverage: 23 Tests ✅

The test suite covers all components with **real environment variables**:

```python
@pytest.fixture
def mock_clerk_config():
    """Real Clerk configuration using actual environment variables."""
    return ClerkConfig()

@pytest.fixture 
def mock_jwt_token(mock_clerk_config):
    """JWT token using actual Clerk secret key."""
    payload = {...}
    return jwt.encode(payload, mock_clerk_config.secret_key, algorithm="HS256")
```

**Test Categories:**
- **Configuration Tests** (4 tests) - Environment variable loading, validation
- **Authentication Tests** (7 tests) - JWT verification, token handling
- **Service Layer Tests** (3 tests) - Business logic, permissions  
- **Dependencies Tests** (7 tests) - FastAPI middleware, role checking
- **Schema Tests** (3 tests) - Request/response validation

**Key Testing Principles:**
- ✅ Uses actual Clerk credentials (not mocks)
- ✅ JWT tokens signed with real secret key
- ✅ Tests production configuration
- ✅ Validates real environment integration

## Usage Examples

### Basic Authentication

```python
from app.dependencies.auth import get_current_user

@router.get("/protected")
async def protected_endpoint(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {"user_id": current_user["sub"], "email": current_user["email"]}
```

### Role-Based Access Control

```python
from app.dependencies.auth import get_admin_user, get_supervisor_or_admin_user

@router.delete("/admin-only")
async def admin_only(current_user: Dict[str, Any] = Depends(get_admin_user)):
    return {"message": "Admin access granted"}

@router.get("/supervisor-access")  
async def supervisor_access(current_user: Dict[str, Any] = Depends(get_supervisor_or_admin_user)):
    return {"message": "Supervisor or admin access granted"}
```

### Frontend Integration

```javascript
// Frontend authentication header
const response = await fetch('/api/v1/auth/me', {
  headers: {
    'Authorization': `Bearer ${clerkToken}`
  }
});
```

## Security Considerations

### JWT Token Verification
- ✅ Uses actual Clerk secret key for verification
- ✅ Validates token expiration
- ✅ Extracts user claims securely
- ✅ Handles invalid tokens gracefully

### Role-Based Access Control
- ✅ Three-tier role system: employee → supervisor → admin
- ✅ Dependency injection for automatic authorization
- ✅ HTTP 403 responses for insufficient permissions
- ✅ Clear separation of role logic

### Environment Security
- ✅ Sensitive credentials in environment variables
- ✅ No hardcoded secrets in code
- ✅ Validation of required configuration
- ✅ Secure `.env` file loading

## Error Handling

### Custom Exception Classes

```python
class UnauthorizedError(CustomHTTPException):
    """HTTP 401 - Invalid or missing authentication"""

class PermissionDeniedError(CustomHTTPException):  
    """HTTP 403 - Insufficient permissions"""
```

### Error Response Format

```json
{
  "error": true,
  "message": "Invalid authentication credentials",
  "status_code": 401
}
```

## Integration Points

### FastAPI Application

```python
# app/main.py
from .api.v1 import api_router

app.include_router(api_router)  # Includes /api/v1/auth endpoints
```

### CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
## Docker Configuration

### Dockerfile Updates Required

The authentication middleware implementation uses relative imports which required updating the backend Dockerfile:

**Updated Dockerfile:**
```dockerfile
FROM python:3.12-slim

WORKDIR /backend

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Key Changes:**
- Changed `COPY app/ .` → `COPY . .` to preserve package structure
- Changed `uvicorn main:app` → `python -m uvicorn app.main:app` for proper module resolution
- This fixes `ImportError: attempted relative import with no known parent package`

### Docker Compose Usage

```bash
# Start services
docker compose up --build -d

# Check status
docker compose ps

# View logs
docker compose logs backend
docker compose logs frontend

# Stop services
docker compose down
```

**Services:**
- Frontend: http://localhost:3000 (Next.js with Clerk)
- Backend: http://localhost:8000 (FastAPI with auth middleware)

### Port Conflicts

If you encounter port allocation errors:
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :8000

# Stop conflicting containers
docker stop <container-name>
```

## Deployment Considerations

### Environment Variables
Ensure these are set in production:
```bash
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
```

### Health Checks
```bash
curl http://localhost:8000/health
# Returns: {"status": "healthy"}
```

### API Documentation
FastAPI automatic documentation available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Performance Notes

- JWT verification is stateless (no database calls)
- Dependencies cached per request
- Minimal overhead for authentication
- Suitable for high-traffic production use

## Troubleshooting

### Common Issues

1. **"CLERK_SECRET_KEY environment variable is required"**
   - Solution: Ensure `.env` file exists with proper Clerk credentials

2. **"Invalid authentication credentials"** 
   - Solution: Check JWT token format and Clerk secret key

3. **Tests failing with actual environment variables**
   - Solution: Verify `.env` file is in backend directory

4. **Docker "ImportError: attempted relative import with no known parent package"**
   - Solution: Use updated Dockerfile with proper module structure (see Docker Configuration section)

5. **Port allocation errors in Docker Compose**
   - Solution: Stop conflicting containers or change ports in docker-compose.yml

### Debug Mode

```python
# Enable detailed error logging
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Conclusion

The Clerk authentication middleware provides a robust, production-ready foundation for the HR Evaluation System. It implements:

- ✅ Secure JWT token verification
- ✅ Role-based access control  
- ✅ FastAPI dependency injection
- ✅ Comprehensive test coverage
- ✅ Real environment integration
- ✅ Clean architecture separation

The middleware is ready for immediate use and provides a solid base for implementing the complete authentication system in subsequent issues.

---

**Documentation Version:** 1.0  
**Last Updated:** June 19, 2025  
**Related Issues:** #13 (Complete), #36 (future), #37 (future)