# Context: Optional Approval Comments, Required Return Comments

## Project Context

### System Overview
This is an HR Evaluation System (人事評価システム) that manages employee goal setting, supervisor review, and performance evaluations.

**Tech Stack**:
- **Frontend**: Next.js 14 (App Router), TypeScript, React, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI, Python 3.12, SQLAlchemy
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Clerk
- **Deployment**: Docker

### Goal Review Workflow

The system implements a structured goal review process:

```
1. Employee creates goal (draft)
2. Employee submits goal (submitted)
3. Supervisor reviews goal:
   - Option A: Approve → Goal approved ✅
   - Option B: Return → Goal rejected ⛔
4. If rejected:
   - Employee revises goal
   - Resubmits for review
   - Repeat until approved
```

### Current Implementation

#### Goal Review Page
**Location**: `/goal-review` (supervisor view)

**Components**:
- `ApprovalForm`: Comment input + approval/rejection buttons
- `GoalApprovalCard`: Goal details + review form
- `ConfirmationDialog`: Confirmation before action

**Current Behavior**:
- Both approval and rejection require mandatory comments
- Form shows "(必須)" label for comment field
- Validation blocks submission if comment is empty

#### Goal Display
**Location**: `/goal-list` (employee view)

**Components**:
- `GoalCard`: Displays goal with status and supervisor feedback

**Current Behavior**:
- Shows approval banner if `goal.status === 'approved'` **AND** `goal.supervisorReview.comment` exists
- Shows rejection banner if `goal.status === 'rejected'` **AND** `goal.supervisorReview.comment` exists
- If comment missing, banner doesn't appear

---

## Problem Statement

### Business Problem
Supervisors report that requiring comments for all approvals creates unnecessary friction:
- Simple approvals that just mean "looks good" don't need detailed comments
- Mandatory comments lead to generic, low-value feedback like "OK" or "承認"
- Slows down the approval process

However, for rejections, detailed feedback is **critical** because employees need to know what to improve.

### User Pain Points
1. **Supervisors**: Forced to write comments even when goal is clearly acceptable
2. **Employees**: Receive generic approval comments with no value
3. **System**: Cluttered with meaningless comments like "OK" or "承認"

### Desired State
- **Approvals**: Optional comments (can be empty)
- **Rejections**: Mandatory comments (must provide feedback)
- **Display**: Show appropriate message when no comment provided

---

## Technical Context

### Architecture

#### Frontend Structure
```
frontend/src/
├── feature/
│   └── evaluation/
│       ├── superviser/
│       │   └── goal-review/
│       │       ├── components/
│       │       │   ├── ApprovalForm/          ← MODIFY
│       │       │   ├── GoalApprovalCard/
│       │       │   └── ConfirmationDialog/
│       │       ├── hooks/
│       │       │   └── useGoalApprovalActions.ts
│       │       └── display/
│       │           └── index.tsx
│       └── employee/
│           └── goal-list/
│               └── components/
│                   └── GoalCard.tsx             ← MODIFY
└── api/
    └── server-actions/
        └── supervisor-reviews.ts
```

#### Backend Structure
```
backend/app/
├── api/v1/
│   └── supervisor_reviews.py                    ← (Optional) MODIFY
├── services/
│   └── supervisor_review_service.py             ← (Optional) MODIFY
├── schemas/
│   └── supervisor_review.py                     ← Already supports optional
└── database/
    ├── models/
    │   └── supervisor_review.py
    └── repositories/
        └── supervisor_review_repository.py
```

### Data Model

