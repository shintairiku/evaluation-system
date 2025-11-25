from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from ..security.viewer_visibility import ViewerSubjectType
from ..security.rbac_types import ResourceType


class ViewerVisibilityOverridePayload(BaseModel):
    subject_type: ViewerSubjectType = Field(..., description="Target scope for the grant")
    subject_id: UUID = Field(..., description="UUID of the target entity")
    resource_type: ResourceType = Field(..., description="Resource type being granted")


class ViewerVisibilityUpdateRequest(BaseModel):
    grants: List[ViewerVisibilityOverridePayload] = Field(
        default_factory=list,
        description="Replacement set of viewer visibility overrides",
    )
    version: Optional[str] = Field(
        default=None,
        description="Current concurrency token for viewer visibility grants",
    )


class ViewerVisibilityPatchRequest(BaseModel):
    add: List[ViewerVisibilityOverridePayload] = Field(
        default_factory=list,
        description="Grants to add",
    )
    remove: List[ViewerVisibilityOverridePayload] = Field(
        default_factory=list,
        description="Grants to remove",
    )
    version: Optional[str] = Field(
        default=None,
        description="Current concurrency token for viewer visibility grants",
    )


class ViewerVisibilityGrantItem(BaseModel):
    subject_type: ViewerSubjectType
    subject_id: UUID
    resource_type: ResourceType
    created_by: Optional[UUID]
    created_at: datetime


class ViewerVisibilityResponse(BaseModel):
    viewer_user_id: UUID
    version: str = Field(..., description="Optimistic concurrency token")
    grants: List[ViewerVisibilityGrantItem] = Field(default_factory=list)
