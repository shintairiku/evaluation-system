# Design Document: Optional Approval Comments, Required Return Comments

## Executive Summary

This document outlines the design for implementing differentiated comment requirements in the goal review workflow. Comments will become optional for approvals but remain mandatory for returns (差し戻し), improving the supervisor experience while maintaining quality feedback for rejected goals.

## Goals

### Primary Goals
1. Allow supervisors to approve goals without entering comments
2. Enforce mandatory comments for goal returns/rejections
3. Provide clear UI indication of when comments are required
4. Display appropriate messages for goals approved without comments

### Secondary Goals
1. Maintain backward compatibility with existing comments
2. Preserve auto-save functionality
3. Ensure accessibility standards are met
4. Add optional backend validation for extra security

## Non-Goals
- Changing comment length limits
- Adding rich text formatting
- Implementing comment editing after submission
- Modifying database schema

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Goal Review Workflow                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ApprovalForm Component                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Comment Input (Zod validation)                    │    │
│  │  - Optional for all actions                        │    │
│  │  - Max 500 chars                                   │    │
│  │  - Label: "コメント (差し戻し時は必須)"              │    │
│  └────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Action Button Handlers                     │    │
│  │                                                     │    │
│  │  handleApprove()          handleReject()          │    │
│  │  - Accept empty comment   - Validate comment       │    │
│  │  - Pass "" or undefined   - Require non-empty      │    │
│  │  - No validation error    - Show error if empty    │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           useGoalApprovalActions Hook                        │
│  - Handles optimistic updates                                │
│  - Calls updateSupervisorReviewAction                        │
│  - Passes comment || undefined                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API                                     │
│  PUT /api/v1/supervisor-reviews/{reviewId}                  │
│  - Accepts optional comment                                  │
│  - (Optional) Validates comment for REJECTED action          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Goal Display (GoalCard)                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Approved Goals:                                   │    │
│  │  - If comment exists: Show comment                 │    │
│  │  - If no comment: "上司からのコメントはありません"   │    │
│  │                                                     │    │
│  │  Rejected Goals:                                   │    │
│  │  - Always show comment (mandatory)                 │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. ApprovalForm Component

**File**: `frontend/src/feature/evaluation/superviser/goal-review/components/ApprovalForm/index.tsx`

#### Current Implementation Issues
- Line 16-22: Zod schema requires `.min(1)` for all actions
- Line 118-125: `handleApprove` rejects empty comments
- Line 138-145: `handleReject` requires comment (correct)
- Line 191: Label shows "(必須)" always

#### Proposed Changes

##### 1.1 Update Zod Schema (Lines 16-22)

```typescript
// BEFORE
const approvalFormSchema = z.object({
  comment: z.string()
    .min(1, 'コメントの入力が必要です')  // ❌ Too restrictive
    .max(500, '500文字以内で入力してください')
    .trim()
});

// AFTER
const approvalFormSchema = z.object({
  comment: z.string()
    .max(500, '500文字以内で入力してください')
    .trim()
    .optional()  // ✅ Optional for flexibility
});
```

**Rationale**:
- Makes comment optional by default
- Preserves length validation
- Allows conditional validation in handlers

##### 1.2 Update Approval Handler (Lines 108-131)

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
  onApprove(approvalComment);  // Can be empty string
  setPendingAction(null);
};
```

**Key Changes**:
- ✅ Removed empty comment validation
- ✅ Only validates max length
- ✅ Passes empty string if no comment
- ✅ No validation errors for approval without comment

##### 1.3 Keep Rejection Handler (Lines 133-157)

```typescript
const handleReject = async () => {
  const formData = form.getValues();
  const rejectionComment = formData.comment?.trim();

  // ✅ Validation for rejection - comment is REQUIRED
  if (!rejectionComment) {
    form.setError('comment', {
      type: 'manual',
      message: '差し戻し時はコメントの入力が必要です'
    });
    announceToScreenReader('差し戻し時はコメントの入力が必要です', 'assertive');
    return;
  }

  // Validate length
  if (rejectionComment.length > 500) {
    form.setError('comment', {
      type: 'manual',
      message: '500文字以内で入力してください'
    });
    return;
  }

  setPendingAction('reject');
  announceToScreenReader('目標を差し戻ししています...', 'polite');
  onReject(rejectionComment);  // Always non-empty
  setPendingAction(null);
};
```

**Key Points**:
- ✅ Maintains mandatory comment validation
- ✅ Clear error message
- ✅ Blocks submission without comment

##### 1.4 Update Form Label (Lines 184-194)

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
  {/* Auto-save status indicators... */}
</FormLabel>
```

