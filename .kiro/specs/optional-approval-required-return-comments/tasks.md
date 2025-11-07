# Task Breakdown: Optional Approval Comments, Required Return Comments

## Overview
Implementation tasks for making comments optional for goal approvals while keeping them mandatory for returns.

**Total Estimated Time**: 2-3 hours
**Priority**: Medium
**Complexity**: Low

---

## Task List

### Phase 1: Frontend - Form Validation (1 hour)

#### Task 1.1: Update Zod Validation Schema
**File**: `frontend/src/feature/evaluation/superviser/goal-review/components/ApprovalForm/index.tsx`
**Lines**: 16-22
**Estimated Time**: 10 minutes
**Priority**: High
**Dependencies**: None

**Changes**:
```typescript
// Update schema
const approvalFormSchema = z.object({
  comment: z.string()
    .max(500, '500文字以内で入力してください')
    .trim()
    .optional()  // ✅ Make optional
});
```

**Acceptance Criteria**:
- [ ] Schema allows empty comments
- [ ] Max 500 char validation still works
- [ ] TypeScript types update correctly
- [ ] Form renders without errors

---

#### Task 1.2: Update Approval Handler
**File**: `frontend/src/feature/evaluation/superviser/goal-review/components/ApprovalForm/index.tsx`
**Lines**: 108-131
**Estimated Time**: 15 minutes
**Priority**: High
**Dependencies**: Task 1.1

**Changes**:
```typescript
const handleApprove = async () => {
  const formData = form.getValues();
  const approvalComment = formData.comment?.trim() || '';

  // Only validate length if comment provided
  if (approvalComment && approvalComment.length > 500) {
    form.setError('comment', {
      type: 'manual',
      message: '500文字以内で入力してください'
    });
    announceToScreenReader('コメントが長すぎます', 'assertive');
    return;
  }

  setPendingAction('approve');
  announceToScreenReader('目標を承認しています...', 'polite');
  onApprove(approvalComment);
  setPendingAction(null);
};
```

**Acceptance Criteria**:
- [ ] Approval works with empty comment
- [ ] Approval works with comment
- [ ] No validation error for empty comment
- [ ] Length validation still works
- [ ] Screen reader announces correctly

---

#### Task 1.3: Verify Rejection Handler
**File**: `frontend/src/feature/evaluation/superviser/goal-review/components/ApprovalForm/index.tsx`
**Lines**: 133-157
**Estimated Time**: 5 minutes
**Priority**: Medium
**Dependencies**: None

**Changes**: None required - verify current implementation

**Verification Checklist**:
- [ ] Empty comment validation present
- [ ] Error message correct: "差し戻し時はコメントの入力が必要です"
- [ ] Submission blocked if no comment
- [ ] Length validation works

---

#### Task 1.4: Update Form Label
**File**: `frontend/src/feature/evaluation/superviser/goal-review/components/ApprovalForm/index.tsx`
**Lines**: 184-194
**Estimated Time**: 10 minutes
**Priority**: High
**Dependencies**: None

**Changes**:
```typescript
<FormLabel className="flex items-center gap-2 justify-between w-full" htmlFor={commentFieldId}>
  <div className="flex items-center gap-2">
    <MessageSquare className="h-4 w-4" aria-hidden="true" />
    コメント
    <span
      className="text-sm text-muted-foreground font-normal"
      aria-label="差し戻し時は必須項目"
    >
      (差し戻し時は必須)
    </span>
  </div>
  {/* Auto-save status... */}
</FormLabel>
```

**Acceptance Criteria**:
- [ ] Label shows "(差し戻し時は必須)"
- [ ] Color changed to `text-muted-foreground`
- [ ] Aria-label updated
- [ ] Visually distinct from error messages

---

### Phase 2: Frontend - Display Logic (45 minutes)

#### Task 2.1: Update Approval Banner Display
**File**: `frontend/src/feature/evaluation/employee/goal-list/components/GoalCard.tsx`
**Lines**: 206-231
**Estimated Time**: 20 minutes
**Priority**: High
**Dependencies**: Task 1.2

**Changes**:
```typescript
{/* Approval Banner - show for ALL approved goals */}
{goal.status === 'approved' && goal.supervisorReview && (  // Remove comment check
  <Alert variant="default" className="border-green-200 bg-green-50">
    <CheckCircle className="h-4 w-4 text-green-600" />
    <AlertDescription className="ml-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-green-900">
            目標が承認されました
          </p>
          <p className="text-sm text-green-800 ml-auto">
            承認日: {formatDate(goal.supervisorReview.reviewedAt || ...)}
          </p>
        </div>
        <div className="bg-white p-3 rounded border border-green-200">
          <p className="text-sm font-medium text-gray-700 mb-1">
            上司からのコメント:
          </p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {goal.supervisorReview.comment || '上司からのコメントはありません'}
          </p>
        </div>
      </div>
    </AlertDescription>
  </Alert>
)}
```

