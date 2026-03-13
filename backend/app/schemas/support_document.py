from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID


class SupportDocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    document_type: str = Field(default="link", pattern="^(link|file)$", alias="documentType")
    url: Optional[str] = Field(None, max_length=2000)
    category: str = Field(default="general", max_length=100)
    display_order: int = Field(default=0, alias="displayOrder")

    model_config = {"populate_by_name": True}


class SupportDocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    url: Optional[str] = Field(None, max_length=2000)
    category: Optional[str] = Field(None, max_length=100)
    display_order: Optional[int] = Field(None, alias="displayOrder")
    is_active: Optional[bool] = Field(None, alias="isActive")

    model_config = {"populate_by_name": True}


class SupportDocumentResponse(BaseModel):
    id: UUID
    organization_id: Optional[str] = Field(None, alias="organizationId")
    title: str
    description: Optional[str] = None
    document_type: str = Field(..., alias="documentType")
    url: Optional[str] = None
    file_path: Optional[str] = Field(None, alias="filePath")
    file_name: Optional[str] = Field(None, alias="fileName")
    category: str
    display_order: int = Field(..., alias="displayOrder")
    is_active: bool = Field(..., alias="isActive")
    created_by: Optional[UUID] = Field(None, alias="createdBy")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}


class SupportDocumentListResponse(BaseModel):
    items: List[SupportDocumentResponse]
    categories: List[str]
