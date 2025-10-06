# Implementation Plan: Improve Rejection Flow - Display Review Comments and Enable Resubmission

> This document breaks down the implementation into specific development tasks based on the design document. Tasks are organized by feature area and include traceability to requirements.

## Feature: Goal List & Rejection Flow UI

### 1. Frontend - Goal List Page Implementation

> Create the main goal list page with filtering and status display

- [ ] **1.1. Create Goal List Page Route**
  > Create new Next.js page for goal list with SSR support
  >
  > **File:** `frontend/src/app/(evaluation)/goal-list/page.tsx`
  >
  > **Implementation:**
  > - Create new route under evaluation section
  > - Implement server component with getGoalsAction
  > - Fetch goals with current period by default
  > - Handle authentication via Clerk
  > - Pass data to client components
  >
  > **Related Requirements:** 1, 4

- [ ] **1.2. Create GoalListPage Container Component**
  > Main container component for goal list with state management
  >
  > **File:** `frontend/src/feature/goal-list/display/index.tsx`
  >
  > **Implementation:**
  > - Client component with useState/useEffect
  > - State for goals, filters, loading, error
  > - Fetch goals when filters change
  > - Handle loading states (skeleton)
  > - Handle error states (retry button)
  > - Handle empty state (no goals message)
  >
  > **Related Requirements:** 1, 4, 7

- [ ] **1.3. Create GoalFilterBar Component**
  > Filter controls for period, status, and category
  >
  > **File:** `frontend/src/feature/goal-list/components/GoalFilterBar.tsx`
  >
  > **Implementation:**
  > - Select dropdowns for period, status, category
  > - Use shadcn/ui Select component
  > - Emit filter changes to parent
  > - Show active filter count badge
  > - Persist filters in URL query params (optional)
  >
  > **Related Requirements:** 4

- [ ] **1.4. Create GoalCard Component**
  > Individual goal card display with status and actions
  >
  > **File:** `frontend/src/feature/goal-list/components/GoalCard.tsx`
  >
  > **Implementation:**
  > - Display goal title, category, weight, status
  > - Show StatusBadge component
  > - Show rejection comment preview if rejected
  > - Action buttons: "View Details", "Edit & Resubmit" (if rejected)
  > - Color-coded border based on status
  > - Responsive layout (mobile-friendly)
  >
  > **Related Requirements:** 1, 2

- [ ] **1.5. Create StatusBadge Component**
  > Color-coded badge for goal status
  >
  > **File:** `frontend/src/feature/goal-list/components/StatusBadge.tsx`
  >
  > **Implementation:**
  > - Badge component with icon and label
  > - Status config: draft, submitted, approved, rejected
  > - Color variants: secondary, warning, success, destructive
  > - Icons from lucide-react
  > - Japanese labels: 下書き, 承認待ち, 承認済み, 差し戻し
  >
  > **Related Requirements:** 1

- [ ] **1.6. Create RejectionCommentPreview Component**
  > Truncated rejection comment with expand/collapse
  >
  > **File:** `frontend/src/feature/goal-list/components/RejectionCommentPreview.tsx`
  >
  > **Implementation:**
  > - Alert component (destructive variant)
  > - Truncate comment at 200 characters
  > - "Read more" / "Show less" toggle
  > - Display reviewer name and date
  > - Handle missing comments (show placeholder)
  >
  > **Related Requirements:** 2

- [ ] **1.7. Create GoalListSkeleton Component**
  > Loading skeleton for goal list
  >
  > **File:** `frontend/src/feature/goal-list/components/GoalListSkeleton.tsx`
  >
  > **Implementation:**
  > - Skeleton cards matching GoalCard layout
  > - Use shadcn/ui Skeleton component
  > - Show 3-5 skeleton cards
  >
  > **Related Requirements:** 7

### 2. Frontend - Goal Detail Page Implementation

> Create goal detail page with full review history

