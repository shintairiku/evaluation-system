import asyncpg
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from ..session import db_session
from ..models.user import UserBase, UserRole, UserSupervisor, UserStatus
from ...schemas.user import UserCreate, UserUpdate
from ...schemas.common import PaginationParams
from ...core.exceptions import NotFoundError, ConflictError, ValidationError


class UserRepository:
    """Repository for user-related database operations"""
    
    def __init__(self):
        self.db = db_session
    
    async def get_by_id(self, user_id: UUID) -> Optional[UserBase]:
        """Get user by ID"""
        query = """
            SELECT * FROM users 
            WHERE id = $1 AND status != 'deleted'
        """
        row = await self.db.fetchrow(query, user_id)
        return UserBase(**dict(row)) if row else None
    
    async def get_by_email(self, email: str) -> Optional[UserBase]:
        """Get user by email address for uniqueness validation"""
        query = """
            SELECT * FROM users 
            WHERE email = $1 AND status != 'deleted'
        """
        row = await self.db.fetchrow(query, email)
        return UserBase(**dict(row)) if row else None
    
    async def get_by_employee_code(self, employee_code: str) -> Optional[UserBase]:
        """Get user by employee code for uniqueness validation"""
        query = """
            SELECT * FROM users 
            WHERE employee_code = $1 AND status != 'deleted'
        """
        row = await self.db.fetchrow(query, employee_code)
        return UserBase(**dict(row)) if row else None
    
    async def get_by_clerk_id(self, clerk_user_id: str) -> Optional[UserBase]:
        """Get user by Clerk user ID"""
        query = """
            SELECT * FROM users 
            WHERE clerk_user_id = $1 AND status != 'deleted'
        """
        row = await self.db.fetchrow(query, clerk_user_id)
        return UserBase(**dict(row)) if row else None
    
    async def get_subordinates(self, supervisor_id: UUID) -> List[UserBase]:
        """Get all subordinates of a supervisor"""
        query = """
            SELECT u.* FROM users u
            INNER JOIN users_supervisors us ON u.id = us.user_id
            WHERE us.supervisor_id = $1 
            AND (us.valid_to IS NULL OR us.valid_to > NOW())
            AND u.status = 'active'
            ORDER BY u.name
        """
        rows = await self.db.fetch(query, supervisor_id)
        return [UserBase(**dict(row)) for row in rows]
    
    async def get_by_department(self, department_id: UUID, pagination: Optional[PaginationParams] = None) -> List[UserBase]:
        """Get all users in a specific department"""
        query = """
            SELECT * FROM users 
            WHERE department_id = $1 AND status = 'active'
            ORDER BY name
        """
        
        if pagination:
            query += f" LIMIT {pagination.limit} OFFSET {pagination.offset}"
        
        rows = await self.db.fetch(query, department_id)
        return [UserBase(**dict(row)) for row in rows]
    
    async def get_by_role(self, role_name: str, pagination: Optional[PaginationParams] = None) -> List[UserBase]:
        """Get all users with a specific role"""
        query = """
            SELECT u.* FROM users u
            INNER JOIN user_roles ur ON u.id = ur.user_id
            INNER JOIN roles r ON ur.role_id = r.id
            WHERE r.name = $1 AND u.status = 'active'
            ORDER BY u.name
        """
        
        if pagination:
            query += f" LIMIT {pagination.limit} OFFSET {pagination.offset}"
        
        rows = await self.db.fetch(query, role_name)
        return [UserBase(**dict(row)) for row in rows]
    
    async def create_user(self, user_data: UserCreate) -> UserBase:
        """Create new user with validation and conflict checking"""
        
        # Check for conflicts
        if await self.get_by_email(user_data.email):
            raise ConflictError(f"User with email {user_data.email} already exists")
        
        if await self.get_by_employee_code(user_data.employee_code):
            raise ConflictError(f"User with employee code {user_data.employee_code} already exists")
        
        if await self.get_by_clerk_id(user_data.clerk_user_id):
            raise ConflictError(f"User with Clerk ID {user_data.clerk_user_id} already exists")
        
        # Insert user
        user_query = """
            INSERT INTO users (
                id, department_id, stage_id, clerk_user_id, name, email, 
                employee_code, status, job_title
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'active', $7
            ) RETURNING *
        """
        
        conn = await self.db.get_connection()
        try:
            async with conn.transaction():
                # Create user
                user_row = await conn.fetchrow(
                    user_query,
                    user_data.department_id,
                    user_data.stage_id,
                    user_data.clerk_user_id,
                    user_data.name,
                    user_data.email,
                    user_data.employee_code,
                    user_data.job_title
                )
                user = UserBase(**dict(user_row))
                
                # Assign roles
                if user_data.role_ids:
                    role_query = "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)"
                    for role_id in user_data.role_ids:
                        await conn.execute(role_query, user.id, role_id)
                
                # Assign supervisor
                if user_data.supervisor_id:
                    supervisor_query = """
                        INSERT INTO users_supervisors (user_id, supervisor_id, valid_from)
                        VALUES ($1, $2, NOW())
                    """
                    await conn.execute(supervisor_query, user.id, user_data.supervisor_id)
                
                return user
        finally:
            await conn.close()
    
    async def update_user(self, user_id: UUID, user_data: UserUpdate) -> Optional[UserBase]:
        """Update user with field validation"""
        
        # Check if user exists
        existing_user = await self.get_by_id(user_id)
        if not existing_user:
            raise NotFoundError(f"User with ID {user_id} not found")
        
        # Check for conflicts if email/employee_code is being updated
        if user_data.email and user_data.email != existing_user.email:
            if await self.get_by_email(user_data.email):
                raise ConflictError(f"User with email {user_data.email} already exists")
        
        if user_data.employee_code and user_data.employee_code != existing_user.employee_code:
            if await self.get_by_employee_code(user_data.employee_code):
                raise ConflictError(f"User with employee code {user_data.employee_code} already exists")
        
        # Build update query dynamically
        update_fields = []
        params = []
        param_count = 1
        
        if user_data.name is not None:
            update_fields.append(f"name = ${param_count}")
            params.append(user_data.name)
            param_count += 1
        
        if user_data.email is not None:
            update_fields.append(f"email = ${param_count}")
            params.append(user_data.email)
            param_count += 1
        
        if user_data.employee_code is not None:
            update_fields.append(f"employee_code = ${param_count}")
            params.append(user_data.employee_code)
            param_count += 1
        
        if user_data.job_title is not None:
            update_fields.append(f"job_title = ${param_count}")
            params.append(user_data.job_title)
            param_count += 1
        
        if user_data.status is not None:
            update_fields.append(f"status = ${param_count}")
            params.append(user_data.status.value)
            param_count += 1
        
        if user_data.department_id is not None:
            update_fields.append(f"department_id = ${param_count}")
            params.append(user_data.department_id)
            param_count += 1
        
        if user_data.stage_id is not None:
            update_fields.append(f"stage_id = ${param_count}")
            params.append(user_data.stage_id)
            param_count += 1
        
        # Use transaction for complex updates
        conn = await self.db.get_connection()
        try:
            async with conn.transaction():
                # Update user fields if any
                if update_fields:
                    update_fields.append(f"updated_at = NOW()")
                    params.append(user_id)
                    
                    query = f"""
                        UPDATE users 
                        SET {', '.join(update_fields)}
                        WHERE id = ${param_count}
                        RETURNING *
                    """
                    
                    user_row = await conn.fetchrow(query, *params)
                    if not user_row:
                        return None
                else:
                    user_row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
                
                # Update roles if provided
                if user_data.role_ids is not None:
                    # Remove existing roles
                    await conn.execute("DELETE FROM user_roles WHERE user_id = $1", user_id)
                    
                    # Add new roles
                    if user_data.role_ids:
                        role_query = "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)"
                        for role_id in user_data.role_ids:
                            await conn.execute(role_query, user_id, role_id)
                
                # Update supervisor if provided
                if user_data.supervisor_id is not None:
                    # Remove existing supervisor relationships
                    await conn.execute("DELETE FROM users_supervisors WHERE user_id = $1", user_id)
                    
                    # Add new supervisor relationship
                    if user_data.supervisor_id:
                        supervisor_query = """
                            INSERT INTO users_supervisors (user_id, supervisor_id, valid_from)
                            VALUES ($1, $2, NOW())
                        """
                        await conn.execute(supervisor_query, user_id, user_data.supervisor_id)
                
                return UserBase(**dict(user_row))
        finally:
            await conn.close()
    
    async def delete_user(self, user_id: UUID) -> bool:
        """Delete user with business rule enforcement"""
        
        # Check if user exists
        existing_user = await self.get_by_id(user_id)
        if not existing_user:
            raise NotFoundError(f"User with ID {user_id} not found")
        
        # Check if user has subordinates (business rule)
        subordinates = await self.get_subordinates(user_id)
        if subordinates:
            raise ValidationError(f"Cannot delete user with {len(subordinates)} subordinates")
        
        # Soft delete by setting status to inactive
        query = """
            UPDATE users 
            SET status = 'inactive', updated_at = NOW()
            WHERE id = $1
        """
        
        result = await self.db.execute(query, user_id)
        return result == "UPDATE 1"
    
    async def search_users(self, search_term: str = "", filters: Dict[str, Any] = None, 
                          pagination: Optional[PaginationParams] = None) -> List[UserBase]:
        """Advanced search with filtering and pagination"""
        
        query = "SELECT * FROM users WHERE status = 'active'"
        params = []
        param_count = 1
        
        # Add search term
        if search_term:
            query += f" AND (name ILIKE ${param_count} OR email ILIKE ${param_count} OR employee_code ILIKE ${param_count})"
            search_pattern = f"%{search_term}%"
            params.extend([search_pattern, search_pattern, search_pattern])
            param_count += 3
        
        # Add filters
        if filters:
            if 'department_id' in filters:
                query += f" AND department_id = ${param_count}"
                params.append(filters['department_id'])
                param_count += 1
            
            if 'status' in filters:
                query += f" AND status = ${param_count}"
                params.append(filters['status'])
                param_count += 1
        
        query += " ORDER BY name"
        
        # Add pagination
        if pagination:
            query += f" LIMIT {pagination.limit} OFFSET {pagination.offset}"
        
        rows = await self.db.fetch(query, *params)
        return [UserBase(**dict(row)) for row in rows]
    
    async def update_last_login(self, user_id: UUID) -> bool:
        """Update user's last login timestamp"""
        query = """
            UPDATE users 
            SET last_login_at = NOW(), updated_at = NOW()
            WHERE id = $1
        """
        
        result = await self.db.execute(query, user_id)
        return result == "UPDATE 1"
    
    async def get_user_roles(self, user_id: UUID) -> List[UserRole]:
        """Get roles for a specific user"""
        query = """
            SELECT ur.* FROM user_roles ur
            INNER JOIN users u ON ur.user_id = u.id
            WHERE ur.user_id = $1 AND u.status = 'active'
        """
        rows = await self.db.fetch(query, user_id)
        return [UserRole(**dict(row)) for row in rows]
    
    async def get_user_supervisors(self, user_id: UUID) -> List[UserSupervisor]:
        """Get supervisors for a specific user"""
        query = """
            SELECT * FROM users_supervisors
            WHERE user_id = $1 
            AND (valid_to IS NULL OR valid_to > NOW())
            ORDER BY valid_from DESC
        """
        rows = await self.db.fetch(query, user_id)
        return [UserSupervisor(**dict(row)) for row in rows]
    
    async def count_users(self, filters: Dict[str, Any] = None) -> int:
        """Count total users with optional filters"""
        query = "SELECT COUNT(*) FROM users WHERE status = 'active'"
        params = []
        param_count = 1
        
        if filters:
            if 'department_id' in filters:
                query += f" AND department_id = ${param_count}"
                params.append(filters['department_id'])
                param_count += 1
        
        return await self.db.fetchval(query, *params)


# Global repository instance
user_repository = UserRepository()
