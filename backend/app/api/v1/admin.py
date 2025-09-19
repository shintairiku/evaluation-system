from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])

# Admin endpoints will be added here as needed
# Most endpoints address roll-based access control at backend service level, including admin-only operations.