from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey, text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship
from sqlalchemy.schema import Index

from .base import Base


class SupportDocument(Base):
    """
    Support document model for storing links and files that help users
    during evaluation filling (e.g., competency criteria, manuals, external references).
    """
    __tablename__ = "support_documents"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    document_type = Column(String(10), nullable=False, default="link")
    url = Column(Text, nullable=True)
    file_path = Column(Text, nullable=True)
    file_name = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, default="general")
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        CheckConstraint("document_type IN ('link', 'file')", name='chk_support_doc_type'),
        CheckConstraint(
            "(document_type = 'link' AND url IS NOT NULL) OR (document_type = 'file' AND file_path IS NOT NULL)",
            name='chk_support_doc_content'
        ),
        Index('idx_support_docs_org', 'organization_id'),
        Index('idx_support_docs_org_category', 'organization_id', 'category', 'display_order'),
    )

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<SupportDocument(id={self.id}, title={self.title}, type={self.document_type})>"
