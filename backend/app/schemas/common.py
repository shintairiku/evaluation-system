from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field
from enum import Enum

T = TypeVar('T')

# Submission Statues (used in self-assessment, supervisor review, and supervisor feedback)
class SubmissionStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"

class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Page number (1-based)")
    limit: int = Field(default=20, ge=1, le=100, description="Items per page")
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int
    pages: int
    
    @classmethod
    def create(cls, items: List[T], total: int, pagination: PaginationParams):
        pages = (total + pagination.limit - 1) // pagination.limit
        return cls(
            items=items,
            total=total,
            page=pagination.page,
            limit=pagination.limit,
            pages=pages
        )


class BaseResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    error: bool = True
    message: str
    status_code: int


class HealthCheckResponse(BaseModel):
    status: str = "healthy"
    timestamp: str
    version: str = "1.0.0"