# Import all schemas to ensure they are registered
from .auth import *
from .common import *
from .department import *
from .evaluation import *
from .goal import *
from .self_assessment import *
from .supervisor_feedback import *  
from .supervisor_review import *
from .user import *
from .stage_competency import *

# Rebuild models with forward references after all schemas are imported
def rebuild_schema_models():
    """Rebuild all models that have forward references after all schemas are loaded"""
    try:
        # Import locally to avoid circular dependencies
        from .stage_competency import StageDetail, CompetencyDetail
        from .user import UserDetailResponse, DepartmentDetail, RoleDetail, User
        
        # Rebuild models with forward references
        StageDetail.model_rebuild()
        CompetencyDetail.model_rebuild()
        UserDetailResponse.model_rebuild()
        DepartmentDetail.model_rebuild()
        RoleDetail.model_rebuild()
        User.model_rebuild()
        
    except Exception as e:
        # Log the error but don't crash the application
        import logging
        logging.warning(f"Failed to rebuild schema models: {e}")

# Call rebuild function
rebuild_schema_models()