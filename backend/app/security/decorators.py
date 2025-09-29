"""
RBAC Decorators - Permission Checking Decorators for Service Functions

This module provides decorators for automatic permission checking in service functions.
These decorators handle simple permission gates (ALLOW/DENY) scenarios, while complex
data filtering should use the RBACHelper class directly.
"""

import logging
import inspect
from functools import wraps
from typing import List, Callable, Any

from .context import AuthContext
from .permissions import Permission
from ..core.exceptions import PermissionDeniedError

logger = logging.getLogger(__name__)


def extract_auth_context(*args, **kwargs) -> AuthContext:
    """
    Extract AuthContext from function arguments.
    
    This utility function looks for AuthContext in various common parameter names
    used across service functions. It supports both positional and keyword arguments.
    
    Common parameter names:
    - current_user_context
    - auth_context
    - user_context
    - context
    
    Returns:
        AuthContext: The extracted authorization context
        
    Raises:
        ValueError: If no AuthContext is found in the arguments
    """
    # Check keyword arguments first (most common case)
    for param_name in ['current_user_context', 'auth_context', 'user_context', 'context']:
        if param_name in kwargs:
            auth_context = kwargs[param_name]
            if isinstance(auth_context, AuthContext):
                return auth_context
    
    # Check positional arguments
    for arg in args:
        if isinstance(arg, AuthContext):
            return arg
    
    # If we reach here, no AuthContext was found
    raise ValueError(
        "No AuthContext found in function arguments. "
        "Ensure the decorated function has a parameter of type AuthContext "
        "named 'current_user_context', 'auth_context', 'user_context', or 'context'"
    )


