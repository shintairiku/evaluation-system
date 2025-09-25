# Implementation Plan

- [ ] 1. Update backend status enum to match database constraints
  - Change EvaluationPeriodStatus enum to use English values: DRAFT="draft", ACTIVE="active", COMPLETED="completed", CANCELLED="cancelled"
  - Update all backend service methods to use English status values
  - Verify status transitions work correctly with English values
  - Test backend status filtering and categorization logic
  - _Requirements: 1.1, 1.3_

- [ ] 2. Update backend service layer status handling
  - Fix status filtering in evaluation period service to use English values
  - Update get_active_evaluation_period to filter by status="active"
  - Update get_by_status methods to use English status values
  - Verify all status-based queries work with English values
  - _Requirements: 1.3, 4.2_

- [ ] 3. Create frontend status mapping utility system
  - Create English-to-Japanese status display mapping constants
  - Implement getStatusDisplay and getStatusVariant utility functions that accept English values
  - Add TypeScript types for status display configuration
  - Write unit tests for status mapping functions with English input values
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 4. Update EvaluationPeriodSelector component status handling
  - Replace hardcoded Japanese status checks with English status values
  - Update getStatusVariant function to map English status to Japanese display
  - Use status mapping utility to display Japanese labels for English status values
  - Add fallback handling for unknown English status values
  - _Requirements: 2.4, 3.2, 4.1_

- [ ] 5. Fix server action status filtering logic
  - Update getCategorizedEvaluationPeriodsAction to use English status values (active, draft, completed)
  - Fix status filtering: current=active, upcoming=draft, completed=completed
  - Add error handling for status-related API issues
  - Test server action with various English status combinations
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 6. Add comprehensive error handling and logging
  - Implement proper error handling in evaluation period fetching
  - Add debug logging for status-related operations
  - Create user-friendly error messages for Japanese users
  - Add retry mechanism for failed evaluation period requests
  - _Requirements: 3.4, 4.4_

- [ ] 7. Verify database status consistency in development environment
  - Check that all existing evaluation periods have valid English status values
  - Verify database constraint accepts English status values (draft, active, completed, cancelled)
  - Test that backend can query and filter by English status values
  - Confirm that related goals and assessments work with English status values
  - _Requirements: 1.1, 1.3_

- [ ] 8. Test frontend evaluation period display functionality
  - Test goal-input page with English status values from API and Japanese display
  - Verify evaluation period selector shows all available periods with Japanese labels
  - Test status badge display shows Japanese labels for English status values
  - Confirm period selection and goal loading works correctly with status mapping
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 9. Create comprehensive test suite for status system
  - Write unit tests for English-to-Japanese status mapping utilities
  - Create integration tests for evaluation period server actions with English status values
  - Add component tests for EvaluationPeriodSelector with English status input and Japanese display
  - Test error scenarios and edge cases for unknown English status values
  - _Requirements: 2.3, 4.4_

- [ ] 10. Update API endpoint documentation and validation
  - Update API documentation to reflect English status values matching database constraints
  - Verify backend validation accepts only valid English status values
  - Test API responses contain consistent English status formatting
  - Add API tests for English status-based filtering and categorization
  - _Requirements: 1.3, 4.3_

- [ ] 11. Update frontend type definitions for status values
  - Update EvaluationPeriodStatus type to use English values ('draft' | 'active' | 'completed' | 'cancelled')
  - Update all TypeScript interfaces to expect English status values from API
  - Verify type safety for status mapping functions
  - Update API response type definitions to match backend English status values
  - _Requirements: 1.3, 2.2_

- [ ] 12. Conduct end-to-end testing and user acceptance validation
  - Test complete goal-input workflow with English backend values and Japanese frontend display
  - Verify Japanese status display clarity and user comprehension
  - Test cross-browser compatibility for Japanese status styling
  - Validate accessibility of Japanese status information
  - _Requirements: 2.1, 3.1, 3.2_