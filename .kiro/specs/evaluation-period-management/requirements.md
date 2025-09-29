# Requirements Document

## Introduction

This feature provides a comprehensive evaluation period management interface for admin users, allowing them to create, view, update, and delete evaluation periods through an intuitive dashboard. The feature includes calendar visualization, detailed period tracking, goal status monitoring, and user activity insights to give administrators complete oversight of the evaluation process.

## Requirements

### Requirement 1

**User Story:** As an admin user, I want to create new evaluation periods with all necessary details, so that I can establish structured evaluation cycles for the organization.

#### Acceptance Criteria

1. WHEN an admin accesses the evaluation period management page THEN the system SHALL display a "新規作成" (Create New) button
2. WHEN an admin clicks "新規作成" THEN the system SHALL open a form with the following fields:
   - 期間名 (Period Name - text input, required)
   - 期間タイプ (Period Type - dropdown with predefined options: "半期", "月次", "四半期", "年次", "その他", required)
   - 開始日 (Start Date - date picker with calendar, required)
   - 終了日 (End Date - date picker with calendar, required)
   - 目標提出期限 (Goal Submission Deadline - date picker with calendar, required)
   - 評価期限 (Evaluation Deadline - date picker with calendar, required)
3. WHEN an admin submits the form with valid data THEN the system SHALL create the evaluation period with status automatically set based on start date and current time
4. WHEN the form is submitted successfully THEN the system SHALL show a success message "評価期間を作成しました" and refresh the period list
5. WHEN form validation fails THEN the system SHALL display specific error messages for each invalid field
6. WHEN an admin selects a start date for the first time THEN the system SHALL automatically calculate and set the end date based on the selected period type:
   - 半期 (Half Term): 6 months from start date
   - 月次 (Monthly): 1 month from start date  
   - 四半期 (Quarterly): 3 months from start date
   - 年次 (Yearly): 1 year from start date
   - その他 (Other): no automatic calculation
7. WHEN an admin changes the start date after the end date has been manually set THEN the system SHALL NOT automatically update the end date
8. WHEN an admin changes the start date from empty to a value AND the end date is empty THEN the system SHALL automatically calculate the end date based on the period type

### Requirement 2

**User Story:** As an admin user, I want to view evaluation periods in both calendar and list formats, so that I can easily understand the timeline and status of all evaluation cycles.

#### Acceptance Criteria

1. WHEN an admin accesses the evaluation period management page THEN the system SHALL display both "カレンダー表示" (Calendar View) and "リスト表示" (List View) options
2. WHEN viewing the calendar THEN the system SHALL show evaluation periods as events with color coding based on status
3. WHEN viewing the list THEN the system SHALL categorize periods into "現在" (Current), "予定" (Upcoming), "完了" (Completed), and "キャンセル" (Cancelled) sections
4. WHEN displaying each period THEN the system SHALL show 期間名 (name), 日程 (dates), ステータス (status), and 目標統計 (goal statistics)
5. WHEN an admin clicks on a period in either view THEN the system SHALL show detailed information including goal counts by status

### Requirement 3

**User Story:** As an admin user, I want to see goal statistics for each evaluation period, so that I can monitor the progress and completion rates across the organization.

#### Acceptance Criteria

1. WHEN viewing evaluation periods THEN the system SHALL display goal counts by status (draft, pending, approved, etc.)
2. WHEN an admin clicks on a goal count THEN the system SHALL open a modal showing the detailed user list
3. WHEN displaying the user list modal THEN the system SHALL show:
   - ユーザー名と役職 (User name and role)
   - 部下名 (Subordinate name - if applicable)
   - 上司名 (Supervisor name - if applicable)
   - 最終目標提出日時 (Last goal submission activity time)
   - 最終評価提出日時 (Last goal review submission activity time)
4. WHEN the modal is open THEN the system SHALL provide filtering and sorting options for the user list
5. WHEN an admin closes the modal THEN the system SHALL return to the main evaluation period view

### Requirement 4

**User Story:** As an admin user, I want to update existing evaluation periods, so that I can modify details when business requirements change.

#### Acceptance Criteria

1. WHEN viewing an evaluation period THEN the system SHALL display an "編集" (Edit) button for each period
2. WHEN an admin clicks "編集" THEN the system SHALL open a form pre-populated with current period data
3. WHEN an admin modifies and submits the form THEN the system SHALL update the evaluation period with the new data
4. WHEN the update is successful THEN the system SHALL show a success message "評価期間を更新しました" and refresh the display
5. WHEN updating dates THEN the system SHALL automatically recalculate the status based on new start date and current time

### Requirement 5

**User Story:** As an admin user, I want to delete evaluation periods with confirmation, so that I can remove periods that are no longer needed while preventing accidental deletions.

#### Acceptance Criteria

1. WHEN viewing an evaluation period THEN the system SHALL display a "削除" (Delete) button for each period
2. WHEN an admin clicks "削除" THEN the system SHALL show a confirmation dialog with period details
3. WHEN the confirmation dialog is displayed THEN the system SHALL require double confirmation (e.g., typing period name or clicking multiple buttons)
4. WHEN an admin confirms deletion THEN the system SHALL permanently remove the evaluation period
5. WHEN deletion is successful THEN the system SHALL show a success message "評価期間を削除しました" and refresh the period list
6. WHEN an admin cancels the deletion THEN the system SHALL close the dialog without making changes

### Requirement 6

**User Story:** As an admin user, I want the evaluation period management to be accessible from the main navigation, so that I can easily access this functionality.

#### Acceptance Criteria

1. WHEN an admin user views the left sidebar navigation THEN the system SHALL display "評価期間設定" (Evaluation Period Settings) tab
2. WHEN the tab is positioned THEN it SHALL be located between "部門管理" (Department Management) and "ステージ管理" (Stage Management)
3. WHEN an admin clicks the "評価期間設定" tab THEN the system SHALL navigate to the evaluation period management page
4. WHEN on the evaluation period management page THEN the system SHALL highlight the corresponding navigation tab as active

### Requirement 7

**User Story:** As an admin user, I want predefined period types with smart date calculation, so that I can quickly set up evaluation periods without manual date calculations.

#### Acceptance Criteria

1. WHEN the period type dropdown is displayed THEN the system SHALL show the following options:
   - 半期 (Half Term)
   - 月次 (Monthly)
   - 四半期 (Quarterly)
   - 年次 (Yearly)
   - その他 (Other)
2. WHEN an admin selects "半期" THEN the system SHALL calculate end date as 6 months from start date
3. WHEN an admin selects "月次" THEN the system SHALL calculate end date as 1 month from start date
4. WHEN an admin selects "四半期" THEN the system SHALL calculate end date as 3 months from start date
5. WHEN an admin selects "年次" THEN the system SHALL calculate end date as 1 year from start date
6. WHEN an admin selects "その他" THEN the system SHALL NOT perform automatic end date calculation
7. WHEN the end date has been manually modified by the user THEN the system SHALL NOT override it with automatic calculations

### Requirement 8

**User Story:** As an admin user, I want automatic status management for evaluation periods, so that the system accurately reflects the current state of each period without manual intervention.

#### Acceptance Criteria

1. WHEN creating a new evaluation period THEN the system SHALL automatically set status to "下書き" (draft) if start date is in the future
2. WHEN the current date reaches the start date THEN the system SHALL automatically change status to "実施中" (active)
3. WHEN the current date passes the end date THEN the system SHALL automatically change status to "完了" (completed)
4. WHEN viewing evaluation periods THEN the system SHALL display the current status with appropriate visual indicators
5. WHEN status changes occur THEN the system SHALL update the display in real-time or on page refresh