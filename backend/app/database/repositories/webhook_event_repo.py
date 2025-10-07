import logging
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime

from ..models.webhook_event import WebhookEvent

logger = logging.getLogger(__name__)

class WebhookEventRepository:
    """Repository for webhook event tracking and idempotency."""
    
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_event_id(self, event_id: str) -> Optional[WebhookEvent]:
        """Get webhook event by event ID."""
        try:
            result = await self.session.execute(
                select(WebhookEvent).filter(WebhookEvent.event_id == event_id)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching webhook event by ID {event_id}: {e}")
            raise

    async def create_event_record(self, event_id: str, event_type: str) -> WebhookEvent:
        """Create a webhook event record for idempotency tracking."""
        try:
            webhook_event = WebhookEvent(
                event_id=event_id,
                event_type=event_type,
                processed_at=datetime.utcnow()
            )
            
            self.session.add(webhook_event)
            await self.session.flush()
            
            logger.info(f"Webhook event recorded: {event_id} ({event_type})")
            return webhook_event
        except SQLAlchemyError as e:
            logger.error(f"Error creating webhook event record: {e}")
            raise