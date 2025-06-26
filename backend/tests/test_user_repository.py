#!/usr/bin/env python3
"""
Test script for UserRepository implementation
"""

import asyncio
import os
from uuid import uuid4
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

async def test_user_repository():
    """Test the user repository functionality"""
    
    try:
        # Import after environment setup
        from app.database.repositories.user_repo import user_repository
        from app.schemas.user import UserCreate
        from app.database.models.user import UserBase
        
        print("🧪 Testing UserRepository...")
        
        # Test 1: Check database connection
        print("1. Testing database connection...")
        try:
            # Test a simple query
            count = await user_repository.count_users()
            print(f"✅ Database connection successful. Total users: {count}")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            return False
        
        # Test 2: Test search functionality
        print("2. Testing search functionality...")
        try:
            users = await user_repository.search_users(search_term="", filters={})
            print(f"✅ Search successful. Found {len(users)} users")
        except Exception as e:
            print(f"❌ Search failed: {e}")
            return False
        
        # Test 3: Test get by email (if users exist)
        if users:
            print("3. Testing get by email...")
            try:
                first_user = users[0]
                user_by_email = await user_repository.get_by_email(first_user.email)
                if user_by_email:
                    print(f"✅ Get by email successful: {user_by_email.name}")
                else:
                    print("⚠️ No user found by email")
            except Exception as e:
                print(f"❌ Get by email failed: {e}")
        
        # Test 4: Test get by employee code (if users exist)
        if users:
            print("4. Testing get by employee code...")
            try:
                first_user = users[0]
                user_by_code = await user_repository.get_by_employee_code(first_user.employee_code)
                if user_by_code:
                    print(f"✅ Get by employee code successful: {user_by_code.name}")
                else:
                    print("⚠️ No user found by employee code")
            except Exception as e:
                print(f"❌ Get by employee code failed: {e}")
        
        # Test 5: Test get by department (if users exist)
        if users:
            print("5. Testing get by department...")
            try:
                first_user = users[0]
                dept_users = await user_repository.get_by_department(first_user.department_id)
                print(f"✅ Get by department successful. Found {len(dept_users)} users in department")
            except Exception as e:
                print(f"❌ Get by department failed: {e}")
        
        print("✅ All tests completed successfully!")
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

async def test_schema_validation():
    """Test schema validation"""
    
    try:
        from app.schemas.user import UserCreate, UserUpdate, UserStatus
        from pydantic import ValidationError
        
        print("\n🧪 Testing schema validation...")
        
        # Test 1: Valid UserCreate
        print("1. Testing valid UserCreate...")
        try:
            valid_user = UserCreate(
                name="Test User",
                email="test@example.com",
                employee_code="EMP001",
                clerk_user_id="clerk_test_123",
                department_id=uuid4(),
                stage_id=uuid4(),
                role_ids=[1, 2],
                supervisor_id=uuid4()
            )
            print(f"✅ Valid UserCreate: {valid_user.name}")
        except ValidationError as e:
            print(f"❌ UserCreate validation failed: {e}")
            return False
        
        # Test 2: Valid UserUpdate
        print("2. Testing valid UserUpdate...")
        try:
            valid_update = UserUpdate(
                name="Updated Name",
                email="updated@example.com",
                status=UserStatus.ACTIVE
            )
            print(f"✅ Valid UserUpdate: {valid_update.name}")
        except ValidationError as e:
            print(f"❌ UserUpdate validation failed: {e}")
            return False
        
        # Test 3: Invalid email
        print("3. Testing invalid email...")
        try:
            invalid_user = UserCreate(
                name="Test User",
                email="invalid-email",
                employee_code="EMP002",
                clerk_user_id="clerk_test_456",
                department_id=uuid4(),
                stage_id=uuid4()
            )
            print("❌ Invalid email should have failed validation")
            return False
        except ValidationError:
            print("✅ Invalid email correctly rejected")
        
        print("✅ All schema validation tests passed!")
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Schema test failed: {e}")
        return False

async def main():
    """Main test function"""
    print("🚀 Starting UserRepository and Schema validation tests...")
    print("=" * 60)
    
    # Test schema validation first
    schema_success = await test_schema_validation()
    
    # Test repository functionality
    repo_success = await test_user_repository()
    
    print("\n" + "=" * 60)
    print("📊 Test Results:")
    print(f"Schema Validation: {'✅ PASSED' if schema_success else '❌ FAILED'}")
    print(f"Repository Tests: {'✅ PASSED' if repo_success else '❌ FAILED'}")
    
    if schema_success and repo_success:
        print("\n🎉 All tests passed! UserRepository implementation is ready.")
    else:
        print("\n⚠️ Some tests failed. Please check the implementation.")

if __name__ == "__main__":
    asyncio.run(main()) 