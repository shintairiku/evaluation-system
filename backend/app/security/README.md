# Security Module Documentation

This module contains all authentication and authorization logic for the HR Evaluation System.

## 🚀 Quick Start

**Need simple permission check?** → Use decorators: `@require_permission(Permission.USER_MANAGE)`  
**Need data filtering by role?** → Use RBACHelper: `await RBACHelper.get_accessible_user_ids(auth_context)`  
**Need to add new permission?** → [Adding New Permissions](#adding-new-permissions)  
**Need new resource type?** → [Adding New Resource Types](#adding-new-resource-types-rbac_typespy)  
**Need to check permissions in code?** → [Ultra-Simple Permission Checking](#ultra-simple-permission-checking)  
**Need to use auth in API?** → [FastAPI Dependencies](#2-fastapi-dependencies-dependenciespy)

## 📁 Module Structure

```
backend/app/security/
├── README.md           # This documentation
├── __init__.py         # Module exports
├── context.py          # AuthContext - User authentication & authorization state
├── dependencies.py     # FastAPI dependencies for auth/permissions
├── permissions.py      # Permission and role definitions
├── rbac_types.py       # Resource types and permission mappings for RBAC framework
├── rbac_helper.py      # Standardized RBAC helper for data filtering
└── decorators.py       # Permission checking decorators for service functions
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

### 4. RBAC Framework (`rbac_types.py`, `rbac_helper.py`, `decorators.py`)
**New standardized RBAC framework for consistent permission checking and data filtering.**

#### When to Use Each Component:

**🎯 Use `@decorators` for simple ALLOW/DENY operations:**
```python
from app.security.decorators import require_permission

@require_permission(Permission.USER_MANAGE)
async def delete_user(user_id: UUID, current_user_context: AuthContext):
    # Permission automatically checked - simple ALLOW/DENY
    return await self.user_repo.delete(user_id)
```

**🎯 Use `RBACHelper` for complex data filtering:**
```python
from app.security.rbac_helper import RBACHelper
from app.security.rbac_types import ResourceType

async def get_users(current_user_context: AuthContext):
    # Get users this person can access based on role
    accessible_user_ids = await RBACHelper.get_accessible_user_ids(current_user_context)
    
    # Apply filtering to database query
    if accessible_user_ids is None:
        # Admin: can access all users
        users = await self.user_repo.get_all_users()
    else:
        # Manager/Employee: filtered access
        users = await self.user_repo.get_users_by_ids(accessible_user_ids)
```

**🎯 Use `ResourceType` when adding new resource types:**
```python
from app.security.rbac_types import ResourceType

# For new resource types like DOCUMENT, PROJECT, etc.
accessible_doc_ids = await RBACHelper.get_accessible_resource_ids(
    current_user_context, ResourceType.DOCUMENT
)
```

## 🛠 How to Modify RBAC Framework

### When to Modify RBAC Components

**❌ DON'T modify RBAC files for:**
- Simple permission checks (use existing decorators)
- Adding business logic (belongs in services)
- Database queries (belongs in repositories)

**✅ DO modify RBAC files for:**
- Adding new resource types (like DOCUMENT, PROJECT)
- Adding new access patterns not covered by existing framework
- Performance optimizations in permission checking

### Adding New Resource Types (`rbac_types.py`)

**When:** You're building a new feature that needs role-based data filtering (like Documents, Projects, etc.)

**Steps:**
1. **Add to ResourceType enum:**
   ```python
   class ResourceType(Enum):
       # Existing types...
       DOCUMENT = "document"
       PROJECT = "project"
   ```

2. **Add permission mapping:**
   ```python
   PERMISSION_MAP: Dict[ResourceType, Dict[str, Permission]] = {
       # Existing mappings...
       ResourceType.DOCUMENT: {
           "read_all": Permission.DOCUMENT_READ_ALL,
           "read_subordinates": Permission.DOCUMENT_READ_SUBORDINATES, 
           "read_self": Permission.DOCUMENT_READ_SELF,
           "manage": Permission.DOCUMENT_MANAGE
       }
   }
   ```

3. **Remember to add corresponding permissions to `permissions.py` first!**

### Extending RBACHelper (`rbac_helper.py`)

**When:** Current methods don't cover your use case (rare)

**⚠️ IMPORTANT:** Most engineers will NOT need to modify this file. Use existing methods:
- `get_accessible_user_ids()` - for user-based filtering  
- `get_accessible_resource_ids()` - for resource-based filtering
- `can_access_resource()` - for individual resource checks

**If you must add methods:**
1. **Follow the same patterns as existing methods**
2. **Add comprehensive logging and caching**
3. **Update all call sites to use new method**

```python
@staticmethod
async def get_accessible_department_ids(
    auth_context: AuthContext,
    target_department_id: Optional[UUID] = None
) -> Optional[List[UUID]]:
    """Add new filtering method following existing patterns."""
    # Follow same cache key, logging, and error handling patterns
    cache_key = f"accessible_departments_{auth_context.user_id}_{target_department_id}"
    
    if cached_result := resource_access_cache.get(cache_key):
        logger.debug(f"Cache hit for accessible department IDs: {auth_context.user_id}")
        return cached_result
    
    # Implementation following existing patterns...
```

### Adding New Decorators (`decorators.py`)

**When:** You need a reusable permission pattern not covered by existing decorators

**Current decorators (use these first):**
- `@require_permission(Permission.X)` - single permission
- `@require_any_permission([Permission.X, Permission.Y])` - multiple options
- `@require_role("admin")` - role-based

**Adding new decorator example:**
```python
def require_resource_ownership(resource_type: ResourceType):
    """Decorator for resource ownership checks."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            auth_context = extract_auth_context(*args, **kwargs)
            resource_id = kwargs.get('resource_id') or args[0]  # Adapt as needed
            
            can_access = await RBACHelper.can_access_resource(
                auth_context, resource_id, resource_type
            )
            if not can_access:
                raise PermissionDeniedError(f"Cannot access {resource_type.value} {resource_id}")
                
            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

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

### Method 4: Field-Level Permission Validation (Advanced)
```python
# For granular field-level permissions (e.g., UserUpdate validation)
from app.security.rbac_helper import RBACHelper

async def update_user(self, user_id: UUID, user_data: UserUpdate, auth_context: AuthContext):
    # Validate field-level permissions before update
    RBACHelper.validate_user_update_fields(
        auth_context, 
        user_data.model_dump(exclude_none=True), 
        user_id
    )
    
    # Proceed with update - permissions already validated
    return await self.user_repo.update_user(user_id, user_data)
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

### Granular User Update Permissions

The system implements three levels of user update permissions:

**🔹 USER_MANAGE (Admin only)**
- Can update **all fields** in UserUpdate schema
- No restrictions on target users

**🔹 USER_MANAGE_PLUS (Manager/Supervisor)**
- Can update: `name`, `job_title`, `department_id`, `subordinate_ids`
- Cannot modify their own subordinate relationships
- Only applies to subordinates and self

**🔹 USER_MANAGE_BASIC (Employee/Parttime)**
- Can update: `name`, `job_title`, `department_id`
- **Only on their own profile**
- Cannot modify: `email`, `employee_code`, `stage_id`, `role_ids`, `supervisor_id`, `subordinate_ids`, `status`

**Example Usage:**
```python
# Automatically validated in update_user service method
update_data = UserUpdate(
    name="Updated Name",           # ✅ Allowed for all update permissions
    job_title="New Position",      # ✅ Allowed for all update permissions  
    department_id=new_dept_id,     # ✅ Allowed for all update permissions
    employee_code="NEW123",        # ❌ Only USER_MANAGE (admin)
    status="active"                # ❌ Only USER_MANAGE (admin)
)

# RBACHelper validates fields automatically
RBACHelper.validate_user_update_fields(auth_context, update_data.model_dump(), target_user_id)
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

# RBAC Framework imports
from app.security.rbac_helper import RBACHelper
from app.security.rbac_types import ResourceType
from app.security.decorators import require_permission, require_any_permission

# Direct import (if needed)
from app.security.permissions import Permission, PermissionManager
from app.security.context import AuthContext
from app.security.dependencies import get_auth_context, require_role
```

## 🎯 Decision Guide: When to Use What

```mermaid
flowchart TD
    A[Need Permission Control?] --> B{Simple ALLOW/DENY?}
    B -->|Yes| C[Use @decorators]
    B -->|No| D{Data filtering by role?}
    D -->|Yes| E[Use RBACHelper]
    D -->|No| F{Custom logic needed?}
    F -->|Yes| G[Use AuthContext methods]
    F -->|No| H[Consider if really needed]
    
    C --> C1[@require_permission<br/>@require_any_permission]
    E --> E1[RBACHelper.get_accessible_user_ids<br/>RBACHelper.get_accessible_resource_ids]
    G --> G1[auth_context.has_permission<br/>auth_context.require_permission]
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

### Issue: Frontend sending forbidden fields in user update requests
**Symptom**: Error like `"Insufficient permission to update fields: employee_code, status, stage_id, email"`
**Cause**: Frontend is sending all form fields instead of only changed fields
**Solution**: Modify frontend to filter fields before sending:
```typescript
// ❌ BAD - Sends all fields
const userData: UserUpdate = {
  name: formData.get('name') as string,
  email: formData.get('email') as string,     // Always sent!
  employee_code: formData.get('employee_code') as string,  // Always sent!
  // ... all fields always sent
};

// ✅ GOOD - Only send changed fields
const userData: UserUpdate = {};
const name = formData.get('name') as string;
if (name && name !== user.name) {
  userData.name = name;  // Only if changed
}
// ... repeat for all fields
```

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
- **After**: 15 consolidated permissions in 3 files + no resource-specific methods + RBAC framework
- **Result**: Engineers add 1-2 lines per service method instead of extending AuthContext
- **Backward compatibility**: `SecurityContext` alias maintained for existing code

### Migrating Existing Services to RBAC Framework

**Before (complex individual implementation):**
```python
async def get_users(self, current_user_context: AuthContext):
    # Complex if-elif-else chains in every service
    user_ids_to_filter = None
    
    if current_user_context.has_permission(Permission.USER_READ_ALL):
        user_ids_to_filter = None
    elif current_user_context.has_permission(Permission.USER_READ_SUBORDINATES):
        subordinate_users = await self.user_repo.get_subordinates(
            current_user_context.user_id
        )
        user_ids_to_filter = [user.id for user in subordinate_users]
    elif current_user_context.has_permission(Permission.USER_READ_SELF):
        user_ids_to_filter = [current_user_context.user_id]
    else:
        current_user_context.require_any_permission([...])
```

**After (using RBAC framework):**
```python
from app.security.rbac_helper import RBACHelper

async def get_users(self, current_user_context: AuthContext):
    # Single line replaces complex logic
    user_ids_to_filter = await RBACHelper.get_accessible_user_ids(current_user_context)
    
    # Use the result in repository call
    if user_ids_to_filter is None:
        users = await self.user_repo.get_all_users()
    else:
        users = await self.user_repo.get_users_by_ids(user_ids_to_filter)
```

### Integration with Service Layer

**When services are initialized, connect RBACHelper to repositories:**

```python
# In service constructor or initialization
class UserService:
    def __init__(self, session: AsyncSession):
        self.user_repo = UserRepository(session)
        
        # Enable RBACHelper to query subordinate relationships
        RBACHelper.initialize_with_repository(self.user_repo)
```

### Performance Considerations

The RBAC framework includes built-in caching:
- **Subordinate relationships**: 5-minute TTL (stable data)
- **Resource access results**: 2-minute TTL (frequently accessed)

**Cache management:**
```python
# Clear cache when permissions change
RBACHelper.clear_cache(user_id)  # Clear specific user
RBACHelper.clear_cache()         # Clear all caches
```