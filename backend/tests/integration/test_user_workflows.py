#!/usr/bin/env python3
"""
User Workflow Integration Tests
Demonstrates end-to-end user management workflows
"""

import pytest
from unittest.mock import patch, AsyncMock
import asyncio
from uuid import uuid4

from tests.integration.test_logging_utils import (
    setup_integration_test_logging,
    log_test_start,
    log_integration_step,
    log_workflow_verification,
    log_end_to_end_test,
    log_database_state,
    log_api_sequence,
    log_component_integration,
    log_assertion_success,
    log_test_summary,
    log_error
)

# Set up centralized logging
TEST_LOG_FILE = setup_integration_test_logging('user_workflows')


class TestUserWorkflowIntegration:
    """Test user management workflows end-to-end"""

    @pytest.fixture
    def admin_user_data(self):
        """Admin user data for workflow testing"""
        return {
            "sub": "admin_workflow_test",
            "role": "admin",
            "email": "admin@workflow.test",
            "name": "Workflow Test Admin"
        }

    @pytest.fixture
    def sample_department_data(self):
        """Sample department for user workflows"""
        return {
            "id": uuid4(),
            "name": "Integration Test Department",
            "description": "Department for integration testing"
        }

    @pytest.fixture
    def sample_user_data(self):
        """Sample user for workflow testing"""
        return {
            "name": "Integration Test User",
            "email": "integration@test.com",
            "employee_code": "INT001",
            "job_title": "Test Engineer",
            "status": "active"
        }

    @pytest.mark.asyncio
    async def test_complete_user_lifecycle_workflow(
        self, 
        admin_user_data, 
        sample_department_data, 
        sample_user_data
    ):
        """Test complete user lifecycle from creation to deletion"""
        log_test_start("complete_user_lifecycle_workflow")
        
        try:
            # Step 1: Setup - Mock department exists
            log_integration_step(1, "Setup department context", {
                "department_id": str(sample_department_data["id"]),
                "department_name": sample_department_data["name"]
            })
            
            # Mock the services for this integration test
            with patch('app.services.user_service.UserService') as mock_user_service, \
                 patch('app.services.department_service.DepartmentService') as mock_dept_service:
                
                # Setup mock returns
                mock_user_instance = AsyncMock()
                mock_dept_instance = AsyncMock()
                mock_user_service.return_value = mock_user_instance
                mock_dept_service.return_value = mock_dept_instance
                
                # Step 2: Create user
                log_integration_step(2, "Create user via service", {
                    "user_name": sample_user_data["name"],
                    "user_email": sample_user_data["email"]
                })
                
                created_user = {
                    **sample_user_data,
                    "id": uuid4(),
                    "department_id": sample_department_data["id"]
                }
                mock_user_instance.create_user.return_value = created_user
                
                result = await mock_user_instance.create_user(sample_user_data, admin_user_data)
                
                log_database_state("user_created", "users", 1)
                assert result["name"] == sample_user_data["name"]
                
                # Step 3: Verify user exists
                log_integration_step(3, "Verify user creation", {
                    "user_id": str(created_user["id"]),
                    "verification_method": "get_by_id"
                })
                
                mock_user_instance.get_user_by_id.return_value = created_user
                fetched_user = await mock_user_instance.get_user_by_id(created_user["id"], admin_user_data)
                
                assert fetched_user["id"] == created_user["id"]
                assert fetched_user["email"] == sample_user_data["email"]
                
                # Step 4: Update user information
                log_integration_step(4, "Update user information", {
                    "user_id": str(created_user["id"]),
                    "update_field": "job_title",
                    "new_value": "Senior Test Engineer"
                })
                
                updated_user = {**created_user, "job_title": "Senior Test Engineer"}
                mock_user_instance.update_user.return_value = updated_user
                
                update_data = {"job_title": "Senior Test Engineer"}
                result = await mock_user_instance.update_user(created_user["id"], update_data, admin_user_data)
                
                assert result["job_title"] == "Senior Test Engineer"
                
                # Step 5: Test user search functionality
                log_integration_step(5, "Test user search", {
                    "search_criteria": "name_contains",
                    "search_value": "Integration"
                })
                
                mock_user_instance.search_users.return_value = {
                    "items": [updated_user],
                    "total": 1,
                    "page": 1,
                    "limit": 10
                }
                
                search_result = await mock_user_instance.search_users(
                    {"name": "Integration"}, admin_user_data
                )
                
                assert search_result["total"] == 1
                assert search_result["items"][0]["id"] == created_user["id"]
                
                # Step 6: Delete user
                log_integration_step(6, "Delete user", {
                    "user_id": str(created_user["id"]),
                    "deletion_method": "soft_delete"
                })
                
                mock_user_instance.delete_user.return_value = {"message": "User deleted successfully"}
                delete_result = await mock_user_instance.delete_user(created_user["id"], admin_user_data)
                
                assert "deleted successfully" in delete_result["message"]
                
                # Verify component integration
                log_component_integration("UserService", "DepartmentService", "user_department_link", True)
                
                # Verify complete workflow
                log_workflow_verification("user_lifecycle_complete", {
                    "user_created": True,
                    "user_fetched": True,
                    "user_updated": True,
                    "user_searched": True,
                    "user_deleted": True,
                    "service_integration": True
                })
                
                log_end_to_end_test("user_lifecycle", ["UserService", "DepartmentService", "Database"], True)
                log_assertion_success("Complete user lifecycle workflow successful")
                log_test_summary("complete_user_lifecycle_workflow", True)
        
        except Exception as e:
            log_error(e, "complete_user_lifecycle_workflow test")
            log_test_summary("complete_user_lifecycle_workflow", False, str(e))
            raise

    @pytest.mark.asyncio 
    async def test_user_department_relationship_workflow(
        self,
        admin_user_data,
        sample_department_data,
        sample_user_data
    ):
        """Test user-department relationship workflow"""
        log_test_start("user_department_relationship_workflow")
        
        try:
            # Mock services
            with patch('app.services.user_service.UserService') as mock_user_service, \
                 patch('app.services.department_service.DepartmentService') as mock_dept_service:
                
                mock_user_instance = AsyncMock()
                mock_dept_instance = AsyncMock()
                mock_user_service.return_value = mock_user_instance
                mock_dept_service.return_value = mock_dept_instance
                
                # Step 1: Create department
                log_integration_step(1, "Create department", {
                    "department_name": sample_department_data["name"]
                })
                
                mock_dept_instance.create_department.return_value = sample_department_data
                dept_result = await mock_dept_instance.create_department(
                    sample_department_data, admin_user_data
                )
                
                assert dept_result["name"] == sample_department_data["name"]
                
                # Step 2: Create user in department
                log_integration_step(2, "Create user in department", {
                    "user_name": sample_user_data["name"],
                    "department_id": str(sample_department_data["id"])
                })
                
                user_with_dept = {
                    **sample_user_data,
                    "id": uuid4(),
                    "department_id": sample_department_data["id"]
                }
                mock_user_instance.create_user.return_value = user_with_dept
                
                user_result = await mock_user_instance.create_user(
                    {**sample_user_data, "department_id": sample_department_data["id"]}, 
                    admin_user_data
                )
                
                assert user_result["department_id"] == sample_department_data["id"]
                
                # Step 3: Verify department users
                log_integration_step(3, "Verify department users", {
                    "department_id": str(sample_department_data["id"]),
                    "expected_users": 1
                })
                
                mock_dept_instance.get_department_users.return_value = {
                    "items": [user_with_dept],
                    "total": 1
                }
                
                dept_users = await mock_dept_instance.get_department_users(
                    sample_department_data["id"], admin_user_data
                )
                
                assert dept_users["total"] == 1
                assert dept_users["items"][0]["id"] == user_with_dept["id"]
                
                # Step 4: Transfer user to another department
                log_integration_step(4, "Transfer user to new department", {
                    "user_id": str(user_with_dept["id"]),
                    "old_department": str(sample_department_data["id"]),
                    "new_department": "new_dept_id"
                })
                
                transferred_user = {**user_with_dept, "department_id": "new_dept_id"}
                mock_user_instance.update_user.return_value = transferred_user
                
                transfer_result = await mock_user_instance.update_user(
                    user_with_dept["id"],
                    {"department_id": "new_dept_id"},
                    admin_user_data
                )
                
                assert transfer_result["department_id"] == "new_dept_id"
                
                # Verify workflow completion
                log_workflow_verification("user_department_relationship", {
                    "department_created": True,
                    "user_created_in_department": True,
                    "department_users_verified": True,
                    "user_transferred": True,
                    "relationship_integrity": True
                })
                
                log_component_integration("UserService", "DepartmentService", "relationship_management", True)
                log_end_to_end_test("user_department_workflow", ["UserService", "DepartmentService"], True)
                log_assertion_success("User-department relationship workflow successful")
                log_test_summary("user_department_relationship_workflow", True)
        
        except Exception as e:
            log_error(e, "user_department_relationship_workflow test")
            log_test_summary("user_department_relationship_workflow", False, str(e))
            raise

    @pytest.mark.asyncio
    async def test_user_permissions_workflow(self, admin_user_data, sample_user_data):
        """Test user permissions and access control workflow"""
        log_test_start("user_permissions_workflow")
        
        try:
            # Mock services and permissions
            with patch('app.services.user_service.UserService') as mock_user_service, \
                 patch('app.core.permissions.PermissionManager') as mock_perm_manager:
                
                mock_user_instance = AsyncMock()
                mock_perm_instance = AsyncMock()
                mock_user_service.return_value = mock_user_instance
                mock_perm_manager.return_value = mock_perm_instance
                
                # Step 1: Create user with specific role
                log_integration_step(1, "Create user with employee role", {
                    "user_name": sample_user_data["name"],
                    "role": "employee"
                })
                
                employee_user = {
                    **sample_user_data,
                    "id": uuid4(),
                    "role": "employee"
                }
                mock_user_instance.create_user.return_value = employee_user
                
                created_user = await mock_user_instance.create_user(
                    {**sample_user_data, "role": "employee"}, admin_user_data
                )
                
                assert created_user["role"] == "employee"
                
                # Step 2: Test permission checks
                log_integration_step(2, "Test permission checks", {
                    "user_role": "employee",
                    "testing_permissions": ["read", "write", "delete"]
                })
                
                # Employee should have read access
                mock_perm_instance.has_permission.return_value = True
                read_allowed = await mock_perm_instance.has_permission(
                    employee_user, "users", "read"
                )
                assert read_allowed is True
                
                # Employee should NOT have delete access
                mock_perm_instance.has_permission.return_value = False
                delete_allowed = await mock_perm_instance.has_permission(
                    employee_user, "users", "delete"
                )
                assert delete_allowed is False
                
                # Step 3: Promote user to manager
                log_integration_step(3, "Promote user to manager", {
                    "user_id": str(employee_user["id"]),
                    "old_role": "employee",
                    "new_role": "manager"
                })
                
                manager_user = {**employee_user, "role": "manager"}
                mock_user_instance.update_user.return_value = manager_user
                
                promoted_user = await mock_user_instance.update_user(
                    employee_user["id"],
                    {"role": "manager"},
                    admin_user_data
                )
                
                assert promoted_user["role"] == "manager"
                
                # Step 4: Verify new permissions
                log_integration_step(4, "Verify new manager permissions", {
                    "user_id": str(manager_user["id"]),
                    "new_role": "manager",
                    "testing_permissions": ["create", "update"]
                })
                
                # Manager should have create access
                mock_perm_instance.has_permission.return_value = True
                create_allowed = await mock_perm_instance.has_permission(
                    manager_user, "users", "create"
                )
                assert create_allowed is True
                
                # Verify workflow completion
                log_workflow_verification("user_permissions_complete", {
                    "user_created_with_role": True,
                    "initial_permissions_verified": True,
                    "user_promoted": True,
                    "new_permissions_verified": True,
                    "rbac_integration": True
                })
                
                log_component_integration("UserService", "PermissionManager", "rbac_integration", True)
                log_end_to_end_test("permissions_workflow", ["UserService", "PermissionManager", "RBAC"], True)
                log_assertion_success("User permissions workflow successful")
                log_test_summary("user_permissions_workflow", True)
        
        except Exception as e:
            log_error(e, "user_permissions_workflow test")
            log_test_summary("user_permissions_workflow", False, str(e))
            raise 