#### SupervisorReview Table
```sql
CREATE TABLE supervisor_reviews (
    id UUID PRIMARY KEY,
    goal_id UUID NOT NULL REFERENCES goals(id),
    period_id UUID NOT NULL REFERENCES evaluation_periods(id),
    supervisor_id UUID NOT NULL REFERENCES users(id),
    subordinate_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(20) NOT NULL,  -- 'APPROVED' or 'REJECTED'
    comment TEXT NULL,             -- ✅ Already nullable
    status VARCHAR(20) NOT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

**Key Point**: `comment` is already nullable - no migration needed!

### API Contract

#### Update Supervisor Review
```
PUT /api/v1/supervisor-reviews/{reviewId}
```

**Request**:
```json
{
  "action": "APPROVED" | "REJECTED",
  "comment": string | null | undefined,
  "status": "submitted"
}
```

**Response**:
```json
{
  "id": "uuid",
  "goalId": "uuid",
  "action": "APPROVED",
  "comment": null,  // ✅ Can be null
  "status": "submitted",
  "reviewedAt": "2025-11-06T10:00:00Z"
}
```

### Current Validation

#### Frontend (ApprovalForm)
```typescript
// Lines 16-22: Zod schema
const approvalFormSchema = z.object({
  comment: z.string()
    .min(1, 'コメントの入力が必要です')  // ❌ Problem: Always required
    .max(500, '500文字以内で入力してください')
    .trim()
});

// Lines 118-125: Approval handler
if (!approvalComment) {  // ❌ Problem: Rejects empty comments
  form.setError('comment', {
    type: 'manual',
    message: '承認時はコメントの入力が必要です'
  });
  return;
}

// Lines 138-145: Rejection handler
if (!rejectionComment) {  // ✅ Correct: Requires comment
  form.setError('comment', {
    type: 'manual',
    message: '差し戻し時はコメントの入力が必要です'
  });
  return;
}
```

#### Backend (supervisor_review_service.py)
```python
# Lines 267-274: Update method
updated = await self.repo.update(
    review_id,
    org_id,
    action=review_update.action.value if review_update.action is not None else None,
    comment=review_update.comment,  # ✅ Already accepts None
    status=status_value,
    reviewed_at=reviewed_at,
)
```

**Key Point**: Backend already supports optional comments - no validation to add!

---

## Business Requirements Context

### Stakeholder Perspective
- **From**: @fukamatsu04 (Product Owner)
- **Decision**: Made in meeting on Nov 4, 2025
- **Rationale**: Reduce friction in approval process while maintaining quality feedback for rejections

### User Experience Goals
1. **Speed**: Supervisors can approve quickly without writing comments
2. **Quality**: Rejection feedback remains detailed and helpful
3. **Clarity**: UI clearly indicates when comments are required
4. **Consistency**: Behavior is predictable and intuitive

### Compliance Considerations
- **Audit Trail**: All actions logged regardless of comment presence
- **Data Retention**: Historical comments must be preserved
- **Feedback Quality**: Rejection comments must be substantive

---

## Related Features

### Auto-Save Functionality
**Location**: `useAutoSave.ts`

**Behavior**:
- Automatically saves draft comments every 5 seconds
- Reduces data loss if page is closed
- Works independently of submission

**Impact**: Must continue to work with optional comments

### Comment History
**Location**: `GoalCard.tsx` - Rejection history section

**Behavior**:
- Shows all previous rejections with comments
- Displays rejection date and supervisor name
- Allows employee to see feedback evolution

**Impact**: All historical rejections will have comments (they were mandatory)

### Approval Notifications (Future)
**Planned Feature**: Email/in-app notifications for goal status changes

**Impact**: Notification templates must handle missing comments gracefully

---

## Technical Constraints

### Must Preserve
1. **Backward Compatibility**: Existing comments must display correctly
2. **API Contract**: Cannot break existing API consumers
3. **Database Schema**: Cannot modify (comment already nullable)
4. **Auto-Save**: Must continue working
5. **Accessibility**: WCAG 2.1 AA compliance

### Cannot Change
1. **Comment Max Length**: 500 characters
2. **Authentication**: Clerk-based auth
3. **Permission Model**: RBAC-based supervisor permissions
4. **Audit Logging**: All actions must be logged

### Must Add
1. **Conditional Validation**: Different rules for approve vs reject
2. **Default Message**: Display fallback for approvals without comments
3. **UI Indicators**: Clear labeling of requirement
4. **Error Messages**: Specific error for rejection without comment

---

## Code Patterns & Conventions

### Frontend Patterns

#### Form Validation
```typescript
// Pattern: Zod + react-hook-form
const schema = z.object({
  field: z.string().optional()
});

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { field: '' }
});
```

#### Server Actions
```typescript
// Pattern: Server actions in /api/server-actions/
export async function updateSupervisorReviewAction(
  reviewId: string,
  data: SupervisorReviewUpdate
): Promise<ApiResponse<SupervisorReview>> {
  // Implementation
}
```

#### Error Handling
```typescript
// Pattern: Toast notifications
if (!result.success) {
  toast.error(result.error || 'エラーが発生しました');
  return;
}
toast.success('正常に更新されました');
```

### Backend Patterns

#### Service Layer
```python
# Pattern: Service methods with permission decorators
@require_permission(Permission.GOAL_APPROVE)
async def update_review(
    self, review_id: UUID, review_update: SupervisorReviewUpdate, context: AuthContext
) -> SupervisorReviewSchema:
    # Validation
    # Business logic
    # Database update
    # Return schema
