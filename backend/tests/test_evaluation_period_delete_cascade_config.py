def test_evaluation_period_delete_uses_db_cascade():
    """
    Regression test for a production 500 when deleting evaluation periods.

    Child tables use FK constraints with ON DELETE CASCADE, so the parent-side
    SQLAlchemy relationships must set passive_deletes=True to avoid SQLAlchemy
    issuing UPDATE ... SET period_id = NULL against non-nullable columns.
    """
    from app.database.models.evaluation import EvaluationPeriod
    from app.database.models.goal import Goal
    from app.database.models.self_assessment import SelfAssessment
    from app.database.models.supervisor_feedback import SupervisorFeedback

    assert EvaluationPeriod.goals.property.passive_deletes is True
    assert EvaluationPeriod.self_assessments.property.passive_deletes is True
    assert EvaluationPeriod.supervisor_feedbacks.property.passive_deletes is True

    goal_fk = next(iter(Goal.__table__.c.period_id.foreign_keys))
    self_assessment_fk = next(iter(SelfAssessment.__table__.c.period_id.foreign_keys))
    supervisor_feedback_fk = next(iter(SupervisorFeedback.__table__.c.period_id.foreign_keys))

    assert goal_fk.ondelete == "CASCADE"
    assert self_assessment_fk.ondelete == "CASCADE"
    assert supervisor_feedback_fk.ondelete == "CASCADE"

