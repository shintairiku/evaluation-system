# API Integration Strategy - Detailed Implementation Tickets

## Overview

This document provides granular, actionable tickets for connecting the existing frontend components (goal-input and user-profile pages) to the backend API layer. Each ticket is designed to be small, specific, and implementable by individual developers.

## Current State Analysis

### Frontend Components Status
- ✅ User profile page UI components implemented (`/user-profiles`)
- ✅ Goal input page UI components implemented (`/goal-input`)
- ✅ Feature-specific components in `/src/feature/` directories
- ⚠️ Components currently use dummy data/static content

### API Layer Status
- ✅ User endpoints available in `/src/api/endpoints/users.ts`
- ✅ User server actions available in `/src/api/server-actions/users.ts`
- ✅ TypeScript interfaces defined in `/src/api/types/`
- ⚠️ No connection between frontend components and API layer

## Implementation Tickets

### 🔵 Category A: User Profile Page Integration

#### A1: Connect User Profile Display to API
**Complexity**: Medium (M)
**Files to modify**: 
- `frontend/src/app/(evaluation)/user-profiles/page.tsx`
- `frontend/src/feature/user-profile/display/UserProfileCard.tsx`

**Description**: Replace dummy user data with real API calls using getUserById server action.

**Requirements**:
- Import and use `getUserById` from server actions
- Handle loading states during data fetch
- Display actual user data (name, email, department, role)
- Handle case when user is not found

**Acceptance Criteria**:
- [ ] Page displays real user data from database
- [ ] Loading spinner shows during data fetch
- [ ] Error message displays if user not found
- [ ] TypeScript types are properly used

**Dependencies**: None

---

#### A2: Implement User Profile Edit Modal
**Complexity**: Large (L)
**Files to modify**:
- `frontend/src/feature/user-profile/components/EditProfileModal.tsx` (new)
- `frontend/src/feature/user-profile/display/UserProfileCard.tsx`

**Description**: Create edit functionality using updateUser endpoint for profile modifications.

**Requirements**:
- Create modal component with form fields
- Connect to `updateUser` endpoint function
- Implement form validation
- Handle success/error states

**Acceptance Criteria**:
- [ ] Modal opens with current user data pre-filled
- [ ] Form validates required fields
- [ ] Successfully updates user profile
- [ ] Shows success message after update
- [ ] Handles API errors gracefully

**Dependencies**: A1

---

#### A3: Add User Avatar Upload Functionality (Hybrid Approach)
**Complexity**: Large (L)
**Frontend Files to modify**:
- `frontend/src/feature/user-profile/components/AvatarUpload.tsx` (new)
- `frontend/src/feature/user-profile/components/EditProfileModal.tsx`
- `frontend/src/feature/user-profile/display/UserProfileCard.tsx`

**Backend Files to modify**:
- `backend/app/api/users.py` (add avatar upload endpoint)
- `backend/app/services/user_service.py` (Clerk integration)

**Description**: Implement hybrid avatar system: auto-use Google Workspace photos from Clerk, with custom upload option that syncs back to Clerk.

**Requirements**:

**Phase 1 - Display Clerk Avatars**:
- Display `user.imageUrl` from Clerk (Google Workspace photos)
- Fallback to default avatar if no Clerk image

**Phase 2 - Custom Upload**:
- File input component with drag-and-drop
- Image preview and validation (size, format)
- Backend endpoint: `POST /users/{user_id}/avatar`
- Upload directly to Clerk via `updateUserProfileImage()` API
- Clerk stores image internally (no external storage needed)

**Backend Tasks**:
- Create file upload endpoint with multipart/form-data
- Integrate `clerkClient.users.updateUserProfileImage()` for direct upload
- Handle file validation (format, size)
- Error handling for Clerk API failures

**Acceptance Criteria**:
- [ ] Google Workspace users see their company photos automatically
- [ ] Users can upload custom avatar images
- [ ] Image preview shows before upload
- [ ] File uploads directly to Clerk via `updateUserProfileImage()`
- [ ] Updated avatar displays immediately after upload
- [ ] Handles upload and Clerk API errors gracefully
- [ ] File size/format validation works

**Dependencies**: A2

---

#### A4: Connect Department/Role Dropdowns
**Complexity**: Small (S)
**Files to modify**:
- `frontend/src/feature/user-profile/components/EditProfileModal.tsx`
- `frontend/src/api/endpoints/departments.ts` (if needed)

**Description**: Connect department and role dropdown menus to backend data.

**Requirements**:
- Fetch available departments from API
- Fetch available roles from API
- Populate dropdown options dynamically

