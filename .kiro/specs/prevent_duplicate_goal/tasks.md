# Implementation Plan: Prevent Duplicate Goal Creation After Submission

> This document breaks down the implementation into specific development tasks based on the **simplified frontend-first approach** in the design document. Tasks focus on frontend validation using existing APIs with minimal backend changes.

## ⚠️ IMPORTANT: Simplified Approach

This implementation uses **frontend validation only** to prevent duplicate goal creation. Backend changes are **optional** and deferred for future enhancement.

**Why Frontend-First?**
- ✅ Time-constrained (limited time for implementation and testing)
- ✅ Zero risk (no backend changes means no breaking existing functionality)
- ✅ Fast to test (manual E2E only, no backend unit tests required)
- ✅ Reuses existing APIs (GET /api/v1/goals already supports filtering)
- ✅ Can add backend validation later if needed

---

## Feature: Frontend Validation for Duplicate Goal Prevention

### 1. Frontend Implementation - Hook Modification

> Modify the period selection hook to check for blocking goal statuses

- [ ] **1.1. Update `usePeriodSelection` hook to fetch all goal statuses**
  > Modify the existing hook to load ALL goal statuses instead of just draft/rejected
  >
  > **File:** `frontend/src/feature/goal-input/hooks/usePeriodSelection.ts`
  >
  > **Current Code (Line ~82):**
  > ```typescript
  > const result = await getGoalsAction({
  >   periodId: period.id,
  >   status: ['draft', 'rejected']
  > });
  > ```
  >
  > **New Code:**
  > ```typescript
  > const result = await getGoalsAction({
  >   periodId: period.id,
  >   status: ['draft', 'submitted', 'approved', 'rejected'] // Fetch ALL
  > });
  > ```
  >
  > **Related Requirements:** Req 1, Req 2
  >
  > **Estimated Time:** 15 minutes

- [ ] **1.2. Add blocking validation logic in `usePeriodSelection`**
  > Check for submitted/approved goals and block goal creation if found
  >
  > **File:** `frontend/src/feature/goal-input/hooks/usePeriodSelection.ts`
  >
  > **Implementation:**
  > - After fetching goals, add validation logic:
  > ```typescript
  > const goals = result.data.items;
  >
  > const hasSubmittedGoals = goals.some(g => g.status === 'submitted');
  > const hasApprovedGoals = goals.some(g => g.status === 'approved');
  >
  > if (hasSubmittedGoals || hasApprovedGoals) {
  >   setHasBlockingGoals(true);
  >   setBlockingMessage(
  >     hasApprovedGoals
  >       ? "目標は既に承認されています。承認済みの目標がある場合、新しい目標を作成することはできません。"
  >       : "目標は既に提出されています。提出済みの目標がある場合、新しい目標を作成することはできません。"
  >   );
  >   setGoalFormData([]);
  >   return; // Stop loading goals into form
  > }
  >
  > // Load only editable goals
  > const editableGoals = goals.filter(g =>
  >   g.status === 'draft' || g.status === 'rejected'
  > );
  > loadGoalsIntoForm(editableGoals);
  > ```
  >
  > **Related Requirements:** Req 1, Req 2, Req 3
  >
  > **Estimated Time:** 30 minutes

- [ ] **1.3. Add state variables for blocking status**
  > Add React state to track blocking status and message
  >
  > **File:** `frontend/src/feature/goal-input/hooks/usePeriodSelection.ts`
  >
  > **Implementation:**
  > - Add state declarations at top of hook:
  > ```typescript
  > const [hasBlockingGoals, setHasBlockingGoals] = useState(false);
  > const [blockingMessage, setBlockingMessage] = useState('');
  > ```
  > - Export these values from the hook return object
  >
  > **Related Requirements:** Req 3
  >
  > **Estimated Time:** 10 minutes

- [ ] **1.4. Reset blocking state when period changes**
  > Ensure blocking state resets when user switches to a different period
  >
  > **File:** `frontend/src/feature/goal-input/hooks/usePeriodSelection.ts`
  >
  > **Implementation:**
  > - At the start of period selection handler:
  > ```typescript
  > setHasBlockingGoals(false);
  > setBlockingMessage('');
  > ```
  >
  > **Related Requirements:** Req 6
  >
  > **Estimated Time:** 5 minutes

