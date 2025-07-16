import asyncio
import logging
from uuid import UUID, uuid4
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
import pytest_asyncio

from app.database.models.user import Department
from app.database.repositories.department_repo import DepartmentRepository
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.database.session import get_db_session
from app.schemas.common import PaginationParams
from tests.repositories.test_logging_utils import (
    setup_repository_test_logging, 
    log_test_start, 
    log_data_verification, 
    log_assertion_success
)

# Set up centralized logging for department repository tests
TEST_LOG_FILE = setup_repository_test_logging('department')


class TestDepartmentRepository:
    """Test DepartmentRepository with actual Supabase data"""
    
    @pytest_asyncio.fixture
    async def session(self):
        """Get actual database session"""
        async for session in get_db_session():
            yield session
            break
    
    @pytest_asyncio.fixture
    async def department_repo(self, session: AsyncSession) -> DepartmentRepository:
        """Create DepartmentRepository instance"""
        return DepartmentRepository(session)
    
    # Test data from 007_seed_user_data.sql
    SEED_DEPARTMENT_IDS = {
        "sales": UUID("650e8400-e29b-41d4-a716-446655440001"),
        "engineering": UUID("650e8400-e29b-41d4-a716-446655440002"), 
        "hr": UUID("650e8400-e29b-41d4-a716-446655440003"),
        "marketing": UUID("650e8400-e29b-41d4-a716-446655440004"),
    }

    @pytest.mark.asyncio
    async def test_get_by_id(self, department_repo: DepartmentRepository):
        """Test fetching department by ID"""
        log_test_start("get_by_id")
        
        dept_id = self.SEED_DEPARTMENT_IDS["engineering"]
        logging.info(f"Attempting to fetch department with ID: {dept_id}")
        
        department = await department_repo.get_by_id(dept_id)
        
        assert department is not None, "Department should not be None"
        assert department.id == dept_id
        assert department.name == "Engineering"
        
        log_data_verification("department", {
            "ID": department.id,
            "Name": department.name,
            "Description": department.description,
        })
        log_assertion_success("Department fetched by ID successfully")

    @pytest.mark.asyncio
    async def test_get_by_name(self, department_repo: DepartmentRepository):
        """Test fetching department by name"""
        log_test_start("get_by_name")
        
        dept_name = "Sales"
        logging.info(f"Attempting to fetch department with name: '{dept_name}'")
        
        department = await department_repo.get_by_name(dept_name)
        
        assert department is not None, "Department should not be None"
        assert department.name == dept_name
        assert department.id == self.SEED_DEPARTMENT_IDS["sales"]
        
        log_data_verification("department", {
            "ID": department.id,
            "Name": department.name
        })
        log_assertion_success("Department fetched by name successfully")

    @pytest.mark.asyncio
    async def test_get_all(self, department_repo: DepartmentRepository):
        """Test fetching all departments"""
        log_test_start("get_all")
        
        departments = await department_repo.get_all()
        
        assert departments is not None
        assert len(departments) >= 4  # Should have at least the 4 seeded departments
        
        log_data_verification("all_departments", {
            "Total Found": len(departments),
            "Names": [d.name for d in departments]
        })
        log_assertion_success("Fetched all departments successfully")

    @pytest.mark.asyncio
    async def test_get_department_users(self, department_repo: DepartmentRepository):
        """Test fetching all active users in a specific department"""
        log_test_start("get_department_users")
        
        # Using Sales department which has both Yamada and Sato
        sales_dept_id = self.SEED_DEPARTMENT_IDS["sales"]
        logging.info(f"Fetching users for department ID: {sales_dept_id}")
        
        users = await department_repo.get_department_users(sales_dept_id)
        
        assert users is not None
        assert len(users) >= 2
        
        user_names = {user.name for user in users}
        assert "山田 太郎" in user_names
        assert "佐藤 花子" in user_names
        assert all(user.department_id == sales_dept_id for user in users)
        assert all(user.status == 'active' for user in users)
        
        log_data_verification("department_users", {
            "Department ID": sales_dept_id,
            "Users Found": len(users),
            "User Names": list(user_names)
        })
        log_assertion_success("Fetched department users successfully")

    @pytest.mark.asyncio
    async def test_search_departments(self, department_repo: DepartmentRepository):
        """Test searching for departments with various criteria"""
        log_test_start("search_departments")

        # 1. Search by name
        logging.info("1. Testing search by name ('Engine')")
        results = await department_repo.search_departments(search_term="Engine")
        assert len(results) >= 1
        assert results[0].name == "Engineering"
        log_assertion_success("Search by name successful")

        # 2. Search with filter (has_users)
        logging.info("2. Testing search with filter (has_users=True)")
        results_with_users = await department_repo.search_departments(filters={"has_users": True})
        assert len(results_with_users) >= 3  # Engineering, Sales, HR should have users

        dept_names = {d.name for d in results_with_users}
        assert "Engineering" in dept_names
        assert "Sales" in dept_names
        assert "Human Resources" in dept_names
        log_assertion_success("Search with has_users filter successful")

        # 3. Search with pagination
        logging.info("3. Testing search with pagination (limit=2)")
        paginated_results = await department_repo.search_departments(
            pagination=PaginationParams(page=1, limit=2)
        )
        assert len(paginated_results) <= 2
        log_assertion_success("Search with pagination successful")
        
        # 4. Empty search
        logging.info("4. Testing empty search term (should return all with pagination)")
        all_paginated = await department_repo.search_departments(pagination=PaginationParams(page=1, limit=10))
        assert len(all_paginated) >= 4
        log_assertion_success("Empty search returned results")

    @pytest.mark.asyncio
    async def test_autocomplete_departments(self, department_repo: DepartmentRepository):
        """Test autocomplete search for departments"""
        log_test_start("autocomplete_departments")

        logging.info("Testing autocomplete with 'Sal'")
        results = await department_repo.autocomplete_departments("Sal", limit=5)
        
        assert len(results) >= 1
        assert results[0].name == "Sales"  # Should be prioritized
        log_assertion_success("Autocomplete search successful")

    @pytest.mark.asyncio
    async def test_count_departments(self, department_repo: DepartmentRepository):
        """Test counting departments with and without filters"""
        log_test_start("count_departments")

        # 1. Total count
        total_count = await department_repo.count_departments()
        assert total_count >= 4
        log_assertion_success(f"Total count successful: {total_count}")

        # 2. Count with filter
        count_with_users = await department_repo.count_departments(filters={"has_users": True})
        assert count_with_users >= 3
        log_assertion_success(f"Count with filter successful: {count_with_users}")

    @pytest.mark.asyncio
    async def test_create_update_delete_flow(self, department_repo: DepartmentRepository, session: AsyncSession):
        """Test the full lifecycle of a department: create, update, delete"""
        log_test_start("create_update_delete_flow")
        
        unique_name = f"Temp Dept {uuid4().hex[:6]}"
        created_dept = None

        try:
            # 1. Create
            logging.info(f"1. Creating department: '{unique_name}'")
            create_schema = DepartmentCreate(name=unique_name, description="A temporary department")
            created_dept = await department_repo.create_department(create_schema)
            await session.commit()  # Commit to make it available for subsequent queries
            
            assert created_dept is not None
            assert created_dept.name == unique_name
            log_assertion_success(f"Department created with ID: {created_dept.id}")

            # 2. Update
            logging.info(f"2. Updating department ID: {created_dept.id}")
            updated_name = f"Updated Dept {uuid4().hex[:6]}"
            update_schema = DepartmentUpdate(name=updated_name, description="Updated description")
            updated_dept = await department_repo.update_department(created_dept.id, update_schema)
            await session.commit()
            
            assert updated_dept is not None
            assert updated_dept.name == updated_name
            assert updated_dept.description == "Updated description"
            log_assertion_success(f"Department updated to name: '{updated_name}'")

        finally:
            # 3. Delete
            if created_dept:
                logging.info(f"3. Deleting department ID: {created_dept.id}")
                deleted = await department_repo.delete_department(created_dept.id)
                await session.commit()
                
                assert deleted is True
                # Verify it's gone
                verified_deleted = await department_repo.get_by_id(created_dept.id)
                assert verified_deleted is None
                log_assertion_success(f"Department deleted successfully")

    @pytest.mark.asyncio
    async def test_delete_department_with_users_fails(self, department_repo: DepartmentRepository):
        """Test that deleting a department with active users raises a ValueError"""
        log_test_start("delete_department_with_users_fails")
        
        sales_dept_id = self.SEED_DEPARTMENT_IDS["sales"]
        logging.info(f"Attempting to delete department with active users: {sales_dept_id}")
        
        with pytest.raises(ValueError) as excinfo:
            await department_repo.delete_department(sales_dept_id)
            
        assert "Cannot delete department with" in str(excinfo.value)
        log_assertion_success("Correctly prevented deletion of department with users")

    @pytest.mark.asyncio
    async def test_create_duplicate_name_fails(self, department_repo: DepartmentRepository):
        """Test that creating a department with a duplicate name raises a ValueError"""
        log_test_start("create_duplicate_name_fails")

        create_schema = DepartmentCreate(name="Engineering", description="This should fail")
        logging.info(f"Attempting to create department with duplicate name: 'Engineering'")

        with pytest.raises(ValueError) as excinfo:
            await department_repo.create_department(create_schema)
            
        assert "already exists" in str(excinfo.value)
        log_assertion_success("Correctly prevented creation of department with duplicate name")

    @pytest.mark.asyncio
    async def test_supabase_connectivity(self, department_repo: DepartmentRepository):
        """Test basic Supabase database connectivity"""
        log_test_start("supabase_connectivity")
        
        try:
            # Test basic connectivity by counting departments
            logging.info("Testing basic database connection...")
            all_departments = await department_repo.get_all()
            
            # Log connectivity success
            logging.info("✅ Supabase connection successful")
            logging.info(f"   Retrieved {len(all_departments)} records from departments")
            
            # Verify we can access the database
            assert len(all_departments) >= 0, "Should be able to query departments table"
            log_assertion_success("Database connectivity verified")
            
        except Exception as e:
            logging.error(f"❌ Supabase connectivity failed: {str(e)}")
            logging.error(f"   Connection error type: {type(e).__name__}")
            raise

    @pytest.mark.asyncio
    async def test_all_seed_departments_exist(self, department_repo: DepartmentRepository):
        """Verify all seed departments exist in database"""
        log_test_start("all_seed_departments_exist")
        
        expected_departments = {
            "sales": "Sales",
            "engineering": "Engineering", 
            "hr": "Human Resources",
            "marketing": "Marketing"
        }
        
        for key, expected_name in expected_departments.items():
            dept_id = self.SEED_DEPARTMENT_IDS[key]
            department = await department_repo.get_by_id(dept_id)
            logging.info(f"   {key}: {'✅ Found' if department else '❌ Missing'}")
            assert department is not None, f"Seed department {key} not found"
            assert department.name == expected_name, f"Expected '{expected_name}', got '{department.name}'"
        
        log_assertion_success("All seed departments found in database")


