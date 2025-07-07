# Role-Based Access Control (RBAC) and Secure API Documentation

## Overview

This document describes the implementation of Role-Based Access Control (RBAC) and secure API documentation system for the HR Evaluation System. The implementation provides enhanced security by:

1. **Secure API Documentation** - Protecting API documentation with engineer access keys
2. **Role-Based Access Control** - Flexible endpoint protection based on user roles
3. **Engineer Bypass** - Development mode bypass for testing and debugging

## Table of Contents

- [Configuration](#configuration)
- [Secure API Documentation](#secure-api-documentation)
- [Role-Based Access Control](#role-based-access-control)
- [Engineer Bypass](#engineer-bypass)
- [API Endpoint Protection](#api-endpoint-protection)
- [Usage Examples](#usage-examples)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Configuration

### Environment Variables

The RBAC system requires the following environment variables:

```bash
# Environment mode (development/production)
ENVIRONMENT=development

# Engineer access key (required in development mode)
ENGINEER_ACCESS_KEY=your_secret_engineer_key_here

# Existing Clerk configuration
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

### Configuration Files

- `backend/app/core/rbac_config.py` - RBAC configuration management
- `backend/app/core/secure_docs.py` - Secure documentation endpoints
- `backend/app/dependencies/auth.py` - Authentication dependencies

## Secure API Documentation

### Production Mode
In production mode (`ENVIRONMENT=production`):
- `/docs` returns 404 Not Found
- `/redoc` returns 404 Not Found
- `/openapi.json` returns 404 Not Found

### Development Mode
In development mode (`ENVIRONMENT=development`):
- Secure endpoints are available with engineer access key
- `/secure-docs` - Swagger UI (requires `X-Engineer-Access-Key` header)
- `/secure-redoc` - ReDoc (requires `X-Engineer-Access-Key` header)
- `/secure-openapi.json` - OpenAPI schema (requires `X-Engineer-Access-Key` header)

### Accessing Secure Documentation

```bash
# Using curl
curl -H "X-Engineer-Access-Key: your_secret_engineer_key_here" \
     http://localhost:8000/secure-docs

# Using browser developer tools
# Add header: X-Engineer-Access-Key: your_secret_engineer_key_here
```

## Role-Based Access Control

### Available Roles

The system supports the following roles (in order of permissions):

1. **admin** - Full system access
2. **manager** - Department and subordinate management
3. **supervisor** - Team supervision and evaluation
4. **employee** - Own data and evaluation management
5. **viewer** - Read-only access to assigned data
6. **parttime** - Limited access for part-time employees

### Role Hierarchy

- **Admin** users have access to all endpoints regardless of specific role requirements
- Each role has specific permissions defined in `backend/app/core/permissions.py`
- Higher-level roles typically include lower-level permissions

### Dependency Functions

#### Basic Role Requirements

```python
from app.dependencies.auth import require_role, require_admin

# Require specific role(s)
@router.get("/manager-only")
async def manager_endpoint(user: dict = Depends(require_role(["manager"]))):
    return {"message": "Manager access granted"}

# Require admin role
@router.get("/admin-only")
async def admin_endpoint(user: dict = Depends(require_admin())):
    return {"message": "Admin access granted"}

# Allow multiple roles
@router.get("/supervisor-or-admin")
async def supervisor_endpoint(user: dict = Depends(require_role(["supervisor", "admin"]))):
    return {"message": "Supervisor or admin access granted"}
```

#### Convenience Functions

```python
from app.dependencies.auth import require_supervisor_or_admin, require_manager_or_admin

# Predefined role combinations
@router.get("/supervision-required")
async def supervision_endpoint(user: dict = Depends(require_supervisor_or_admin())):
    return {"message": "Supervision privileges required"}

@router.get("/management-required")
async def management_endpoint(user: dict = Depends(require_manager_or_admin())):
    return {"message": "Management privileges required"}
```

## Engineer Bypass

### Purpose
The engineer bypass allows developers to test all API endpoints without role restrictions during development.

### How It Works
1. **Development Mode Only** - Only active when `ENVIRONMENT=development`
2. **Access Key Required** - Must provide valid `X-Engineer-Access-Key` header
3. **Admin Privileges** - Temporarily grants admin-level access
4. **Automatic Disable** - Automatically disabled in production

### Usage

```bash
# API request with engineer bypass
curl -H "Authorization: Bearer any_token" \
     -H "X-Engineer-Access-Key: your_secret_engineer_key_here" \
     http://localhost:8000/api/v1/admin/roles/

# The system will:
# 1. Check if in development mode
# 2. Validate engineer access key
# 3. Grant admin privileges for the request
# 4. Bypass all role-based restrictions
```

### Security Considerations
- **Never** use engineer bypass in production
- **Always** use strong, unique engineer access keys
- **Rotate** engineer access keys regularly
- **Limit** access to development environment only

## API Endpoint Protection

### Protected Endpoints

#### User Management
- `GET /api/v1/users/` - Role-based filtering applied
- `POST /api/v1/users/` - **Admin only**
- `PUT /api/v1/users/{id}` - **Admin/Manager only**
- `DELETE /api/v1/users/{id}` - **Admin only**

#### Role Management
- `GET /api/v1/admin/roles/` - **Admin only**
- `POST /api/v1/admin/roles/` - **Admin only**
- `PUT /api/v1/admin/roles/{id}` - **Admin only**
- `DELETE /api/v1/admin/roles/{id}` - **Admin only**

#### Department Management
- `GET /api/v1/departments/` - Role-based filtering applied
- `POST /api/v1/departments/` - **Admin only**
- `PUT /api/v1/departments/{id}` - **Admin/Manager only**
- `DELETE /api/v1/departments/{id}` - **Admin only**
- `PUT /api/v1/departments/{id}/manager/{user_id}` - **Admin only**

#### Public Endpoints
- `GET /` - Health check (public)
- `GET /health` - Health check (public)

### Error Responses

#### 401 Unauthorized
```json
{
  "detail": "Invalid authentication credentials: <reason>"
}
```

#### 403 Forbidden
```json
{
  "detail": "Access denied. Required roles: admin, manager"
}
```

#### 404 Not Found (API Documentation)
```json
{
  "detail": "API documentation is not available in this environment"
}
```

## Usage Examples

### 1. Creating a Protected Endpoint

```python
from fastapi import APIRouter, Depends
from app.dependencies.auth import require_role

router = APIRouter()

@router.get("/reports/")
async def get_reports(user: dict = Depends(require_role(["admin", "manager"]))):
    """Get reports - Admin or Manager only."""
    user_role = user.get("role")
    user_id = user.get("sub")
    
    # Implementation here
    return {"reports": [], "user_role": user_role}
```

### 2. Using Engineer Bypass for Testing

```python
# test_endpoints.py
import requests

# Test with engineer bypass
headers = {
    "X-Engineer-Access-Key": "your_secret_engineer_key_here",
    "Authorization": "Bearer dummy_token"
}

response = requests.get("http://localhost:8000/api/v1/admin/roles/", headers=headers)
print(response.status_code)  # Should be 200 or appropriate success code
```

### 3. Accessing Secure Documentation

```html
<!-- In browser, add headers via developer tools -->
<script>
fetch('/secure-docs', {
    headers: {
        'X-Engineer-Access-Key': 'your_secret_engineer_key_here'
    }
})
.then(response => response.text())
.then(html => document.body.innerHTML = html);
</script>
```

## Testing

### Running RBAC Tests

```bash
# Run all RBAC tests
cd backend
python -m pytest tests/test_rbac_implementation.py -v

# Run specific test categories
python -m pytest tests/test_rbac_implementation.py::TestRBACConfig -v
python -m pytest tests/test_rbac_implementation.py::TestSecureDocumentation -v
python -m pytest tests/test_rbac_implementation.py::TestRoleBasedAccess -v
```

### Test Coverage

The test suite covers:
- ✅ RBAC configuration validation
- ✅ Secure documentation access control
- ✅ Role-based endpoint protection
- ✅ Engineer bypass functionality
- ✅ Production vs development mode behavior
- ✅ Error handling and edge cases

## Troubleshooting

### Common Issues

#### 1. Engineer Access Key Not Working
**Problem**: Getting 401 Unauthorized when using engineer access key

**Solutions**:
- Verify `ENVIRONMENT=development` is set
- Check `ENGINEER_ACCESS_KEY` environment variable
- Ensure correct header name: `X-Engineer-Access-Key`
- Verify no typos in the access key

#### 2. API Documentation Not Available
**Problem**: Getting 404 when accessing `/docs`

**Solutions**:
- Check environment mode (docs disabled in production)
- Use secure endpoints in development: `/secure-docs`
- Provide engineer access key header

#### 3. Role-Based Access Denied
**Problem**: Getting 403 Forbidden for endpoints

**Solutions**:
- Verify user has correct role in JWT token
- Check if endpoint requires specific roles
- Ensure JWT token is valid and not expired
- Use engineer bypass for testing (development only)

#### 4. Configuration Errors
**Problem**: Application fails to start with configuration errors

**Solutions**:
- Verify all required environment variables are set
- Check `.env` file is properly loaded
- Ensure `ENGINEER_ACCESS_KEY` is set in development mode
- Validate Clerk configuration variables

### Debug Mode

To enable debug logging for RBAC:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Health Check

Verify the system is working correctly:

```bash
# Check health endpoint (should always work)
curl http://localhost:8000/health

# Check secure docs (development only)
curl -H "X-Engineer-Access-Key: your_key" http://localhost:8000/secure-docs
```

## Security Best Practices

1. **Environment Variables**:
   - Never commit `.env` files to version control
   - Use strong, unique engineer access keys
   - Rotate keys regularly

2. **Production Deployment**:
   - Always set `ENVIRONMENT=production`
   - Remove or invalidate engineer access keys
   - Monitor API access logs

3. **Development**:
   - Use separate keys for each developer
   - Limit engineer bypass to development environment
   - Regularly review and audit access logs

4. **Access Control**:
   - Follow principle of least privilege
   - Regularly review user roles and permissions
   - Monitor for unauthorized access attempts

## Migration from Previous System

### Changes Made

1. **Authentication Dependencies**:
   - Updated `get_current_user()` to support engineer bypass
   - Added `require_role()` factory function
   - Added convenience functions for common role checks

2. **API Documentation**:
   - Disabled default endpoints in production
   - Added secure endpoints with key protection
   - Conditional setup based on environment

3. **Endpoint Protection**:
   - Applied role-based protection to critical endpoints
   - Simplified role checking logic
   - Maintained backward compatibility

### Updating Existing Endpoints

Replace hardcoded role checks:

```python
# Before
@router.get("/admin-only")
async def admin_endpoint(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return {"message": "Success"}

# After
@router.get("/admin-only")
async def admin_endpoint(user: dict = Depends(require_admin())):
    return {"message": "Success"}
```

## Conclusion

The RBAC and secure API documentation system provides:

- **Enhanced Security** - Role-based access control for all endpoints
- **Flexible Protection** - Easy-to-use dependency functions
- **Development Support** - Engineer bypass for testing
- **Production Ready** - Secure documentation and access control
- **Backward Compatibility** - Maintains existing functionality

For additional support or questions, please refer to the codebase documentation or contact the development team. 