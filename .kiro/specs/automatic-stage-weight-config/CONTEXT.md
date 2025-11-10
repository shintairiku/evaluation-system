# Context: HR Evaluation System Goal Weights

## 📋 Overview

This document provides context about the current HR evaluation system's goal weighting mechanism and why automatic stage-based weight configuration is needed.

**GitHub Issue**: [#305](https://github.com/shintairiku/evaluation-system/issues/305)

---

## 🏗️ Current System Architecture

### Goal Categories and Weights

The evaluation system supports three types of goals:

1. **業績目標 (Performance Goals)** - Two subtypes:
   - **定量目標 (Quantitative)**: Measurable, numerical targets (e.g., "Increase sales by 20%")
   - **定性目標 (Qualitative/PJ)**: Qualitative project-based goals (e.g., "Lead team training initiative")

2. **コンピテンシー (Competency Goals)**:
   - Behavioral skills and competencies aligned with employee's stage
   - Linked to stage-specific competency framework

3. **コアバリュー (Core Value Goals)**:
   - Company core values embodiment goals
   - Currently supported in schema but not actively used

### Current Weight System

**Database Model** ([goal.py:26](backend/app/database/models/goal.py#L26)):
```python
class Goal(Base):
    weight = Column(DECIMAL(5, 2), nullable=False)  # 0-100
    # Constraint: weight >= 0 AND weight <= 100
```

**API Schema** ([goal.py:84](backend/app/schemas/goal.py#L84)):
```python
class GoalCreate(BaseModel):
    weight: float = Field(..., ge=0, le=100)
```

**Current Behavior:**
- Employees manually enter weight when creating each goal
- No automatic validation of weight distribution
- No stage-based defaults
- System allows any weight 0-100 per individual goal

---

## 🎭 User Roles and Stages

### Stage Hierarchy

The organization uses a 9-stage career progression system:

| Stage Range | Typical Roles | Responsibilities |
|-------------|---------------|------------------|
| **Stage 1-3** | Junior, Intermediate | Individual contributors, some project leadership |
| **Stage 4-5** | Senior, Team Lead | Team management, strategic projects |
| **Stage 6-9** | Manager, Director, Executive | Department/org management, company strategy |

**Stage Model** ([stage_competency.py:9-23](backend/app/database/models/stage_competency.py#L9-23)):
```python
class Stage(Base):
    __tablename__ = "stages"

    id = Column(UUID, primary_key=True)
    organization_id = Column(String(50), ForeignKey("organizations.id"))
    name = Column(Text, nullable=False)
    description = Column(Text)
    # NO WEIGHT FIELDS YET (to be added)
```

**User-Stage Relationship** ([user.py](backend/app/database/models/user.py)):
```python
class User(Base):
    stage_id = Column(UUID, ForeignKey("stages.id"))
    stage = relationship("Stage", back_populates="users")
```

---

## 📊 Current Weight Distribution Problems

### Problem 1: Manual Input Errors

**Example Scenario:**
```
Employee: Tanaka-san (Stage 3)
Creating 3 performance goals:

Goal 1 (定量): Weight = 60%  ← Manually entered
Goal 2 (定量): Weight = 65%  ← Typo! Should be 70%
Goal 3 (定性): Weight = 25%  ← Manually entered

Total: 150% ❌ INVALID (but system allows it per-goal)
```

**Issues:**
- No validation that total weights across all goals = 100%
- Employees confused about correct weights for their stage
- Typos and calculation errors common

### Problem 2: Inconsistent Evaluations

**Example Scenario:**
```
Two employees at same stage (Stage 3):

Employee A:
- Quantitative goals: 70% total
- Qualitative goals: 20% total
- Competency goals: 10% total

Employee B:
- Quantitative goals: 50% total
- Qualitative goals: 40% total
- Competency goals: 10% total

Same stage, different weight distributions → Unfair comparison
```

### Problem 3: Cognitive Load

Employees must remember:
- Which weight percentages apply to their stage
- How to split weights across multiple goals in same category
- What happens if they create fewer/more goals than expected

Current process:
1. Employee starts creating a goal
2. Stops to look up correct weight for their stage
3. Calculates weight for this specific goal
4. Enters weight manually
5. Hopes they got it right

**Time waste**: 15-20 seconds per goal × 6-8 goals = 2-3 minutes extra per evaluation period

---

## 🎯 Organizational Weight Policy

Based on the organizational evaluation framework, the desired weight distribution is:

### Stage 1-3 (Junior/Intermediate)
- **定量 (Quantitative)**: 70% of evaluation
  - Focus on measurable output and task completion
  - Individual performance metrics
- **定性/PJ (Qualitative)**: 30% of evaluation
  - Small project contributions
  - Team collaboration
- **コンピテンシー (Competency)**: 10% of evaluation
  - Skill development
  - Behavioral competencies

### Stage 4-5 (Senior/Team Lead)
- **定量 (Quantitative)**: 80% of evaluation
  - Higher accountability for measurable results
  - Team/project KPIs
- **定性/PJ (Qualitative)**: 20% of evaluation
  - Cross-functional project leadership
- **コンピテンシー (Competency)**: 10% of evaluation
  - Leadership competencies
  - Mentoring skills

### Stage 6-9 (Manager/Executive)
- **定量 (Quantitative)**: 100% of evaluation
  - Pure results-driven evaluation
  - Strategic KPIs and business outcomes
- **定性/PJ (Qualitative)**: Not applicable
  - At this level, all work is quantifiable
- **コンピテンシー (Competency)**: 10% of evaluation
  - Strategic thinking
  - Organizational leadership

**Note**: These percentages represent the total weight budget per goal type for a given stage. Employees may create multiple goals within a category as long as the combined weight matches the stage total (e.g., Stage 3 quantitative goals must sum to 70% in total).

---

## 🔄 Weight Calculation Logic

### Current System (Manual)

```typescript
// frontend: Goal creation form
function createGoal(formData) {
  return {
    goalCategory: "業績目標",
    performanceGoalType: "quantitative",
    weight: 70, // ← Employee types this in manually
    // ... other fields
  }
}
```

### Proposed System (Guided Distribution)

```python
# backend: Enforce stage-level weight budgets per category
def validate_goal_submission(goals: list[GoalCreate], user_id: UUID):
    user = get_user(user_id)
    stage_config = get_stage_weight_config(user.stage_id)  # e.g., 70/30/10

    totals = {
        "quantitative": 0,
        "qualitative": 0,
        "competency": 0,
    }

    for goal in goals:
        if goal.goal_category == "業績目標":
            totals[goal.performance_goal_type] += goal.weight
        elif goal.goal_category in {"コンピテンシー", "コアバリュー"}:
            totals["competency"] += goal.weight

    assert totals["quantitative"] == stage_config.quantitative_weight
    assert totals["qualitative"] == stage_config.qualitative_weight
    assert totals["competency"] == stage_config.competency_weight
```

The frontend assists by auto-splitting the remaining budget each time the employee adds a new goal (e.g., first quantitative goal starts at 70%, the second divides whatever is left), but users can fine‑tune the numbers as long as the totals equal the stage policy.

---

## 🔧 Technical Components to Modify

### Backend Changes Required

1. **Database Schema** ([stage_competency.py](backend/app/database/models/stage_competency.py)):
   ```python
   class Stage(Base):
       # ADD these fields:
       quantitative_weight = Column(DECIMAL(5,2))
       qualitative_weight = Column(DECIMAL(5,2))
       competency_weight = Column(DECIMAL(5,2))
   ```

2. **API Schemas** ([stage_competency.py](backend/app/schemas/stage_competency.py)):
   ```python
   class StageWeightConfig(BaseModel):
       quantitative_weight: float
       qualitative_weight: float
       competency_weight: float

   class StageUpdate(BaseModel):
       # ADD optional weight fields
       quantitative_weight: Optional[float] = None
       qualitative_weight: Optional[float] = None
       competency_weight: Optional[float] = None
   ```

3. **Goal Service** ([goal_service.py](backend/app/services/goal_service.py)):
   ```python
   class GoalService:
       async def create_goal(self, goal_data, user_id):
           user = await self.user_repo.get_user(user_id)
           stage_weights = await self.stage_repo.get_weights(user.stage_id)
           self._validate_stage_budget(goal_data, stage_weights)
           return await self.goal_repo.create_goal(goal_data, user_id)
   ```

4. **API Endpoints** (New):
   ```python
   # GET /api/v1/stages/{stage_id}/weights
   # PATCH /api/v1/stages/{stage_id}/weights (admin only)
   ```

### Frontend Changes Required

1. **Types** ([frontend/src/api/types/](frontend/src/api/types/)):
   ```typescript
   // ADD new type
   export interface StageWeightConfig {
     quantitativeWeight: number;
     qualitativeWeight: number;
     competencyWeight: number;
   }

   export interface Stage {
     id: string;
     name: string;
     // ADD:
     quantitativeWeight?: number;
     qualitativeWeight?: number;
     competencyWeight?: number;
   }
   ```

2. **Goal Creation Form** (to be located):
   - Keep weight inputs but initialize them with an even split of the remaining budget
   - Display running totals per category (e.g., “Quantitative 40/70%”)
   - Prevent submission until each category total matches the stage policy

3. **Admin Stage Management** (New page):
   - Display stage list with weight configuration
   - Edit modal for weight configuration
   - Validation and save functionality

---

## 🎯 User Flows

### Current Flow: Create Goal (Employee)

```mermaid
sequenceDiagram
    participant E as Employee
    participant F as Frontend
    participant B as Backend

    E->>F: Fill goal form
    Note over E: Manually enters weight<br/>(e.g., 70%)
    E->>F: Submit goal
    F->>B: POST /goals {weight: 70}
    B->>B: Validate weight (0-100)
    B->>F: Goal created
    F->>E: Success
```

**Pain Points:**
- Employee must know correct weight
- Manual entry error-prone
- No stage-based validation

### Proposed Flow: Create Goal (Employee)

```mermaid
sequenceDiagram
    participant E as Employee
    participant F as Frontend
    participant B as Backend

    E->>F: Select goal category
    F->>B: GET /users/me
    B->>F: User (stageId: stage-3)
    F->>B: GET /stages/stage-3/weights
    B->>F: {quantitative: 70, qualitative: 30, ...}
    F->>E: Show remaining budget + default split
    E->>F: Adjust weights (e.g., 20/20/30)
    F->>E: Display totals + validation state
    E->>F: Submit goal set
    F->>B: POST /goals (weights included)
    B->>B: Validate totals vs stage budget
    B->>F: Goal created with user-defined weights
    F->>E: Success
```

**Benefits:**
- Guided manual input with instant validation
- Stage-based consistency without extra math
- Clear indicator of remaining budget per category

---

## 📊 Migration Considerations

### Existing Goals

**Question**: What happens to goals created before this feature?

**Options:**

1. **Leave as-is** (Recommended):
   - Existing goals keep their manually-entered weights
   - Only new or edited goals must satisfy the stage budget validation
   - Pros: No data migration risk, historical consistency
   - Cons: Inconsistency between old and new goals

2. **Force migration**:
   - Update all existing goals to use stage-based weights
   - Pros: Complete consistency
   - Cons: Changes historical data, may affect completed evaluations

3. **Optional admin migration**:
   - Provide admin tool to update specific goals/periods
   - Pros: Flexibility, controlled migration
   - Cons: More complex implementation

**Recommendation**: Option 1 (leave as-is) for initial release, Option 3 for future enhancement

---

## 🔗 Related System Components

### Competency Framework

Competencies are already stage-based:
- Each stage has specific competencies ([Competency model](backend/app/database/models/stage_competency.py))
- Competency goals reference these stage competencies
- Weight standardization completes the stage-based evaluation framework

### Evaluation Periods

Goals are created within evaluation periods:
- Typically 2 evaluation periods per year (mid-year, year-end)
- Weight configuration should remain consistent within a period
- Admin can adjust weights between periods if policy changes

### Supervisor Approval

Supervisors approve employee goals:
- Currently check weights manually during approval
- With guided budgets, approval is faster because totals are enforced ahead of time
- Rejection comments no longer need to mention weight errors

---

## 🚀 Success Vision

### Before (Current State)

```
Employee creates 6 goals:
- 3 quantitative: Manually enters 70%, 70%, 65% (typo!)
- 2 qualitative: Manually enters 30%, 30%
- 1 competency: Manually enters 10%

Total: 275% ❌ Invalid
Supervisor rejects → Employee fixes → Resubmits
Time wasted: 10+ minutes
```

### After (Guided Budgets)

```
Employee creates 6 goals:
- 3 quantitative: 20% + 20% + 30% (UI shows 70/70% complete)
- 2 qualitative: 15% + 15% (UI shows 30/30% complete)
- 1 competency: 10%

Totals always match stage policy ✅
Supervisor approves immediately because validation already passed
Time saved: 10 minutes
```

---

## 📝 Assumptions & Constraints

### Assumptions

1. **Stage-based policy**: Weight distribution is determined by employee stage, not department or role
2. **Consistent within stage**: All employees at same stage have same weight distribution
3. **Admin configurability**: Admins can adjust default weights per stage as policy evolves
4. **Per-goal flexibility**: Employees can split the stage budget across any number of goals as long as category totals match

### Constraints

1. **Backward compatibility**: Existing goals must remain unchanged
2. **Performance**: Weight calculation must not add noticeable latency to goal creation
3. **Validation**: System must prevent invalid weight configurations at admin level
4. **Audit trail**: Changes to stage weight configuration should be logged

---

## 🔍 References

**Related Code:**
- Goal model: `backend/app/database/models/goal.py`
- Goal schemas: `backend/app/schemas/goal.py`
- Stage model: `backend/app/database/models/stage_competency.py`
- Stage schemas: `backend/app/schemas/stage_competency.py`
- Goal service: `backend/app/services/goal_service.py`

**Related Documentation:**
- Stage-competency management spec: `.kiro/specs/stage-competency-management/`
- RBAC permissions: `backend/app/security/permissions.py`

---

**Last Updated**: 2024-11-06
**Status**: 📋 Context Complete
**Next Steps**: Review requirements.md for detailed functional requirements