- [ ] **2.1. Create Goal Detail Page Route**
  > Create dynamic route for goal details
  >
  > **File:** `frontend/src/app/(evaluation)/goal-detail/[id]/page.tsx`
  >
  > **Implementation:**
  > - Dynamic route with goal ID parameter
  > - Server component to fetch goal details
  > - Call getGoalByIdAction with goal ID
  > - Include supervisor reviews in response
  > - Handle not found errors
  >
  > **Related Requirements:** 1, 6

- [ ] **2.2. Create GoalDetailView Component**
  > Main detail view component with all goal information
  >
  > **File:** `frontend/src/feature/goal-detail/display/index.tsx`
  >
  > **Implementation:**
  > - Display goal fields based on category
  > - Show SupervisorReviewSection component
  > - Action buttons based on status
  > - Back to list navigation
  > - Breadcrumb navigation (optional)
  >
  > **Related Requirements:** 1, 6

- [ ] **2.3. Create SupervisorReviewSection Component**
  > Display all supervisor reviews for a goal
  >
  > **File:** `frontend/src/feature/goal-detail/components/SupervisorReviewSection.tsx`
  >
  > **Implementation:**
  > - Loop through supervisorReviews array
  > - Display each review with action, comment, date
  > - Use RejectionAlert for REJECTED reviews
  > - Use ApprovalBanner for APPROVED reviews
  > - Sort reviews by date (newest first)
  > - Show "No reviews yet" if empty
  >
  > **Related Requirements:** 2, 6

- [ ] **2.4. Create RejectionAlert Component**
  > Prominent alert for rejection feedback
  >
  > **File:** `frontend/src/feature/goal-detail/components/RejectionAlert.tsx`
  >
  > **Implementation:**
  > - Alert component (destructive variant)
  > - Full rejection comment (not truncated)
  > - Reviewer name and date
  > - Warning icon
  > - Styled for prominence
  >
  > **Related Requirements:** 2

- [ ] **2.5. Create ApprovalBanner Component**
  > Positive banner for approval feedback
  >
  > **File:** `frontend/src/feature/goal-detail/components/ApprovalBanner.tsx`
  >
  > **Implementation:**
  > - Alert component (success variant)
  > - Approval comment (if provided)
  > - Approver name and date
  > - Checkmark icon
  > - Green styling
  >
  > **Related Requirements:** 6

### 3. Frontend - Edit & Resubmit Goal Implementation

> Enable editing and resubmission of rejected goals

- [ ] **3.1. Modify Goal Input Page for Edit Mode**
  > Add support for editing existing goals with rejection feedback
  >
  > **File:** `frontend/src/feature/goal-input/display/index.tsx`
  >
  > **Implementation:**
  > - Detect `edit` and `mode` query params
  > - Load goal data if edit mode
  > - Load rejection comments if mode=resubmit
  > - Pre-fill all form fields
  > - Display rejection banner at top (sticky)
  > - Change submit button to "Resubmit for Approval"
  > - Add "Save Draft" button
  >
  > **Related Requirements:** 3, 5

- [ ] **3.2. Create RejectionFeedbackBanner Component**
  > Sticky banner showing rejection feedback while editing
  >
  > **File:** `frontend/src/feature/goal-input/components/RejectionFeedbackBanner.tsx`
  >
  > **Implementation:**
  > - Sticky positioned at top of form
  > - Alert component (warning variant)
  > - Full rejection comment
  > - Expandable/collapsible
  > - "Show Full" / "Collapse" toggle
  > - Reviewer info
  >
  > **Related Requirements:** 3

- [ ] **3.3. Add Resubmit Logic to Goal Input**
  > Handle resubmission workflow
  >
  > **File:** `frontend/src/feature/goal-input/display/ConfirmationStep.tsx` or new hook
  >
  > **Implementation:**
  > - Add "Save Draft" button handler:
  >   - Call updateGoalAction (PUT /api/v1/goals/:id)
  >   - Keep status as "rejected"
  >   - Show success toast
  > - Add "Resubmit for Approval" button handler:
  >   - Call updateGoalAction first (if changes)
  >   - Then call submitGoalAction (POST /submit)
  >   - Change status to "submitted"
  >   - Show success toast: "目標を再提出しました"
  >   - Redirect to goal list
  >
  > **Related Requirements:** 3