### 2. Frontend Implementation - UI Components

> Add alert component and form disable logic to Goal Input Page

- [ ] **2.1. Add Alert component to Goal Input Page**
  > Display blocking alert when submitted/approved goals exist
  >
  > **File:** `frontend/src/feature/goal-input/display/index.tsx`
  >
  > **Implementation:**
  > - Import Alert components:
  > ```typescript
  > import { Alert, AlertCircle, AlertTitle, AlertDescription } from '@/components/ui/alert';
  > import Link from 'next/link';
  > ```
  > - Add alert at top of page (before form):
  > ```tsx
  > {hasBlockingGoals && (
  >   <Alert variant="destructive" className="mb-6">
  >     <AlertCircle className="h-4 w-4" />
  >     <AlertTitle>新しい目標を作成できません</AlertTitle>
  >     <AlertDescription>
  >       {blockingMessage}
  >       <Link href="/goal-list" className="underline ml-2 font-medium">
  >         目標一覧ページで確認してください
  >       </Link>
  >     </AlertDescription>
  >   </Alert>
  > )}
  > ```
  >
  > **Related Requirements:** Req 3
  >
  > **Estimated Time:** 20 minutes

- [ ] **2.2. Disable form when blocking goals exist**
  > Pass disabled prop to form components to prevent editing
  >
  > **File:** `frontend/src/feature/goal-input/display/index.tsx`
  >
  > **Implementation:**
  > - Get `hasBlockingGoals` from `usePeriodSelection` hook
  > - Pass to child components:
  > ```tsx
  > <ConfirmationStep
  >   disabled={hasBlockingGoals}
  >   onSubmit={handleSubmit}
  > />
  > ```
  > - May need to pass down to other form components (GoalInputStep, etc.)
  >
  > **Related Requirements:** Req 3
  >
  > **Estimated Time:** 15 minutes

- [ ] **2.3. Update form components to accept disabled prop**
  > Modify form components to disable inputs when disabled=true
  >
  > **Files:**
  > - `frontend/src/feature/goal-input/display/ConfirmationStep.tsx`
  > - Other relevant step components
  >
  > **Implementation:**
  > - Add `disabled?: boolean` to component props
  > - Disable input fields, buttons, etc. when disabled=true
  > - Apply grayed-out styling
  >
  > **Related Requirements:** Req 3
  >
  > **Estimated Time:** 30 minutes

### 3. Testing - Manual E2E Tests

> Execute comprehensive manual testing scenarios

- [ ] **3.1. Test Case 1: Create goal when no submitted goals exist**
  > Verify normal flow when only draft/rejected goals exist
  >
  > **Test Steps:**
  > 1. Login as user with only draft goals for current period
  > 2. Navigate to Goal Input page
  > 3. Verify form is enabled
  > 4. Verify no blocking alert is shown
  > 5. Create new goal successfully
  >
  > **Expected Result:** ✅ Form enabled, goal creation works normally
  >
  > **Related Requirements:** Req 1, Req 6
  >
  > **Estimated Time:** 5 minutes

- [ ] **3.2. Test Case 2: Blocked by submitted goals**
  > Verify blocking when submitted goals exist
  >
  > **Test Steps:**
  > 1. Create and submit goals for current period
  > 2. Navigate to Goal Input page
  > 3. Verify blocking alert appears with message: "目標は既に提出されています"
  > 4. Verify form is disabled
  > 5. Verify link "目標一覧ページで確認してください" is present
  >
  > **Expected Result:** ✅ Alert shown, form disabled, link present
  >
  > **Related Requirements:** Req 1, Req 2, Req 3
  >
  > **Estimated Time:** 5 minutes

- [ ] **3.3. Test Case 3: Blocked by approved goals**
  > Verify blocking when approved goals exist
  >
  > **Test Steps:**
  > 1. Have supervisor approve goals for current period
  > 2. Navigate to Goal Input page as subordinate
  > 3. Verify blocking alert appears with message: "目標は既に承認されています"
  > 4. Verify form is disabled
  >
  > **Expected Result:** ✅ Alert with "承認済み" message, form disabled
  >
  > **Related Requirements:** Req 1, Req 6
  >
  > **Estimated Time:** 5 minutes

