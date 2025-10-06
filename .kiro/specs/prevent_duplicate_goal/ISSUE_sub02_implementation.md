# [TASK-04] sub02 - Prevent Duplicate Goal Creation - Frontend Implementation

## Overview

Implement frontend validation to prevent users from creating duplicate goals when they already have submitted or approved goals for the current evaluation period.

**Approach:** Frontend-first validation using existing APIs (no backend changes required).

## Related Issue

Part of #272 - [TASK-04] Prevent duplicate Goal creation after submission

## Acceptance Criteria

- [ ] Users cannot create new goals when submitted/approved goals exist for the current period
- [ ] Clear alert message displayed when goal creation is blocked
- [ ] Form is disabled when blocking goals exist
- [ ] Link to goal list page (/goal-list) is provided for users to view their submitted goals
- [ ] Blocking is period-specific (different periods are independent)
- [ ] Rejected and draft goals do NOT block creation
- [ ] All manual E2E tests pass

## Implementation Checklist

### Frontend Changes

- [ ] **Update `usePeriodSelection.ts`** (`frontend/src/feature/goal-input/hooks/usePeriodSelection.ts`)
  - [ ] Change `getGoalsAction` call to fetch all statuses: `['draft', 'submitted', 'approved', 'rejected']`
  - [ ] Add validation logic to check for submitted/approved goals
  - [ ] Add state variables: `hasBlockingGoals`, `blockingMessage`
  - [ ] Block goal loading when blocking goals exist
  - [ ] Filter only editable goals (draft/rejected) for form
  - [ ] Reset blocking state when period changes

- [ ] **Update Goal Input Page** (`frontend/src/feature/goal-input/display/index.tsx`)
  - [ ] Import Alert components from shadcn/ui
  - [ ] Add blocking alert at top of page
  - [ ] Pass `hasBlockingGoals` to form components as `disabled` prop
  - [ ] Add link to `/goal-list` page in alert message

- [ ] **Update Form Components**
  - [ ] Add `disabled?: boolean` prop to ConfirmationStep
  - [ ] Disable inputs and buttons when `disabled={true}`
  - [ ] Apply grayed-out styling to disabled form

### Code Quality

- [ ] TypeScript types are correct
- [ ] Code comments added explaining validation logic
- [ ] No console.logs or debug code
- [ ] Follows project naming and structure conventions
- [ ] Code passes self-review

## Testing Checklist

Execute all manual E2E test scenarios:

- [ ] **TC1:** Create goal when no submitted goals exist → ✅ Form enabled
- [ ] **TC2:** Blocked by submitted goals → ✅ Alert shown, form disabled
- [ ] **TC3:** Blocked by approved goals → ✅ "承認済み" message, form disabled
- [ ] **TC4:** Different periods → ✅ Blocking is period-specific
- [ ] **TC5:** Only rejected goals → ✅ Form enabled, goals editable
- [ ] **TC6:** Period switching → ✅ Blocking updates dynamically
- [ ] **TC7:** Link navigation → ✅ Navigates to /goal-list
- [ ] **TC8:** API error handling → ✅ Error toast, form safely disabled
- [ ] **TC9:** Mobile responsiveness → ✅ Alert displays correctly
- [ ] **Document test results** in test report

## Error Messages (Japanese)

**Submitted Goals:**
```
目標は既に提出されています。提出済みの目標がある場合、新しい目標を作成することはできません。
```

**Approved Goals:**
```
目標は既に承認されています。承認済みの目標がある場合、新しい目標を作成することはできません。
```

## Files to Modify

- `frontend/src/feature/goal-input/hooks/usePeriodSelection.ts`
- `frontend/src/feature/goal-input/display/index.tsx`
- `frontend/src/feature/goal-input/display/ConfirmationStep.tsx` (optional, if disabled prop needed)

## Estimated Effort

**Total: ~4 hours**
- Frontend implementation: 2-2.5 hours
- Manual E2E testing: 1 hour
- Documentation and code review: 30-60 minutes

## Dependencies

- Existing `GET /api/v1/goals` endpoint (already implemented)
- shadcn/ui Alert components (already in project)
- TASK-05 will implement the `/goal-list` page (link will 404 until then)

## Notes

**Why No Backend Changes?**
- Time-constrained implementation
- Frontend validation is sufficient for MVP
- Existing API already supports all necessary filtering
- Can add backend validation layer later as safety net
- Zero risk of breaking existing backend functionality

**Integration with TASK-05:**
- Alert includes link to `/goal-list` page
- TASK-05 will build complete goal list UI with rejection comments
- Both tasks work together for seamless UX

## Definition of Done

- [ ] All implementation checklist items completed
- [ ] All 9 manual test cases pass
- [ ] Test results documented
- [ ] Code reviewed and approved
- [ ] PR created and merged
- [ ] No regressions in existing functionality
- [ ] Performance remains good (<200ms page load)
