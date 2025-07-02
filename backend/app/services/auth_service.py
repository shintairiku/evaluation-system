from typing import Optional
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.session import get_db_session
from ..database.repositories.user_repo import UserRepository
from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.role_repo import RoleRepository
from ..schemas.user import UserDetailResponse, Department, Stage, Role, UserProfileOption
from ..schemas.auth import UserSignUpRequest, SignUpOptionsResponse

class AuthService:
    """Service for handling user authentication operations."""

    def __init__(self, session: AsyncSession = Depends(get_db_session)):
        self.session = session
        self.user_repo = UserRepository(session)
        self.department_repo = DepartmentRepository(session)
        self.stage_repo = StageRepository(session)
        self.role_repo = RoleRepository(session)

    async def get_profile_options(self) -> SignUpOptionsResponse:
        """Get all available options for profile completion."""
        # Fetch raw data from repositories
        departments_data = await self.department_repo.get_all()
        stages_data = await self.stage_repo.get_all()
        roles_data = await self.role_repo.get_all()
        users_data = await self.user_repo.get_active_users()
        
        # Convert SQLAlchemy models to Pydantic models
        departments = [Department.model_validate(dept, from_attributes=True) for dept in departments_data]
        stages = [Stage.model_validate(stage, from_attributes=True) for stage in stages_data]
        roles = [Role.model_validate(role, from_attributes=True) for role in roles_data]
        
        # Create simple user options without complex relationships
        users = []
        for user_data in users_data:
            user_option = UserProfileOption(
                id=user_data.id,
                name=user_data.name,
                email=user_data.email,
                employee_code=user_data.employee_code,
                job_title=user_data.job_title,
                roles=[Role.model_validate(role, from_attributes=True) for role in user_data.roles]
            )
            users.append(user_option)
        
        return SignUpOptionsResponse(
            departments=departments,
            stages=stages,
            roles=roles,
            users=users
        )