from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from .stage_competency import Stage
from .user import Department, Role, UserDetailResponse, UserStatus


class UserListPageMeta(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    approximate_total: bool = False
    next_cursor: Optional[str] = None


class UserListPageFilters(BaseModel):
    search: Optional[str] = None
    statuses: Optional[List[UserStatus]] = None
    department_ids: Optional[List[UUID]] = None
    stage_ids: Optional[List[UUID]] = None
    role_ids: Optional[List[UUID]] = None
    supervisor_id: Optional[UUID] = None

    departments: List[Department] = Field(default_factory=list)
    stages: List[Stage] = Field(default_factory=list)
    roles: List[Role] = Field(default_factory=list)


class UserListPageResponse(BaseModel):
    users: List[UserDetailResponse]
    meta: UserListPageMeta
    filters: UserListPageFilters
