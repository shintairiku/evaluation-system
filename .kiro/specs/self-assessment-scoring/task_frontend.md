# Task: Frontend Self-Assessment Experience

## Overview
Build the `/self-assessment` experience in Next.js so employees can rate goals per bucket, benefit from autosave, and view a read-only summary with grade ladder once submitted.

## Objectives
- Create a dedicated feature module with reusable components and hooks aligned with existing project patterns.
- Implement autosave, validation, and read-only states driven by the new backend APIs.
- Provide transparency via per-bucket breakdown, grade ladder, fail badges, and level delta preview.

## Deliverables
1. **Routing & Data Layer**
   - Add `/self-assessment` route under `src/app/(evaluation)/(employee)/` rendering `SelfAssessmentPage`.
   - Server actions hitting the new APIs: `getSelfAssessmentContextAction`, `saveSelfAssessmentDraftAction`, `submitSelfAssessmentAction` with cache/revalidation strategy consistent with other features.
2. **Feature Module Structure** (`frontend/src/feature/evaluation/employee/self-assessment/`)
   - `display/SelfAssessmentPage.tsx` orchestrating loading/error/empty states and read-only mode.
   - `components/`:
     - `BucketSection` (card per bucket with list of goals and stage weight chip).
     - `RatingRadioGroup` (SS–D radios, keyboard support, optional comment).
     - `AssessmentSummaryPanel` (per-bucket averages, total, final rating, fail badge, level delta).
     - `GradeLadder` (visual ladder from thresholds, highlights current total).
     - `AutosaveToast` & shared callouts for errors.
   - `hooks/`:
     - `useSelfAssessmentData` to group goals, filter zero-weight buckets, and manage local state.
     - `useAutosaveDraft` with debounce + requestId guard to drop stale responses.
     - `useGradePreview` to compute provisional totals client-side before submit.
   - `types/` + `copy.ts` for EN/JP strings.
3. **States & UX**
   - Editing state: radios enabled, autosave debounce (~1.2s), validation for required buckets.
   - Read-only state after submit: disable inputs, show backend summary only, highlight fail badge when `flags.fail=true`.
   - Error handling: inline validation, toast for autosave failures with retry.
   - Responsive layout (1 column mobile, 2+ columns desktop) and accessible focus styles.
4. **Testing**
   - RTL tests for `BucketSection` (hides zero-weight buckets) and `GradeLadder` (renders thresholds from props).
   - Playwright E2E scenario: load page, edit ratings, observe autosave, submit, verify read-only lock & summary.
   - Accessibility pass using `@axe-core/react` for radios, buttons, ladder.

## Acceptance Criteria
- Page loads goals/draft/stage weights in <1.5s p95 with skeleton fallback, matching the active organization’s data.
- Autosave never reverts to stale data and surfaces failure to the user.
- Submitting shows per-bucket contributions, ladder highlights the final grade, and level delta reflects backend response.
- Lint/tests succeed (`npm run lint`, `npm run test`, Playwright suite).