- [ ] **3.4. Add Unsaved Changes Warning**
  > Prevent accidental navigation away from unsaved changes
  >
  > **File:** `frontend/src/feature/goal-input/hooks/useUnsavedChanges.ts` (create)
  >
  > **Implementation:**
  > - Track form dirty state
  > - Add beforeunload event listener
  > - Show browser confirmation dialog
  > - Add custom dialog on route change (Next.js router)
  > - Provide options: Save Draft, Discard, Cancel
  >
  > **Related Requirements:** 3

### 4. Frontend - Integration with Goal Creation (TASK-04)

> Add links from goal creation alerts to goal list

- [ ] **4.1. Update Goal Creation Page Alerts**
  > Add links to goal list page in TASK-04 alerts
  >
  > **File:** `frontend/src/feature/goal-input/display/index.tsx`
  >
  > **Implementation:**
  > - Update "submitted goals exist" alert:
  >   - Add link: `/goal-list` with text "目標一覧ページで確認してください"
  > - Add new "rejected goals exist" alert:
  >   - Show when rejected goals found (and no submitted)
  >   - Add link: `/goal-list?status=rejected`
  >   - Message: "差し戻された目標があります"
  > - Add "approved goals exist" alert:
  >   - Show when approved goals exist
  >   - Add link to goal list
  >
  > **Related Requirements:** 5

- [ ] **4.2. Add Goal List Link to Sidebar/Navigation**
  > Ensure goal list is accessible from main navigation
  >
  > **File:** `frontend/src/components/display/sidebar.tsx`
  >
  > **Implementation:**
  > - Add "目標一覧" (Goal List) menu item
  > - Icon: List or FileCheck
  > - Route: `/goal-list`
  > - Visible to all employees
  > - Badge showing rejected goals count (optional)
  >
  > **Related Requirements:** 4

### 5. Frontend - API Integration

> Connect components to existing backend APIs

- [ ] **5.1. Verify/Update Goal API Types**
  > Ensure TypeScript types include supervisor reviews
  >
  > **File:** `frontend/src/api/types/goal.ts`
  >
  > **Implementation:**
  > - Verify GoalDetail includes supervisorReviews?: SupervisorReview[]
  > - Add SupervisorReview type if missing
  > - Ensure action enum: APPROVED | REJECTED | PENDING
  > - Export types from index
  >
  > **Related Requirements:** All

- [ ] **5.2. Create/Update Goal Server Actions**
  > Server actions for goal operations
  >
  > **File:** `frontend/src/api/server-actions/goals.ts`
  >
  > **Implementation:**
  > - Verify getGoalsAction exists with filter support
  > - Verify getGoalByIdAction exists
  > - Verify updateGoalAction exists
  > - Verify submitGoalAction exists
  > - Add error handling for all actions
  > - Return ApiResponse<T> format
  >
  > **Related Requirements:** All

- [ ] **5.3. Add Helper Functions**
  > Utility functions for goal display
  >
  > **File:** `frontend/src/lib/utils/goals.ts` (create)
  >
  > **Implementation:**
  > - `getGoalTitle(goal: Goal): string` - extract title from targetData
  > - `getStatusBorderColor(status: GoalStatus): string` - return Tailwind classes
  > - `formatGoalCategory(category: string): string` - format display
  > - `getLatestReview(reviews: SupervisorReview[]): SupervisorReview | null`
  > - `formatReviewDate(date: string): string` - Japanese date format
  >
  > **Related Requirements:** 1, 2

### 6. Manual E2E Testing

> Execute manual test scenarios to validate functionality

- [ ] **6.1. Test Scenario: View Goal List**
  > Verify goal list displays correctly with all statuses
  >
  > **Test Steps:**
  > 1. Login as employee
  > 2. Navigate to `/goal-list`
  > 3. Verify goals are displayed with correct status badges
  > 4. Verify filter dropdowns work (period, status, category)
  > 5. Verify empty state when no goals match filter
  > 6. Verify loading skeleton appears during fetch
  >
  > **Expected Result:** Goal list loads and displays correctly
  >
  > **Related Requirements:** 1, 4, 7