if __name__ == "__main__":
    import sys
    import inspect
    
    async def run_tests(selected_test: str = None):
        logging.info("=== Department Repository Test Execution ===")
        logging.info(f"Log file location: {TEST_LOG_FILE}")
        
        async for session in get_db_session():
            logging.info("✅ Database session acquired")
            repo = DepartmentRepository(session)
            test_instance = TestDepartmentRepository()
            
            available_tests = [
                (name, func) for name, func in inspect.getmembers(test_instance, predicate=inspect.iscoroutinefunction)
                if name.startswith("test_")
            ]
            
            tests_to_run = available_tests
            if selected_test:
                tests_to_run = [(name, func) for name, func in available_tests if name == selected_test]
                if not tests_to_run:
                    logging.error(f"❌ Test '{selected_test}' not found!")
                    logging.info("Available tests: " + ", ".join([name for name, _ in available_tests]))
                    return
            
            passed_tests, failed_tests = 0, 0
            
            for test_name, test_func in tests_to_run:
                try:
                    logging.info(f"\n{'='*60}\nRunning: {test_name}\n{'='*60}")
                    
                    sig = inspect.signature(test_func)
                    if 'session' in sig.parameters:
                        await test_func(repo, session)
                    else:
                        await test_func(repo)
                    
                    passed_tests += 1
                    logging.info(f"✅ {test_name} - PASSED")
                    
                except Exception as e:
                    failed_tests += 1
                    logging.error(f"❌ {test_name} - FAILED: {str(e)}", exc_info=True)
            
            logging.info(f"\n{'='*60}\nDEPARTMENT REPOSITORY TEST SUMMARY\n{'='*60}")
            logging.info(f"Total tests run: {len(tests_to_run)}")
            logging.info(f"Passed: {passed_tests}, Failed: {failed_tests}")
            logging.info(f"Success rate: {(passed_tests/len(tests_to_run)*100):.1f}%")
            
            if failed_tests == 0:
                logging.info("🎉 All tests completed successfully!")
            else:
                logging.error(f"❌ {failed_tests} test(s) failed.")
                
            break
    
    def show_usage():
        print("="*60 + "\nDEPARTMENT REPOSITORY TEST RUNNER\n" + "="*60)
        print("\nUsage:")
        print("  python test_department_repo.py [test_name]")
        print("  python -m tests.repositories.test_department_repo [test_name]")
        print("\nAvailable Tests:")
        test_names = [
            'supabase_connectivity', 'get_by_id', 'get_by_name', 'get_all', 
            'get_department_users', 'search_departments', 'autocomplete_departments', 
            'count_departments', 'create_update_delete_flow', 'delete_department_with_users_fails',
            'create_duplicate_name_fails', 'all_seed_departments_exist'
        ]
        for name in test_names:
            print(f"  {name}")
        print("\nLogs are saved to backend/tests/logs/")
    
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg in ["--help", "-h"]:
            show_usage()
        else:
            asyncio.run(run_tests(arg))
    else:
        asyncio.run(run_tests()) 