**Acceptance Criteria**:
- [ ] Banner shows for all approved goals
- [ ] Default message: "上司からのコメントはありません"
- [ ] Comment displays if present
- [ ] Approval date always shows
- [ ] Styling unchanged

---

#### Task 2.2: Test Rejection Banner (No Changes)
**File**: `frontend/src/feature/evaluation/employee/goal-list/components/GoalCard.tsx`
**Lines**: 180-205
**Estimated Time**: 10 minutes
**Priority**: Low
**Dependencies**: None

**Changes**: None - verify current implementation

**Verification Checklist**:
- [ ] Rejection banner still works
- [ ] Comment always present (validated)
- [ ] Multiple rejections display correctly
- [ ] Styling unchanged

---

#### Task 2.3: Check Other Display Locations
**File**: Multiple
**Estimated Time**: 15 minutes
**Priority**: Medium
**Dependencies**: Task 2.1

**Locations to Check**:
1. `GoalApprovalCard.tsx` - Admin/supervisor view
2. `GoalReviewDetail` - Detail view
3. Any other components displaying supervisorReview.comment

**Changes**: Apply same logic - show default message for empty comments

**Acceptance Criteria**:
- [ ] All locations handle empty comments
- [ ] Consistent default message everywhere
- [ ] No broken displays

---

### Phase 3: Backend Validation (Optional - 30 minutes)

#### Task 3.1: Add Comment Validation for Rejection
**File**: `backend/app/services/supervisor_review_service.py`
**Lines**: After line 260
**Estimated Time**: 20 minutes
**Priority**: Low (Optional)
**Dependencies**: None

**Changes**:
```python
# In update_review method, after permission checks:

# Validate comment requirement for REJECTED action
if review_update.action == SupervisorAction.REJECTED:
    if not review_update.comment or not review_update.comment.strip():
        raise ValidationError("Comment is required when rejecting a goal")
```

**Acceptance Criteria**:
- [ ] Rejection without comment returns 400 error
- [ ] Error message clear
- [ ] Approval without comment succeeds
- [ ] Existing functionality unchanged

---

#### Task 3.2: Add Backend Tests
**File**: `backend/tests/services/test_supervisor_review_service.py`
**Estimated Time**: 10 minutes
**Priority**: Low (Optional)
**Dependencies**: Task 3.1

**Tests to Add**:
```python
async def test_reject_without_comment_fails()
async def test_approve_without_comment_succeeds()
async def test_reject_with_comment_succeeds()
```

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Coverage > 90%
- [ ] Edge cases covered

---

### Phase 4: Testing (30 minutes)

#### Task 4.1: Write Frontend Unit Tests
**File**: `frontend/src/feature/evaluation/superviser/goal-review/components/__tests__/ApprovalForm.test.tsx`
**Estimated Time**: 15 minutes
**Priority**: High
**Dependencies**: Tasks 1.1-1.4

**Tests to Add**:
```typescript
describe('ApprovalForm', () => {
  it('allows approval without comment')
  it('allows approval with comment')
  it('requires comment for rejection')
  it('shows error for rejection without comment')
  it('validates comment length')
  it('updates label correctly')
})
```

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Coverage > 80%
- [ ] Edge cases covered

---

#### Task 4.2: Write Display Unit Tests
**File**: `frontend/src/feature/evaluation/employee/goal-list/components/__tests__/GoalCard.test.tsx`
**Estimated Time**: 10 minutes
**Priority**: High
**Dependencies**: Task 2.1

**Tests to Add**:
```typescript
describe('GoalCard - Approval Display', () => {
  it('shows default message for approval without comment')
  it('shows comment for approval with comment')
  it('always shows comment for rejection')
})
```

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Snapshot tests updated
- [ ] Coverage maintained

---

#### Task 4.3: Manual Testing
**Estimated Time**: 5 minutes
**Priority**: High
**Dependencies**: All previous tasks

**Test Scenarios**:
1. **Approve without comment**
   - [ ] Navigate to goal-review
   - [ ] Leave comment empty
   - [ ] Click "承認"
   - [ ] Confirm in dialog
   - [ ] ✅ Approval succeeds
   - [ ] Check goal-list
   - [ ] ✅ See "上司からのコメントはありません"

2. **Reject without comment**
   - [ ] Navigate to goal-review
   - [ ] Leave comment empty
   - [ ] Click "差し戻し"
   - [ ] ✅ See error message
   - [ ] ✅ Submission blocked

3. **Historical data**
   - [ ] View old approved goals
   - [ ] ✅ Comments display correctly
   - [ ] ✅ No default message for old comments

---

### Phase 5: Documentation & Deployment (15 minutes)

#### Task 5.1: Update User Documentation (If Exists)
**File**: User manual / help docs
**Estimated Time**: 5 minutes
**Priority**: Low
**Dependencies**: None

**Updates**:
- Document that approval comments are optional
- Document that rejection comments are mandatory
- Update screenshots if needed

**Acceptance Criteria**:
- [ ] Documentation accurate
- [ ] Screenshots updated
- [ ] Clear explanations

---

