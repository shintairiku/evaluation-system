import pytest
from pydantic import ValidationError

from app.schemas.supervisor_feedback import SupervisorFeedbackSubmit


def test_supervisor_feedback_submit_allows_only_approved_action():
    with pytest.raises(ValidationError, match="Only APPROVED is supported"):
        SupervisorFeedbackSubmit(action="PENDING")