- [ ] **3.4. Test Case 4: Different periods**
  > Verify blocking is period-specific
  >
  > **Test Steps:**
  > 1. Submit goals for Period A
  > 2. Switch to Period B (no submitted goals)
  > 3. Verify form is enabled for Period B
  > 4. Create goals for Period B successfully
  >
  > **Expected Result:** ✅ Blocking only applies to Period A, Period B works normally
  >
  > **Related Requirements:** Req 1
  >
  > **Estimated Time:** 5 minutes

- [ ] **3.5. Test Case 5: Only rejected goals**
  > Verify rejected goals don't block creation
  >
  > **Test Steps:**
  > 1. Have supervisor reject goals for current period
  > 2. Navigate to Goal Input page
  > 3. Verify form is enabled
  > 4. Verify rejected goals are loaded for editing
  >
  > **Expected Result:** ✅ Form enabled, rejected goals editable
  >
  > **Related Requirements:** Req 6
  >
  > **Estimated Time:** 5 minutes

- [ ] **3.6. Test Case 6: Period switching**
  > Verify dynamic blocking when switching periods
  >
  > **Test Steps:**
  > 1. Navigate to Goal Input page
  > 2. Select Period A (no submitted goals) - form enabled
  > 3. Switch to Period B (has submitted goals)
  > 4. Verify alert appears immediately
  > 5. Verify form disables dynamically
  > 6. Switch back to Period A
  > 7. Verify alert disappears and form re-enables
  >
  > **Expected Result:** ✅ Blocking state updates dynamically on period change
  >
  > **Related Requirements:** Req 1, Req 3
  >
  > **Estimated Time:** 5 minutes

- [ ] **3.7. Test Case 7: Link navigation**
  > Verify link to goal list page works
  >
  > **Test Steps:**
  > 1. Trigger blocking alert (submitted goals exist)
  > 2. Click "目標一覧ページで確認してください" link
  > 3. Verify navigation to /goal-list page
  >
  > **Expected Result:** ✅ Navigates to goal list page (will be 404 until TASK-05)
  >
  > **Related Requirements:** Req 3, Integration with TASK-05
  >
  > **Estimated Time:** 3 minutes

- [ ] **3.8. Test Case 8: API error handling**
  > Verify graceful error handling when API fails
  >
  > **Test Steps:**
  > 1. Simulate API failure (disconnect network or use dev tools)
  > 2. Try to load Goal Input page
  > 3. Verify error toast appears
  > 4. Verify form is safely disabled
  >
  > **Expected Result:** ✅ Error message shown, no crash, form disabled
  >
  > **Related Requirements:** Req 5, Error handling
  >
  > **Estimated Time:** 5 minutes

- [ ] **3.9. Test Case 9: Mobile responsiveness**
  > Verify UI works on mobile devices
  >
  > **Test Steps:**
  > 1. Open Goal Input page on mobile viewport
  > 2. Trigger blocking alert
  > 3. Verify alert is readable and properly formatted
  > 4. Verify link is clickable
  >
  > **Expected Result:** ✅ Alert displays correctly on mobile
  >
  > **Related Requirements:** Req 7 (accessibility)
  >
  > **Estimated Time:** 5 minutes

- [ ] **3.10. Document test results**
  > Create test report documenting all test case results
  >
  > **Deliverable:** Test results document (Markdown or spreadsheet)
  >
  > **Estimated Time:** 15 minutes

### 4. Documentation & Code Review

> Document changes and prepare for code review

- [ ] **4.1. Add code comments explaining validation logic**
  > Add clear comments to the validation code
  >
  > **Files:** `usePeriodSelection.ts`, Goal Input Page
  >
  > **Implementation:**
  > - Comment explaining why we check submitted/approved statuses
  > - Comment explaining blocking behavior
  > - Comment referencing TASK-05 for complete UX
  >
  > **Estimated Time:** 10 minutes

- [ ] **4.2. Update code for review**
  > Prepare code for peer review
  >
  > **Steps:**
  > - Self-review changes
  > - Check TypeScript types are correct
  > - Verify no console.logs or debug code
  > - Ensure code follows project conventions
  >
  > **Estimated Time:** 15 minutes

