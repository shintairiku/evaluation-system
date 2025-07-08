"""
Integration tests for authentication workflow.
Tests the complete user signup process from Clerk authentication to profile completion.

This test suite validates:
1. Profile options retrieval for signup form
2. User existence checking by Clerk ID
3. Complete user signup workflow
4. Data validation and error handling
5. Duplicate handling

Run with: pytest tests/integration/test_auth_workflow.py -v
"""
import pytest
import httpx
import logging
from uuid import uuid4
from typing import Dict, Any

from .logging_utils import (
    setup_auth_test_logging,
    log_test_start,
    log_test_success,
    log_test_failure,
    log_api_request,
    log_api_response,
    log_auth_workflow_step,
    log_data_validation,
    log_test_summary,
    log_workflow_completion
)

# Setup logging for this test session
TEST_LOG_FILE = setup_auth_test_logging('auth_workflow')


class TestAuthWorkflow:
    """Test complete auth workflow from Clerk signup to profile completion."""
    
    BASE_URL = "http://localhost:8000/api/v1"
    
    @pytest.mark.asyncio
    async def test_get_profile_options(self):
        """Test retrieving profile options for signup form."""
        test_name = "Profile Options Retrieval"
        log_test_start(test_name)
        
        try:
            async with httpx.AsyncClient() as client:
                log_api_request("GET", f"{self.BASE_URL}/auth/signup/profile-options")
                response = await client.get(f"{self.BASE_URL}/auth/signup/profile-options")
                log_api_response(response.status_code)
                
                assert response.status_code == 200
                
                data = response.json()
                log_auth_workflow_step("Profile options retrieved", {
                    "departments_count": len(data.get("departments", [])),
                    "stages_count": len(data.get("stages", [])),
                    "roles_count": len(data.get("roles", [])),
                    "users_count": len(data.get("users", []))
                })
                
                # Verify data structure
                assert "departments" in data
                assert "stages" in data
                assert "roles" in data
                assert "users" in data
                
                assert isinstance(data["departments"], list)
                assert isinstance(data["stages"], list)
                assert isinstance(data["roles"], list)
                assert isinstance(data["users"], list)
                
                # Verify department structure if departments exist
                if data["departments"]:
                    dept = data["departments"][0]
                    assert "id" in dept
                    assert "name" in dept
                    logging.info(f"   Sample department: {dept['name']}")
                
                # Verify stage structure if stages exist
                if data["stages"]:
                    stage = data["stages"][0]
                    assert "id" in stage
                    assert "name" in stage
                    logging.info(f"   Sample stage: {stage['name']}")
                
                # Verify role structure if roles exist
                if data["roles"]:
                    role = data["roles"][0]
                    assert "id" in role
                    assert "name" in role
                    logging.info(f"   Sample role: {role['name']}")
                
                log_test_success(test_name, {"data_structure": "validated"})
                
        except Exception as e:
            log_test_failure(test_name, e)
            raise

    @pytest.mark.asyncio
    async def test_check_user_exists_nonexistent(self):
        """Test checking for a user that doesn't exist."""
        test_name = "Check Non-existent User"
        log_test_start(test_name)
        
        try:
            clerk_id = f"test-clerk-nonexistent-{uuid4()}"
            log_auth_workflow_step("Generated test Clerk ID", {"clerk_id": clerk_id})
            
            async with httpx.AsyncClient() as client:
                log_api_request("GET", f"{self.BASE_URL}/auth/user/{clerk_id}")
                response = await client.get(f"{self.BASE_URL}/auth/user/{clerk_id}")
                log_api_response(response.status_code, response.json())
                
                assert response.status_code == 200
                
                data = response.json()
                assert data["exists"] is False
                assert "user_id" not in data or data["user_id"] is None
                
                log_test_success(test_name, {"user_exists": False})
                
        except Exception as e:
            log_test_failure(test_name, e)
            raise

    @pytest.mark.asyncio
    async def test_complete_signup_workflow(self):
        """Test the complete signup workflow with valid data."""
        test_name = "Complete Signup Workflow"
        log_test_start(test_name)
        
        try:
            clerk_id = f"test-clerk-{uuid4()}"
            employee_code = f"EMP{uuid4().hex[:6].upper()}"
            log_auth_workflow_step("Generated test identifiers", {
                "clerk_id": clerk_id,
                "employee_code": employee_code
            })
            
            async with httpx.AsyncClient() as client:
                # Step 1: Get profile options first
                log_auth_workflow_step("Step 1: Getting profile options")
                log_api_request("GET", f"{self.BASE_URL}/auth/signup/profile-options")
                options_response = await client.get(f"{self.BASE_URL}/auth/signup/profile-options")
                log_api_response(options_response.status_code)
                
                assert options_response.status_code == 200
                options = options_response.json()
                
                # Use actual data from the system if available
                department_id = None
                stage_id = None
                role_ids = []
                
                if options["departments"]:
                    department_id = options["departments"][0]["id"]
                if options["stages"]:
                    stage_id = options["stages"][0]["id"]
                if options["roles"]:
                    role_ids = [options["roles"][0]["id"]]
                
                log_auth_workflow_step("Profile options configured", {
                    "department_id": department_id,
                    "stage_id": stage_id,
                    "role_ids": role_ids
                })
                
                # Step 2: Check user doesn't exist
                log_auth_workflow_step("Step 2: Checking user doesn't exist")
                log_api_request("GET", f"{self.BASE_URL}/auth/user/{clerk_id}")
                check_response = await client.get(f"{self.BASE_URL}/auth/user/{clerk_id}")
                log_api_response(check_response.status_code, check_response.json())
                
                assert check_response.status_code == 200
                check_data = check_response.json()
                assert check_data["exists"] is False
                
                # Step 3: Create signup data
                signup_data = {
                    "clerk_user_id": clerk_id,
                    "name": "田中 太郎",
                    "email": f"test-{uuid4()}@example.com",
                    "employee_code": employee_code,
                    "job_title": "ソフトウェアエンジニア",
                    "department_id": department_id,
                    "stage_id": stage_id,
                    "role_ids": role_ids
                }
                
                log_auth_workflow_step("Step 3: Preparing signup data", {
                    "name": signup_data["name"],
                    "email": signup_data["email"],
                    "job_title": signup_data["job_title"]
                })
                
                # Step 4: Complete signup
                log_auth_workflow_step("Step 4: Submitting signup")
                log_api_request("POST", f"{self.BASE_URL}/auth/signup", signup_data)
                signup_response = await client.post(f"{self.BASE_URL}/auth/signup", json=signup_data)
                log_api_response(signup_response.status_code, signup_response.json())
                
                assert signup_response.status_code == 200
                
                signup_result = signup_response.json()
                assert signup_result["success"] is True
                assert "pending approval" in signup_result["message"].lower()
                
                # Verify user data
                user_data = signup_result["user"]
                expected_data = {
                    "clerk_user_id": clerk_id,
                    "name": signup_data["name"],
                    "email": signup_data["email"],
                    "employee_code": employee_code,
                    "status": "pending_approval"
                }
                
                log_data_validation("User Data", expected_data, user_data)
                
                assert user_data["clerk_user_id"] == clerk_id
                assert user_data["name"] == signup_data["name"]  # Name stored as-is
                assert user_data["email"] == signup_data["email"]
                assert user_data["employee_code"] == employee_code
                assert user_data["status"] == "pending_approval"
                
                # Step 5: Verify user now exists
                log_auth_workflow_step("Step 5: Verifying user exists")
                log_api_request("GET", f"{self.BASE_URL}/auth/user/{clerk_id}")
                final_check = await client.get(f"{self.BASE_URL}/auth/user/{clerk_id}")
                log_api_response(final_check.status_code, final_check.json())
                
                assert final_check.status_code == 200
                final_data = final_check.json()
                assert final_data["exists"] is True
                assert final_data["user_id"] == user_data["id"]
                
                log_workflow_completion("Complete Signup", user_data)
                log_test_success(test_name, {"user_id": user_data["id"]})
                
        except Exception as e:
            log_test_failure(test_name, e)
            raise

    @pytest.mark.asyncio
    async def test_signup_with_minimal_data(self):
        """Test signup with only required fields."""
        test_name = "Minimal Data Signup"
        log_test_start(test_name)
        
        try:
            clerk_id = f"test-clerk-minimal-{uuid4()}"
            employee_code = f"MIN{uuid4().hex[:6].upper()}"
            
            minimal_signup_data = {
                "clerk_user_id": clerk_id,
                "name": "佐藤 花子",
                "email": f"minimal-{uuid4()}@example.com",
                "employee_code": employee_code,
                "job_title": "デザイナー",
                "department_id": None,
                "stage_id": None,
                "role_ids": []
            }
            
            log_auth_workflow_step("Testing minimal data signup", {
                "optional_fields_null": ["department_id", "stage_id", "role_ids"]
            })
            
            async with httpx.AsyncClient() as client:
                log_api_request("POST", f"{self.BASE_URL}/auth/signup", minimal_signup_data)
                response = await client.post(f"{self.BASE_URL}/auth/signup", json=minimal_signup_data)
                log_api_response(response.status_code, response.json())
                
                assert response.status_code == 200
                
                data = response.json()
                assert data["success"] is True
                
                user_data = data["user"]
                assert user_data["name"] == "佐藤 花子"
                assert user_data["status"] == "pending_approval"
                
                log_test_success(test_name, {"minimal_fields_accepted": True})
                
        except Exception as e:
            log_test_failure(test_name, e)
            raise

    @pytest.mark.asyncio
    async def test_duplicate_employee_code(self):
        """Test handling of duplicate employee codes."""
        test_name = "Duplicate Employee Code Handling"
        log_test_start(test_name)
        
        try:
            # Create first user
            clerk_id_1 = f"test-clerk-dup1-{uuid4()}"
            employee_code = f"DUP{uuid4().hex[:6].upper()}"
            
            signup_data_1 = {
                "clerk_user_id": clerk_id_1,
                "name": "田中 太郎",
                "email": f"dup1-{uuid4()}@example.com",
                "employee_code": employee_code,
                "job_title": "エンジニア",
                "department_id": None,
                "stage_id": None,
                "role_ids": []
            }
            
            log_auth_workflow_step("Creating first user", {"employee_code": employee_code})
            
            async with httpx.AsyncClient() as client:
                # First signup should succeed
                log_api_request("POST", f"{self.BASE_URL}/auth/signup", signup_data_1)
                response1 = await client.post(f"{self.BASE_URL}/auth/signup", json=signup_data_1)
                log_api_response(response1.status_code)
                
                assert response1.status_code == 200
                log_auth_workflow_step("First user created successfully")
                
                # Second signup with same employee code should fail
                clerk_id_2 = f"test-clerk-dup2-{uuid4()}"
                signup_data_2 = signup_data_1.copy()
                signup_data_2["clerk_user_id"] = clerk_id_2
                signup_data_2["email"] = f"dup2-{uuid4()}@example.com"
                
                log_auth_workflow_step("Attempting duplicate employee code", {
                    "duplicate_employee_code": employee_code,
                    "different_clerk_id": clerk_id_2
                })
                
                log_api_request("POST", f"{self.BASE_URL}/auth/signup", signup_data_2)
                response2 = await client.post(f"{self.BASE_URL}/auth/signup", json=signup_data_2)
                log_api_response(response2.status_code, response2.json())
                
                assert response2.status_code in [400, 409]  # Bad request or conflict
                log_test_success(test_name, {"duplicate_rejected": True})
                
        except Exception as e:
            log_test_failure(test_name, e)
            raise

    @pytest.mark.asyncio
    async def test_duplicate_clerk_id(self):
        """Test handling of duplicate Clerk IDs."""
        test_name = "Duplicate Clerk ID Handling"
        log_test_start(test_name)
        
        try:
            clerk_id = f"test-clerk-duplicate-{uuid4()}"
            
            signup_data = {
                "clerk_user_id": clerk_id,
                "name": "田中 太郎",
                "email": f"dup-clerk-{uuid4()}@example.com",
                "employee_code": f"DUP1{uuid4().hex[:6].upper()}",
                "job_title": "エンジニア",
                "department_id": None,
                "stage_id": None,
                "role_ids": []
            }
            
            log_auth_workflow_step("Creating first user", {"clerk_id": clerk_id})
            
            async with httpx.AsyncClient() as client:
                # First signup should succeed
                log_api_request("POST", f"{self.BASE_URL}/auth/signup", signup_data)
                response1 = await client.post(f"{self.BASE_URL}/auth/signup", json=signup_data)
                log_api_response(response1.status_code)
                
                assert response1.status_code == 200
                log_auth_workflow_step("First user created successfully")
                
                # Second signup with same Clerk ID should fail
                signup_data_2 = signup_data.copy()
                signup_data_2["email"] = f"dup-clerk2-{uuid4()}@example.com"
                signup_data_2["employee_code"] = f"DUP2{uuid4().hex[:6].upper()}"
                
                log_auth_workflow_step("Attempting duplicate Clerk ID", {
                    "duplicate_clerk_id": clerk_id,
                    "different_employee_code": signup_data_2["employee_code"]
                })
                
                log_api_request("POST", f"{self.BASE_URL}/auth/signup", signup_data_2)
                response2 = await client.post(f"{self.BASE_URL}/auth/signup", json=signup_data_2)
                log_api_response(response2.status_code, response2.json())
                
                assert response2.status_code in [400, 409]  # Bad request or conflict
                log_test_success(test_name, {"duplicate_rejected": True})
                
        except Exception as e:
            log_test_failure(test_name, e)
            raise

    @pytest.mark.asyncio
    async def test_validation_errors(self):
        """Test input validation error handling."""
        test_name = "Input Validation"
        log_test_start(test_name)
        
        try:
            async with httpx.AsyncClient() as client:
                # Test missing required fields
                invalid_data_cases = [
                    # Missing clerk_user_id
                    {
                        "name": "Test User",
                        "email": "test@example.com",
                        "employee_code": "EMP123",
                        "job_title": "Test"
                    },
                    # Missing name
                    {
                        "clerk_user_id": f"test-clerk-{uuid4()}",
                        "email": "test@example.com",
                        "employee_code": "EMP123",
                        "job_title": "Test"
                    },
                    # Invalid email format
                    {
                        "clerk_user_id": f"test-clerk-{uuid4()}",
                        "name": "Test User",
                        "email": "invalid-email",
                        "employee_code": "EMP123",
                        "job_title": "Test"
                    },
                    # Missing employee_code
                    {
                        "clerk_user_id": f"test-clerk-{uuid4()}",
                        "name": "Test User",
                        "email": "test@example.com",
                        "job_title": "Test"
                    }
                ]
                
                validation_results = []
                for i, invalid_data in enumerate(invalid_data_cases):
                    log_auth_workflow_step(f"Testing validation case {i+1}", {
                        "missing_fields": [k for k in ["clerk_user_id", "name", "email", "employee_code"] 
                                         if k not in invalid_data or invalid_data[k] == "invalid-email"]
                    })
                    
                    log_api_request("POST", f"{self.BASE_URL}/auth/signup", invalid_data)
                    response = await client.post(f"{self.BASE_URL}/auth/signup", json=invalid_data)
                    log_api_response(response.status_code, response.json())
                    
                    validation_results.append(response.status_code == 422)
                    assert response.status_code == 422, f"Expected validation error for data: {invalid_data}"
                
                log_test_success(test_name, {
                    "validation_cases_tested": len(invalid_data_cases),
                    "all_rejected": all(validation_results)
                })
                
        except Exception as e:
            log_test_failure(test_name, e)
            raise

    @pytest.mark.asyncio
    async def test_check_existing_user(self):
        """Test checking an existing user."""
        test_name = "Check Existing User"
        log_test_start(test_name)
        
        try:
            # First create a user
            clerk_id = f"test-clerk-existing-{uuid4()}"
            employee_code = f"EXT{uuid4().hex[:6].upper()}"
            
            signup_data = {
                "clerk_user_id": clerk_id,
                "name": "山田 次郎",
                "email": f"existing-{uuid4()}@example.com",
                "employee_code": employee_code,
                "job_title": "テスター",
                "department_id": None,
                "stage_id": None,
                "role_ids": []
            }
            
            log_auth_workflow_step("Creating user for existence test", {
                "clerk_id": clerk_id,
                "name": signup_data["name"]
            })
            
            async with httpx.AsyncClient() as client:
                # Create user
                log_api_request("POST", f"{self.BASE_URL}/auth/signup", signup_data)
                signup_response = await client.post(f"{self.BASE_URL}/auth/signup", json=signup_data)
                log_api_response(signup_response.status_code)
                
                assert signup_response.status_code == 200
                log_auth_workflow_step("User created successfully")
                
                # Check user exists
                log_auth_workflow_step("Checking user existence")
                log_api_request("GET", f"{self.BASE_URL}/auth/user/{clerk_id}")
                check_response = await client.get(f"{self.BASE_URL}/auth/user/{clerk_id}")
                log_api_response(check_response.status_code, check_response.json())
                
                assert check_response.status_code == 200
                
                check_data = check_response.json()
                assert check_data["exists"] is True
                assert check_data["name"] == "山田 次郎"
                assert check_data["status"] == "pending_approval"
                
                log_test_success(test_name, {"user_found": True})
                
        except Exception as e:
            log_test_failure(test_name, e)
            raise


