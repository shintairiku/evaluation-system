# Supervisor Review for Self-Assessment Buckets

Goal: allow supervisors to review self-assessment submissions (goal ratings + comments) per bucket, approve/reject with comments, and have these items counted in the existing goal-review pending counter.

## Scope
- Surfaces self-assessment submissions to supervisors alongside regular goals.
- Aggregates goals into two buckets: 業績目標（定量＋定性） and コンピテンシー.
- Supervisor can approve or reject each bucket; rejection requires a comment, approval comment optional.
- Updates pending counter in supervisor goal-review page to include self-assessment items.
- Writes results to `supervisor_feedback` (one per self-assessment submission/user/period, with per-bucket decision stored in the payload).

## UX / UI
- Goal-review page sidebar counter: pending = existing goal review pending + self-assessment pending for current period.
- New card type in goal-review list:
  - Header: employee name, period, label “自己評価レビュー”.
  - Body sections per bucket showing: bucket name, employee rating code, employee comment, computed contribution (optional), and stage weights for context.
  - Actions per bucket: Approve or Reject (Reject requires comment textarea).
  - Global submit: confirm modal summarizing decisions; saves via API and updates counter.
- Empty states: if no pending self-assessment items, nothing new appears.
- Layout (match spreadsheet-style card):
  - Columns per bucket: Performance（業績：定量＋定性）, Competency（コンピテンシー）, Core Value（コアバリュー）.
  - For cada bucket mostrar: 最終評価 (nota do funcionário), ウェイト (%), 点数 (pontos calculados).
  - Linhas: linha base (nota enviada pelo colaborador) e, se o supervisor recalcular, segunda linha com nota/pontos ajustados.
  - À direita, um bloco de resumo com 合計（点） e 総合評価 (grade final) que atualiza conforme aprovação/rejeição/recalculo.

## Data Flow
1) Employee submits self-assessment (existing `/self-assessments/submit`), which already upserts `self_assessment_summaries` and auto-creates `supervisor_feedback` draft.
2) Supervisor goal-review fetch includes these draft feedback records for period/org.
3) Approve/Reject per bucket updates `supervisor_feedback` with statuses and comments, then marks overall feedback as `submitted`.
4) After submission, employee page fetch reflects supervisor decision and allows resubmission only for rejected buckets.

## API / Backend
- Extend `SupervisorFeedbackRepository` to support filtering by period/org where `status = 'draft'` to power the pending counter.
- Add fields to `supervisor_feedback` payload (JSON) or columns to store per-bucket decision/comment (if column-based, consider JSONB `bucket_decisions`).
- New endpoints for supervisor review of self-assessment:
  - `GET /self-assessments/review?periodId=...` → list pending items with buckets.
  - `POST /self-assessments/review/{feedbackId}/decision` body `{ buckets: [{ bucket, status: 'approved'|'rejected', comment? }] }` → updates feedback and sets status submitted.
- RBAC: supervisor must have `ASSET_READ_SUBORDINATES` or equivalent; enforce org scope.

## Pending Counter Logic
SQL-like: count(distinct self_assessment_id) from `supervisor_feedback` where `status='draft'`, `period_id = current`, org matches, supervisor matches access. Add to existing goal-review pending total.

## Validation Rules
- Reject requires non-empty comment per bucket.
- Approve comment optional.
- Cannot submit if any bucket missing decision.
- Optimistic concurrency: use `updated_at` check or eTag-equivalent to avoid overwriting.

## Open Questions
- Storage for per-bucket decisions: reuse existing columns or add JSONB? (Proposed: JSONB `bucket_decisions` keyed by bucket.)
- Should supervisor be able to edit after submit? Default: no; require admin override.
- Should approval auto-lock employee editing immediately, or only once both buckets approved? Proposed: lock approved buckets; allow edit only for rejected buckets.
