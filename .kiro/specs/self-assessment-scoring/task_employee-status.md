# Employee Page Status After Supervisor Review

Goal: reflect supervisor decisions on /self-assessment, per bucket, and allow resubmission for rejected items only.

## States
- `draft`: employee saved; not visible to supervisor.
- `submitted`: employee sent; waiting for supervisor (feedback draft exists).
- `in_review`: supervisor has draft decisions but not submitted.
- `approved`: bucket approved; locked for edits.
- `rejected`: bucket rejected; comment displayed; bucket re-opened for edits.

## UI on /self-assessment
- Submitted summary section (提出済みサマリー) shows:
  - Overall status: derived from buckets (all approved → Approved; any rejected → Rejected; else Submitted/In review).
  - Per-bucket status badge and supervisor comment (if any).
  - Final rating, weighted total, flags, level adjustment as today.
- Editing rules:
  - Approved buckets: fields read-only.
  - Rejected buckets: fields editable; resubmit triggers new summary + resets supervisor feedback to draft for that bucket.
  - Submitted/In review: read-only until supervisor responds, or optionally allow withdraw (TBD).

## Data Needed in Context API
Extend `SelfAssessmentService.get_self_assessment_context` to return:
- `summary.status` (overall), `summary.perBucketStatus[]` with `{ bucket, status, supervisorComment? }`.
- Existing `summary` fields (weights, totals, flags, levelAdjustmentPreview, submittedAt).

## Resubmission Flow
- Employee edits only rejected buckets.
- `submit` sets statuses for edited buckets back to `submitted`, creates/updates `supervisor_feedback` draft scoped to those buckets, and updates summary timestamp.
- Approved buckets stay locked and their decisions remain.

## Validation
- When resubmitting, ensure all buckets with weight>0 have ratings (unchanged for approved buckets; required for rejected buckets being edited).
- Prevent clearing ratings for approved buckets.

## Open Questions
- Should overall weighted score be recomputed on partial resubmission? (Proposed: yes, recompute using latest bucket ratings.)
- Should supervisor be notified of resubmission events? (If yes, emit notification/metric as follow-up.)
