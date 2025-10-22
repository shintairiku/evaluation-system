"""
Test configuration and fixtures for pytest.
Provides database session management and test isolation.
"""
import asyncio
from datetime import date, datetime
from typing import Any, AsyncGenerator, Dict
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.database.models.organization import Organization
from app.database.models.stage_competency import Stage
from app.database.models.user import (
    Department,
    Role as RoleModel,
    User,
    UserSupervisor,
)
from app.database.session import Base
from app.schemas.user import UserStatus


# Use in-memory SQLite for tests to avoid polluting real database
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    try:
        import aiosqlite  # noqa: F401
    except ModuleNotFoundError as exc:  # pragma: no cover - environment guard
        pytest.skip(f"aiosqlite is required for SQLite async tests: {exc}")  # type: ignore[unreachable]

    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,  # Set to True for SQL debugging
        poolclass=NullPool,
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Cleanup
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session with automatic rollback."""
    TestSessionLocal = sessionmaker(
        bind=test_engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )
    
    async with TestSessionLocal() as session:
        # Start a transaction
        transaction = await session.begin()
        
        try:
            yield session
        finally:
            # Rollback the transaction to ensure test isolation
            await transaction.rollback()
            await session.close()


@pytest_asyncio.fixture
async def seeded_user_data(test_session: AsyncSession) -> Dict[str, Any]:
    """
    Seed minimal organization, department, stage, roles, and users for user list tests.
    Returns dictionary with seeded objects for assertions.
    """
    org = Organization(id="org_test", name="Test Org", slug="test-org")

    engineering = Department(id=uuid4(), organization_id=org.id, name="Engineering")
    product = Department(id=uuid4(), organization_id=org.id, name="Product")

    junior_stage = Stage(id=uuid4(), organization_id=org.id, name="Junior", description="Junior stage")

    role_admin = RoleModel(
        id=uuid4(),
        organization_id=org.id,
        name="Administrator",
        description="Admin role",
        hierarchy_order=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    role_manager = RoleModel(
        id=uuid4(),
        organization_id=org.id,
        name="Manager",
        description="Manager role",
        hierarchy_order=2,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    role_staff = RoleModel(
        id=uuid4(),
        organization_id=org.id,
        name="Staff",
        description="Staff role",
        hierarchy_order=3,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    admin_user = User(
        id=uuid4(),
        clerk_user_id="user_admin",
        clerk_organization_id=org.id,
        name="Alice Admin",
        email="alice@example.com",
        employee_code="E001",
        status=UserStatus.ACTIVE.value,
        job_title="Head of Engineering",
        department_id=engineering.id,
        stage_id=junior_stage.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    manager_user = User(
        id=uuid4(),
        clerk_user_id="user_manager",
        clerk_organization_id=org.id,
        name="Bob Manager",
        email="bob@example.com",
        employee_code="E002",
        status=UserStatus.ACTIVE.value,
        job_title="Engineering Manager",
        department_id=engineering.id,
        stage_id=junior_stage.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    supervisor_user = User(
        id=uuid4(),
        clerk_user_id="user_supervisor",
        clerk_organization_id=org.id,
        name="Charlie Supervisor",
        email="charlie@example.com",
        employee_code="E003",
        status=UserStatus.ACTIVE.value,
        job_title="Team Lead",
        department_id=product.id,
        stage_id=junior_stage.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    staff_user = User(
        id=uuid4(),
        clerk_user_id="user_staff",
        clerk_organization_id=org.id,
        name="Dana Staff",
        email="dana@example.com",
        employee_code="E004",
        status=UserStatus.ACTIVE.value,
        job_title="Engineer",
        department_id=engineering.id,
        stage_id=junior_stage.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    admin_user.roles.append(role_admin)
    manager_user.roles.append(role_manager)
    supervisor_user.roles.append(role_manager)
    staff_user.roles.append(role_staff)

    supervisor_link = UserSupervisor(
        user_id=staff_user.id,
        supervisor_id=manager_user.id,
        valid_from=date.today(),
    )

    test_session.add_all(
        [
            org,
            engineering,
            product,
            junior_stage,
            role_admin,
            role_manager,
            role_staff,
            admin_user,
            manager_user,
            supervisor_user,
            staff_user,
            supervisor_link,
        ]
    )

    await test_session.flush()

    return {
        "org": org,
        "departments": {
            "engineering": engineering,
            "product": product,
        },
        "stage": junior_stage,
        "roles": {
            "admin": role_admin,
            "manager": role_manager,
            "staff": role_staff,
        },
        "users": {
            "admin": admin_user,
            "manager": manager_user,
            "supervisor": supervisor_user,
            "staff": staff_user,
        },
    }