```

#### Validation
```python
# Pattern: Raise custom exceptions
if invalid_condition:
    raise ValidationError("Specific error message")
```

---

## Testing Context

### Existing Test Coverage

#### Frontend
- **Location**: `__tests__/ApprovalForm.test.tsx`
- **Coverage**: ~75%
- **Patterns**: Jest + React Testing Library
- **Needs**: Tests for optional approval comments

#### Backend
- **Location**: `tests/services/test_supervisor_review_service.py`
- **Coverage**: ~85%
- **Patterns**: pytest + AsyncMock
- **Needs**: (Optional) Tests for comment validation

### Test Data

#### Existing Goals with Comments
```json
{
  "id": "goal-1",
  "status": "approved",
  "supervisorReview": {
    "action": "APPROVED",
    "comment": "良く作成された目標です",
    "reviewedAt": "2025-11-01T10:00:00Z"
  }
}
```

#### Historical Rejections (All have comments)
```json
{
  "id": "goal-2",
  "status": "rejected",
  "supervisorReview": {
    "action": "REJECTED",
    "comment": "目標の具体性が不足しています",
    "reviewedAt": "2025-10-30T15:00:00Z"
  }
}
```

---

## Accessibility Context

### Current Implementation
- Form uses semantic HTML (`<label>`, `<textarea>`, `<button>`)
- ARIA labels for all interactive elements
- Screen reader announcements for actions
- Keyboard navigation support

### Accessibility Requirements
- Label must indicate conditional requirement
- Error messages announced with `aria-live="assertive"`
- Success messages announced with `aria-live="polite"`
- Focus management unchanged
- Color contrast ratios maintained

### Screen Reader Experience
```
Current: "コメント 必須項目"
Proposed: "コメント オプション項目 差し戻し時は必須"
```

---

## Performance Context

### Current Metrics
- Form validation: < 50ms
- API call latency: ~200ms (p95)
- Page load time: ~1.2s
- Auto-save debounce: 5s

### Performance Targets
- No degradation in existing metrics
- Form validation: < 10ms (faster due to less validation)
- Bundle size: -50 bytes (removed validation)

---

## Security Context

### Authentication & Authorization
- **Auth**: Clerk-based JWT tokens
- **Permissions**: RBAC with roles (admin, supervisor, employee)
- **Scope**: Supervisors can only review their subordinates' goals

### Input Validation
- **Frontend**: Zod schema validation
- **Backend**: Pydantic schema validation
- **XSS**: Comments sanitized on display
- **SQL Injection**: Parameterized queries (SQLAlchemy)

### Audit Trail
All supervisor review actions logged:
```json
{
  "action": "supervisor_review.update",
  "userId": "supervisor-uuid",
  "targetGoalId": "goal-uuid",
  "reviewAction": "APPROVED",
  "commentProvided": false,
  "timestamp": "2025-11-06T10:00:00Z"
}
```

---

## Deployment Context

### Environment
- **Development**: Local Docker Compose
- **Staging**: Vercel (Frontend) + Railway (Backend)
- **Production**: Vercel (Frontend) + Railway (Backend)

### Deployment Process
1. Create PR from feature branch
2. Automated tests run on PR
3. Manual review + approval
4. Merge to `develop`
5. Auto-deploy to staging
6. Manual testing on staging
7. Promote to production (manual trigger)

### Feature Flags
Currently not implemented. Consider adding for gradual rollout:
```typescript
const enableOptionalApprovalComments = useFeatureFlag('optional-approval-comments');
```

---

## Monitoring & Observability

### Existing Logging
- **Frontend**: Console logs (development), Vercel logs (production)
- **Backend**: Python logging module, Railway logs
- **Errors**: Captured in Sentry (if configured)

### Metrics to Add
```typescript
// Log approval without comment
analytics.track('goal_approved', {
  goalId: goal.id,
  commentProvided: false,
  supervisorId: user.id
});