#### Task 5.2: Create PR
**Estimated Time**: 5 minutes
**Priority**: High
**Dependencies**: All tasks complete

**PR Checklist**:
- [ ] Branch: `fix/optional-approval-required-return-comments`
- [ ] Title: "feat: Make approval comments optional, keep rejection comments mandatory"
- [ ] Description includes:
  - Changes summary
  - Issue link (#336)
  - Testing performed
  - Screenshots (approval without comment)
- [ ] All tests pass
- [ ] Lint passes
- [ ] Ready for review

---

#### Task 5.3: Deploy to Staging
**Estimated Time**: 5 minutes
**Priority**: High
**Dependencies**: PR approved

**Deployment Steps**:
1. [ ] Merge PR to develop
2. [ ] Deploy to staging environment
3. [ ] Smoke test on staging
4. [ ] Verify with stakeholders

---

## Task Dependencies Graph

```
Task 1.1 (Schema) ──────> Task 1.2 (Approval Handler) ──────> Task 4.1 (Tests)
                                                                      │
Task 1.3 (Verify Rejection) ────────────────────────────────> Task 4.1 (Tests)
                                                                      │
Task 1.4 (Label) ────────────────────────────────────────────> Task 4.1 (Tests)
                                                                      │
Task 2.1 (Display) ──────> Task 2.3 (Other Locations) ──> Task 4.2 (Display Tests)
                                                                      │
Task 2.2 (Verify Rejection Display) ──────────────────────────> Task 4.2 (Tests)
                                                                      │
Task 3.1 (Backend) ──────> Task 3.2 (Backend Tests) ──────────────────┤
                                                                      │
                                                     Task 4.3 (Manual Testing)
                                                                      │
                                                         Task 5.1 (Docs)
                                                                      │
                                                           Task 5.2 (PR)
                                                                      │
                                                       Task 5.3 (Deploy)
```

---

## Quick Start Guide

### Minimum Viable Implementation (30 minutes)
For rapid deployment, complete only these essential tasks:

1. ✅ Task 1.1: Update schema
2. ✅ Task 1.2: Update approval handler
3. ✅ Task 1.4: Update label
4. ✅ Task 2.1: Update display
5. ✅ Task 4.3: Manual testing

**Result**: Functional feature with core requirements met

### Complete Implementation (2-3 hours)
For production-ready code, complete all tasks in order.

---

## Rollback Instructions

If issues are discovered:

### Immediate Rollback (Frontend Only)
```bash
# Revert frontend changes
git revert <commit-hash>
git push origin develop

# Redeploy previous version
./deploy-staging.sh
```

### File-Level Rollback
1. Restore `ApprovalForm/index.tsx`:
   - Add `.min(1)` back to schema
   - Add empty comment validation to `handleApprove`
   - Change label back to "(必須)"

2. Restore `GoalCard.tsx`:
   - Add `&& goal.supervisorReview.comment` back to condition
   - Remove default message

---

## Success Criteria

### Definition of Done
- [ ] All Priority: High tasks completed
- [ ] All tests pass (frontend + backend)
- [ ] Manual testing completed
- [ ] PR approved by 2+ reviewers
- [ ] Deployed to staging successfully
- [ ] Stakeholder sign-off

### Acceptance Validation
- [ ] Supervisor can approve goal without comment
- [ ] Supervisor must provide comment for rejection
- [ ] Default message displays for approvals without comment
- [ ] Form label clearly indicates requirement
- [ ] All existing functionality preserved
- [ ] No regression bugs
- [ ] Performance unchanged

---

## Notes

### Development Tips
1. **Test incrementally**: Test each task before moving to next
2. **Use feature flags**: Consider feature flag for gradual rollout
3. **Monitor metrics**: Track approval without comment rate
4. **Get feedback early**: Show to stakeholders after Task 2.1

### Common Pitfalls
1. ❌ Forgetting to handle `null` vs `undefined` vs `""`
2. ❌ Not updating all display locations
3. ❌ Breaking existing comment display
4. ❌ Missing screen reader announcements
5. ❌ Not testing with historical data

### Time-Saving Shortcuts
1. Skip backend validation (Task 3.x) - frontend is sufficient
2. Combine Tasks 1.1 and 1.2 - edit same file
3. Use existing test utilities - don't write from scratch
4. Copy-paste similar test cases - adapt as needed

---

## Post-Deployment

### Monitoring (First 24 hours)
- [ ] Check error logs for validation failures
- [ ] Monitor approval success rate
- [ ] Track rejection without comment attempts
- [ ] Review user feedback/support tickets

### Metrics to Track (First week)
- % of approvals without comment
- Rejection error rate
- Page load time
- Auto-save success rate
- User satisfaction score

### Follow-up Tasks (If needed)
- Adjust default message based on feedback
- Add analytics for comment patterns
- Consider adding comment templates
- Update training materials

---

## Contact

**Developer**: TBD
**Reviewer**: TBD
**Stakeholder**: @fukamatsu04
**Issue**: https://github.com/shintairiku/evaluation-system/issues/336
