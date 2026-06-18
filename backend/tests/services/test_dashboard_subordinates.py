"""
Tests for DashboardService._build_subordinates_list — the pure (no-DB) computation
extracted from _get_subordinates_list when it was batched to remove the per-subordinate
N+1. These lock in behavioural equivalence with the previous per-subordinate logic
(status/priority mapping, needs_attention_count, sort order, department mapping).
"""

from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4

from app.services.dashboard_service import DashboardService
from app.schemas.dashboard import SubordinateStatus, TaskPriority


def _sub(name, *, department_id=None):
    return SimpleNamespace(
        id=uuid4(),
        name=name,
        employee_code=name,
        department_id=department_id,
        updated_at=datetime(2026, 1, 1),
    )


def _goal(status):
    return SimpleNamespace(status=status)


def _feedback(status):
    return SimpleNamespace(status=status)


def test_status_priority_attention_and_sort():
    # One subordinate per status, names chosen so the sort is observable.
    s_goals = _sub("B-pending-goals")      # has a submitted goal -> NEEDS_GOAL_APPROVAL
    s_feedback = _sub("A-needs-feedback")  # self done, no feedback -> NEEDS_FEEDBACK
    s_delayed = _sub("C-delayed")          # no goals -> DELAYED
    s_ontrack = _sub("D-on-track")         # goals + self + feedback submitted -> ON_TRACK

    subordinates = [s_goals, s_feedback, s_delayed, s_ontrack]
    goals_by_user = {
        s_goals.id: [_goal("submitted"), _goal("approved")],
        s_feedback.id: [_goal("approved")],
        s_ontrack.id: [_goal("approved")],
        # s_delayed: no entry -> no goals
    }
    self_completed_ids = {s_feedback.id, s_ontrack.id}
    feedback_by_user = {s_ontrack.id: _feedback("submitted")}  # feedback only for on-track

    result = DashboardService._build_subordinates_list(
        subordinates=subordinates,
        has_current_period=True,
        dept_name_by_id={},
        goals_by_user=goals_by_user,
        self_completed_ids=self_completed_ids,
        feedback_by_user=feedback_by_user,
    )

    by_name = {s.name: s for s in result.subordinates}
    assert by_name["B-pending-goals"].status == SubordinateStatus.NEEDS_GOAL_APPROVAL
    assert by_name["B-pending-goals"].priority == TaskPriority.HIGH
    assert by_name["B-pending-goals"].has_pending_goals is True

    assert by_name["A-needs-feedback"].status == SubordinateStatus.NEEDS_FEEDBACK
    assert by_name["A-needs-feedback"].priority == TaskPriority.HIGH
    assert by_name["A-needs-feedback"].has_pending_feedback is True

    assert by_name["C-delayed"].status == SubordinateStatus.DELAYED
    assert by_name["C-delayed"].priority == TaskPriority.MEDIUM
    assert by_name["C-delayed"].goals_count == 0

    assert by_name["D-on-track"].status == SubordinateStatus.ON_TRACK
    assert by_name["D-on-track"].priority == TaskPriority.LOW
    assert by_name["D-on-track"].feedback_provided is True
    assert by_name["D-on-track"].goals_approved_count == 1

    # needs_attention = the two HIGH + the MEDIUM (on-track excluded)
    assert result.needs_attention_count == 3
    assert result.total_subordinates == 4

    # Sort: HIGH (by name) -> MEDIUM -> LOW
    assert [s.name for s in result.subordinates] == [
        "A-needs-feedback", "B-pending-goals", "C-delayed", "D-on-track",
    ]


def test_no_current_period_marks_all_delayed():
    subs = [_sub("x"), _sub("y")]
    result = DashboardService._build_subordinates_list(
        subordinates=subs,
        has_current_period=False,
        dept_name_by_id={},
        goals_by_user={subs[0].id: [_goal("approved")]},  # ignored when no period
        self_completed_ids={subs[0].id},                  # ignored when no period
        feedback_by_user={},
    )
    for info in result.subordinates:
        assert info.status == SubordinateStatus.DELAYED
        assert info.priority == TaskPriority.MEDIUM
        assert info.goals_count == 0
        assert info.self_assessment_completed is False
    assert result.needs_attention_count == 2


def test_self_assessment_done_but_feedback_pending_is_high_priority():
    s = _sub("solo")
    result = DashboardService._build_subordinates_list(
        subordinates=[s],
        has_current_period=True,
        dept_name_by_id={},
        goals_by_user={s.id: [_goal("approved")]},
        self_completed_ids={s.id},
        feedback_by_user={},  # no feedback row -> pending
    )
    info = result.subordinates[0]
    assert info.self_assessment_completed is True
    assert info.has_pending_feedback is True
    assert info.feedback_provided is False
    assert info.status == SubordinateStatus.NEEDS_FEEDBACK
    assert info.priority == TaskPriority.HIGH


def test_department_name_mapping():
    dept_id = uuid4()
    s_with = _sub("has-dept", department_id=dept_id)
    s_without = _sub("no-dept", department_id=None)
    result = DashboardService._build_subordinates_list(
        subordinates=[s_with, s_without],
        has_current_period=True,
        dept_name_by_id={dept_id: "営業部"},
        goals_by_user={},
        self_completed_ids=set(),
        feedback_by_user={},
    )
    by_name = {s.name: s for s in result.subordinates}
    assert by_name["has-dept"].department_name == "営業部"
    assert by_name["no-dept"].department_name is None