// Log rejection attempt without comment (blocked)
analytics.track('rejection_blocked_no_comment', {
  goalId: goal.id,
  supervisorId: user.id
});
```

---

## Known Issues & Gotchas

### Frontend Quirks
1. **Zod Validation**: `.min(1)` validation runs even on optional fields if present
2. **React Hook Form**: Empty string `""` vs `undefined` vs `null` behaves differently
3. **Auto-Save**: Saves draft comments even if never submitted

### Backend Quirks
1. **SQLAlchemy**: `None` serializes to `null` in JSON, not omitted
2. **Pydantic**: `Optional[str]` allows `None` but not missing field (use `Field(default=None)`)
3. **Database**: Empty string `""` stored differently than `NULL`

### Display Issues
1. **Conditional Rendering**: `{condition && component}` doesn't show if condition is falsy
2. **Fallback Values**: `value || 'default'` treats `""` as falsy (correct for this case)
3. **Historical Data**: Some old approvals might have `null` comments, some might have `""`

---

## FAQ

### Q: Why not make comments optional for rejections too?
**A**: Employees need clear feedback on why their goal was rejected. Without comments, they can't improve.

### Q: What about goals approved before this change?
**A**: Historical approved goals with comments will display normally. Historical approved goals without comments (if any) will show the default message.

### Q: Should backend validate comment requirement?
**A**: Optional but recommended. Frontend validation is primary, backend is defense-in-depth.

### Q: What if a supervisor had a draft comment and then approves?
**A**: The draft comment will be included with the approval (if not manually deleted).

### Q: Can we track how many approvals are done without comments?
**A**: Yes, add analytics event: `analytics.track('goal_approved', { commentProvided: false })`.

### Q: What about comment templates or suggestions?
**A**: Out of scope for v1. Could be added in v2.

---

## References

### Internal Documentation
- [Goal Review Workflow](../../../docs/workflows/goal-review.md)
- [Supervisor Review API](../../../docs/api/supervisor-reviews.md)
- [Frontend Architecture](../../../docs/architecture/frontend.md)

### External Resources
- [Zod Documentation](https://zod.dev/)
- [React Hook Form](https://react-hook-form.com/)
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [Pydantic](https://docs.pydantic.dev/)

### Related Issues
- Issue #336: This task
- (No other related issues)

---

## Contact Information

**Issue Creator**: @fukamatsu04
**Product Owner**: TBD
**Tech Lead**: TBD
**Developer**: TBD
**Reviewer**: TBD

**Support**:
- GitHub Issues: https://github.com/shintairiku/evaluation-system/issues
- Slack: #evaluation-system (if exists)
