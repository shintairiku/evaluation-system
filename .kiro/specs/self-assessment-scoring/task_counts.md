# Pending Counter Calculation (Self-Assessment + Goals)

Goal: add a pending badge/count for the dedicated self-assessment-review page (goal-review badge stays unchanged).

## Definition
pending_self_assessment_reviews = count of self-assessment feedback drafts for current period (use to show badge on new page/dashboard card)
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
- Badge/alert para página (ou card do dashboard) mostrando apenas pendências de self-assessment.
- Lista da nova página usa mesma consulta; tratar zero pendências.

## Open Questions
- Should we show bucket-level pending count instead of per-assessment? (Keeping per-assessment for simplicity.)
- If multiple supervisors share a subordinate, should items appear for all or assigned one? (TBD; current assumption: primary supervisor only.)