- [ ] **4.3. Create pull request**
  > Create PR with comprehensive description
  >
  > **PR Description should include:**
  > - Summary of changes (frontend validation only)
  > - Link to GitHub issue #272
  > - Screenshots of blocking alert
  > - Test results summary
  > - Note about backend validation being deferred
  >
  > **Estimated Time:** 15 minutes

---

## Backend Implementation (Optional - Future Enhancement)

> **NOT REQUIRED FOR INITIAL IMPLEMENTATION**
>
> These tasks can be implemented later as a "safety net" to add server-side validation. Frontend validation is sufficient for MVP.

### Optional: Backend Validation Layer

- [ ] **OPT-1. Add `check_submitted_goals_exist` to GoalRepository**
  > Optional backend validation method
  >
  > **File:** `backend/app/database/repositories/goal_repo.py`
  >
  > **Deferred Reason:** Time-constrained, frontend validation sufficient
  >
  > **Implementation Note:** Can be added post-MVP if needed

- [ ] **OPT-2. Add validation in GoalService.create_goal**
  > Optional service layer validation
  >
  > **File:** `backend/app/services/goal_service.py`
  >
  > **Deferred Reason:** Time-constrained, frontend validation sufficient
  >
  > **Implementation Note:** Can be added post-MVP if needed

- [ ] **OPT-3. Backend unit tests**
  > Optional backend tests
  >
  > **Files:** `backend/tests/repositories/test_goal_repo.py`, etc.
  >
  > **Deferred Reason:** No backend logic added, no tests needed yet
  >
  > **Implementation Note:** Add when backend validation is implemented

---

## Task Summary

### Required Tasks (Frontend Only)

| Task | Estimated Time | Type |
|------|---------------|------|
| 1.1 Update getGoalsAction call | 15 min | Code |
| 1.2 Add blocking validation | 30 min | Code |
| 1.3 Add state variables | 10 min | Code |
| 1.4 Reset blocking state | 5 min | Code |
| 2.1 Add Alert component | 20 min | Code |
| 2.2 Disable form | 15 min | Code |
| 2.3 Update components | 30 min | Code |
| 3.1-3.9 Manual E2E tests | 45 min | Testing |
| 3.10 Document results | 15 min | Docs |
| 4.1 Add comments | 10 min | Docs |
| 4.2 Code review prep | 15 min | QA |
| 4.3 Create PR | 15 min | Admin |
| **TOTAL** | **~4 hours** | |

### Deferred Tasks (Optional Backend)

| Task | Deferred To | Reason |
|------|------------|--------|
| Backend Repository | Post-MVP | Time-constrained |
| Backend Service | Post-MVP | Frontend sufficient |
| Backend Tests | Post-MVP | No backend code yet |

---

## Success Criteria

✅ **Frontend Changes Complete:**
- [ ] Hook fetches all goal statuses
- [ ] Blocking validation logic works correctly
- [ ] Alert component displays properly
- [ ] Form disables when blocked
- [ ] Link to goal list page present

✅ **All Manual Tests Pass:**
- [ ] 9 test scenarios executed
- [ ] All tests documented
- [ ] No critical bugs found

✅ **Code Quality:**
- [ ] TypeScript types correct
- [ ] Code comments added
- [ ] Follows project conventions
- [ ] Peer review approved

✅ **Integration:**
- [ ] Link to TASK-05 goal list page works
- [ ] No breaking changes to existing functionality
- [ ] Performance remains good (<200ms page load)

---

## Notes

**Why No Backend Changes?**
1. **Time-constrained:** Limited time for implementation and testing
2. **Sufficient for MVP:** Frontend validation prevents 99% of duplicate submissions
3. **Low risk:** No changes to backend means no risk of breaking existing APIs
4. **Fast testing:** Manual E2E tests only, no backend unit tests needed
5. **Future-proof:** Can add backend validation later without breaking frontend

**Integration with TASK-05:**
- Alert includes link to `/goal-list` page
- TASK-05 will implement the complete goal list UI
- Both tasks work together for complete UX

**Performance:**
- Reuses existing GET /api/v1/goals endpoint
- No additional API calls
- Client-side validation is instant
- Zero performance impact
