"""
Test suite for RBAC Decorators - Permission checking decorators for service functions.

This test suite verifies:
- @require_permission decorator functionality
- @require_any_permission decorator functionality
- @require_role decorator functionality
- AuthContext extraction utility
- Error handling and logging
- Both async and sync function support
"""

import pytest
import asyncio
import inspect
from uuid import UUID, uuid4
from unittest.mock import Mock, patch, AsyncMock

from app.security.decorators import (
    require_permission, 
    require_any_permission, 
    require_role,
    extract_auth_context
)
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.core.exceptions import PermissionDeniedError


class TestAuthContextExtraction:
    """Test suite for extract_auth_context utility function"""
    
    @pytest.fixture
    def sample_auth_context(self):
        """Create sample AuthContext for testing"""
        roles = [RoleInfo(id=1, name="admin", description="Administrator")]
        return AuthContext(
            user_id=uuid4(),
            clerk_user_id="admin_123",
            roles=roles
        )
    
    def test_extract_from_keyword_current_user_context(self, sample_auth_context):
        """Test extracting AuthContext from 'current_user_context' keyword argument"""
        result = extract_auth_context(current_user_context=sample_auth_context)
        assert result == sample_auth_context
    
    def test_extract_from_keyword_auth_context(self, sample_auth_context):
        """Test extracting AuthContext from 'auth_context' keyword argument"""
        result = extract_auth_context(auth_context=sample_auth_context)
        assert result == sample_auth_context
    
    def test_extract_from_keyword_user_context(self, sample_auth_context):
        """Test extracting AuthContext from 'user_context' keyword argument"""
        result = extract_auth_context(user_context=sample_auth_context)
        assert result == sample_auth_context
    
    def test_extract_from_keyword_context(self, sample_auth_context):
        """Test extracting AuthContext from 'context' keyword argument"""
        result = extract_auth_context(context=sample_auth_context)
        assert result == sample_auth_context
    
    def test_extract_from_positional_arguments(self, sample_auth_context):
        """Test extracting AuthContext from positional arguments"""
        result = extract_auth_context("other_arg", sample_auth_context, "another_arg")
        assert result == sample_auth_context
    
    def test_extract_prioritizes_keywords_over_positional(self, sample_auth_context):
        """Test that keyword arguments take priority over positional"""
        other_context = AuthContext(user_id=uuid4(), roles=[])
        
        result = extract_auth_context(
            other_context,  # positional
            current_user_context=sample_auth_context  # keyword
        )
        assert result == sample_auth_context  # Should use keyword version
    
    def test_extract_with_non_auth_context_keyword(self, sample_auth_context):
        """Test that non-AuthContext values in keywords are ignored"""
        result = extract_auth_context(
            current_user_context="not_an_auth_context",  # Wrong type
            auth_context=sample_auth_context  # Correct type
        )
        assert result == sample_auth_context
    
    def test_extract_fails_when_no_auth_context_found(self):
        """Test ValueError when no AuthContext is found"""
        with pytest.raises(ValueError) as exc_info:
            extract_auth_context("arg1", "arg2", param1="value1", param2="value2")
        
        assert "No AuthContext found in function arguments" in str(exc_info.value)
    
    def test_extract_fails_with_wrong_type_in_positional(self):
        """Test ValueError when positional args don't contain AuthContext"""
        with pytest.raises(ValueError):
            extract_auth_context("string_arg", 123, {"key": "value"})