def require_permission(permission: Permission) -> Callable:
    """
    Decorator that requires a specific permission for function execution.
    
    This decorator automatically extracts the AuthContext from the function arguments
    and checks if the user has the required permission before allowing the function
    to execute.
    
    Usage:
        @require_permission(Permission.USER_MANAGE)
        async def delete_user(user_id: UUID, current_user_context: AuthContext):
            # Function body - permission is automatically checked
            pass
    
    Args:
        permission: The permission required to execute the function
        
    Returns:
        Decorator function that wraps the original function
        
    Raises:
        PermissionDeniedError: If the user lacks the required permission
        ValueError: If no AuthContext is found in function arguments
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            try:
                # Extract AuthContext from function arguments
                auth_context = extract_auth_context(*args, **kwargs)
                
                # Check permission using AuthContext's built-in method
                auth_context.require_permission(permission)
                
                # Log successful permission check
                logger.debug(
                    f"Permission check passed for {func.__name__}: "
                    f"user {auth_context.user_id} has {permission.value}"
                )
                
                # Execute the original function
                return await func(*args, **kwargs)
                
            except PermissionDeniedError as e:
                # Log permission denial
                logger.warning(
                    f"Permission denied for {func.__name__}: "
                    f"user {getattr(auth_context, 'user_id', 'unknown')} lacks {permission.value}"
                )
                raise e
            except Exception as e:
                logger.error(f"Error in permission decorator for {func.__name__}: {e}")
                raise e
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            try:
                # Extract AuthContext from function arguments
                auth_context = extract_auth_context(*args, **kwargs)
                
                # Check permission using AuthContext's built-in method
                auth_context.require_permission(permission)
                
                # Log successful permission check
                logger.debug(
                    f"Permission check passed for {func.__name__}: "
                    f"user {auth_context.user_id} has {permission.value}"
                )
                
                # Execute the original function
                return func(*args, **kwargs)
                
            except PermissionDeniedError as e:
                # Log permission denial
                logger.warning(
                    f"Permission denied for {func.__name__}: "
                    f"user {getattr(auth_context, 'user_id', 'unknown')} lacks {permission.value}"
                )
                raise e
            except Exception as e:
                logger.error(f"Error in permission decorator for {func.__name__}: {e}")
                raise e
        
        # Return appropriate wrapper based on whether the function is async
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def require_any_permission(permissions: List[Permission]) -> Callable:
    """
    Decorator that requires any of the specified permissions for function execution.
    
    This decorator is useful when a function can be accessed by users with different
    permission levels. The user needs only one of the specified permissions.
    
    Usage:
        @require_any_permission([
            Permission.USER_READ_ALL, 
            Permission.USER_READ_SUBORDINATES
        ])
        async def get_user_report(user_id: UUID, current_user_context: AuthContext):
            # Function accessible to both admins and managers
            pass
    
    Args:
        permissions: List of permissions, any of which allows function execution
        
    Returns:
        Decorator function that wraps the original function
        
    Raises:
        PermissionDeniedError: If the user lacks all of the specified permissions
        ValueError: If no AuthContext is found in function arguments
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            try:
                # Extract AuthContext from function arguments
                auth_context = extract_auth_context(*args, **kwargs)
                
                # Check permissions using AuthContext's built-in method
                auth_context.require_any_permission(permissions)
                
                # Log successful permission check
                logger.debug(
                    f"Permission check passed for {func.__name__}: "
                    f"user {auth_context.user_id} has one of {[p.value for p in permissions]}"
                )
                
                # Execute the original function
                return await func(*args, **kwargs)
                
            except PermissionDeniedError as e:
                # Log permission denial
                logger.warning(
                    f"Permission denied for {func.__name__}: "
                    f"user {getattr(auth_context, 'user_id', 'unknown')} lacks any of "
                    f"{[p.value for p in permissions]}"
                )
                raise e
            except Exception as e:
                logger.error(f"Error in permission decorator for {func.__name__}: {e}")
                raise e
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            try:
                # Extract AuthContext from function arguments
                auth_context = extract_auth_context(*args, **kwargs)
                
                # Check permissions using AuthContext's built-in method
                auth_context.require_any_permission(permissions)
                
                # Log successful permission check
                logger.debug(
                    f"Permission check passed for {func.__name__}: "
                    f"user {auth_context.user_id} has one of {[p.value for p in permissions]}"
                )
                
                # Execute the original function
                return func(*args, **kwargs)
                
            except PermissionDeniedError as e:
                # Log permission denial
                logger.warning(
                    f"Permission denied for {func.__name__}: "
                    f"user {getattr(auth_context, 'user_id', 'unknown')} lacks any of "
                    f"{[p.value for p in permissions]}"
                )
                raise e
            except Exception as e:
                logger.error(f"Error in permission decorator for {func.__name__}: {e}")
                raise e
        
        # Return appropriate wrapper based on whether the function is async
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def require_role(role_name: str) -> Callable:
    """
    Decorator that requires a specific role for function execution.
    
    This decorator is useful for functions that should only be accessible
    to users with specific roles (e.g., admin-only functions).
    
    Usage:
        @require_role("admin")
        async def system_maintenance(current_user_context: AuthContext):
            # Only admins can access this function
            pass
    
    Args:
        role_name: The role name required to execute the function
        
    Returns:
        Decorator function that wraps the original function
        
    Raises:
        PermissionDeniedError: If the user lacks the required role
        ValueError: If no AuthContext is found in function arguments
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            try:
                # Extract AuthContext from function arguments
                auth_context = extract_auth_context(*args, **kwargs)
                
                # Check role using AuthContext's built-in method
                auth_context.require_role(role_name)
                
                # Log successful role check
                logger.debug(
                    f"Role check passed for {func.__name__}: "
                    f"user {auth_context.user_id} has role {role_name}"
                )
                
                # Execute the original function
                return await func(*args, **kwargs)
                
            except PermissionDeniedError as e:
                # Log role denial
                logger.warning(
                    f"Role denied for {func.__name__}: "
                    f"user {getattr(auth_context, 'user_id', 'unknown')} lacks role {role_name}"
                )
                raise e
            except Exception as e:
                logger.error(f"Error in role decorator for {func.__name__}: {e}")
                raise e
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            try:
                # Extract AuthContext from function arguments
                auth_context = extract_auth_context(*args, **kwargs)
                
                # Check role using AuthContext's built-in method
                auth_context.require_role(role_name)
                
                # Log successful role check
                logger.debug(
                    f"Role check passed for {func.__name__}: "
                    f"user {auth_context.user_id} has role {role_name}"
                )
                
                # Execute the original function
                return func(*args, **kwargs)
                
            except PermissionDeniedError as e:
                # Log role denial
                logger.warning(
                    f"Role denied for {func.__name__}: "
                    f"user {getattr(auth_context, 'user_id', 'unknown')} lacks role {role_name}"
                )
                raise e
            except Exception as e:
                logger.error(f"Error in role decorator for {func.__name__}: {e}")
                raise e
        
        # Return appropriate wrapper based on whether the function is async
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator