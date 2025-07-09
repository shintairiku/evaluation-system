# Security Module Documentation

This module contains all authentication and authorization logic for the HR Evaluation System.

## 🚀 Quick Start

**Need to add permission check?** → Just add: `auth_context.require_permission(Permission.SOME_PERMISSION)`  
**Need to add a new permission?** → [Adding New Permissions](#adding-new-permissions)  
**Need to modify role access?** → [Adding Permissions to Roles](#adding-permissions-to-roles)  
**Need to check permissions in code?** → [Ultra-Simple Permission Checking](#ultra-simple-permission-checking)  
**Need to use auth in API?** → [FastAPI Dependencies](#2-fastapi-dependencies-dependenciespy)

## 📁 Module Structure

```
backend/app/security/
├── README.md           # This documentation
├── __init__.py         # Module exports
├── context.py          # AuthContext - User authentication & authorization state
├── dependencies.py     # FastAPI dependencies for auth/permissions
└── permissions.py      # Permission and role definitions
```

## 🔐 Core Components

### 1. AuthContext (`context.py`)
Ultra-simple authorization context with no resource-specific methods.

```python
from app.security import AuthContext, RoleInfo

# Create auth context
admin_role = RoleInfo(id=1, name="admin", description="Administrator")
context = AuthContext(user_id=user_id, roles=[admin_role])

# Three ways to check permissions:

# Option 1: Simple check
if context.has_permission(Permission.USER_MANAGE):
    # User can manage other users

# Option 2: Helper method (throws exception if denied)
context.require_permission(Permission.USER_MANAGE)

# Option 3: Role checking
if context.is_admin():
    # User is an admin
```

### 2. FastAPI Dependencies (`dependencies.py`)
Use these in your API endpoints for authentication and authorization.

```python
from app.security import get_auth_context, require_role

@router.get("/admin-only")
async def admin_endpoint(
    auth: AuthContext = Depends(get_auth_context)
):
    # All authenticated users can access
    if not auth.is_admin():
        raise HTTPException(403, "Admin required")

@router.get("/managers-only") 
async def manager_endpoint(
    auth: AuthContext = Depends(require_role(["admin", "manager"]))
):
    # Only admins and managers can access
```

### 3. Permissions System (`permissions.py`)
Defines all roles and permissions in the system.

## 🛠 How to Modify Permissions

### Adding New Permissions

1. **Add to Permission Enum**
   ```python
   class Permission(Enum):
       # Existing permissions...
       DOCUMENT_CREATE = "document:create"
       DOCUMENT_READ_ALL = "document:read:all"  
       DOCUMENT_DELETE = "document:delete"
   ```

2. **Follow Naming Convention**
   - Format: `{RESOURCE}_{ACTION}_{SCOPE}`
   - Examples: `USER_READ_ALL`, `GOAL_MANAGE`, `EVALUATION_REVIEW`
   - Use descriptive names that clearly indicate what the permission allows

### Adding Permissions to Roles

1. **Locate the role in ROLE_PERMISSIONS mapping**
2. **Add permissions to the role's permissions set**

```python
Role.ADMIN: RolePermissions(
    role=Role.ADMIN,
    description="管理者 - 全システム機能へのアクセス",
    permissions={
        # Existing permissions...
        Permission.DOCUMENT_CREATE,      # Add new permission
        Permission.DOCUMENT_READ_ALL,    # Add new permission
        Permission.DOCUMENT_DELETE,      # Add new permission
    }
)
```

### Removing Permissions from Roles

1. **Find the role in ROLE_PERMISSIONS mapping**
2. **Remove the permission from the permissions set**
3. **⚠️ Ensure removal doesn't break existing functionality**

### Adding New Roles

1. **Add to Role Enum**
   ```python
   class Role(Enum):
       # Existing roles...
       CONTRACTOR = "contractor"
   ```

2. **Create RolePermissions entry**
   ```python
   ROLE_PERMISSIONS = {
       # Existing roles...
       Role.CONTRACTOR: RolePermissions(
           role=Role.CONTRACTOR,
           description="契約者 - 限定的なアクセス",
           permissions={
               Permission.USER_READ_SELF,
               Permission.GOAL_READ,
               # Add appropriate permissions...
           }
       )
   }
   ```

## 🔍 Ultra-Simple Permission Checking

**The key principle: Engineers add 1-2 lines of permission checking in their service methods.**

### Method 1: Helper Methods (Recommended)
```python
# In any service method - just 1 line!
async def get_user(self, user_id, auth_context: AuthContext):
    auth_context.require_permission(Permission.USER_READ_ALL)
    # Rest of method logic...

async def create_user(self, user_data, auth_context: AuthContext):
    auth_context.require_permission(Permission.USER_MANAGE)
    # Rest of method logic...

# For multiple permissions (any)
async def get_users(self, auth_context: AuthContext):
    auth_context.require_any_permission([
        Permission.USER_READ_ALL,
        Permission.USER_READ_SUBORDINATES,
        Permission.USER_READ_SELF
    ])
    # Rest of method logic...
```

### Method 2: Manual Checking (When you need custom logic)
```python
# In services - engineers add these patterns
async def some_service_method(self, auth_context: AuthContext):
    # Simple permission check
    if not auth_context.has_permission(Permission.USER_READ_ALL):
        raise PermissionDeniedError("You don't have permission to read all users")
    
    # Or with custom logic
    if auth_context.has_permission(Permission.USER_READ_ALL):
        # Access all users
        users = await self.get_all_users()
    elif auth_context.has_permission(Permission.USER_READ_SUBORDINATES):
        # Access subordinates only
        users = await self.get_subordinate_users(auth_context.user_id)
    elif auth_context.has_permission(Permission.USER_READ_SELF):
        # Access self only
        users = [await self.get_user(auth_context.user_id)]
    else:
        raise PermissionDeniedError("Insufficient permissions")
```

### Method 3: Role-Based Checking (When appropriate)
```python
# Simple role check
async def admin_function(self, auth_context: AuthContext):
    auth_context.require_role("admin")
    # Rest of method logic...

# Or manual role check
async def manager_function(self, auth_context: AuthContext):
    if not auth_context.is_manager_or_above():
        raise PermissionDeniedError("Manager role required")
    # Rest of method logic...
```

### Role Hierarchy Checks
```python
# Check role hierarchy
if PermissionManager.is_admin_or_manager(user_role):
    # Admin or manager access

if PermissionManager.is_supervisor_or_above(user_role):
    # Supervisor, manager, or admin access
```

## 📊 Current Role Hierarchy

```
ADMIN       → Full system access (13 permissions)
MANAGER     → Department and subordinate management (11 permissions)  
SUPERVISOR  → Team leadership and goal approval (11 permissions)
VIEWER      → Read-only access to assigned areas (5 permissions)
EMPLOYEE    → Self-management and work tasks (7 permissions)
PARTTIME    → Limited employee access (6 permissions)
```

## 🧪 Testing Permission Changes

After modifying permissions, always:

1. **Run permission tests**
   ```bash
   pytest tests/test_permissions.py -v
   ```

2. **Test integration**
   ```bash
   pytest tests/integration/ -k auth -v
   ```

3. **Manual verification**
   - Create test users with different roles
   - Verify access patterns work as expected
   - Test both positive and negative cases

## 📝 Import Patterns

```python
# Recommended: Import from security module
from app.security import AuthContext, Permission, PermissionManager

# Direct import (if needed)
from app.security.permissions import Permission, PermissionManager
from app.security.context import AuthContext
from app.security.dependencies import get_auth_context, require_role
```

## ⚠️ Important Notes

- **Always test thoroughly** when modifying permissions
- **Consider security implications** - err on the side of being restrictive
- **Update tests** when changing permission structure
- **Document breaking changes** in permission structure
- **Use descriptive names** that are self-explanatory
- **Follow the principle of least privilege** - give users only the permissions they need

## 🆘 Common Issues & Solutions

### Issue: Permission not working in API endpoint
**Solution**: Ensure you're using the correct dependency:
```python
# ✅ Correct
@router.get("/endpoint")
async def endpoint(auth: AuthContext = Depends(get_auth_context)):
    if auth.has_permission(Permission.SOME_PERMISSION):
        # Handle request

# ❌ Incorrect - missing dependency
@router.get("/endpoint") 
async def endpoint():
    # No auth context available
```

### Issue: User has role but not expected permissions
**Solution**: Check the ROLE_PERMISSIONS mapping - the role might not have the expected permission assigned.

### Issue: Tests failing after permission changes
**Solution**: Update test expectations to match the new permission structure.

## 🎯 Key Design Principle

**AuthContext has NO resource-specific methods!**

❌ **Bad (old way)**: AuthContext had methods like `can_access_user()`, `can_modify_user()`, etc.  
✅ **Good (new way)**: Engineers add simple permission checks in their service methods.

```python
# ❌ OLD WAY - AuthContext keeps growing
def can_access_user(self, user_id): ...
def can_modify_user(self, user_id): ...  
def can_access_document(self, doc_id): ...  # Engineers had to add this
def can_modify_document(self, doc_id): ...  # Engineers had to add this
# ... endless methods for every resource type

# ✅ NEW WAY - AuthContext stays minimal forever
async def get_user(self, user_id, auth_context):
    auth_context.require_permission(Permission.USER_READ_ALL)  # Just 1 line!
    # Rest of method logic...
```

## 🔄 Migration Notes

This security module replaces the previous complex RBAC system:
- **Before**: 31 granular permissions across 7 files + resource-specific methods
- **After**: 15 consolidated permissions in 3 files + no resource-specific methods
- **Result**: Engineers add 1-2 lines per service method instead of extending AuthContext
- **Backward compatibility**: `SecurityContext` alias maintained for existing code