class TestRequirePermissionDecorator:
    """Test suite for @require_permission decorator"""
    
    @pytest.fixture
    def admin_auth_context(self):
        """AuthContext with admin permissions"""
        roles = [RoleInfo(id=1, name="admin", description="Administrator")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.fixture
    def employee_auth_context(self):
        """AuthContext with employee permissions"""
        roles = [RoleInfo(id=4, name="employee", description="Employee")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.mark.asyncio
    async def test_async_function_with_valid_permission(self, admin_auth_context):
        """Test decorator on async function with valid permission"""
        @require_permission(Permission.USER_MANAGE)
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        result = await test_function(current_user_context=admin_auth_context)
        assert result == "success"
    
    @pytest.mark.asyncio
    async def test_async_function_with_invalid_permission(self, employee_auth_context):
        """Test decorator on async function with invalid permission"""
        @require_permission(Permission.USER_MANAGE)
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        with pytest.raises(PermissionDeniedError) as exc_info:
            await test_function(current_user_context=employee_auth_context)
        
        assert "Permission denied: user:manage" in str(exc_info.value)
    
    def test_sync_function_with_valid_permission(self, admin_auth_context):
        """Test decorator on sync function with valid permission"""
        @require_permission(Permission.USER_READ_ALL)
        def test_function(current_user_context: AuthContext):
            return "success"
        
        result = test_function(current_user_context=admin_auth_context)
        assert result == "success"
    
    def test_sync_function_with_invalid_permission(self, employee_auth_context):
        """Test decorator on sync function with invalid permission"""
        @require_permission(Permission.USER_READ_ALL)
        def test_function(current_user_context: AuthContext):
            return "success"
        
        with pytest.raises(PermissionDeniedError) as exc_info:
            test_function(current_user_context=employee_auth_context)
        
        assert "Permission denied: user:read:all" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_decorator_preserves_function_metadata(self):
        """Test that decorator preserves function metadata"""
        @require_permission(Permission.USER_READ_ALL)
        async def original_function(current_user_context: AuthContext):
            """Original docstring"""
            return "result"
        
        assert original_function.__name__ == "original_function"
        assert original_function.__doc__ == "Original docstring"
    
    @pytest.mark.asyncio
    async def test_decorator_with_positional_auth_context(self, admin_auth_context):
        """Test decorator with AuthContext passed as positional argument"""
        @require_permission(Permission.USER_READ_ALL)
        async def test_function(context: AuthContext, other_param: str):
            return f"success with {other_param}"
        
        result = await test_function(admin_auth_context, "test")
        assert result == "success with test"
    
    @pytest.mark.asyncio
    async def test_decorator_with_mixed_arguments(self, admin_auth_context):
        """Test decorator with mix of positional and keyword arguments"""
        @require_permission(Permission.USER_READ_ALL)
        async def test_function(param1: str, current_user_context: AuthContext, param2: int = 10):
            return f"{param1}-{param2}"
        
        result = await test_function("test", current_user_context=admin_auth_context, param2=20)
        assert result == "test-20"
    
    def test_decorator_detects_async_vs_sync_correctly(self):
        """Test that decorator correctly detects async vs sync functions"""
        @require_permission(Permission.USER_READ_ALL)
        async def async_function(current_user_context: AuthContext):
            return "async"
        
        @require_permission(Permission.USER_READ_ALL)
        def sync_function(current_user_context: AuthContext):
            return "sync"
        
        assert inspect.iscoroutinefunction(async_function)
        assert not inspect.iscoroutinefunction(sync_function)
    
    @pytest.mark.asyncio
    async def test_decorator_error_handling_for_missing_context(self):
        """Test decorator error handling when AuthContext is missing"""
        @require_permission(Permission.USER_READ_ALL)
        async def test_function(some_param: str):
            return "success"
        
        with pytest.raises(ValueError) as exc_info:
            await test_function("test")
        
        assert "No AuthContext found in function arguments" in str(exc_info.value)


class TestRequireAnyPermissionDecorator:
    """Test suite for @require_any_permission decorator"""
    
    @pytest.fixture
    def manager_auth_context(self):
        """AuthContext with manager permissions"""
        roles = [RoleInfo(id=2, name="manager", description="Manager")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.fixture
    def employee_auth_context(self):
        """AuthContext with employee permissions"""
        roles = [RoleInfo(id=4, name="employee", description="Employee")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.mark.asyncio
    async def test_async_function_with_one_valid_permission(self, manager_auth_context):
        """Test decorator when user has one of the required permissions"""
        @require_any_permission([Permission.USER_READ_ALL, Permission.USER_READ_SUBORDINATES])
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        result = await test_function(current_user_context=manager_auth_context)
        assert result == "success"
    
    @pytest.mark.asyncio
    async def test_async_function_with_no_valid_permissions(self, employee_auth_context):
        """Test decorator when user has none of the required permissions"""
        @require_any_permission([Permission.USER_READ_ALL, Permission.USER_MANAGE])
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        with pytest.raises(PermissionDeniedError) as exc_info:
            await test_function(current_user_context=employee_auth_context)
        
        assert "Permission denied: requires any of" in str(exc_info.value)
        assert "user:read:all" in str(exc_info.value)
        assert "user:manage" in str(exc_info.value)
    
    def test_sync_function_with_valid_permission(self, manager_auth_context):
        """Test decorator on sync function with valid permission"""
        @require_any_permission([Permission.USER_READ_SUBORDINATES, Permission.USER_READ_ALL])
        def test_function(current_user_context: AuthContext):
            return "success"
        
        result = test_function(current_user_context=manager_auth_context)
        assert result == "success"
    
    def test_sync_function_with_invalid_permissions(self, employee_auth_context):
        """Test decorator on sync function with invalid permissions"""
        @require_any_permission([Permission.USER_READ_ALL, Permission.USER_MANAGE])
        def test_function(current_user_context: AuthContext):
            return "success"
        
        with pytest.raises(PermissionDeniedError):
            test_function(current_user_context=employee_auth_context)
    
    @pytest.mark.asyncio
    async def test_single_permission_list(self, manager_auth_context):
        """Test decorator with single permission in list"""
        @require_any_permission([Permission.USER_READ_SUBORDINATES])
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        result = await test_function(current_user_context=manager_auth_context)
        assert result == "success"
    
    @pytest.mark.asyncio
    async def test_empty_permission_list(self, manager_auth_context):
        """Test decorator with empty permission list"""
        @require_any_permission([])
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        with pytest.raises(PermissionDeniedError):
            await test_function(current_user_context=manager_auth_context)


class TestRequireRoleDecorator:
    """Test suite for @require_role decorator"""
    
    @pytest.fixture
    def admin_auth_context(self):
        """AuthContext with admin role"""
        roles = [RoleInfo(id=1, name="admin", description="Administrator")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.fixture
    def employee_auth_context(self):
        """AuthContext with employee role"""
        roles = [RoleInfo(id=4, name="employee", description="Employee")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.mark.asyncio
    async def test_async_function_with_valid_role(self, admin_auth_context):
        """Test decorator on async function with valid role"""
        @require_role("admin")
        async def test_function(current_user_context: AuthContext):
            return "admin_success"
        
        result = await test_function(current_user_context=admin_auth_context)
        assert result == "admin_success"
    
    @pytest.mark.asyncio
    async def test_async_function_with_invalid_role(self, employee_auth_context):
        """Test decorator on async function with invalid role"""
        @require_role("admin")
        async def test_function(current_user_context: AuthContext):
            return "admin_success"
        
        with pytest.raises(PermissionDeniedError) as exc_info:
            await test_function(current_user_context=employee_auth_context)
        
        assert "Access denied: requires admin role" in str(exc_info.value)
    
    def test_sync_function_with_valid_role(self, admin_auth_context):
        """Test decorator on sync function with valid role"""
        @require_role("admin")
        def test_function(current_user_context: AuthContext):
            return "admin_success"
        
        result = test_function(current_user_context=admin_auth_context)
        assert result == "admin_success"
    
    def test_sync_function_with_invalid_role(self, employee_auth_context):
        """Test decorator on sync function with invalid role"""
        @require_role("admin")
        def test_function(current_user_context: AuthContext):
            return "admin_success"
        
        with pytest.raises(PermissionDeniedError) as exc_info:
            test_function(current_user_context=employee_auth_context)
        
        assert "Access denied: requires admin role" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_case_insensitive_role_check(self, admin_auth_context):
        """Test that role checking is case insensitive"""
        @require_role("ADMIN")  # Uppercase
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        result = await test_function(current_user_context=admin_auth_context)
        assert result == "success"
    
    @pytest.mark.asyncio
    async def test_mixed_case_role_check(self, admin_auth_context):
        """Test with mixed case role name"""
        @require_role("Admin")  # Mixed case
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        result = await test_function(current_user_context=admin_auth_context)
        assert result == "success"


class TestDecoratorLogging:
    """Test suite for decorator logging functionality"""
    
    @pytest.fixture
    def admin_auth_context(self):
        """AuthContext with admin permissions"""
        roles = [RoleInfo(id=1, name="admin", description="Administrator")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.fixture
    def employee_auth_context(self):
        """AuthContext with employee permissions"""
        roles = [RoleInfo(id=4, name="employee", description="Employee")]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @patch('app.security.decorators.logger')
    @pytest.mark.asyncio
    async def test_permission_success_logging(self, mock_logger, admin_auth_context):
        """Test that successful permission checks are logged"""
        @require_permission(Permission.USER_READ_ALL)
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        await test_function(current_user_context=admin_auth_context)
        
        mock_logger.debug.assert_called_once()
        log_call = mock_logger.debug.call_args[0][0]
        assert "Permission check passed" in log_call
        assert "test_function" in log_call
        assert str(admin_auth_context.user_id) in log_call
        assert "user:read:all" in log_call
    
    @patch('app.security.decorators.logger')
    @pytest.mark.asyncio
    async def test_permission_denial_logging(self, mock_logger, employee_auth_context):
        """Test that permission denials are logged"""
        @require_permission(Permission.USER_READ_ALL)
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        with pytest.raises(PermissionDeniedError):
            await test_function(current_user_context=employee_auth_context)
        
        mock_logger.warning.assert_called_once()
        log_call = mock_logger.warning.call_args[0][0]
        assert "Permission denied" in log_call
        assert "test_function" in log_call
        assert str(employee_auth_context.user_id) in log_call
        assert "user:read:all" in log_call
    
    @patch('app.security.decorators.logger')
    @pytest.mark.asyncio
    async def test_role_success_logging(self, mock_logger, admin_auth_context):
        """Test that successful role checks are logged"""
        @require_role("admin")
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        await test_function(current_user_context=admin_auth_context)
        
        mock_logger.debug.assert_called_once()
        log_call = mock_logger.debug.call_args[0][0]
        assert "Role check passed" in log_call
        assert "test_function" in log_call
        assert "admin" in log_call
    
    @patch('app.security.decorators.logger')
    @pytest.mark.asyncio
    async def test_role_denial_logging(self, mock_logger, employee_auth_context):
        """Test that role denials are logged"""
        @require_role("admin")
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        with pytest.raises(PermissionDeniedError):
            await test_function(current_user_context=employee_auth_context)
        
        mock_logger.warning.assert_called_once()
        log_call = mock_logger.warning.call_args[0][0]
        assert "Role denied" in log_call
        assert "test_function" in log_call
        assert "admin" in log_call
    
    @patch('app.security.decorators.logger')
    @pytest.mark.asyncio
    async def test_error_logging_for_exceptions(self, mock_logger, admin_auth_context):
        """Test that unexpected errors are logged"""
        @require_permission(Permission.USER_READ_ALL)
        async def test_function(current_user_context: AuthContext):
            raise RuntimeError("Unexpected error")
        
        with pytest.raises(RuntimeError):
            await test_function(current_user_context=admin_auth_context)
        
        mock_logger.error.assert_called_once()
        log_call = mock_logger.error.call_args[0][0]
        assert "Error in permission decorator" in log_call
        assert "test_function" in log_call


class TestDecoratorIntegration:
    """Test suite for decorator integration scenarios"""
    
    @pytest.fixture
    def multi_role_auth_context(self):
        """AuthContext with multiple roles"""
        roles = [
            RoleInfo(id=2, name="manager", description="Manager"),
            RoleInfo(id=3, name="supervisor", description="Supervisor")
        ]
        return AuthContext(user_id=uuid4(), roles=roles)
    
    @pytest.mark.asyncio
    async def test_multiple_decorators_on_same_function(self, multi_role_auth_context):
        """Test multiple decorators applied to the same function"""
        @require_role("manager")
        @require_permission(Permission.USER_READ_SUBORDINATES)
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        result = await test_function(current_user_context=multi_role_auth_context)
        assert result == "success"
    
    @pytest.mark.asyncio
    async def test_nested_decorator_calls(self, multi_role_auth_context):
        """Test nested function calls with decorators"""
        @require_permission(Permission.USER_READ_SUBORDINATES)
        async def inner_function(current_user_context: AuthContext):
            return "inner_success"
        
        @require_role("manager")
        async def outer_function(current_user_context: AuthContext):
            result = await inner_function(current_user_context=current_user_context)
            return f"outer_{result}"
        
        result = await outer_function(current_user_context=multi_role_auth_context)
        assert result == "outer_inner_success"
    
    @pytest.mark.asyncio
    async def test_decorator_with_complex_function_signature(self):
        """Test decorator with complex function signature"""
        admin_roles = [RoleInfo(id=1, name="admin", description="Administrator")]
        admin_context = AuthContext(user_id=uuid4(), roles=admin_roles)
        
        @require_permission(Permission.USER_MANAGE)
        async def complex_function(
            user_id: UUID,
            current_user_context: AuthContext,
            name: str = "default",
            *args,
            **kwargs
        ):
            return {
                "user_id": user_id,
                "name": name,
                "args": args,
                "kwargs": kwargs
            }
        
        result = await complex_function(
            uuid4(),
            admin_context,
            name="test",
            extra_param="extra_value"
        )
        
        assert result["name"] == "test"
        assert result["args"] == ()
        assert result["kwargs"] == {"extra_param": "extra_value"}


class TestDecoratorErrorHandling:
    """Test suite for decorator error handling edge cases"""
    
    @pytest.mark.asyncio
    async def test_decorator_with_none_auth_context(self):
        """Test decorator behavior with None AuthContext"""
        @require_permission(Permission.USER_READ_ALL)
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        with pytest.raises(ValueError):
            await test_function(current_user_context=None)
    
    @pytest.mark.asyncio
    async def test_decorator_with_invalid_permission_type(self):
        """Test decorator with invalid permission type"""
        admin_roles = [RoleInfo(id=1, name="admin", description="Administrator")]
        admin_context = AuthContext(user_id=uuid4(), roles=admin_roles)
        
        @require_permission("not_a_permission")  # String instead of Permission enum
        async def test_function(current_user_context: AuthContext):
            return "success"
        
        with pytest.raises(AttributeError):
            await test_function(current_user_context=admin_context)
    
    def test_decorator_preserves_original_function_behavior(self):
        """Test that decorator preserves original function behavior"""
        admin_roles = [RoleInfo(id=1, name="admin", description="Administrator")]
        admin_context = AuthContext(user_id=uuid4(), roles=admin_roles)
        
        @require_permission(Permission.USER_READ_ALL)
        def test_function(current_user_context: AuthContext, value: int):
            if value < 0:
                raise ValueError("Value must be positive")
            return value * 2
        
        # Should work normally with valid input
        result = test_function(current_user_context=admin_context, value=5)
        assert result == 10
        
        # Should still raise original exceptions
        with pytest.raises(ValueError) as exc_info:
            test_function(current_user_context=admin_context, value=-1)
        assert "Value must be positive" in str(exc_info.value)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])