- [ ] **6.2. Test Scenario: View Rejected Goal Details**
  > Verify rejection comments are displayed prominently
  >
  > **Test Steps:**
  > 1. Create and submit a goal
  > 2. Login as supervisor and reject with comment
  > 3. Login back as employee
  > 4. Navigate to goal list
  > 5. Find rejected goal and click "View Details"
  > 6. Verify rejection comment is displayed in alert
  > 7. Verify reviewer name and date are shown
  >
  > **Expected Result:** Rejection feedback clearly visible
  >
  > **Related Requirements:** 2, 6

- [ ] **6.3. Test Scenario: Edit and Resubmit Rejected Goal**
  > Verify complete resubmission workflow
  >
  > **Test Steps:**
  > 1. From rejected goal, click "Edit & Resubmit"
  > 2. Verify rejection banner appears at top
  > 3. Verify all fields are pre-filled
  > 4. Make changes to goal
  > 5. Click "Save Draft" - verify status stays "rejected"
  > 6. Click "Resubmit for Approval"
  > 7. Verify status changes to "submitted"
  > 8. Verify redirect to goal list
  > 9. Verify success toast appears
  >
  > **Expected Result:** Goal successfully resubmitted
  >
  > **Related Requirements:** 3

- [ ] **6.4. Test Scenario: Unsaved Changes Warning**
  > Verify navigation protection
  >
  > **Test Steps:**
  > 1. Start editing a rejected goal
  > 2. Make changes without saving
  > 3. Try to navigate away (browser back, close tab, route change)
  > 4. Verify confirmation dialog appears
  > 5. Test "Cancel" option - stay on page
  > 6. Test "Discard" option - leave page
  >
  > **Expected Result:** Unsaved changes protected
  >
  > **Related Requirements:** 3

- [ ] **6.5. Test Scenario: Integration with TASK-04**
  > Verify navigation from goal creation to goal list
  >
  > **Test Steps:**
  > 1. Submit goals for a period
  > 2. Navigate to goal creation page
  > 3. Verify alert: "目標は既に提出されています"
  > 4. Click link to goal list
  > 5. Verify navigation to `/goal-list`
  > 6. Verify submitted goals are displayed
  >
  > **Expected Result:** Seamless navigation between pages
  >
  > **Related Requirements:** 5

- [ ] **6.6. Test Scenario: Filter by Rejected Goals**
  > Verify filtering works correctly
  >
  > **Test Steps:**
  > 1. Create goals with different statuses
  > 2. Navigate to goal list
  > 3. Filter by status "rejected"
  > 4. Verify only rejected goals shown
  > 5. Verify count badge shows correct number
  > 6. Filter by status "all"
  > 7. Verify all goals shown again
  >
  > **Expected Result:** Filtering works as expected
  >
  > **Related Requirements:** 4

- [ ] **6.7. Test Scenario: Mobile Responsiveness**
  > Verify mobile layout works correctly
  >
  > **Test Steps:**
  > 1. Open goal list on mobile device (or Chrome DevTools mobile mode)
  > 2. Verify cards stack vertically
  > 3. Verify filters are accessible
  > 4. Verify action buttons don't overflow
  > 5. Test navigation to detail page
  > 6. Test edit/resubmit flow on mobile
  >
  > **Expected Result:** Fully functional on mobile
  >
  > **Related Requirements:** 7

- [ ] **6.8. Test Scenario: Error Handling**
  > Verify error states and recovery
  >
  > **Test Steps:**
  > 1. Disconnect network
  > 2. Try to load goal list
  > 3. Verify error message appears
  > 4. Verify "Retry" button exists
  > 5. Reconnect network and click retry
  > 6. Verify data loads successfully
  > 7. Test API error (e.g., invalid goal ID)
  > 8. Verify appropriate error message
  >
  > **Expected Result:** Graceful error handling
  >
  > **Related Requirements:** 7, 8