**Acceptance Criteria**:
- [ ] Department dropdown shows real departments
- [ ] Role dropdown shows real roles
- [ ] Selections properly save to user profile

**Dependencies**: A2

---

#### A5: Implement User Search Functionality
**Complexity**: Medium (M)
**Files to modify**:
- `frontend/src/feature/user-profile/components/UserSearch.tsx` (new)
- `frontend/src/app/(evaluation)/user-profiles/page.tsx`

**Description**: Add search and filter capabilities for user list.

**Requirements**:
- Search input with debounced API calls
- Filter by department/role
- Pagination for large user lists
- Use existing search endpoints

**Acceptance Criteria**:
- [ ] Search works with name/email input
- [ ] Filters work correctly
- [ ] Results update in real-time
- [ ] Pagination handles large datasets

**Dependencies**: A1

---

#### A6: Add User Profile Loading States
**Complexity**: Small (S)
**Files to modify**:
- `frontend/src/feature/user-profile/display/UserProfileCard.tsx`
- `frontend/src/components/ui/loading-skeleton.tsx` (if needed)

**Description**: Implement consistent loading states for all user profile operations.

**Requirements**:
- Skeleton loaders for profile data
- Loading spinners for edit operations
- Disabled states during API calls

**Acceptance Criteria**:
- [ ] Skeleton shows while loading profile
- [ ] Buttons disable during operations
- [ ] Loading states are visually consistent

**Dependencies**: A1, A2

---

#### A7: Implement User Profile Error Handling
**Complexity**: Medium (M)
**Files to modify**:
- `frontend/src/feature/user-profile/display/UserProfileCard.tsx`
- `frontend/src/feature/user-profile/components/EditProfileModal.tsx`
- `frontend/src/components/ui/error-boundary.tsx` (if needed)

**Description**: Add comprehensive error handling for all user profile operations.

**Requirements**:
- Error messages for failed API calls
- Retry mechanisms for network errors
- User-friendly error notifications

**Acceptance Criteria**:
- [ ] Clear error messages for different failure types
- [ ] Retry buttons for recoverable errors
- [ ] Errors don't crash the application

**Dependencies**: A1, A2

---

### 🟢 Category B: Goal Input Page Integration (PROPOSED; NOT FINALIZED)

#### B1: Connect Goal Display to API
**Complexity**: Medium (M)
**Files to modify**:
- `frontend/src/app/(evaluation)/goal-input/page.tsx`
- `frontend/src/feature/goal-input/display/index.tsx`

**Description**: Replace dummy goal data with real API calls to fetch existing goals.

**Requirements**:
- Import and use goal server actions
- Display existing goals for editing
- Handle cases with no existing goals

**Acceptance Criteria**:
- [ ] Page loads existing user goals from database
- [ ] Shows empty state when no goals exist
- [ ] Properly handles loading states
- [ ] Uses correct TypeScript interfaces

**Dependencies**: None

---

#### B2: Implement Goal Draft Save Functionality
**Complexity**: Small (S)
**Files to modify**:
- `frontend/src/feature/goal-input/components/SaveDraft.tsx`
- `frontend/src/feature/goal-input/display/index.tsx`

**Description**: Connect the "Save Draft" button to save goals as drafts via API.

**Requirements**:
- Save goals with draft status
- Auto-save functionality (optional)
- Show save status to user

**Acceptance Criteria**:
- [ ] Draft button saves current form data
- [ ] User sees confirmation of save
- [ ] Draft status persists on page reload

**Dependencies**: B1

---

#### B3: Connect Competency Goals to Backend
**Complexity**: Medium (M)
**Files to modify**:
- `frontend/src/feature/goal-input/display/CompetencyGoalsStep.tsx`
- `frontend/src/api/types/goals.ts`

**Description**: Connect competency goals form to backend schema and validation.

**Requirements**:
- Map form fields to backend goal schema
- Implement validation rules
- Handle competency-specific data

**Acceptance Criteria**:
- [ ] Form data matches backend expectations
- [ ] Validation works correctly
- [ ] Competency goals save successfully

**Dependencies**: B1

---

#### B4: Connect Core Value Goals to Backend
**Complexity**: Medium (M)
**Files to modify**:
- `frontend/src/feature/goal-input/display/CoreValueGoalsStep.tsx`
- `frontend/src/api/types/goals.ts`

**Description**: Connect core value goals form to backend schema and validation.

**Requirements**:
- Map form fields to backend goal schema
- Implement validation rules
- Handle core value-specific data

**Acceptance Criteria**:
- [ ] Form data matches backend expectations
- [ ] Validation works correctly
- [ ] Core value goals save successfully

