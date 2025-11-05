from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PermissionCatalogItem(BaseModel):
    code: str = Field(..., description="Permission code (e.g., user:read:all)")
    description: str = Field("", description="Human readable description")


class RolePermissionResponse(BaseModel):
    role_id: UUID
    permissions: List[PermissionCatalogItem]
    version: str = Field(..., description="Optimistic concurrency token for the role permission set")


class RolePermissionUpdateRequest(BaseModel):
    permissions: List[str] = Field(default_factory=list)
    version: Optional[str] = Field(
        default=None,
        description="Current concurrency token returned by the API; required to avoid overwriting newer changes",
    )


class RolePermissionPatchRequest(BaseModel):
    add: List[str] = Field(default_factory=list)
    remove: List[str] = Field(default_factory=list)
    version: Optional[str] = Field(
        default=None,
        description="Current concurrency token returned by the API; required to avoid overwriting newer changes",
    )


class RolePermissionCloneRequest(BaseModel):
    from_role_id: UUID = Field(..., description="Source role whose permissions will be cloned")