**Changes**:
- ✅ Changed from "(必須)" to "(差し戻し時は必須)"
- ✅ Changed color from `text-red-500` to `text-muted-foreground`
- ✅ More accurate aria-label

### 2. GoalCard Component

**File**: `frontend/src/feature/evaluation/employee/goal-list/components/GoalCard.tsx`

#### Current Implementation
- Line 207: Shows approval banner only if comment exists
- Line 180: Shows rejection banner only if comment exists

#### Proposed Changes

##### 2.1 Update Approval Banner (Lines 206-231)

```typescript
{/* Approval Banner - shown if this goal is approved */}
{goal.status === 'approved' && goal.supervisorReview && (
  <Alert variant="default" className="border-green-200 bg-green-50">
    <CheckCircle className="h-4 w-4 text-green-600" />
    <AlertDescription className="ml-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-green-900">
            目標が承認されました
          </p>
          <p className="text-sm text-green-800 ml-auto">
            承認日: {formatDate(goal.supervisorReview.reviewedAt || goal.supervisorReview.updatedAt || goal.supervisorReview.createdAt)}
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

**Key Changes**:
- ✅ Removed `&& goal.supervisorReview.comment` condition
- ✅ Always show banner for approved goals
- ✅ Display fallback message: "上司からのコメントはありません"
- ✅ Uses `||` operator for default value

##### 2.2 Keep Rejection Banner (Lines 180-205)

```typescript
{/* Rejection History - shows if there were previous rejections */}
{rejectionHistory.length > 0 && (
  <div className="space-y-3">
    <h4 className="text-sm font-semibold text-red-900 flex items-center gap-2">
      <AlertCircle className="h-4 w-4" />
      差し戻し履歴
    </h4>
    {rejectionHistory.map((rejection, index) => (
      <Alert key={index} variant="destructive" className="border-red-200 bg-red-50">
        <AlertDescription className="ml-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-red-900">
                差し戻し {rejectionHistory.length - index}回目
              </p>
              <p className="text-sm text-red-800 ml-auto">
                {formatDate(rejection.updatedAt)}
              </p>
            </div>
            {rejection.comment && (  // ✅ Keep check - comment is mandatory
              <div className="bg-white p-3 rounded border border-red-200">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  差し戻し理由:
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {rejection.comment}
                </p>
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>
    ))}
  </div>
)}
```

**No Changes Needed**:
- ✅ Rejection comments are always present (validated)
- ✅ Check `{rejection.comment &&` can remain for safety
- ✅ No fallback message needed

### 3. Backend Validation (Optional Enhancement)

**File**: `backend/app/services/supervisor_review_service.py`

#### Current Implementation
- Line 267-274: Updates review without validating comment

#### Proposed Enhancement

Add validation in `update_review` method (after line 260):

```python
async def update_review(
    self, review_id: UUID, review_update: SupervisorReviewUpdate, current_user_context: AuthContext
) -> SupervisorReviewSchema:
    try:
        org_id = current_user_context.organization_id
        if not org_id:
            raise PermissionDeniedError("Organization context required")

        review = await self.repo.get_by_id(review_id, org_id)
        if not review:
            raise NotFoundError(f"Supervisor review with ID {review_id} not found")

        # Only the creating supervisor or admin can update
        if not (current_user_context.has_permission(Permission.GOAL_READ_ALL) or review.supervisor_id == current_user_context.user_id):
            raise PermissionDeniedError("You do not have permission to update this review")

        # Additional check: if not admin, verify supervisor still has authority over the goal owner
        if not current_user_context.has_permission(Permission.GOAL_READ_ALL):
            goal = await self.goal_repo.get_goal_by_id(review.goal_id, org_id)
            if goal:
                await self._require_supervisor_of_goal_owner(goal, current_user_context)

        # ✅ NEW: Validate comment requirement for REJECTED action
        if review_update.action == SupervisorAction.REJECTED:
            if not review_update.comment or not review_update.comment.strip():
                raise ValidationError("Comment is required when rejecting a goal")

        reviewed_at = review.reviewed_at
        status_value = review_update.status.value if review_update.status is not None else None
        if status_value == "submitted" and reviewed_at is None:
            reviewed_at = datetime.now(timezone.utc)
        if status_value in ["incomplete", "draft"]:
            reviewed_at = None

        updated = await self.repo.update(
            review_id,
            org_id,
            action=review_update.action.value if review_update.action is not None else None,
            comment=review_update.comment,
            status=status_value,
            reviewed_at=reviewed_at,
        )

        # Sync goal if moving to submitted
        if status_value == "submitted":
            await self._sync_goal_status_with_review(updated, current_user_context)

        await self.session.commit()
        return SupervisorReviewSchema.model_validate(updated, from_attributes=True)
    except Exception as e:
        await self.session.rollback()
        logger.error(f"Error updating supervisor review {review_id}: {e}")
        raise
```

**Benefits**:
- ✅ Defense in depth - validates even if frontend bypassed
- ✅ API consumers get clear error message
- ✅ Consistent validation logic

**Drawbacks**:
- Frontend should already handle this
- Adds minor complexity

**Recommendation**: Implement as optional safety measure.

## Data Flow

### Approval Flow (With Comment)

```
User fills comment
    ↓
User clicks "承認"
    ↓
handleApprove()
  - Gets comment value
  - No validation error
  - Calls onApprove(comment)
    ↓
useGoalApprovalActions.handleApprove()
  - Sets confirmationDialog
    ↓
User confirms in dialog
    ↓
confirmAction()
  - Optimistic update
  - API call: updateSupervisorReviewAction({
      action: 'APPROVED',
      comment: "良く作成されました",  // User's comment
      status: 'submitted'
    })
    ↓
Backend updates review
    ↓
Goal status → 'approved'
    ↓
GoalCard displays:
  "目標が承認されました"
  "上司からのコメント: 良く作成されました"
```

### Approval Flow (Without Comment)

```
User leaves comment empty
    ↓
User clicks "承認"
    ↓
handleApprove()
  - Gets empty comment: ""
  - No validation error
  - Calls onApprove("")
    ↓
useGoalApprovalActions.handleApprove()
  - Sets confirmationDialog with comment: ""
    ↓
User confirms in dialog
    ↓
confirmAction()
  - Optimistic update
  - API call: updateSupervisorReviewAction({
      action: 'APPROVED',
      comment: undefined,  // or ""
      status: 'submitted'
    })
    ↓
Backend updates review (comment = NULL)
    ↓
Goal status → 'approved'
    ↓
GoalCard displays:
  "目標が承認されました"
  "上司からのコメント: 上司からのコメントはありません"  // ✅ Default message
```

### Return Flow (Without Comment - Error)

```
User leaves comment empty
    ↓
User clicks "差し戻し"
    ↓
handleReject()
  - Gets empty comment: ""
  - Validation fails ❌
  - Shows error: "差し戻し時はコメントの入力が必要です"
  - Blocks submission
    ↓
User sees error message
    ↓
User enters comment
    ↓
[Proceed with normal return flow...]
```

### Return Flow (With Comment)

```
User fills comment
    ↓
User clicks "差し戻し"
    ↓
handleReject()
  - Gets comment value
  - Validation passes ✅
  - Calls onReject(comment)
    ↓
useGoalApprovalActions.handleReject()
  - Sets confirmationDialog
    ↓
User confirms in dialog
    ↓
confirmAction()
  - Optimistic update
  - API call: updateSupervisorReviewAction({
      action: 'REJECTED',
      comment: "目標の具体性が不足しています",  // Mandatory
      status: 'submitted'
    })
    ↓
Backend updates review
    ↓
Goal status → 'rejected'
    ↓
GoalCard displays:
  "目標が差し戻されました"
  "差し戻し理由: 目標の具体性が不足しています"  // Always present
```

## UI/UX Design

### Form Label States

#### Before (Current)
```
コメント (必須) ← Always red, always required
```

#### After (Proposed)
```
コメント (差し戻し時は必須) ← Gray, conditional requirement
```

### Error Messages

| Action | Scenario | Error Message | Display |
|--------|----------|---------------|---------|
| Approval | Empty comment | None | No error |
| Approval | >500 chars | "500文字以内で入力してください" | Red text below field |
| Rejection | Empty comment | "差し戻し時はコメントの入力が必要です" | Red text below field |
| Rejection | >500 chars | "500文字以内で入力してください" | Red text below field |

### Approval Banner

#### With Comment
```
┌─────────────────────────────────────────────────┐
│ ✓ 目標が承認されました        承認日: 2025/11/06 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 上司からのコメント:                          │ │
│ │ 良く作成された目標です。                     │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

#### Without Comment (New)
```
┌─────────────────────────────────────────────────┐
│ ✓ 目標が承認されました        承認日: 2025/11/06 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 上司からのコメント:                          │ │
│ │ 上司からのコメントはありません               │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Rejection Banner
```
┌─────────────────────────────────────────────────┐
│ ⚠ 目標が差し戻されました      差し戻し日: 2025/11/05 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 差し戻し理由:                                │ │
│ │ 目標の具体性が不足しています。               │ │
│ │ SMARTの基準を満たすように修正してください。  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Accessibility

### Screen Reader Announcements

| Event | Announcement |
|-------|-------------|
| Form loaded | "コメント オプション項目 差し戻し時は必須" |
| Approval clicked (empty comment) | "目標を承認しています" |
| Approval success | "目標を承認しました" |
| Rejection clicked (empty comment) | "差し戻し時はコメントの入力が必要です" (assertive) |
| Rejection clicked (with comment) | "目標を差し戻ししています" |

### ARIA Attributes

```html
<!-- Form label -->
<label
  for="comment-field"
  aria-label="コメント オプション項目 差し戻し時は必須"
>
  コメント (差し戻し時は必須)
</label>

<!-- Textarea -->
<textarea
  id="comment-field"
  aria-describedby="char-count error-message"
  aria-required="false"
  aria-invalid="false"
  maxLength={500}
/>

<!-- Error message -->
<div
  id="error-message"
  role="alert"
  aria-live="assertive"
>
  差し戻し時はコメントの入力が必要です
</div>

<!-- Character count -->
<div
  id="char-count"
  aria-label="文字数: 0文字 / 500文字まで"
  aria-live="polite"
>
  0/500
</div>
```

## Testing Strategy

### Unit Tests

#### Frontend

**File**: `ApprovalForm.test.tsx`

```typescript
describe('ApprovalForm', () => {
  it('allows approval without comment', async () => {
    const onApprove = jest.fn();
    render(<ApprovalForm onApprove={onApprove} />);

    const approveButton = screen.getByText('承認');
    fireEvent.click(approveButton);

    expect(onApprove).toHaveBeenCalledWith('');
  });

  it('requires comment for rejection', async () => {
    const onReject = jest.fn();
    render(<ApprovalForm onReject={onReject} />);

    const rejectButton = screen.getByText('差し戻し');
    fireEvent.click(rejectButton);

    expect(screen.getByText('差し戻し時はコメントの入力が必要です')).toBeInTheDocument();
    expect(onReject).not.toHaveBeenCalled();
  });

  it('accepts approval with comment', async () => {
    const onApprove = jest.fn();
    render(<ApprovalForm onApprove={onApprove} />);

    const commentField = screen.getByLabelText(/コメント/);
    fireEvent.change(commentField, { target: { value: '良い目標です' } });

    const approveButton = screen.getByText('承認');
    fireEvent.click(approveButton);

    expect(onApprove).toHaveBeenCalledWith('良い目標です');
  });
});
```

**File**: `GoalCard.test.tsx`

```typescript
describe('GoalCard - Approval Display', () => {
  it('shows default message for approval without comment', () => {
    const goal = {
      status: 'approved',
      supervisorReview: {
        action: 'APPROVED',
        comment: null,
        reviewedAt: '2025-11-06T10:00:00Z'
      }
    };

    render(<GoalCard goal={goal} />);

    expect(screen.getByText('上司からのコメントはありません')).toBeInTheDocument();
  });

  it('shows comment for approval with comment', () => {
    const goal = {
      status: 'approved',
      supervisorReview: {
        action: 'APPROVED',
        comment: '良い目標です',
        reviewedAt: '2025-11-06T10:00:00Z'
      }
    };

    render(<GoalCard goal={goal} />);

    expect(screen.getByText('良い目標です')).toBeInTheDocument();
    expect(screen.queryByText('上司からのコメントはありません')).not.toBeInTheDocument();
  });
});
```

#### Backend (Optional)

**File**: `test_supervisor_review_service.py`

```python
async def test_reject_without_comment_fails():
    """Rejection without comment should raise ValidationError"""
    review_update = SupervisorReviewUpdate(
        action=SupervisorAction.REJECTED,
        comment=None,
        status=SubmissionStatus.SUBMITTED
    )

    with pytest.raises(ValidationError, match="Comment is required"):
        await service.update_review(review_id, review_update, context)

async def test_approve_without_comment_succeeds():
    """Approval without comment should succeed"""
    review_update = SupervisorReviewUpdate(
        action=SupervisorAction.APPROVED,
        comment=None,
        status=SubmissionStatus.SUBMITTED
    )

    result = await service.update_review(review_id, review_update, context)

    assert result.action == SupervisorAction.APPROVED
    assert result.comment is None
```

### Integration Tests

**Scenario 1: Approve without comment**
1. Navigate to goal review page
2. Select a submitted goal
3. Leave comment field empty
4. Click "承認"
5. Confirm in dialog
6. ✅ Goal status changes to "approved"
7. ✅ No error message
8. Navigate to employee goal list
9. ✅ See "上司からのコメントはありません"

**Scenario 2: Reject without comment**
1. Navigate to goal review page
2. Select a submitted goal
3. Leave comment field empty
4. Click "差し戻し"
5. ✅ See error: "差し戻し時はコメントの入力が必要です"
6. ✅ Dialog does not open
7. ✅ Goal status unchanged

**Scenario 3: Historical data**
1. View goals with existing comments
2. ✅ All comments display correctly
3. ✅ No "上司からのコメントはありません" for old approvals with comments
4. ✅ Rejection comments all visible

### Manual Testing Checklist

- [ ] Approval without comment succeeds
- [ ] Approval with comment succeeds
- [ ] Rejection without comment fails with correct error
- [ ] Rejection with comment succeeds
- [ ] Default message shows for new approvals without comment
- [ ] Historical approvals with comments display correctly
- [ ] Historical approvals without comments display correctly (if any)
- [ ] Form label shows "(差し戻し時は必須)"
- [ ] Auto-save still works
- [ ] Character count updates correctly
- [ ] Max length validation works (>500 chars)
- [ ] Screen reader announces form label correctly
- [ ] Screen reader announces validation errors
- [ ] Mobile layout displays correctly
- [ ] Keyboard navigation works
- [ ] Focus management unchanged

## Performance Considerations

### Impact Assessment

| Area | Impact | Mitigation |
|------|--------|------------|
| Form validation | Negligible | Removing validation is faster |
| API calls | None | Same endpoint, same payload |
| Database queries | None | No schema changes |
| Rendering | Minimal | One conditional render (`||` operator) |
| Bundle size | -50 bytes | Removed validation code |

### Expected Performance
- Form validation: < 10ms (faster than before)
- API response time: Unchanged (~200ms)
- Page render: < 5ms for comment display
- Auto-save: Unchanged (~300ms)

## Security Considerations

### XSS Protection
- Existing: Comments are sanitized on display
- No changes needed
- `whitespace-pre-wrap` prevents code injection

### CSRF
- Existing: CSRF tokens on all mutations
- No changes needed

### Authorization
- Existing: Supervisor permission required
- No changes needed
- Backend validates supervisor relationship

### Input Validation
- Frontend: Optional comment, max 500 chars
- Backend: (Optional) Validate REJECTED requires comment
- Both layers provide security

### Audit Trail
- All actions logged with comment presence/absence
- No PII in logs (comment content not logged)
- Timestamps preserved

## Rollout Plan

### Phase 1: Development
1. Update `ApprovalForm/index.tsx`
2. Update `GoalCard.tsx`
3. (Optional) Update `supervisor_review_service.py`
4. Write unit tests
5. Code review

### Phase 2: Testing
1. Run unit tests
2. Run integration tests
3. Manual testing on staging
4. Accessibility audit
5. Performance testing

### Phase 3: Deployment
1. Deploy backend changes (if any)
2. Deploy frontend changes
3. Monitor error logs
4. Monitor user feedback

### Phase 4: Validation
1. Check approval success rate
2. Check rejection error rate
3. Verify no support tickets
4. Review user feedback

### Rollback Plan
If issues arise:
1. Revert frontend changes
2. Restore "(必須)" label
3. Restore approval comment validation
4. Investigate and fix issues
5. Redeploy

## Monitoring & Metrics

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Approval success rate | 100% | < 98% |
| Rejection without comment attempts | < 5% of rejections | > 15% |
| Approval without comment rate | 20-40% | N/A (informational) |
| API error rate | < 0.1% | > 1% |
| Page load time | < 2s | > 3s |

### Logging

```typescript
// Log approval without comment
logger.info('Goal approved without comment', {
  goalId: goal.id,
  supervisorId: currentUser.id,
  commentProvided: false
});

// Log rejection attempt without comment
logger.warn('Rejection blocked - missing comment', {
  goalId: goal.id,
  supervisorId: currentUser.id,
  attemptTimestamp: Date.now()
});
```

## Dependencies

### Internal
- Zod (validation library)
- react-hook-form (form management)
- Auto-save system
- Goal display components

### External
- None

## Open Questions

1. **Q**: Should we track how many approvals are done without comments?
   **A**: Yes, for metrics only. Not blocking.

2. **Q**: Should backend validation be mandatory or optional?
   **A**: Optional but recommended for defense in depth.

3. **Q**: What if a user had a draft comment saved and then approves?
   **A**: Draft comment is included if present, empty string if cleared.

4. **Q**: Should we add a confirmation for approval without comment?
   **A**: No, existing confirmation dialog is sufficient.

## Future Enhancements

### Out of Scope for v1
- Comment templates for common feedback
- Character counter with visual indicator (already exists)
- Rich text formatting for comments
- Attaching files to comments
- Comment editing after submission
- Comment threading/replies

### Potential v2 Features
- Analytics on comment patterns
- AI-suggested feedback
- Comment quality scoring
- Multilingual comments

## Conclusion

This design implements a straightforward improvement to the goal review workflow by making comments optional for approvals while maintaining the requirement for rejections. The changes are minimal, backward compatible, and improve the user experience without compromising feedback quality.

**Estimated Effort**: 2-3 hours
**Risk Level**: Low
**User Impact**: High (positive)
**Technical Complexity**: Low