**Dependencies**: B1

---

#### B5: Connect Performance Goals to Backend
**Complexity**: Medium (M)
**Files to modify**:
- `frontend/src/feature/goal-input/display/PerformanceGoalsStep.tsx`
- `frontend/src/api/types/goals.ts`

**Description**: Connect performance goals form to backend schema and validation.

**Requirements**:
- Map form fields to backend goal schema
- Implement validation rules
- Handle performance-specific data

**Acceptance Criteria**:
- [ ] Form data matches backend expectations
- [ ] Validation works correctly
- [ ] Performance goals save successfully

**Dependencies**: B1

---

#### B6: Implement Goal Submission Workflow
**Complexity**: Large (L)
**Files to modify**:
- `frontend/src/feature/goal-input/components/SubmitButton.tsx`
- `frontend/src/feature/goal-input/display/ConfirmationStep.tsx`

**Description**: Complete the goal submission process with validation and confirmation.

**Requirements**:
- Validate all goal types before submission
- Show confirmation step
- Submit goals with "submitted" status
- Handle submission success/failure

**Acceptance Criteria**:
- [ ] All goal types validate before submission
- [ ] Confirmation step shows goal summary
- [ ] Goals submit successfully
- [ ] User receives confirmation message

**Dependencies**: B3, B4, B5

---

#### B7: Add Goal Editing/Update Functionality
**Complexity**: Medium (M)
**Files to modify**:
- `frontend/src/feature/goal-input/display/index.tsx`
- Multiple goal step components

**Description**: Allow users to edit existing goals that are not yet submitted.

**Requirements**:
- Load existing goals into form
- Update goals via API
- Handle different goal statuses

**Acceptance Criteria**:
- [ ] Existing goals populate form fields
- [ ] Changes save successfully
- [ ] Status transitions work correctly

**Dependencies**: B1, B6

---

#### B8: Connect Goal Approval Status Display
**Complexity**: Small (S)
**Files to modify**:
- `frontend/src/feature/goal-input/display/index.tsx`
- `frontend/src/feature/goal-input/components/GoalStatus.tsx` (new)

**Description**: Show goal approval status and related information.

**Requirements**:
- Display current approval status
- Show supervisor feedback if available
- Handle different status states

**Acceptance Criteria**:
- [ ] Status displays correctly for each goal
- [ ] Feedback shows when available
- [ ] Status updates reflect in real-time

**Dependencies**: B1

---

#### B9: Add Goal History/Versioning Support
**Complexity**: Large (L)
**Files to modify**:
- `frontend/src/feature/goal-input/components/GoalHistory.tsx` (new)
- `frontend/src/feature/goal-input/display/index.tsx`

**Description**: Implement goal versioning to track changes over time.

**Requirements**:
- Show goal change history
- Compare different versions
- Track who made changes when

**Acceptance Criteria**:
- [ ] History shows all goal versions
- [ ] Changes are clearly highlighted
- [ ] Timestamps and users are tracked

**Dependencies**: B1, B7

---

#### B10: Implement Goal Validation Logic
**Complexity**: Medium (M)
**Files to modify**:
- `frontend/src/feature/goal-input/utils/validation.ts` (new)
- All goal step components

**Description**: Add comprehensive validation for all goal types.

**Requirements**:
- Client-side validation rules
- Real-time validation feedback
- Integration with backend validation

**Acceptance Criteria**:
- [ ] All fields validate in real-time
- [ ] Error messages are clear
- [ ] Validation prevents invalid submissions

**Dependencies**: B3, B4, B5

---

### 🟡 Category C: Technical Infrastructure

#### C1: Update TypeScript Interfaces
**Complexity**: Small (S)
**Files to modify**:
- `frontend/src/api/types/users.ts`
- `frontend/src/api/types/goals.ts`

**Description**: Ensure all TypeScript interfaces match current backend schemas.

**Requirements**:
- Review and update user interfaces
- Review and update goal interfaces
- Add any missing interface definitions

**Acceptance Criteria**:
- [ ] All interfaces match backend schemas
- [ ] No TypeScript errors in components
- [ ] Proper typing for all API calls

**Dependencies**: None

---

#### C2: Implement Consistent Error Handling
**Complexity**: Medium (M)
**Files to modify**:
- `frontend/src/utils/error-handling.ts` (new)
- `frontend/src/api/client/http-unified-client.ts` (new)
- `frontend/src/api/client/auth-helper.ts` (new)
- `frontend/src/api/hooks/useAuthSync.ts` (new)
- `frontend/src/api/client/http-client.ts` (updated for backward compatibility)

