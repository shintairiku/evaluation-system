# Requirements: Optional Approval Comments, Required Return Comments

## Overview
Implement differentiated comment requirements for goal approval vs. return actions in the supervisor goal review workflow, making comments optional for approvals but mandatory for returns.

## Business Requirements

### BR-1: Optional Approval Comments
**Priority**: High
**Description**: Supervisors should be able to approve goals without providing a comment.

**Rationale**:
- Approving a goal indicates acceptance; detailed comments are not always necessary
- Reduces friction in the approval process
- Supervisors can still provide comments when they have feedback

**Success Criteria**:
- Approval action completes successfully with empty comment
- System logs approval even without comment
- No validation errors for empty comments on approval

### BR-2: Mandatory Return Comments
**Priority**: High
**Description**: Supervisors must provide a comment when returning (rejecting) a goal.

**Rationale**:
- Employees need clear feedback on why their goal was rejected
- Comments provide actionable guidance for goal revision
- Ensures quality of feedback in the review process

**Success Criteria**:
- Return action fails validation if comment is empty
- Clear error message guides user to add comment
- All returned goals have associated supervisor comments

### BR-3: Clear User Guidance
**Priority**: Medium
**Description**: The UI must clearly indicate when comments are mandatory vs. optional.

**Rationale**:
- Reduces user confusion and errors
- Improves user experience
- Meets accessibility standards

**Success Criteria**:
- Form label clearly indicates: "コメント (差し戻し時は必須)"
- Error messages are specific and helpful
- Screen readers announce comment requirements correctly

### BR-4: Historical Data Preservation
**Priority**: High
**Description**: Existing comments and approval records must remain unchanged.

**Rationale**:
- Maintain audit trail
- Preserve historical context
- Ensure compliance

**Success Criteria**:
- No changes to existing supervisor_review records
- Historical comments display correctly
- Audit logs remain intact

## Functional Requirements

### FR-1: Frontend Validation

#### FR-1.1: Form Schema
- **ID**: FR-1.1
- **Description**: Update Zod validation schema to make comment optional
- **Input**: Comment field value (string)
- **Processing**:
  - Remove `.min(1)` requirement
  - Add `.optional()` modifier
  - Keep `.max(500)` validation for length
- **Output**: Valid/invalid status
- **Error Handling**: Show length error if > 500 chars

#### FR-1.2: Approval Handler
- **ID**: FR-1.2
- **Description**: Allow approval with empty comments
- **Input**: Comment value from form
- **Processing**:
  - Remove empty comment validation
  - Trim whitespace
  - Accept empty string
  - Pass to API as `""` or `undefined`
- **Output**: Approval action triggered
- **Error Handling**: Only validate max length

#### FR-1.3: Return Handler
- **ID**: FR-1.3
- **Description**: Enforce mandatory comments for return action
- **Input**: Comment value from form
- **Processing**:
  - Check if comment is empty after trim
  - Show error if empty: "差し戻し時はコメントの入力が必要です"
  - Block submission if validation fails
- **Output**: Return action triggered or error displayed
- **Error Handling**: Specific error message for empty comments

#### FR-1.4: Form Label
- **ID**: FR-1.4
- **Description**: Update comment field label to reflect conditional requirement
- **Input**: N/A
- **Processing**: Display label with contextual requirement
- **Output**: "コメント (差し戻し時は必須)"
- **Error Handling**: N/A

### FR-2: Comment Display

#### FR-2.1: Approved Goal Display
- **ID**: FR-2.1
- **Description**: Handle display of approved goals with/without comments
- **Input**: Goal with `status: 'approved'` and `supervisorReview`
- **Processing**:
  - Check if `supervisorReview.comment` exists and is non-empty
  - If no comment: Show "上司からのコメントはありません"
  - If has comment: Show comment normally
- **Output**: Approval banner with comment or default message
- **Error Handling**: Fallback to default message if comment is null/undefined

#### FR-2.2: Returned Goal Display
- **ID**: FR-2.2
- **Description**: Display comments for returned goals (always present due to validation)
- **Input**: Goal with `status: 'rejected'` and `supervisorReview.comment`
- **Processing**: Display comment as before
- **Output**: Rejection banner with mandatory comment
- **Error Handling**: Should not occur (comment is validated)

### FR-3: Backend Validation (Optional Enhancement)

#### FR-3.1: Schema Validation
- **ID**: FR-3.1
- **Description**: Validate comment requirement based on action type
- **Input**: `SupervisorReviewUpdate` with `action` and `comment`
- **Processing**:
  - If `action === 'REJECTED'` and comment is empty: Raise validation error
  - If `action === 'APPROVED'`: Accept any comment value
