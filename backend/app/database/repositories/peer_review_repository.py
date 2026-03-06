# Re-export for backward compatibility
from .peer_review_assignment_repo import PeerReviewAssignmentRepository
from .peer_review_evaluation_repo import PeerReviewEvaluationRepository

__all__ = [
    "PeerReviewAssignmentRepository",
    "PeerReviewEvaluationRepository",
]