- [ ] **6.9. Test Scenario: Performance with Many Goals**
  > Verify performance with large dataset
  >
  > **Test Steps:**
  > 1. Create 50+ goals (test data)
  > 2. Navigate to goal list
  > 3. Measure page load time (<2 seconds)
  > 4. Test filtering (should be instant)
  > 5. Test scrolling (should be smooth)
  > 6. Verify pagination if implemented
  >
  > **Expected Result:** Good performance even with many goals
  >
  > **Related Requirements:** 7

- [ ] **6.10. Test Scenario: Accessibility**
  > Verify keyboard navigation and screen reader support
  >
  > **Test Steps:**
  > 1. Use Tab key to navigate goal list
  > 2. Verify focus indicators are visible
  > 3. Use Enter to activate buttons
  > 4. Use screen reader (NVDA/JAWS) to read content
  > 5. Verify ARIA labels are present
  > 6. Test with keyboard only (no mouse)
  >
  > **Expected Result:** Fully accessible interface
  >
  > **Related Requirements:** 7

### 7. Documentation and Polish

> Finalize implementation with documentation and refinements

- [ ] **7.1. Add Inline Code Comments**
  > Document complex logic and business rules
  >
  > **Files:** All component files
  >
  > **Implementation:**
  > - Explain "why" not just "what"
  > - Document edge cases handled
  > - Reference requirements where applicable
  >
  > **Related Requirements:** All

- [ ] **7.2. Update Component README (if exists)**
  > Document new components and their usage
  >
  > **File:** `frontend/src/feature/goal-list/README.md` (create if needed)
  >
  > **Implementation:**
  > - List all components with descriptions
  > - Show usage examples
  > - Document props and types
  >
  > **Related Requirements:** All

- [ ] **7.3. Code Review and Refinement**
  > Ensure code quality and consistency
  >
  > **Checklist:**
  > - [ ] All components follow project patterns
  > - [ ] TypeScript types are correct
  > - [ ] No console.log statements left
  > - [ ] Proper error boundaries
  > - [ ] Loading states everywhere
  > - [ ] Consistent styling (Tailwind classes)
  > - [ ] Responsive design verified
  > - [ ] Accessibility checked
  > - [ ] Linting passes (`npm run lint`)
  > - [ ] Type checking passes (`npm run type-check`)
  >
  > **Related Requirements:** All

### 8. Deployment Preparation

> Prepare for production deployment

- [ ] **8.1. Create Rollback Plan**
  > Document how to rollback if issues occur
  >
  > **File:** `.kiro/specs/Improve_rejection_flow/ROLLBACK.md` (create)
  >
  > **Content:**
  > - Feature flags approach (if applicable)
  > - Steps to disable goal list page
  > - How to revert TASK-04 integration
  > - Monitoring checklist
  >
  > **Related Requirements:** All

- [ ] **8.2. Update User Documentation (Optional)**
  > Create user guide for rejection flow (if needed)
  >
  > **File:** TBD (depends on project docs structure)
  >
  > **Content:**
  > - How to view submitted/rejected goals
  > - How to edit and resubmit
  > - Screenshots of UI
  > - FAQ section
  >
  > **Related Requirements:** All

- [ ] **8.3. Monitor Deployment**
  > Track issues after deployment
  >
  > **Metrics to Monitor:**
  > - Goal list page load time
  > - Error rates on goal APIs
  > - User navigation patterns
  > - Rejection/resubmission success rates
  > - Browser console errors
  >
  > **Related Requirements:** 7

## Summary

**Total Tasks:** 49
**Estimated Effort:** 3-5 developer days
- Frontend Components: 2 days (tasks 1-3)
- Integration & Polish: 0.5 day (task 4)
- API Integration: 0.5 day (task 5)
- Manual Testing: 1 day (task 6)
- Documentation & Deployment: 0.5 day (tasks 7-8)

**Dependencies:**
- TASK-04 should be completed first (or at least partially) for integration
- Existing backend APIs must be functional
- shadcn/ui components must be installed

**Success Criteria:**
- All E2E test scenarios pass
- Code review approved
- Performance metrics met (<2s load time)
- Accessible and mobile-responsive
- Clean integration with TASK-04
