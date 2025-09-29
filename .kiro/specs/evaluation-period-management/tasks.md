# Implementation Plan

- [ ] 1. Set up navigation and routing infrastructure
  - Add evaluation period management route to navigation constants
  - Create page component with proper routing structure
  - Add calendar icon to sidebar icon mapping
  - Test navigation integration between 部門管理 and ステージ管理
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 2. Enhance server actions for goal statistics
  - Implement getEvaluationPeriodGoalStatisticsAction server action
  - Create goal statistics data processing utilities
  - Add user activity aggregation logic with supervisor/subordinate relationships
  - Write unit tests for goal statistics server action
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Create core type definitions and utilities
  - Define EvaluationPeriodFormData and GoalStatistics interfaces
  - Create PERIOD_TYPE_LABELS constant with Japanese labels
  - Implement date calculation utilities for period types (半期, 月次, 四半期, 年次)
  - Create form validation utilities with Japanese error messages
  - Write unit tests for date calculation and validation utilities
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 1.6, 1.7, 1.8_

- [ ] 4. Build main page and container components
  - Create EvaluationPeriodManagementPage server component
  - Implement EvaluationPeriodManagementContainer client component with state management
  - Add view toggle functionality (calendar/list) with URL parameter handling
  - Create EvaluationPeriodManagementHeader with view controls and create button
  - Write component tests for page and container components
  - _Requirements: 2.1, 1.1_

- [ ] 5. Implement list view components
  - Create EvaluationPeriodListView with categorized sections (現在/予定/完了/キャンセル)
  - Build PeriodCard component with period information display
  - Add GoalStatistics component with clickable goal counts
  - Implement ActionButtons component with 編集 and 削除 buttons
  - Write unit tests for list view components
  - _Requirements: 2.3, 2.4, 2.5, 4.1, 5.1_

- [ ] 6. Create calendar view components
  - Implement EvaluationPeriodCalendarView with full calendar functionality
  - Add color-coded period display based on status
  - Create PeriodEventCard for calendar period representation
  - Implement responsive design for mobile calendar view
  - Write unit tests for calendar view components
  - _Requirements: 2.2_

- [ ] 7. Build create/edit period modal
  - Create CreateEditPeriodModal with form state management
  - Implement PeriodForm with all required fields (期間名, 期間タイプ, dates)
  - Add smart date calculation logic with user override capability
  - Implement form validation with Japanese error messages
  - Create date picker components with calendar integration
  - Write unit tests for modal and form components
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 4.2, 4.3, 4.4, 4.5, 7.7_

- [ ] 8. Implement goal statistics modal
  - Create GoalStatisticsModal with detailed user activity display
  - Build UserActivityTable with sorting and filtering capabilities
  - Add user information display (ユーザー名, 役職, 部下名, 上司名, activity times)
  - Implement filtering and search functionality for user list
  - Write unit tests for goal statistics modal components
  - _Requirements: 3.3, 3.4, 3.5_

- [ ] 9. Create delete confirmation modal
  - Implement DeleteConfirmationModal with double confirmation logic
  - Add period details display in confirmation dialog
  - Create confirmation input field (typing period name or multiple clicks)
  - Implement safe deletion with success/error handling
  - Write unit tests for delete confirmation modal
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 10. Add automatic status management
  - Implement status calculation logic based on current date and period dates
  - Create status display components with visual indicators
  - Add real-time status updates on page refresh
  - Implement status change handling in form updates
  - Write unit tests for status management logic
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11. Integrate all components and test complete functionality
  - Wire up all modal interactions with container component
  - Implement optimistic updates for better user experience
  - Add loading states and error handling throughout the application
  - Test complete CRUD operations flow
  - Verify cache revalidation after data mutations
  - _Requirements: 1.4, 4.4, 5.5_

- [ ] 12. Add responsive design and accessibility features
  - Implement responsive layouts for mobile and tablet devices
  - Add ARIA labels and keyboard navigation support
  - Create high contrast mode support for status indicators
  - Implement focus management for modal interactions
  - Test accessibility compliance with screen readers
  - _Requirements: All requirements - accessibility and UX enhancements_

- [ ] 13. Write comprehensive tests and documentation
  - Create integration tests for server action flows
  - Write E2E tests for complete user workflows
  - Add component documentation with usage examples
  - Create error handling tests for edge cases
  - Test performance with large datasets
  - _Requirements: All requirements - testing and validation_