- **Output**: Valid request or ValidationError
- **Error Handling**: Return 400 with error message

**Note**: Current backend already accepts optional comments. This requirement adds action-specific validation for extra security.

## Non-Functional Requirements

### NFR-1: Performance
- Form validation should complete in < 100ms
- No additional database queries required
- No impact on page load time

### NFR-2: Accessibility
- Screen reader announces: "コメント オプション項目 差し戻し時は必須"
- Error messages announced with `aria-live="assertive"`
- Focus management unchanged
- Keyboard navigation unaffected

### NFR-3: Compatibility
- Works with existing auto-save functionality
- Compatible with all supported browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive
- No breaking changes to API contracts

### NFR-4: Security
- XSS protection for comment content (existing)
- CSRF token validation (existing)
- Rate limiting unchanged
- Audit logging unchanged

### NFR-5: Maintainability
- Clear code comments explaining conditional logic
- Unit tests for approval without comment
- Unit tests for return without comment (should fail)
- Integration tests for both scenarios

## Data Requirements

### DR-1: Database Schema
**No changes required**. Current schema already supports optional comments:
```sql
comment TEXT NULL
```

### DR-2: API Request Format
```json
{
  "action": "APPROVED" | "REJECTED",
  "comment": string | null | undefined,
  "status": "submitted"
}
```

### DR-3: API Response Format
Unchanged - existing format sufficient.

## User Stories

### US-1: Supervisor Approves Goal Without Comment
**As a** supervisor
**I want to** approve a goal without writing a comment
**So that** I can quickly approve goals that meet expectations without redundant documentation

**Acceptance Criteria**:
- I can leave the comment field empty
- Clicking "承認" succeeds without validation error
- Goal status changes to "approved"
- Employee sees "上司からのコメントはありません" in their goal view

### US-2: Supervisor Returns Goal With Comment
**As a** supervisor
**I want to** be required to provide a comment when returning a goal
**So that** the employee understands what needs improvement

**Acceptance Criteria**:
- If I leave comment empty and click "差し戻し", I see an error
- Error message says "差し戻し時はコメントの入力が必要です"
- I cannot submit until I add a comment
- After adding comment, return succeeds
- Employee sees my comment in the rejection banner

### US-3: Supervisor Approves Goal With Comment
**As a** supervisor
**I want to** optionally provide a comment when approving a goal
**So that** I can give positive feedback or suggestions

**Acceptance Criteria**:
- I can write a comment in the text area
- Clicking "承認" succeeds with my comment
- Employee sees my comment in the approval banner

### US-4: Employee Views Approved Goal
**As an** employee
**I want to** see supervisor feedback on my approved goal
**So that** I understand if there are any suggestions or just acknowledgment

**Acceptance Criteria**:
- If supervisor left a comment, I see it in the approval banner
- If supervisor didn't leave a comment, I see "上司からのコメントはありません"
- Both cases display the approval date

## Dependencies

### Internal Dependencies
- Existing form validation framework (Zod, react-hook-form)
- Auto-save functionality
- Goal display components (GoalCard)
- Supervisor review service

### External Dependencies
- None

## Constraints

### Technical Constraints
- Must maintain TypeScript type safety
- Must follow existing validation patterns
- Cannot modify database schema
- Must preserve API backward compatibility

### Business Constraints
- Cannot change historical data
- Must maintain audit trail
- Must comply with data retention policies

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Users confused by conditional requirement | Medium | Low | Clear UI labels and error messages |
| Missing comments on old approvals break display | Low | Low | Conditional rendering with fallback |
| Backend doesn't validate, allowing empty return comments | Low | Medium | Add optional backend validation |
| Historical data display issues | Low | High | Thorough testing of existing records |

## Success Metrics

### Quantitative Metrics
- 100% of approvals should complete successfully (with or without comment)
- 0% of returns should succeed without comment
- < 5% of users should see validation errors on approval
- Auto-save success rate remains > 95%

### Qualitative Metrics
- User feedback indicates clear understanding of when comments are required
- No support tickets about comment validation
- Supervisors report easier approval workflow

## Out of Scope

The following are explicitly NOT included in this requirement:
- Changing comment max length (500 chars)
- Adding rich text formatting to comments
- Making comments editable after submission
- Adding attachments to comments
- Email notifications about comments
- Comment threading or replies
- Translation of comments
- AI-generated comment suggestions
