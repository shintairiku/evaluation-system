from fastapi import APIRouter

from .users import router as user_router
from .roles import router as role_router
from .departments import router as department_router
from .stages import router as stage_router
from .permissions import router as permission_router
from .admin import router as admin_router

from .goals import router as goal_router
from .supervisor_reviews import router as supervisor_review_router

from .evaluation_periods import router as evaluation_period_router
from .competencies import router as competency_router
from .self_assessments import router as self_assessment_router
from .supervisor_feedbacks import router as supervisor_feedback_router
from .dashboard import router as dashboard_router
from .self_assessment_summary import router as self_assessment_summary_router

# from .reports import router as reports_router  # Will be defined in the future
# from .webhooks import router as webhooks_router


# Organization-scoped API router (enterprise-only)
org_api_router = APIRouter(prefix="/api/org/{org_slug}")

# Organization-scoped routes (auth is handled separately as organization-agnostic)
org_api_router.include_router(user_router)
org_api_router.include_router(role_router)
org_api_router.include_router(department_router)
org_api_router.include_router(stage_router)
org_api_router.include_router(permission_router)
org_api_router.include_router(admin_router)
org_api_router.include_router(goal_router)
org_api_router.include_router(supervisor_review_router)
org_api_router.include_router(evaluation_period_router)
org_api_router.include_router(competency_router)
org_api_router.include_router(self_assessment_router)
org_api_router.include_router(self_assessment_summary_router)
org_api_router.include_router(supervisor_feedback_router)
org_api_router.include_router(dashboard_router)

# api_router.include_router(reports_router)

# Webhooks should be registered without the /api/v1 prefix
webhooks_router_root = APIRouter()
# webhooks_router_root.include_router(webhooks_router)
