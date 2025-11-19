# Backend Follow-ups for Self-Assessment Supervisor Review

## Objectives
- Expose supervisor-facing APIs to review self-assessment buckets and record approve/reject decisions on a dedicated flow (goal-review remains untouched).
- Enrich employee context responses with supervisor decision status and comments.
- Provide a self-assessment pending counter/badge with proper RBAC scoping.

## Repository / Model Changes
- `supervisor_feedback` table: add JSONB `bucket_decisions` (or equivalent columns) storing per-bucket `{ status, comment, decided_at, decided_by }` keyed by bucket name.
- `SupervisorFeedbackRepository`:
  - Filter by org/period/supervisor for pending (status draft) items.
  - Upsert bucket decisions, set `status='submitted'`, `submitted_at=now` on final submit.
- `SelfAssessmentSummaryRepository`: no change; keep summary as-is. Derive status by joining `supervisor_feedback`.

## Services
- `SelfAssessmentService.get_self_assessment_context`:
  - Join in `supervisor_feedback` for the user/period and map per-bucket status/comment into `summary.perBucketStatus` and overall `summary.status`.
- New `SupervisorFeedbackService` methods:
  - `list_self_assessment_reviews(period_id, supervisor_id, org_id)`
  - `submit_bucket_decisions(feedback_id, decisions[])` with validation (reject needs comment).

## API Endpoints (FastAPI)
- `GET /self-assessments/review?periodId=...` → list pending review items for supervisor.
- `POST /self-assessments/review/{feedbackId}/decision` → body with bucket decisions; returns updated feedback with status submitted.
- RBAC: require `ASSESSMENT_READ_SUBORDINATES` or `ASSESSMENT_READ_ALL`; scope by organization.

## Counter Calculation
- Pending self-assessment review count: `count(distinct self_assessment_id)` from `supervisor_feedback` where `status='draft'`, `period_id=current`, org matches, and supervisor has access. Use for the new page/dashboard badge (do not modify goal-review badge).

## Validation Rules
- Reject requires non-empty comment per bucket.
- Cannot submit if any bucket lacks a decision.
- Optimistic concurrency: optional `If-Match` or `updated_at` precondition to avoid conflicts.

## Open Questions
- Should we allow multiple supervisors? If yes, need aggregation/assignment rules.
- Should approved buckets lock out future edits even if other buckets are pending? Proposed: yes, lock approved; allow edits only on rejected buckets.