**Description**: Create standardized error handling patterns across the application and implement unified HTTP client for both server-side and client-side contexts.

**Requirements**:
- Centralized error handling utility
- Consistent error message formatting
- Error logging and reporting
- Unified HTTP client supporting both server and client environments
- Automatic environment detection and appropriate auth handling
- Enhanced request body handling (JSON, FormData, file uploads)
- Unified error response format for better clarity
- Proper Content-Type header management for different body types

**Acceptance Criteria**:
- [x] All API errors handle consistently
- [x] User-friendly error messages (Japanese)
- [x] Errors are properly logged with severity levels
- [x] Unified HTTP client works in both server and client contexts
- [x] Automatic Clerk auth integration for both environments
- [x] Backward compatibility maintained for existing code
- [x] FormData and file upload support with proper Content-Type handling
- [x] Unified error response format (single errorMessage property)
- [x] Automatic Content-Type detection and header management

**Dependencies**: None

---

#### C3: Add Global Loading State Management
**Complexity**: Small (S)
**Files to modify**:
- `frontend/src/hooks/useLoading.ts` (new)
- `frontend/src/context/LoadingContext.tsx` (new)
- `frontend/src/components/ui/loading-spinner.tsx` (new)
- `frontend/src/components/ui/loading-skeleton.tsx` (new)
- `frontend/src/components/ui/loading-button.tsx` (new)

**Description**: Implement consistent loading state management across components with comprehensive UI patterns.

**Requirements**:
- Global loading context with key-based state management
- Loading hook for components with automatic cleanup
- Multiple loading patterns (spinner, skeleton, button states)
- Support for concurrent loading operations
- Consistent loading UI patterns across the application

**Acceptance Criteria**:
- [x] Global loading context provider with key-based state management
- [x] useLoading hook with withLoading wrapper for async operations
- [x] Multiple loading hooks (useGlobalLoading, useMultipleLoading)
- [x] Comprehensive loading UI components (spinner, skeleton, button)
- [x] Automatic cleanup on component unmount
- [x] Support for multiple concurrent loading operations
- [x] User-friendly loading indicators with Japanese text support

**Dependencies**: None

---

#### C4: Update API Client Configuration
**Complexity**: Small (S)
**Files to modify**:
- `frontend/src/api/client/http-client.ts`
- `frontend/src/api/constants/config.ts`

**Description**: Ensure API client is properly configured for production use.

**Requirements**:
- Review authentication setup
- Configure timeout and retry logic
- Add request/response interceptors

**Acceptance Criteria**:
- [ ] API client handles auth correctly
- [ ] Timeouts and retries work
- [ ] Interceptors log appropriately

**Dependencies**: None

---

#### C5: Implement Data Validation Schemas
**Complexity**: Medium (M)
**Files to modify**:
- `frontend/src/utils/validation-schemas.ts` (new)
- Various form components

**Description**: Add comprehensive client-side data validation using schemas.

**Requirements**:
- Create validation schemas for all forms
- Integrate with form libraries
- Provide clear validation feedback

**Acceptance Criteria**:
- [ ] All forms validate with schemas
- [ ] Validation feedback is immediate
- [ ] Schemas match backend requirements

**Dependencies**: C1

---

#### C6: Add Optimistic Updates
**Complexity**: Large (L)
**Files to modify**:
- `frontend/src/hooks/useOptimisticUpdate.ts` (new)
- User and goal components

**Description**: Implement optimistic updates for better user experience.

**Requirements**:
- Update UI immediately on user action
- Rollback changes if API call fails
- Handle concurrent updates

**Acceptance Criteria**:
- [ ] UI updates immediately on actions
- [ ] Changes rollback on failures
- [ ] Concurrent updates handled correctly

**Dependencies**: C2, C3

---

## Implementation Order & Dependencies

### Phase 1: Foundation (Tickets C1-C4)
Setup technical infrastructure and ensure all types/configurations are correct.

### Phase 2: Basic Integration (Tickets A1, B1)
Connect basic display functionality for both user profiles and goals.

### Phase 3: Core Features (Tickets A2-A5, B2-B6)
Implement main CRUD operations for users and goals.

### Phase 4: Advanced Features (Tickets A6-A8, B7-B10, C5-C6)
Add loading states, error handling, validation, and advanced features.


## Success Criteria

✅ All frontend components connected to real API endpoints
✅ User profile management fully functional
✅ Goal input/editing workflow complete
✅ Consistent error handling and loading states
✅ Type-safe API interactions throughout
✅ Permission-based access controls implemented