class TestAuthWorkflowHelper:
    """Helper functions for testing the auth workflow."""
    
    @staticmethod
    async def create_test_user(client: httpx.AsyncClient, suffix: str = None) -> Dict[str, Any]:
        """Helper to create a test user and return the response data."""
        suffix = suffix or uuid4().hex[:6]
        clerk_id = f"test-clerk-{suffix}"
        employee_code = f"EMP{suffix.upper()}"
        
        signup_data = {
            "clerk_user_id": clerk_id,
            "name": f"テストユーザー {suffix}",
            "email": f"test-{suffix}@example.com",
            "employee_code": employee_code,
            "job_title": "テスター",
            "department_id": None,
            "stage_id": None,
            "role_ids": []
        }
        
        logging.info(f"Creating test user with suffix: {suffix}")
        response = await client.post("http://localhost:8000/api/v1/auth/signup", json=signup_data)
        
        if response.status_code == 200:
            logging.info(f"Test user created successfully: {clerk_id}")
            return response.json()
        else:
            logging.error(f"Failed to create test user: {response.status_code}")
            return None


# Test runner function for easy execution
def run_auth_tests():
    """
    Run auth workflow tests with prerequisite checking.
    
    Usage:
        python -c "from tests.integration.test_auth_workflow import run_auth_tests; run_auth_tests()"
    """
    import subprocess
    import sys
    
    logging.info("🧪 Running Auth Workflow Tests")
    logging.info("=" * 50)
    
    # Check if backend is running
    try:
        import httpx
        with httpx.Client() as client:
            response = client.get("http://localhost:8000/api/v1/auth/signup/profile-options", timeout=5)
            if response.status_code != 200:
                logging.error("❌ Backend is not running or auth endpoints not available.")
                logging.error("   Please start with: docker-compose up -d")
                return False
    except Exception as e:
        logging.error(f"❌ Backend is not accessible: {e}")
        logging.error("   Please start with: docker-compose up -d")
        return False
    
    logging.info("✅ Backend is running and auth endpoints are accessible")
    
    # Run tests
    try:
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            "tests/integration/test_auth_workflow.py", 
            "-v", "--tb=short", "--no-header"
        ], cwd=".", capture_output=False)
        
        success = result.returncode == 0
        logging.info("\n" + "=" * 50)
        if success:
            logging.info("🎉 ALL AUTH TESTS PASSED!")
            logging.info("✅ Auth workflow is working correctly")
        else:
            logging.error("❌ Some tests failed. Check output above.")
        
        return success
        
    except Exception as e:
        logging.error(f"❌ Error running tests: {e}")
        return False


if __name__ == "__main__":
    run_auth_tests()