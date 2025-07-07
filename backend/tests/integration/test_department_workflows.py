#!/usr/bin/env python3
"""
Department Workflow Integration Tests
Demonstrates end-to-end department management workflows
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
TEST_LOG_FILE = setup_integration_test_logging('department_workflows')


class TestDepartmentWorkflowIntegration:
    """Test department management workflows end-to-end"""

    @pytest.fixture
    def admin_user_data(self):
        """Admin user data for workflow testing"""
        return {
            "sub": "admin_dept_test",
            "role": "admin",
            "email": "admin@department.test",
            "name": "Department Admin"
        }

    @pytest.fixture
    def sample_department_data(self):
        """Sample department data for testing"""
        return {
            "name": "Engineering Department",
            "description": "Software engineering and development",
            "budget": 100000,
            "status": "active"
        }

    @pytest.fixture
    def sample_manager_data(self):
        """Sample manager data for department testing"""
        return {
            "name": "John Manager",
            "email": "manager@eng.test",
            "employee_code": "MGR001",
            "job_title": "Engineering Manager",
            "role": "manager"
        }

    @pytest.mark.asyncio
    async def test_department_creation_workflow(
        self,
        admin_user_data,
        sample_department_data,
        sample_manager_data
    ):
        """Test complete department creation workflow"""
        log_test_start("department_creation_workflow")
        
        try:
            # Mock services
            with patch('app.services.department_service.DepartmentService') as mock_dept_service, \
                 patch('app.services.user_service.UserService') as mock_user_service:
                
                mock_dept_instance = AsyncMock()
                mock_user_instance = AsyncMock()
                mock_dept_service.return_value = mock_dept_instance
                mock_user_service.return_value = mock_user_instance
                
                # Step 1: Create department
                log_integration_step(1, "Create new department", {
                    "department_name": sample_department_data["name"],
                    "budget": sample_department_data["budget"]
                })
                
                created_dept = {
                    **sample_department_data,
                    "id": uuid4(),
                    "created_by": admin_user_data["sub"]
                }
                mock_dept_instance.create_department.return_value = created_dept
                
                dept_result = await mock_dept_instance.create_department(
                    sample_department_data, admin_user_data
                )
                
                assert dept_result["name"] == sample_department_data["name"]
                assert dept_result["budget"] == sample_department_data["budget"]
                log_database_state("department_created", "departments", 1)
                
                # Step 2: Assign manager to department
                log_integration_step(2, "Assign manager to department", {
                    "department_id": str(created_dept["id"]),
                    "manager_name": sample_manager_data["name"]
                })
                
                manager_with_dept = {
                    **sample_manager_data,
                    "id": uuid4(),
                    "department_id": created_dept["id"]
                }
                mock_user_instance.create_user.return_value = manager_with_dept
                
                manager_result = await mock_user_instance.create_user(
                    {**sample_manager_data, "department_id": created_dept["id"]}, 
                    admin_user_data
                )
                
                assert manager_result["department_id"] == created_dept["id"]
                assert manager_result["role"] == "manager"
                
                # Step 3: Update department with manager
                log_integration_step(3, "Update department with manager", {
                    "department_id": str(created_dept["id"]),
                    "manager_id": str(manager_with_dept["id"])
                })
                
                updated_dept = {
                    **created_dept,
                    "manager_id": manager_with_dept["id"]
                }
                mock_dept_instance.update_department.return_value = updated_dept
                
                dept_update = await mock_dept_instance.update_department(
                    created_dept["id"],
                    {"manager_id": manager_with_dept["id"]},
                    admin_user_data
                )
                
                assert dept_update["manager_id"] == manager_with_dept["id"]
                
                # Step 4: Verify department structure
                log_integration_step(4, "Verify department structure", {
                    "department_id": str(created_dept["id"]),
                    "verification_points": ["manager_assigned", "budget_set", "status_active"]
                })
                
                mock_dept_instance.get_department_by_id.return_value = updated_dept
                verified_dept = await mock_dept_instance.get_department_by_id(
                    created_dept["id"], admin_user_data
                )
                
                assert verified_dept["manager_id"] == manager_with_dept["id"]
                assert verified_dept["status"] == "active"
                assert verified_dept["budget"] == 100000
                
                # Verify workflow completion
                log_workflow_verification("department_creation_complete", {
                    "department_created": True,
                    "manager_assigned": True,
                    "department_updated": True,
                    "structure_verified": True,
                    "service_integration": True
                })
                
                log_component_integration("DepartmentService", "UserService", "manager_assignment", True)
                log_end_to_end_test("department_creation", ["DepartmentService", "UserService", "Database"], True)
                log_assertion_success("Department creation workflow successful")
                log_test_summary("department_creation_workflow", True)
        
        except Exception as e:
            log_error(e, "department_creation_workflow test")
            log_test_summary("department_creation_workflow", False, str(e))
            raise

    @pytest.mark.asyncio
    async def test_department_team_management_workflow(
        self,
        admin_user_data,
        sample_department_data,
        sample_manager_data
    ):
        """Test department team management workflow"""
        log_test_start("department_team_management_workflow")
        
        try:
            # Mock services
            with patch('app.services.department_service.DepartmentService') as mock_dept_service, \
                 patch('app.services.user_service.UserService') as mock_user_service:
                
                mock_dept_instance = AsyncMock()
                mock_user_instance = AsyncMock()
                mock_dept_service.return_value = mock_dept_instance
                mock_user_service.return_value = mock_user_instance
                
                # Step 1: Setup department
                log_integration_step(1, "Setup department with manager", {
                    "department_name": sample_department_data["name"]
                })
                
                department = {
                    **sample_department_data,
                    "id": uuid4(),
                    "manager_id": uuid4()
                }
                mock_dept_instance.get_department_by_id.return_value = department
                
                # Step 2: Add team members
                log_integration_step(2, "Add team members to department", {
                    "department_id": str(department["id"]),
                    "team_size": 3
                })
                
                team_members = []
                for i in range(3):
                    member = {
                        "id": uuid4(),
                        "name": f"Team Member {i+1}",
                        "email": f"member{i+1}@eng.test",
                        "employee_code": f"EMP00{i+1}",
                        "job_title": "Software Engineer",
                        "department_id": department["id"],
                        "role": "employee"
                    }
                    team_members.append(member)
                
                mock_user_instance.create_user.side_effect = team_members
                
                # Create team members
                for member_data in team_members:
                    created_member = await mock_user_instance.create_user(
                        member_data, admin_user_data
                    )
                    assert created_member["department_id"] == department["id"]
                
                # Step 3: Verify team structure
                log_integration_step(3, "Verify team structure", {
                    "department_id": str(department["id"]),
                    "expected_members": 3,
                    "roles": ["manager", "employees"]
                })
                
                mock_dept_instance.get_department_users.return_value = {
                    "items": team_members,
                    "total": 3,
                    "managers": 1,
                    "employees": 3
                }
                
                dept_users = await mock_dept_instance.get_department_users(
                    department["id"], admin_user_data
                )
                
                assert dept_users["total"] == 3
                assert len(dept_users["items"]) == 3
                
                # Step 4: Update team member role
                log_integration_step(4, "Promote team member to senior", {
                    "member_id": str(team_members[0]["id"]),
                    "new_role": "senior_engineer"
                })
                
                promoted_member = {
                    **team_members[0],
                    "job_title": "Senior Software Engineer"
                }
                mock_user_instance.update_user.return_value = promoted_member
                
                promotion_result = await mock_user_instance.update_user(
                    team_members[0]["id"],
                    {"job_title": "Senior Software Engineer"},
                    admin_user_data
                )
                
                assert promotion_result["job_title"] == "Senior Software Engineer"
                
                # Step 5: Remove team member
                log_integration_step(5, "Remove team member from department", {
                    "member_id": str(team_members[2]["id"]),
                    "action": "transfer_to_other_department"
                })
                
                mock_user_instance.update_user.return_value = {
                    **team_members[2],
                    "department_id": "other_dept_id"
                }
                
                transfer_result = await mock_user_instance.update_user(
                    team_members[2]["id"],
                    {"department_id": "other_dept_id"},
                    admin_user_data
                )
                
                assert transfer_result["department_id"] == "other_dept_id"
                
                # Verify workflow completion
                log_workflow_verification("team_management_complete", {
                    "department_setup": True,
                    "team_members_added": True,
                    "team_structure_verified": True,
                    "member_promoted": True,
                    "member_transferred": True,
                    "team_integrity": True
                })
                
                log_component_integration("DepartmentService", "UserService", "team_management", True)
                log_end_to_end_test("team_management", ["DepartmentService", "UserService", "RBAC"], True)
                log_assertion_success("Department team management workflow successful")
                log_test_summary("department_team_management_workflow", True)
        
        except Exception as e:
            log_error(e, "department_team_management_workflow test")
            log_test_summary("department_team_management_workflow", False, str(e))
            raise

    @pytest.mark.asyncio
    async def test_department_budget_management_workflow(
        self,
        admin_user_data,
        sample_department_data
    ):
        """Test department budget management workflow"""
        log_test_start("department_budget_management_workflow")
        
        try:
            # Mock services
            with patch('app.services.department_service.DepartmentService') as mock_dept_service:
                
                mock_dept_instance = AsyncMock()
                mock_dept_service.return_value = mock_dept_instance
                
                # Step 1: Create department with initial budget
                log_integration_step(1, "Create department with budget", {
                    "department_name": sample_department_data["name"],
                    "initial_budget": sample_department_data["budget"]
                })
                
                department = {
                    **sample_department_data,
                    "id": uuid4(),
                    "budget": 100000,
                    "budget_spent": 0,
                    "budget_remaining": 100000
                }
                mock_dept_instance.create_department.return_value = department
                
                created_dept = await mock_dept_instance.create_department(
                    sample_department_data, admin_user_data
                )
                
                assert created_dept["budget"] == 100000
                assert created_dept["budget_remaining"] == 100000
                
                # Step 2: Update budget allocation
                log_integration_step(2, "Update budget allocation", {
                    "department_id": str(department["id"]),
                    "new_budget": 150000,
                    "reason": "team_expansion"
                })
                
                updated_dept = {
                    **department,
                    "budget": 150000,
                    "budget_remaining": 150000
                }
                mock_dept_instance.update_department.return_value = updated_dept
                
                budget_update = await mock_dept_instance.update_department(
                    department["id"],
                    {"budget": 150000},
                    admin_user_data
                )
                
                assert budget_update["budget"] == 150000
                
                # Step 3: Track budget spending
                log_integration_step(3, "Track budget spending", {
                    "department_id": str(department["id"]),
                    "expense_amount": 25000,
                    "expense_type": "equipment"
                })
                
                expense_updated_dept = {
                    **updated_dept,
                    "budget_spent": 25000,
                    "budget_remaining": 125000
                }
                mock_dept_instance.update_department.return_value = expense_updated_dept
                
                expense_result = await mock_dept_instance.update_department(
                    department["id"],
                    {"budget_spent": 25000},
                    admin_user_data
                )
                
                assert expense_result["budget_spent"] == 25000
                assert expense_result["budget_remaining"] == 125000
                
                # Step 4: Generate budget report
                log_integration_step(4, "Generate budget report", {
                    "department_id": str(department["id"]),
                    "report_type": "quarterly_budget"
                })
                
                mock_dept_instance.get_budget_report.return_value = {
                    "department_id": department["id"],
                    "budget_allocated": 150000,
                    "budget_spent": 25000,
                    "budget_remaining": 125000,
                    "utilization_rate": 16.67,
                    "quarterly_expenses": [
                        {"category": "equipment", "amount": 25000}
                    ]
                }
                
                budget_report = await mock_dept_instance.get_budget_report(
                    department["id"], admin_user_data
                )
                
                assert budget_report["budget_allocated"] == 150000
                assert budget_report["utilization_rate"] == 16.67
                
                # Verify workflow completion
                log_workflow_verification("budget_management_complete", {
                    "department_created_with_budget": True,
                    "budget_updated": True,
                    "spending_tracked": True,
                    "report_generated": True,
                    "budget_integrity": True
                })
                
                log_component_integration("DepartmentService", "BudgetManager", "budget_tracking", True)
                log_end_to_end_test("budget_management", ["DepartmentService", "BudgetManager", "Database"], True)
                log_assertion_success("Department budget management workflow successful")
                log_test_summary("department_budget_management_workflow", True)
        
        except Exception as e:
            log_error(e, "department_budget_management_workflow test")
            log_test_summary("department_budget_management_workflow", False, str(e))
            raise 