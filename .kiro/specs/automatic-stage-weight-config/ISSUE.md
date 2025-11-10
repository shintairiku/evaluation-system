# [TASK-06] sub00: Automatic Stage-Based Weight Configuration

## 📋 Overview

Implement automatic weight configuration for goals based on employee stage to eliminate manual configuration errors and standardize evaluation criteria across organizational levels.

**GitHub Issue**: [#305](https://github.com/shintairiku/evaluation-system/issues/305)

**Related Specifications**:
- Context: `.kiro/specs/automatic-stage-weight-config/CONTEXT.md`
- Requirements: `.kiro/specs/automatic-stage-weight-config/requirements.md`
- Design: `.kiro/specs/automatic-stage-weight-config/design.md`
- Tasks: `.kiro/specs/automatic-stage-weight-config/tasks.md`

---

## 🎯 Problem Statement

### Current Issues with Manual Weight Configuration

**Usability Problems:**
- ❌ **Manual weight input errors**: Employees manually enter weights for each goal, leading to frequent mistakes
- ❌ **Inconsistent evaluations**: Different weights for same roles/stages create unfair evaluations
- ❌ **Cognitive load**: Employees must remember correct weight distributions for their level
- ❌ **No validation**: System doesn't prevent incorrect weight combinations
- ❌ **Time-consuming**: Extra 15-20 seconds per goal creation to calculate and input weights

**Business Impact:**
- 📉 **Evaluation accuracy**: Incorrect weights distort performance assessments
- 😕 **User frustration**: Confusion about which weights to use for their stage
- ⚠️ **Compliance risk**: Inconsistent evaluation criteria across organization
- 🎯 **Management overhead**: Supervisors must verify weights during approval

**Current Implementation:**
```typescript
// frontend/src/api/types/goal.ts (current)
export interface GoalCreate {
  weight: number; // Manually entered by user (0-100)
  // ... other fields
}
```

```python
# backend/app/schemas/goal.py (current)
class GoalCreate(BaseModel):
    weight: float = Field(..., ge=0, le=100)  # No stage-based logic
```

---

## 🎯 Desired Solution

### Standardized Weight Distribution by Stage

Based on organizational policy, weights should be automatically assigned based on employee stage:

| Stage | 定量 (Quantitative) | 定性 PJ (Qualitative) | コンピテンシー (Competency) |
|-------|---------------------|------------------------|----------------------------|
| **Stage 1-3** (Junior/Intermediate) | 70% | 30% | 10% |
| **Stage 4-5** (Senior/Manager) | 80% | 20% | 10% |
| **Stage 6-9** (Executive/Director) | 100% | - (not applicable) | 10% |

**Note**: The weight calculation logic:
- **Performance Goals (業績目標)**: Split between quantitative/qualitative based on stage
  - Quantitative goal: Gets the quantitative percentage
  - Qualitative goal: Gets the qualitative percentage
- **Competency Goals (コンピテンシー)**: Always 10% regardless of stage
- **Core Value Goals (コアバリュー)**: TBD (not shown in table)

### Solution Components

#### A. Backend: Stage Weight Configuration

**Database Schema Update:**
```sql
ALTER TABLE stages ADD COLUMN quantitative_weight DECIMAL(5,2);
ALTER TABLE stages ADD COLUMN qualitative_weight DECIMAL(5,2);
ALTER TABLE stages ADD COLUMN competency_weight DECIMAL(5,2);
```

**API Endpoint:**
```python
# Admin-only endpoint to configure weights per stage
PATCH /api/v1/stages/{stage_id}/weights
Body: {
  "quantitativeWeight": 70.0,
  "qualitativeWeight": 30.0,
  "competencyWeight": 10.0
}
```

**Auto-Apply Logic:**
```python
# When creating a goal, automatically apply weights based on user's stage
def create_goal(goal_data, user_id):
    user = get_user(user_id)
    stage_weights = get_stage_weights(user.stage_id)

    if goal_data.goal_category == "業績目標":
        if goal_data.performance_goal_type == "quantitative":
            goal_data.weight = stage_weights.quantitative_weight
        else:  # qualitative
            goal_data.weight = stage_weights.qualitative_weight
    elif goal_data.goal_category == "コンピテンシー":
        goal_data.weight = stage_weights.competency_weight

    return save_goal(goal_data)
```

#### B. Frontend: Admin Configuration UI

**Admin Stage Management Page:**
- Display table of all stages with current weight configurations
- Click to edit weights for a stage
- Modal with weight inputs and validation
- Save button applies changes

**Goal Creation Form (Employee):**
- Remove manual weight input field
- Display auto-applied weight as read-only badge
- Show explanation: "Weight automatically set based on your stage"

**Benefits:**
- ✅ **Zero manual errors**: No user input required
- ✅ **100% consistency**: Same weights for all employees at same stage
- ✅ **Easy updates**: Admin can adjust weights organization-wide
- ✅ **Faster goal creation**: 15-20 seconds saved per goal
- ✅ **Clear expectations**: Employees know their evaluation criteria upfront

---

## ✅ Success Criteria

### AC-1: Stage Weight Configuration (Admin)
```gherkin
GIVEN I am an admin
WHEN I navigate to stage management page
THEN I see current weight configuration for each stage
AND I can click "Configure Weights" to open modal
AND I can edit quantitative, qualitative, and competency weights
AND system validates that weights are sensible (0-100)
AND I can save changes
THEN all future goals for that stage use new weights
```

### AC-2: Automatic Weight Application (Employee)
```gherkin
GIVEN I am an employee at Stage 3
AND my stage is configured with: quantitative=70%, qualitative=30%, competency=10%
WHEN I create a quantitative performance goal
THEN the weight is automatically set to 70%
AND I cannot edit the weight field (read-only)

WHEN I create a competency goal
THEN the weight is automatically set to 10%
```

### AC-3: Weight Validation
```gherkin
GIVEN an admin is configuring stage weights
WHEN they enter weights that don't make business sense
THEN system shows validation error
AND prevents saving invalid configuration

EXAMPLES:
- Negative weights → Error
- Weights > 100 → Error
- All weights = 0 → Error
```

### AC-4: Migration of Existing Goals
```gherkin
GIVEN there are existing goals created before this feature
WHEN the feature is deployed
THEN existing goals keep their manually-entered weights
AND new goals use automatic weight assignment
AND admins can optionally run a migration to update old goals
```

---

## 📊 Success Metrics

### User Experience Metrics:
- ✅ **Error reduction**: 0 weight configuration errors (vs current ~5% error rate)
- ✅ **Time savings**: 15-20 seconds saved per goal creation
- ✅ **Consistency**: 100% of goals at same stage have correct weights
- ✅ **User satisfaction**: Positive feedback on simplified goal creation

### Technical Metrics:
- ✅ **Weight validation**: 100% of weight configurations pass validation
- ✅ **API response time**: < 100ms for weight configuration retrieval
- ✅ **Database integrity**: 0 goals with invalid weights

### Business Metrics:
- ✅ **Evaluation accuracy**: Standardized criteria across all employees
- ✅ **Compliance**: Consistent evaluation process organization-wide
- ✅ **Admin efficiency**: 90% reduction in weight-related support tickets

---

## 🔄 Phased Rollout Plan

### Phase 1: Backend Foundation
1. Database migration: Add weight columns to `stages` table
2. Seed default weights based on organizational policy
3. Create API endpoints for weight configuration
4. Add validation logic

### Phase 2: Admin Configuration UI
1. Create admin stage weight management page
2. Implement weight editing modal
3. Add validation and error handling
4. Deploy to admin users for testing

### Phase 3: Auto-Apply for New Goals
1. Update goal creation logic to auto-apply weights
2. Remove weight input from employee goal creation form
3. Display auto-applied weight as read-only
4. Deploy to all users

### Phase 4: Optional Migration
1. Provide admin tool to update existing goals
2. Run migration in phases (by department/stage)
3. Validate results

---

## 🚧 Out of Scope

**Not included in this task:**
- ❌ Different weight configurations per department (only by stage)
- ❌ Custom weights per individual employee
- ❌ Dynamic weight adjustment based on evaluation period
- ❌ Weight recommendations based on historical data
- ❌ Automatic rebalancing when goal count changes

---

## 🔗 Related Work

**Similar Implementations in Project:**
- Stage-competency management: Stage-based configuration pattern
- RBAC permissions: Role-based auto-assignment
- Organization settings: Admin-configurable defaults

**Future Enhancements (Out of Scope):**
- AI-suggested weight distributions
- Department-level weight overrides
- Historical weight analytics
- Weight optimization based on evaluation outcomes

---

## 📝 Clarifications (resolved questions)

1. **Weight Sum Logic**  
   Competency scoring is a parallel axis (業績目標 vs コンピテンシー) per the policy image. We therefore expect quantitative + qualitative to reach 100%, and competency adds an extra 10% that is not normalized away. UI copy will explain why totals can exceed 100%.

2. **Core Value Goals**  
   Core value goals reuse the competency weight for their stage (10% by default) until HR provides a dedicated ratio.

3. **Weight Customization**  
   We will persist weight columns per stage so admins can configure each stage independently through the new UI; there is no organization-wide override beyond those records.

4. **Existing Goals**  
   Legacy/manual weights remain untouched; only new goals (or edits that change category/type) receive automatic values. A future migration tool can be considered separately.

5. **Multiple Goals in One Category**  
   Each goal instance receives the stage’s full weight for its category (e.g., both Stage 3 quantitative goals display 70%). This matches how supervisors score each goal independently today.

---

**Last Updated**: 2024-11-06
**Status**: 📋 Ready for Implementation
**Recommendation**: **APPROVE** - Clear business value, well-defined scope, straightforward implementation
