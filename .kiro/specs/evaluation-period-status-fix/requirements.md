# Requirements Document

## Introduction

This feature addresses the evaluation period display issue on the goal-input page where evaluation periods are not showing despite being stored in the database. The root cause is a status value inconsistency between the database constraints (English values) and the application code (Japanese values). Additionally, we need to create a consistent status mapping system for Japanese users to improve UI visibility and user experience.

## Requirements

### Requirement 1: Database Status Consistency

**User Story:** As a system administrator, I want the database constraints to match the application code status values, so that evaluation periods are properly stored and retrieved without data inconsistencies.

#### Acceptance Criteria

1. WHEN the system stores evaluation period status THEN the database SHALL accept Japanese status values ('準備中', '実施中', '完了', 'キャンセル済み')
2. WHEN the database constraint is updated THEN existing data SHALL be migrated to use Japanese status values
3. WHEN the application queries evaluation periods THEN the status values SHALL be consistent between database and application code
4. IF there are existing evaluation periods with English status values THEN the system SHALL migrate them to Japanese equivalents during the update

### Requirement 2: Status Mapping System

**User Story:** As a Japanese user, I want to see evaluation period statuses in clear, consistent Japanese terminology, so that I can easily understand the current state of evaluation periods.

#### Acceptance Criteria

1. WHEN the system displays evaluation period status THEN it SHALL show Japanese labels that are user-friendly
2. WHEN the system processes status values internally THEN it SHALL use a consistent mapping between internal values and display labels
3. WHEN the status mapping is implemented THEN it SHALL support both current and future status values
4. WHEN the UI displays status badges THEN they SHALL use appropriate colors and styling for each status type

### Requirement 3: Frontend Status Display Fix

**User Story:** As an employee, I want to see available evaluation periods on the goal-input page, so that I can select the appropriate period for setting my goals.

#### Acceptance Criteria

1. WHEN I navigate to the goal-input page THEN the system SHALL display all available evaluation periods
2. WHEN evaluation periods are fetched from the server THEN the status filtering SHALL work correctly with the updated status values
3. WHEN I select an evaluation period THEN the system SHALL properly identify active, upcoming, and completed periods
4. WHEN there are no evaluation periods available THEN the system SHALL display an appropriate message

### Requirement 4: Server Action Status Handling

**User Story:** As a developer, I want the server actions to properly handle status filtering and categorization, so that the frontend receives correctly categorized evaluation periods.

#### Acceptance Criteria

1. WHEN the getCategorizedEvaluationPeriodsAction is called THEN it SHALL correctly categorize periods based on Japanese status values
2. WHEN the system filters periods by status THEN it SHALL use the correct Japanese status values for comparison
3. WHEN the API returns evaluation periods THEN the status values SHALL be consistent with the frontend expectations
4. WHEN status-based filtering is applied THEN it SHALL work correctly with the updated status mapping

### Requirement 5: Data Migration and Backward Compatibility

**User Story:** As a system administrator, I want existing evaluation period data to be preserved and migrated correctly, so that no data is lost during the status system update.

#### Acceptance Criteria

1. WHEN the database constraint is updated THEN existing English status values SHALL be migrated to Japanese equivalents
2. WHEN the migration is performed THEN the mapping SHALL be: 'draft' → '準備中', 'active' → '実施中', 'completed' → '完了', 'cancelled' → 'キャンセル済み'
3. WHEN the migration is complete THEN all evaluation periods SHALL have valid Japanese status values
4. WHEN the system is updated THEN it SHALL continue to work with existing goal and assessment data linked to evaluation periods