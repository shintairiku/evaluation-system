# Pending Counter Calculation (Self-Assessment + Goals)

Goal: include self-assessment reviews in the supervisor goal-review pending badge.

## Definition
pending_total = pending_goal_reviews + pending_self_assessment_reviews

### pending_goal_reviews
Existing logic (unchanged): goals with status submitted/awaiting supervisor action.

### pending_self_assessment_reviews
Count self-assessment feedback drafts for current period:
- `supervisor_feedback.status = 'draft'`
- `period_id = current_period`
- Org scoped.
- (Optional) Filter by supervisor assignment if multi-supervisor is supported.

SQL sketch:
```sql
SELECT COUNT(*)
FROM supervisor_feedback sf
JOIN self_assessments sa ON sa.id = sf.self_assessment_id
JOIN goals g ON g.id = sa.goal_id
JOIN users u ON u.id = g.user_id
WHERE sf.status = 'draft'
  AND sf.period_id = :current_period
  AND u.clerk_organization_id = :org
  -- AND sf.supervisor_id = :user_id  -- if needed
```

## Frontend
- Fetch combined pending count for badge display.
- Update goal-review list fetch to include self-assessment review items.
- Handle zero pending gracefully.

## Open Questions
- Should we show bucket-level pending count instead of per-assessment? (Keeping per-assessment for simplicity.)
- If multiple supervisors share a subordinate, should items appear for all or assigned one? (TBD; current assumption: primary supervisor only.)
