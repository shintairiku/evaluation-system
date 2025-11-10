# Requirements Document

## Introduction

This document specifies the functional and non-functional requirements for automatic stage-based weight configuration in the HR evaluation system. The feature eliminates manual weight input errors by guiding employees to distribute weights so that each category total matches the policy for their stage.

**GitHub Issue**: [#305](https://github.com/shintairiku/evaluation-system/issues/305)

---

## Functional Requirements

### Requirement 1: Stage Weight Configuration (Admin Only)

**User Story:** As a system administrator, I want to configure weight distributions for each stage so that all employees at the same stage have consistent evaluation criteria.

#### Acceptance Criteria

1. WHEN an admin navigates to the stage management page THEN the system SHALL display a list of all stages with their current weight configuration SHALL
2. WHEN an admin clicks "Configure Weights" for a stage THEN the system SHALL open a configuration modal with three weight input fields SHALL
3. WHEN an admin enters weight values THEN the system SHALL validate that each weight is between 0 and 100 SHALL
4. WHEN an admin saves the weight configuration THEN the system SHALL persist the changes to the database SHALL
5. WHEN weight configuration is updated THEN the system SHALL apply the new weights to all future goals created by employees at that stage SHALL
6. WHEN weight configuration is updated THEN the system SHALL NOT modify weights of existing goals SHALL
7. WHEN a non-admin user attempts to access weight configuration THEN the system SHALL return a 403 Forbidden error SHALL

#### Weight Configuration Fields

- **Quantitative Weight** (定量目標の比重): 0-100% - Weight for quantitative performance goals
- **Qualitative Weight** (定性目標の比重): 0-100% - Weight for qualitative/project-based performance goals
- **Competency Weight** (コンピテンシーの比重): 0-100% - Weight for competency goals

---

### Requirement 2: Default Weight Values

**User Story:** As a system administrator, I want default weight values pre-configured for each stage based on organizational policy so that the system works correctly out of the box.

#### Acceptance Criteria

1. WHEN the system is first deployed THEN stages SHALL be pre-configured with default weights as follows SHALL:

| Stage | Quantitative | Qualitative | Competency |
|-------|--------------|-------------|------------|
| 1 | 70.0 | 30.0 | 10.0 |
| 2 | 70.0 | 30.0 | 10.0 |
| 3 | 70.0 | 30.0 | 10.0 |
| 4 | 80.0 | 20.0 | 10.0 |
| 5 | 80.0 | 20.0 | 10.0 |
| 6 | 100.0 | 0.0 | 10.0 |
| 7 | 100.0 | 0.0 | 10.0 |
| 8 | 100.0 | 0.0 | 10.0 |
| 9 | 100.0 | 0.0 | 10.0 |

2. WHEN a new stage is created THEN the system SHALL initialize it with default weights (70.0, 30.0, 10.0) SHALL
3. WHEN an admin views stage configuration THEN the system SHALL clearly display which weights are defaults vs customized SHALL

---

### Requirement 3: Stage Weight Budget Enforcement on Goal Creation

**User Story:** As an employee, I want the system to guide me so that the total weight of my goals matches the policy for my stage without doing manual math.

#### Acceptance Criteria

1. WHEN an employee opens the goal wizard THEN the system SHALL load the employee's stage weight configuration (quantitative, qualitative, competency) SHALL
2. WHEN the employee adds or edits a goal weight THEN the system SHALL update the running total for that category SHALL
3. WHEN the sum of quantitative goals exceeds the stage budget THEN the system SHALL show an error and prevent submission SHALL
4. WHEN the sum of quantitative goals is below the stage budget THEN the system SHALL show the remaining percentage required SHALL
5. WHEN the sum of qualitative goals exceeds or falls short of the stage budget THEN the system SHALL show analogous warnings SHALL
6. WHEN competency/core value goals are present THEN their combined weight SHALL equal the competency budget for the stage SHALL
7. WHEN the employee submits their goals THEN the backend SHALL verify that each category total matches the configured stage budget and return 422 if not SHALL
8. WHEN validation succeeds THEN the system SHALL save the user-defined weights exactly as entered SHALL

#### Weight Validation Logic

```python
totals = get_totals_by_category(goals)
assert totals["quantitative"] == stage.quantitative_weight
assert totals["qualitative"] == stage.qualitative_weight
assert totals["competency"] == stage.competency_weight
```

---

### Requirement 4: Goal Creation UI Updates (Employee)

**User Story:** As an employee, I want clear feedback on how much budget resta em cada categoria enquanto distribuo os pesos, para garantir que o total feche corretamente.

#### Acceptance Criteria

1. WHEN an employee opens the goal form THEN the system SHALL display editable weight fields for each goal with pre-filled values that evenly divide the remaining budget SHALL
2. WHEN an employee changes a weight THEN the system SHALL recalculate the remaining budget for that category in real time SHALL
3. WHEN the total weight for a category reaches the configured budget THEN the system SHALL show a success indicator (e.g., “Quantitative goals: 70/70%”) SHALL
4. WHEN the total weight is below the budget THEN the system SHALL show the missing amount and disable submission SHALL
5. WHEN the total weight exceeds the budget THEN the system SHALL highlight the overflow in red and disable submission SHALL
6. WHEN all categories meet their budgets THEN the primary action button SHALL become enabled SHALL

#### UI Mockup (Conceptual)

```
Quantitative goals — 40% allocated / 70% required
[ goal card … weight input ]
[ goal card … weight input ]
[＋ Add goal]  (auto-fills remaining 30%)

Qualitative goals — 20% allocated / 30% required
...
```

---

### Requirement 5: Goal Editing Behavior

**User Story:** As an employee, I want to understand how weight changes work when editing goals so that I can make informed decisions about goal modifications.

#### Acceptance Criteria

1. WHEN an employee opens an existing goal THEN the system SHALL pre-fill the stored weight so it can be adjusted SHALL
2. WHEN an employee changes the weight or category THEN the system SHALL re-run the budget validation for the affected category SHALL
3. WHEN the edited weight would cause the category total to exceed the budget THEN the system SHALL block saving until the employee rebalances SHALL
4. WHEN editing a pre-feature goal THEN the form SHALL require the employee to rebalance to the current stage budget before saving (unless no weight fields were touched) SHALL
5. WHEN a goal's weight is changed THEN the system SHALL log the change in the audit trail SHALL

---

### Requirement 6: Weight Configuration Validation

**User Story:** As a system administrator, I want weight configurations to be validated so that invalid configurations cannot break the evaluation system.

#### Acceptance Criteria

1. WHEN an admin enters a weight value THEN the system SHALL validate that it is a valid decimal number SHALL
2. WHEN an admin enters a weight value THEN the system SHALL validate that it is between 0.00 and 100.00 (inclusive) SHALL
3. WHEN an admin enters a negative weight THEN the system SHALL display an error message "Weight must be between 0 and 100" SHALL
4. WHEN an admin enters a weight greater than 100 THEN the system SHALL display an error message "Weight must be between 0 and 100" SHALL
5. WHEN an admin sets all three weights to 0 THEN the system SHALL display a warning "At least one weight must be greater than 0" SHALL
6. WHEN weight validation fails THEN the system SHALL prevent saving the configuration SHALL
7. WHEN weights are successfully validated THEN the system SHALL enable the "Save" button SHALL

#### Validation Rules

- **Quantitative Weight**: 0.00 ≤ value ≤ 100.00
- **Qualitative Weight**: 0.00 ≤ value ≤ 100.00
- **Competency Weight**: 0.00 ≤ value ≤ 100.00
- **At least one weight must be > 0** (to prevent completely disabled evaluation)

**Note**: Weights do NOT need to sum to 100% (as multiple goals may exist per category)

---

### Requirement 7: API Endpoints for Weight Management

**User Story:** As a frontend developer, I want clear API endpoints for managing stage weights so that I can build the admin UI and the guided weight-budget functionality.

#### Acceptance Criteria

1. WHEN I request `GET /api/v1/stages/{stage_id}` THEN the system SHALL return stage details including weight configuration SHALL
2. WHEN I request `GET /api/v1/stages` THEN the system SHALL return all stages with their weight configurations SHALL
3. WHEN I request `PATCH /api/v1/stages/{stage_id}/weights` with valid admin credentials THEN the system SHALL update the weight configuration SHALL
4. WHEN I request `PATCH /api/v1/stages/{stage_id}/weights` without admin credentials THEN the system SHALL return 403 Forbidden SHALL
5. WHEN I request `PATCH /api/v1/stages/{stage_id}/weights` with invalid weights THEN the system SHALL return 422 Unprocessable Entity with validation errors SHALL
6. WHEN I request `GET /api/v1/users/me` THEN the system SHALL include the user's stage with weight configuration SHALL

#### API Specifications

##### Get Stage Details
```http
GET /api/v1/stages/{stage_id}

Response 200 OK:
{
  "id": "uuid",
  "name": "Stage 3",
  "description": "Intermediate level",
  "quantitativeWeight": 70.0,
  "qualitativeWeight": 30.0,
  "competencyWeight": 10.0,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-11-06T00:00:00Z"
}
```

##### Update Stage Weights (Admin Only)
```http
PATCH /api/v1/stages/{stage_id}/weights

Request Body:
{
  "quantitativeWeight": 75.0,
  "qualitativeWeight": 25.0,
  "competencyWeight": 10.0
}

Response 200 OK:
{
  "id": "uuid",
  "name": "Stage 3",
  "quantitativeWeight": 75.0,
  "qualitativeWeight": 25.0,
  "competencyWeight": 10.0,
  "updatedAt": "2024-11-06T10:30:00Z"
}

Response 403 Forbidden (non-admin):
{
  "detail": "Admin permissions required to modify stage weights"
}

Response 422 Unprocessable Entity (invalid weights):
{
  "detail": [
    {
      "loc": ["body", "quantitativeWeight"],
      "msg": "Weight must be between 0 and 100",
      "type": "value_error"
    }
  ]
}
```

---

### Requirement 8: Backward Compatibility

**User Story:** As a system administrator, I want existing goals to remain unchanged when deploying this feature so that historical evaluations are not affected.

#### Acceptance Criteria

1. WHEN the stage weight budgeting feature is deployed THEN the system SHALL NOT modify weights of existing goals SHALL
2. WHEN querying existing goals THEN the system SHALL return their original manually-entered weights SHALL
3. WHEN a stage is migrated to the new budgeting rules THEN goals created before migration SHALL keep their original weights SHALL
4. WHEN a stage is migrated to the new budgeting rules THEN goals created after migration SHALL respect the configured totals SHALL
5. WHEN reporting on goals across evaluation periods THEN the system SHALL correctly handle both legacy and budget-enforced weights SHALL

---

### Requirement 9: User Experience Improvements

**User Story:** As an employee, I want a faster and less error-prone goal creation experience so that I can focus on writing quality goals instead of calculating weights.

#### Acceptance Criteria

1. WHEN comparing goal creation time before and after the feature THEN the system SHALL reduce time by at least 15 seconds per goal SHALL
2. WHEN employees create goals THEN the weight error rate SHALL be 0% (compared to current ~5% manual error rate) SHALL
3. WHEN employees create goals THEN the system SHALL provide clear visual feedback about which weight is being applied SHALL
4. WHEN supervisors review goals THEN the system SHALL display each goal's weight along with a summary badge showing category totals vs budgets SHALL
5. WHEN employees view their goal list THEN the system SHALL display weights consistently formatted (e.g., "35.0%") and show whether the category is fully allocated SHALL

---

### Requirement 10: Admin Audit Trail

**User Story:** As a system administrator, I want to track changes to stage weight configurations so that I can audit who changed weights and when.

#### Acceptance Criteria

1. WHEN an admin modifies stage weights THEN the system SHALL log the change with admin ID, timestamp, old values, and new values SHALL
2. WHEN an admin views the audit log THEN the system SHALL display weight configuration changes SHALL
3. WHEN a weight configuration change causes issues THEN administrators SHALL be able to identify when and by whom the change was made SHALL

---

## Non-Functional Requirements

### NFR-1: Performance

1. WHEN retrieving stage weight configuration THEN the system SHALL respond within 100ms (p95) SHALL
2. WHEN validating goal weights against stage budgets THEN the system SHALL add no more than 50ms latency SHALL
3. WHEN updating stage weights THEN the system SHALL complete within 200ms SHALL
4. WHEN querying all stages with weights THEN the system SHALL return within 300ms for up to 20 stages SHALL

### NFR-2: Data Integrity

1. WHEN weight data is stored THEN the system SHALL use DECIMAL(5,2) precision to avoid floating-point errors SHALL
2. WHEN database constraints are defined THEN the system SHALL enforce weight bounds (0-100) at the database level SHALL
3. WHEN concurrent weight updates occur THEN the system SHALL use appropriate locking to prevent race conditions SHALL

### NFR-3: Security

1. WHEN weight configuration endpoints are accessed THEN the system SHALL require authentication SHALL
2. WHEN non-admin users attempt weight configuration THEN the system SHALL deny access with 403 Forbidden SHALL
3. WHEN audit logs are created THEN the system SHALL securely store admin identities SHALL

### NFR-4: Maintainability

1. WHEN weight calculation logic is implemented THEN the system SHALL centralize it in a single service method SHALL
2. WHEN adding new goal categories THEN the system SHALL support easy extension of weight application logic SHALL
3. WHEN debugging weight issues THEN the system SHALL log weight calculation details at DEBUG level SHALL

### NFR-5: Usability

1. WHEN admins configure weights THEN the UI SHALL provide clear labels and help text in Japanese SHALL
2. WHEN employees see auto-assigned weights THEN the system SHALL explain why this weight was chosen SHALL
3. WHEN validation errors occur THEN the system SHALL display user-friendly error messages SHALL

---

## Edge Cases and Error Handling

### Edge Case 1: User Without Stage

**Scenario:** Employee's `stage_id` is NULL

**Requirement:**
- WHEN creating a goal for a user without a stage THEN the system SHALL return a 400 Bad Request with message "User must be assigned to a stage before creating goals" SHALL
- WHEN an admin attempts to assign such a user THEN the system SHALL prompt them to set the user's stage first SHALL

### Edge Case 2: Stage Without Weight Configuration

**Scenario:** Stage exists but weights are NULL (e.g., newly created stage)

**Requirement:**
- WHEN a stage has NULL weight values THEN the system SHALL use default weights (70.0, 30.0, 10.0) SHALL
- WHEN displaying such a stage THEN the UI SHALL indicate "Using default weights" SHALL

### Edge Case 3: Stage Configuration for Stages 6-9 (No Qualitative Goals)

**Scenario:** Stages 6-9 have qualitative weight = 0.0

**Requirement:**
- WHEN an employee at Stage 6-9 attempts to create a qualitative goal THEN the system SHALL allow it but assign weight = 0.0 SHALL
- WHEN displaying the weight THEN the UI SHALL show "0%" and explain "Qualitative goals are not weighted at your stage level" SHALL

### Edge Case 4: Migration of User to Different Stage

**Scenario:** User is promoted from Stage 3 to Stage 4 mid-evaluation period

**Requirement:**
- WHEN a user's stage changes THEN existing goals SHALL keep their original weights SHALL
- WHEN the user creates new goals after the stage change THEN the system SHALL use the new stage's weights SHALL

### Edge Case 5: Simultaneous Admin Weight Updates

**Scenario:** Two admins update the same stage's weights simultaneously

**Requirement:**
- WHEN concurrent updates occur THEN the system SHALL use optimistic locking or last-write-wins SHALL
- WHEN a conflict occurs THEN the second admin SHALL see an error "Stage was modified by another admin, please refresh" SHALL

---

## Acceptance Testing Scenarios

### Test Scenario 1: End-to-End Goal Creation with Budget Validation

```gherkin
Feature: Stage Weight Budget Enforcement

Scenario: Employee allocates quantitative and qualitative goals
  Given I am logged in as employee "田中太郎"
  And my stage is "Stage 3" (quantitative 70%, qualitative 30%)
  When I create three quantitative goals with weights 20, 20, and 30
  And I create three qualitative goals with weights 10, 10, and 10
  Then I see success banners "Quantitative 70/70%" and "Qualitative 30/30%"
  And the Save button is enabled
  When I submit the form
  Then the backend accepts the goals

Scenario: Employee exceeds the budget
  Given I already allocated quantitative 70/70%
  When I change one quantitative goal to 40%
  Then the UI shows "Quantitative exceeds budget by 10%"
  And submission remains disabled
  When I fix the weights back to 70%
  Then submission becomes available again
```

### Test Scenario 2: Admin Configures Stage Weights

```gherkin
Scenario: Admin updates weight configuration for Stage 4
  Given I am logged in as admin
  When I navigate to stage management page
  And I click "Configure Weights" for Stage 4
  Then I see modal with current weights (80%, 20%, 10%)
  When I change quantitative weight to 85%
  And I change qualitative weight to 15%
  And I click "Save"
  Then stage weights are updated
  And I see confirmation "Stage 4 weights updated successfully"
  When an employee at Stage 4 edits their quantitative goals
  Then the UI reflects the new 85/15 budget and enforces the totals before submission
```

### Test Scenario 3: Non-Admin Cannot Configure Weights

```gherkin
Scenario: Non-admin user attempts to access weight configuration
  Given I am logged in as employee (not admin)
  When I attempt to access "/admin/stages/stage-3/weights"
  Then I see 403 Forbidden error
  And I see message "Admin permissions required"
```

---

## Data Migration Requirements

### Migration 1: Add Weight Columns to Stages Table

```sql
ALTER TABLE stages
ADD COLUMN quantitative_weight DECIMAL(5,2),
ADD COLUMN qualitative_weight DECIMAL(5,2),
ADD COLUMN competency_weight DECIMAL(5,2);

-- Add check constraints
ALTER TABLE stages
ADD CONSTRAINT check_quantitative_weight_range
  CHECK (quantitative_weight >= 0 AND quantitative_weight <= 100);

ALTER TABLE stages
ADD CONSTRAINT check_qualitative_weight_range
  CHECK (qualitative_weight >= 0 AND qualitative_weight <= 100);

ALTER TABLE stages
ADD CONSTRAINT check_competency_weight_range
  CHECK (competency_weight >= 0 AND competency_weight <= 100);
```

### Migration 2: Seed Default Weights

```sql
-- Seed weights for stages 1-3
UPDATE stages SET
  quantitative_weight = 70.0,
  qualitative_weight = 30.0,
  competency_weight = 10.0
WHERE name IN ('Stage 1', 'Stage 2', 'Stage 3');

-- Seed weights for stages 4-5
UPDATE stages SET
  quantitative_weight = 80.0,
  qualitative_weight = 20.0,
  competency_weight = 10.0
WHERE name IN ('Stage 4', 'Stage 5');

-- Seed weights for stages 6-9
UPDATE stages SET
  quantitative_weight = 100.0,
  qualitative_weight = 0.0,
  competency_weight = 10.0
WHERE name IN ('Stage 6', 'Stage 7', 'Stage 8', 'Stage 9');
```

---

## Success Metrics

### Quantitative Metrics

- **Weight Error Rate**: 0% (down from ~5% with manual entry)
- **Goal Creation Time**: 15-20 seconds faster per goal
- **Configuration Change Latency**: < 200ms for weight updates
- **API Response Time**: < 100ms for weight retrieval

### Qualitative Metrics

- **User Satisfaction**: Positive feedback from employees on simplified process
- **Admin Confidence**: Admins confident in consistent evaluation criteria
- **Support Tickets**: 90% reduction in weight-related issues

---

**Last Updated**: 2024-11-06
**Status**: ✅ Requirements Complete
**Next Steps**: Review design.md for technical implementation details
