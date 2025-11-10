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

**Note**: These percentages are stage-level weight budgets. Employees can spread the 70% (quantitative) or 30% (qualitative) across multiple goals, but the sum per category must match the table above. Competency/Core Value goals share the 10% budget.

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

**Budget Validation Logic:**
```python
# When saving goals, enforce stage weight budgets per category
def validate_stage_weights(goals, user_id):
    user = get_user(user_id)
    weights = get_stage_weights(user.stage_id)

    totals = defaultdict(Decimal)
    for goal in goals:
        key = _category_key(goal)
        totals[key] += Decimal(str(goal.weight or 0))

    if totals["quantitative"] != weights.quantitative_weight:
        raise ValidationError("Quantitative goals must total 70% for Stage 3")
    if totals["qualitative"] != weights.qualitative_weight:
        raise ValidationError("Qualitative goals must total 30% for Stage 3")
    if totals["competency"] != weights.competency_weight:
        raise ValidationError("Competency goals must total 10%")
```

#### B. Frontend: Admin Configuration UI

**Admin Stage Management Page:**
- Display table of all stages with current weight configurations
- Click to edit weights for a stage
- Modal with weight inputs and validation
- Save button applies changes

**Goal Creation Form (Employee):**
- Keep weight inputs but pre-fill them evenly so totals equal the stage budget
- Show running total indicators per category (e.g., “Quantitative 40/70% allocated”)
- Block submission until each category total matches the stage configuration

**Benefits:**
- ✅ **Guided accuracy**: UI auto-distributes the remaining weight and warns when totals don't match the policy
- ✅ **Consistent evaluation**: Every employee must hit the 70/30/10 totals, preventing over/under-weighting
- ✅ **Easy updates**: Admin can adjust weights organization-wide
- ✅ **Clear expectations**: Employees see exactly how much budget is left per category while editing
- ✅ **Flexibility**: Teams can decide whether to split 70% as 35/35, 20/20/30, etc., without breaking compliance

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

### AC-2: Stage Budget Enforcement (Employee)
```gherkin
Scenario: Employee creates multiple quantitative goals
  Given I am Stage 3 (quantitative=70%, qualitative=30%, competency=10%)
  When I add three quantitative goals with weights 20, 20, and 30
  Then the UI shows "Quantitative: 70 / 70% allocated" in green
  And the Save button becomes enabled

Scenario: Employee exceeds the budget
  Given I already allocated 70% to quantitative goals
  When I try to set one goal to 40%
  Then the UI shows "Quantitative exceeds budget by 10%"
  And submission is blocked until I rebalance
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
   Legacy/manual weights remain untouched; only when a goal is edited and its weights change do we require rebalancing to the current stage budget. A future migration tool can be considered separately.

5. **Multiple Goals in One Category**  
   Employees can split the stage budget however they like (20/20/30, 35/35, etc.) as long as the sum hits the configured total. The UI and backend validations ensure the total matches policy.

---

**Last Updated**: 2024-11-06
**Status**: 📋 Ready for Implementation
**Recommendation**: **APPROVE** - Clear business value, well-defined scope, straightforward implementation
