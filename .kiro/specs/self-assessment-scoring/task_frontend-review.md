# Frontend Review Tasks (Self-Assessment + Goal Review)

## Goal-Review Page (Supervisor)
- Pending badge: include self-assessment pending items (feedback status draft) for current period.
- List items: add “自己評価レビュー” cards grouped by employee.
  - Show stage weights, final rating, per-bucket rating/comment from employee.
  - Per-bucket Approve/Reject controls; rejection requires comment.
  - Submit actions call new supervisor review endpoint.
- Empty state: hide card type if none pending.
- Layout guidance (match spreadsheet-style card):
  - Columns: Performance（業績：定量＋定性）, Competency（コンピテンシー）, Core Value（コアバリュー）.
  - Each column shows employee rating, weight %, and calculated points; allow optional supervisor recalculated line.
  - Right-side summary block shows 合計（点） and 総合評価 updating as supervisor decisions are made.

## Self-Assessment Page (Employee)
- Submitted summary shows supervisor status per bucket and comment.
- Buckets marked rejected become editable; approved remain read-only.
- On resubmit, call existing submit endpoint (may need new payload field) to trigger fresh supervisor draft and refresh summary.

## Data Layer
- Update self-assessment server actions/types to carry `summary.status`, `perBucketStatus[]`, and supervisor comment.
- Add hooks/queries for supervisor review list and decision submit.

## UI Components
- New bucket review card for supervisor (reuse goal-review styles where possible).
- Status badges: pending, approved, rejected, in_review.
- Comment textarea with validation on reject.

## Edge Cases
- Loading/optimistic UI: disable buttons while submitting decisions.
- Concurrency: handle 409/412 if outdated; prompt to refresh.
- Access: hide controls if user lacks permission.
