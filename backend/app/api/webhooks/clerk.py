from fastapi import APIRouter, Request, HTTPException, Depends, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
import json
import logging
from typing import Dict, Any, Optional
from svix import Webhook, WebhookVerificationError
import asyncio
from datetime import datetime

from ...database.session import get_db_session
from ...database.repositories.user_repo import UserRepository
from ...database.repositories.organization_repo import OrganizationRepository
from ...database.repositories.webhook_event_repo import WebhookEventRepository
from ...core.config import settings
from ...schemas.user import UserStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/clerk", tags=["webhooks"])

class WebhookProcessor:
    """Handles Clerk webhook events with security, idempotency, and retry logic."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.org_repo = OrganizationRepository(session)
        self.event_repo = WebhookEventRepository(session)

    async def verify_signature(self, payload: bytes, headers: Dict[str, str]) -> None:
        """Verify webhook signature using svix."""
        webhook_secret = settings.CLERK_WEBHOOK_SECRET
        if not webhook_secret:
            logger.error("CLERK_WEBHOOK_SECRET not configured - webhook signature verification disabled")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Webhook configuration error"
            )
        
        try:
            wh = Webhook(webhook_secret)
            wh.verify(payload, headers)
            logger.info("Webhook signature verification successful")
        except WebhookVerificationError as e:
            logger.error(f"Webhook signature verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature"
            )

    async def ensure_idempotency(self, event_id: str, event_type: str) -> bool:
        """Check if event has already been processed to ensure idempotency."""
        try:
            existing_event = await self.event_repo.get_by_event_id(event_id)
            if existing_event:
                logger.info(f"Event {event_id} ({event_type}) already processed, skipping")
                return False
            
            # Record the event to prevent duplicate processing
            await self.event_repo.create_event_record(event_id, event_type)
            return True
        except Exception as e:
            logger.error(f"Error checking event idempotency: {e}")
            raise

    async def process_user_created(self, event_data: Dict[str, Any]) -> None:
        """Process user.created webhook event."""
        try:
            user_data = event_data.get("data", {})
            clerk_user_id = user_data.get("id")
            
            if not clerk_user_id:
                raise ValueError("No user ID in webhook data")
            
            # Extract user information
            email_addresses = user_data.get("email_addresses", [])
            primary_email = None
            for email_obj in email_addresses:
                if email_obj.get("id") == user_data.get("primary_email_address_id"):
                    primary_email = email_obj.get("email_address")
                    break
            
            if not primary_email:
                logger.warning(f"No primary email found for user {clerk_user_id}")
                return
            
            # Get organization membership
            organization_memberships = user_data.get("organization_memberships", [])
            organization_id = None
            if organization_memberships:
                # Take the first organization membership
                organization_id = organization_memberships[0].get("organization", {}).get("id")
            
            # Check if user already exists
            existing_user = await self.user_repo.get_user_by_clerk_id(clerk_user_id)
            if existing_user:
                logger.info(f"User {clerk_user_id} already exists, updating organization if needed")
                if organization_id and existing_user.clerk_organization_id != organization_id:
                    # Update organization membership
                    existing_user.clerk_organization_id = organization_id
                    self.session.add(existing_user)
                    await self.session.commit()
                return
            
            # Create user record if auto-approval is enabled or if it's an organization member
            if organization_id:
                logger.info(f"Creating user record for organization member: {clerk_user_id}")
                # TODO: Implement user creation with organization context
                # This would typically create a pending user record for admin approval
            
            logger.info(f"User created webhook processed: {clerk_user_id}")
            
        except Exception as e:
            logger.error(f"Error processing user.created webhook: {e}")
            raise

    async def process_user_updated(self, event_data: Dict[str, Any]) -> None:
        """Process user.updated webhook event."""
        try:
            user_data = event_data.get("data", {})
            clerk_user_id = user_data.get("id")
            
            if not clerk_user_id:
                raise ValueError("No user ID in webhook data")
            
            existing_user = await self.user_repo.get_user_by_clerk_id(clerk_user_id)
            if not existing_user:
                logger.warning(f"User {clerk_user_id} not found for update webhook")
                return
            
            # Update organization membership if changed
            organization_memberships = user_data.get("organization_memberships", [])
            new_organization_id = None
            if organization_memberships:
                new_organization_id = organization_memberships[0].get("organization", {}).get("id")
            
            if existing_user.clerk_organization_id != new_organization_id:
                logger.info(f"Updating user {clerk_user_id} organization: {existing_user.clerk_organization_id} -> {new_organization_id}")
                existing_user.clerk_organization_id = new_organization_id
                self.session.add(existing_user)
                await self.session.commit()
            
            logger.info(f"User updated webhook processed: {clerk_user_id}")
            
        except Exception as e:
            logger.error(f"Error processing user.updated webhook: {e}")
            raise

    async def process_organization_created(self, event_data: Dict[str, Any]) -> None:
        """Process organization.created webhook event."""
        try:
            org_data = event_data.get("data", {})
            org_id = org_data.get("id")
            org_name = org_data.get("name")
            org_slug = org_data.get("slug")
            
            if not org_id or not org_name:
                raise ValueError("Incomplete organization data in webhook")
            
            # Check if organization already exists
            existing_org = await self.org_repo.get_by_id(org_id)
            if existing_org:
                logger.info(f"Organization {org_id} already exists")
                return
            
            # Create organization record
            await self.org_repo.create_organization({
                "id": org_id,
                "name": org_name,
                "slug": org_slug
            })
            await self.session.commit()
            
            logger.info(f"Organization created: {org_id} ({org_name})")
            
        except Exception as e:
            logger.error(f"Error processing organization.created webhook: {e}")
            raise

    async def process_organization_updated(self, event_data: Dict[str, Any]) -> None:
        """Process organization.updated webhook event."""
        try:
            org_data = event_data.get("data", {})
            org_id = org_data.get("id")
            org_name = org_data.get("name")
            org_slug = org_data.get("slug")
            
            if not org_id:
                raise ValueError("No organization ID in webhook data")
            
            # Update organization
            updated_org = await self.org_repo.update_organization(org_id, {
                "name": org_name,
                "slug": org_slug
            })
            
            if updated_org:
                await self.session.commit()
                logger.info(f"Organization updated: {org_id}")
            else:
                logger.warning(f"Organization {org_id} not found for update")
            
        except Exception as e:
            logger.error(f"Error processing organization.updated webhook: {e}")
            raise

async def process_webhook_with_retry(processor: WebhookProcessor, event_type: str, event_data: Dict[str, Any], max_retries: int = 3):
    """Process webhook with exponential backoff retry logic."""
    for attempt in range(max_retries):
        try:
            if event_type == "user.created":
                await processor.process_user_created(event_data)
            elif event_type == "user.updated":
                await processor.process_user_updated(event_data)
            elif event_type == "organization.created":
                await processor.process_organization_created(event_data)
            elif event_type == "organization.updated":
                await processor.process_organization_updated(event_data)
            else:
                logger.warning(f"Unhandled webhook event type: {event_type}")
            
            # Success - exit retry loop
            break
            
        except Exception as e:
            logger.error(f"Webhook processing attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                # Final attempt failed
                logger.error(f"Webhook processing failed after {max_retries} attempts")
                raise
            
            # Exponential backoff: 1s, 2s, 4s, etc.
            await asyncio.sleep(2 ** attempt)

@router.post("/")
async def handle_clerk_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db_session)
):
    """
    Handle Clerk webhook events with security, idempotency, and retry logic.
    
    Supported events:
    - user.created: New user registration
    - user.updated: User information changes
    - organization.created: New organization creation
    - organization.updated: Organization information changes
    """
    try:
        # Get raw payload and headers
        payload = await request.body()
        headers = dict(request.headers)
        
        processor = WebhookProcessor(session)
        
        # Verify webhook signature
        await processor.verify_signature(payload, headers)
        
        # Parse webhook data
        webhook_data = json.loads(payload.decode())
        event_type = webhook_data.get("type")
        event_id = webhook_data.get("data", {}).get("id", webhook_data.get("id"))
        
        if not event_type or not event_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid webhook data: missing type or id"
            )
        
        # Ensure idempotency
        should_process = await processor.ensure_idempotency(event_id, event_type)
        if not should_process:
            return {"status": "already_processed", "event_id": event_id}
        
        # Process webhook in background with retry logic
        background_tasks.add_task(
            process_webhook_with_retry,
            processor,
            event_type,
            webhook_data
        )
        
        logger.info(f"Webhook queued for processing: {event_type} ({event_id})")
        
        return {
            "status": "accepted",
            "event_type": event_type,
            "event_id": event_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in webhook handler: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error processing webhook"
        )