# Issue #336: Optional Comment for Approval, Required Comment for Return

**GitHub Issue**: https://github.com/shintairiku/evaluation-system/issues/336

## Issue Title
[TASK-12] sub00: Optional Comment for Approval, Required Comment for Return

## Created By
@fukamatsu04

## Created Date
November 4, 2025

## Status
Open / Unassigned

## Labels
None

## Description

During a meeting, it was decided that the current system needs to implement different comment requirements for approvals and returns (差し戻し) in the goal review process.

### Current Behavior
- Both approval and return actions require mandatory comments
- Comment field shows "(必須)" (required) label regardless of action
- Users cannot approve goals without entering a comment

### Desired Behavior
- **Approval (承認)**: Comment should be optional
- **Return (差し戻し)**: Comment must be mandatory
- Clear UI indication of when comments are required
- Backend validation to enforce comment rules

## Requirements

### 1. Approval Process
- [ ] Comment field should be optional for approval action
- [ ] Users can approve goals with or without comments
- [ ] Empty comments should be accepted by both frontend and backend
- [ ] Display default message when no comment provided: "上司からのコメントはありません"

### 2. Return/Rejection Process
- [ ] Comment field must be required for return action
- [ ] Validation error shown if user attempts to return without comment
- [ ] Error message: "差し戻し時はコメントの入力が必要です"
- [ ] Backend must reject return requests without comments

### 3. Frontend Responsibilities
- [ ] Update form validation schema to make comment optional
- [ ] Clearly indicate when comment is mandatory: "(差し戻し時は必須)"
- [ ] Show validation errors for missing comments on return
- [ ] Handle empty comments gracefully in display

### 4. Backend Responsibilities
- [ ] Accept optional comments for approval actions
- [ ] Validate comment presence for return actions
- [ ] Return appropriate error if return action lacks comment
- [ ] Log all actions with their associated comments

## Acceptance Criteria

1. **AC1: Optional Approval Comments**
   - Users can approve goals without entering a comment
   - Approval succeeds with empty comment field
   - Backend accepts `comment: null` or `comment: ""` for approval

2. **AC2: Mandatory Return Comments**
   - Users cannot return goals without entering a comment
   - Validation error appears: "差し戻し時はコメントの入力が必要です"
   - Backend rejects return requests without comments
   - Return action with comment succeeds as before

3. **AC3: Clear UI Indicators**
   - Form label shows: "コメント (差し戻し時は必須)"
   - No persistent red "(必須)" label
   - Error appears only when attempting return without comment

4. **AC4: Display Handling**
   - Approved goals without comments show: "上司からのコメントはありません"
   - Approved goals with comments show comment normally
   - Return comments always displayed (since they're mandatory)
   - Comment history preserved correctly

5. **AC5: Action Logging**
   - All return actions logged with mandatory comments
   - Approval actions logged with optional comments
   - Comment presence/absence clearly indicated in logs

## Technical Context

### Affected Components

**Frontend**:
- `ApprovalForm/index.tsx` - Form validation and submission
- `GoalCard.tsx` - Comment display for approved/rejected goals
- `useGoalApprovalActions.ts` - Action handlers

**Backend**:
- `supervisor_review_service.py` - Business logic
- `supervisor_review.py` - Schema validation
- `supervisor_reviews.py` - API endpoints

### Current Implementation
- Comment field uses Zod schema with `.min(1)` validation
- Both approval and rejection handlers check for empty comments
- Backend schema has `comment: Optional[str] = None`

## Priority
Medium

## Estimate
2-3 hours

## Related Issues
None

## Notes
- Backward compatibility: existing comments should remain unchanged
- Auto-save functionality should continue working for draft comments
- Accessibility: screen reader announcements should reflect new behavior
