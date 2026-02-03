# Domain Model: Self-Assessment Feature

**Status:** Updated
**Last Updated:** 2025-02-03
**Related Issues:** #414, #453

---

## 1. Business Context

### Problem Statement
Employees need a structured way to evaluate their own performance against approved goals and competencies before supervisor review. The self-assessment process allows employees to:
- Reflect on their achievements during the evaluation period
- Rate their own performance using the company's grading system: **SS, S, A, B, C, D** (input scale, up to 6 levels depending on goal type)
- Provide narrative comments for each goal and competency
- Submit their evaluation for supervisor review

**Assessment Scope:**
1. **業績目標 (Performance Goals)**: Created by employee → Approved by supervisor → Self-assessed by employee → Supervisor reviews self-assessment
2. **コンピテンシー (Competency Goals)**: Created by employee → Approved by supervisor → Self-assessed by employee → Supervisor reviews self-assessment
3. **コアバリュー (Core Value Goals)**: **Only available in end-of-period evaluations (期末). When available, unlocks AFTER supervisor approves self-assessments for Performance and Competency goals**

**Sequential Flow:**
```
Employee creates Performance + Competency goals
         ↓
Supervisor reviews and approves goals
         ↓
Employee completes self-assessments (Performance + Competency)
         ↓
Supervisor reviews and approves self-assessments
         ↓
Core Value goals become available (期末評価 only)
         ↓
Employee completes Core Value self-assessment
         ↓
Supervisor reviews and approves Core Value self-assessment
```

### Business Value
- **Employee Empowerment**: Employees have a voice in their performance evaluation
- **Better Communication**: Facilitates dialogue between employees and supervisors
- **Fair Process**: Ensures employees can present their perspective before final review
- **Documentation**: Creates a historical record of self-perception vs. supervisor assessment

### Target Users
1. **Employees**: Create and submit self-assessments for their approved goals
2. **Supervisors**: Review employee self-assessments alongside their own evaluations
3. **Admins**: Monitor self-assessment completion rates and compliance

### UI Implementation
- **Employee Self-Assessment Pages**: Located in `/evaluation-input` section
  - Employee creates and submits self-assessments
  - Draft auto-save functionality
  - Letter grade selection per goal type:
    - 定量目標: SS, S, A, B, C, D (6 levels)
    - 定性目標: SS, S, A, B, C (5 levels, no D)
    - コンピテンシー: SS, S, A, B, C (5 levels, no D)
  - Comment input for each goal
  - Employee can edit self-assessment until supervisor approves

- **Supervisor Review Pages**: Located in `/evaluation-feedback` section
  - Supervisor reviews submitted self-assessments
  - Provides supervisor rating and feedback comment
  - Approves employee self-assessments (no rejection - provides feedback via comments for employee to revise)
  - Controls Core Value phase unlock
  - **Badge notification**: Shows count of pending self-assessments to review

### Notification System (Badge Counters)
Following the same pattern as goal-review:
- **When employee submits self-assessment**:
  - Badge counter appears on `/evaluation-feedback` navigation icon (left sidebar)
  - Supervisor sees count of pending self-assessments requiring review

- **Badge behavior**:
  - Counter increments for each new submitted item
  - Counter decrements when supervisor approves
  - Real-time updates via existing notification system

#### Technical Implementation (Following Goal Review Pattern)

**Architecture**: React Context API for state management

**Context Providers** (to be implemented):
- `SelfAssessmentReviewContext` - For supervisor side (pending self-assessments count)
  - Extends pattern from `GoalReviewContext`
  - Query: Count of `self_assessments` with `status = 'submitted'` (awaiting supervisor review)
  - API: Use existing `getSelfAssessmentsAction()` with filter

- `SelfAssessmentListContext` - For employee side (draft self-assessments count)
  - Extends pattern from `GoalListContext`
  - Query: Count of `self_assessments` with `status = 'draft'`
  - API: Use existing `getSelfAssessmentsAction()` with filter

**Badge Display**:
- Location: `Sidebar` component (left navigation bar)
- Visual: Red badge with counter (max display: 99+)
- States:
  - Collapsed sidebar: Badge on icon only
  - Expanded sidebar: Badge next to label text
  - Hover: Transition effect

**Update Triggers**:
- Initial load: Auto-fetch on context provider mount
- Manual refresh: Page components call `refreshCount()` on data changes
- Cache: 5-minute cache + `revalidateTag()` on mutations

**Reference Implementation**:
- Pattern: `frontend/src/context/GoalReviewContext.tsx`
- Alternative: `frontend/src/context/GoalListContext.tsx` (with client-side filtering)
- Display: `frontend/src/components/display/sidebar.tsx` (lines 120-153)

---

## 2. Core Entities

### 2.1. SelfAssessment

**Purpose**: Represents an employee's self-evaluation of a specific goal (any category: Performance, Competency, or Core Value).

**Key Attributes**:
- `id` (UUID) - Unique identifier
- `goal_id` (UUID) - Reference to the goal being assessed
- `period_id` (UUID) - Reference to the evaluation period
- **`self_rating_code`** (String) - Employee's grade: **SS | S | A | B | C | D** (optional in draft, **required** for submission). Allowed values depend on goal type (validated at service layer).
- `self_rating` (Decimal) - Numeric equivalent for calculations (internal, auto-calculated from rating_code)
- **`self_comment`** (String) - Employee's narrative self-assessment (optional in draft, **required** for submission)
- **`rating_data`** (JSONB, nullable) - Granular per-action ratings for コンピテンシー goals. Structure:
  ```json
  {
    "action_ratings": {
      "<competency_id>": {
        "<action_number>": {"code": "S", "value": 6.0}
      }
    },
    "competency_averages": {
      "<competency_id>": 4.0
    },
    "overall_average": 5.25
  }
  ```
  - `action_ratings`: Individual rating per ideal action, keyed by competency UUID then action number (1-5)
  - `competency_averages`: Calculated average per competency (from its action ratings)
  - `overall_average`: Calculated average across all competencies
  - **NULL** for 業績目標 goals (rating is direct via `self_rating_code`)
  - For コンピテンシー: `self_rating_code` stores the final letter grade derived from `overall_average`
- `status` (Enum) - Current state: `draft`, `submitted`, `approved`
- `submitted_at` (DateTime) - Timestamp when assessment was submitted
- `created_at` (DateTime) - Record creation timestamp
- `updated_at` (DateTime) - Last modification timestamp

**Input Rating Scale (Per Goal Type)**:

| Goal Type | Allowed Grades | Levels |
|-----------|---------------|--------|
| 定量目標 (Quantitative) | SS, S, A, B, C, D | 6 |
| 定性目標 (Qualitative) | SS, S, A, B, C | 5 (no D) |
| コンピテンシー (Competency) | SS, S, A, B, C | 5 (no D) |

**Grade-to-Number Mapping (Input Scale)**:
| Grade | Numeric Value | Meaning |
|-------|--------------|---------|
| SS | 7.0 | Exceptional |
| S | 6.0 | Excellent |
| A | 4.0 | Good |
| B | 2.0 | Acceptable |
| C | 1.0 | Below Expectations |
| D | 0.0 | Unsatisfactory (定量目標 only) |

**Final Calculated Rating Scale (System Output - 7 levels)**:
| Grade | Numeric Value |
|-------|--------------|
| SS | 7.0 |
| S | 6.0 |
| A+ | 5.0 |
| A | 4.0 |
| A- | 3.0 |
| B | 2.0 |
| C | 1.0 |

**Lifecycle**: draft → submitted → approved

**3-State System**:
- Employee can edit self-assessment until supervisor approves
- No formal rejection — supervisor provides feedback via comments, employee revises and resubmits

**Cardinality**: One self-assessment per goal (unique constraint on `goal_id`)

---

### 2.2. Goal

**Purpose**: Represents an employee's performance objective for an evaluation period.

**Key Attributes**:
- `id` (UUID) - Unique identifier
- `user_id` (UUID) - Employee who owns the goal
- `period_id` (UUID) - Evaluation period
- `goal_category` (Enum) - Type: `業績目標` (Performance), `コンピテンシー` (Competency), `コアバリュー` (Core Value)
- `target_data` (JSONB) - Flexible goal details per category
- `weight` (Decimal 0-100) - Goal weight percentage
- `status` (Enum) - `draft`, `submitted`, `approved`, `rejected`
- `approved_by` (UUID) - Supervisor who approved the goal
- `approved_at` (DateTime) - Approval timestamp

**Lifecycle**: draft → submitted → approved/rejected

**Business Rule**: Only **approved** goals can be self-assessed

---

### 2.3. EvaluationPeriod

**Purpose**: Defines a time-bound evaluation cycle (e.g., 2024 Q4, 2025 Fiscal Year).

**Key Attributes**:
- `id` (UUID) - Unique identifier
- `name` (String) - Period name (e.g., "2024 Q4 Review")
- `start_date` (Date) - Period start
- `end_date` (Date) - Period end
- `deadline` (Date) - Assessment submission deadline
- `status` (Enum) - `active`, `closed`

**Business Rule**: Self-assessments can only be created for active periods with approved goals

---

### 2.4. User (Employee)

**Purpose**: Represents an employee in the system.

**Key Attributes**:
- `id` (UUID) - Unique identifier
- `name` (String) - Full name
- `email` (String) - Email address
- `organization_id` (String) - Organization membership
- `supervisor_id` (UUID) - Direct supervisor reference

**Roles in Self-Assessment**:
- **Owner**: Creates self-assessments for their own goals
- **Cannot**: Edit/delete self-assessments of others

---

### 2.5. SupervisorFeedback

**Purpose**: Supervisor's review and approval of an employee's self-assessment.

**Key Attributes**:
- `id` (UUID) - Unique identifier
- `self_assessment_id` (UUID) - Reference to self-assessment
- `period_id` (UUID) - Reference to the evaluation period
- `supervisor_id` (UUID) - Supervisor providing the feedback
- `subordinate_id` (UUID) - Employee who owns the self-assessment
- `supervisor_rating_code` (String) - Supervisor's grade: **SS | S | A | B | C | D** (required for approval). Same goal-type validation as self-assessment.
- `supervisor_rating` (Decimal) - Numeric equivalent for calculations (0.0-7.0, auto-calculated)
- **`supervisor_comment`** (String) - Supervisor's feedback comment (optional)
- **`rating_data`** (JSONB, nullable) - Supervisor's granular per-action rating suggestions for コンピテンシー goals. Same structure as SelfAssessment.rating_data. Rarely used — most supervisors only provide an overall `supervisor_rating_code`. **NULL** for 業績目標 goals.
- `action` (Enum) - Supervisor decision: `PENDING` or `APPROVED` (no REJECTED)
- `status` (Enum) - Workflow status: `incomplete`, `draft`, `submitted` (uses `SubmissionStatus`)
- `submitted_at` (DateTime) - Timestamp when feedback was submitted
- `reviewed_at` (DateTime) - Timestamp when supervisor approved
- `created_at` (DateTime) - Record creation timestamp
- `updated_at` (DateTime) - Last modification timestamp

**Lifecycle**:
- Status: incomplete → draft → submitted
- Action: PENDING → APPROVED

**Relationship**: One-to-one with SelfAssessment

**Business Rule**:
- When action changes to APPROVED, the linked self-assessment status changes to `approved` (locked)
- Supervisor must approve ALL Performance and Competency self-assessments before Core Value goals become available
- No rejection — supervisor provides feedback via comments, employee can edit and resubmit until approval

---

## 3. Entity Relationships (ERD)

```mermaid
erDiagram
    USER ||--o{ GOAL : "creates"
    USER ||--o{ SELF_ASSESSMENT : "creates"
    EVALUATION_PERIOD ||--o{ GOAL : "contains"
    EVALUATION_PERIOD ||--o{ SELF_ASSESSMENT : "evaluated in"
    GOAL ||--o| SELF_ASSESSMENT : "assesses"
    SELF_ASSESSMENT ||--o| SUPERVISOR_FEEDBACK : "receives"
    USER ||--o{ SUPERVISOR_FEEDBACK : "provides as supervisor"

    USER {
        uuid id PK
        string name
        string email
        string organization_id
        uuid supervisor_id FK
    }

    GOAL {
        uuid id PK
        uuid user_id FK "Employee"
        uuid period_id FK
        string goal_category "業績目標|コンピテンシー|コアバリュー"
        jsonb target_data
        decimal weight "0-100"
        string status "draft|submitted|approved|rejected"
        uuid approved_by FK "Supervisor"
        timestamp approved_at
        timestamp created_at
        timestamp updated_at
    }

    EVALUATION_PERIOD {
        uuid id PK
        string name
        date start_date
        date end_date
        date deadline
        string status "active|closed"
    }

    SELF_ASSESSMENT {
        uuid id PK
        uuid goal_id FK "UNIQUE"
        uuid period_id FK
        string self_rating_code "SS|S|A|B|C|D, nullable"
        decimal self_rating "0-7, nullable, auto-calculated"
        string self_comment "nullable"
        jsonb rating_data "nullable, competency per-action ratings"
        string status "draft|submitted|approved"
        timestamp submitted_at "nullable"
        timestamp created_at
        timestamp updated_at
    }

    SUPERVISOR_FEEDBACK {
        uuid id PK
        uuid self_assessment_id FK "UNIQUE"
        uuid period_id FK
        uuid supervisor_id FK
        uuid subordinate_id FK
        string supervisor_rating_code "SS|S|A|B|C|D, nullable"
        decimal supervisor_rating "0-7, nullable, auto-calculated"
        string supervisor_comment "nullable"
        jsonb rating_data "nullable, competency per-action ratings"
        string action "PENDING|APPROVED"
        string status "incomplete|draft|submitted"
        timestamp submitted_at "nullable"
        timestamp reviewed_at "nullable"
        timestamp created_at
        timestamp updated_at
    }
```

**Key Relationships**:
- One Goal → One SelfAssessment (1:1, unique constraint on goal_id)
- One SelfAssessment → One SupervisorFeedback (1:1, optional)
- One User → Many Goals (1:N)
- One EvaluationPeriod → Many Goals (1:N)
- One EvaluationPeriod → Many SelfAssessments (1:N)

---

## 4. Business Rules

### 4.1. Creation Rules

**Goal Prerequisites**:
- ✅ Self-assessment is **automatically created** when goal status changes to **approved**
- ✅ Goal must belong to the current user (employee)
- ✅ Goal's evaluation period must be active
- ✅ **One self-assessment per goal** (unique constraint on `goal_id`)
- ✅ System creates self-assessment in `draft` status with empty `self_rating_code` and `self_comment`

**Goal Category Sequential Rules**:
- ✅ **Performance Goals** (`業績目標`): Can be self-assessed immediately after approval
- ✅ **Competency Goals** (`コンピテンシー`): Can be self-assessed immediately after approval
- ✅ **Core Value Goals** (`コアバリュー`):
  - **Only available in end-of-period evaluations (期末評価)**
  - Not available in mid-year or interim reviews
  - Can ONLY be self-assessed **after supervisor has approved** self-assessments for ALL Performance and Competency goals in the same period

**Period Constraints**:
- ✅ Can only create self-assessments during active evaluation periods
- ✅ Cannot create assessments after period deadline

---

### 4.2. Rating Validation

**Self-Rating Code Rules**:
- ✅ Rating code is **optional** in draft state
- ✅ Rating code is **required** for submission
- ✅ Database stores both:
  - `self_rating_code` (string): The letter grade (e.g., "A+")
  - `self_rating` (decimal): Numeric equivalent (e.g., 5.0) for calculations

**Rating Scale by Goal Type (User Input)**:

| Goal Type | Allowed Grades | Levels |
|-----------|---------------|--------|
| 定量目標 (Quantitative Performance) | SS, S, A, B, C, D | 6 |
| 定性目標 (Qualitative Performance) | SS, S, A, B, C | 5 (no D) |
| コンピテンシー (Competency) | SS, S, A, B, C | 5 (no D) |

- Database stores any value from SS to D (VARCHAR(3))
- **Service layer validates** allowed grades per goal type
- Grade-to-Number Mapping:
  ```
  SS → 7.0 | S → 6.0 | A → 4.0
  B → 2.0  | C → 1.0 | D → 0.0 (定量目標 only)
  ```

**Final Calculated Assessment - System Output**: **SS | S | A+ | A | A- | B | C** (7 levels)
- System calculates final grade based on weighted average of all goal assessments
- Includes intermediate grades A+, A- for more precise evaluation
- Used for overall period performance rating
- Grade-to-Number Mapping:
  ```
  SS → 7.0 | S → 6.0 | A+ → 5.0 | A → 4.0
  A- → 3.0 | B → 2.0 | C → 1.0
  ```

**Key Distinction**:
- **Input Scale (up to 6 levels)**: What users select for each individual goal - SS, S, A, B, C, D (D only for 定量目標)
- **Output Scale (7 levels)**: What system calculates for final evaluation - SS, S, A+, A, A-, B, C

**Comment Rules**:
- ✅ **Employee self-assessment comment**: **REQUIRED** (mandatory for submission)
- ✅ **Supervisor comment**: **Optional** (supervisor can provide feedback but not mandatory)
- ⚠️ **Open Question**: Should there be a minimum/maximum character count?

---

### 4.3. Status Transitions (3-State System)

**Draft State**:
- ✅ Editable by employee
- ✅ Auto-saved periodically (frontend behavior)
- ✅ Can be deleted
- ✅ No `submitted_at` timestamp
- ✅ Rating and comment are optional

**Submitted State**:
- ✅ Must have `submitted_at` timestamp (database constraint)
- ✅ Must have `self_rating_code` (enforced at submission)
- ✅ Must have `self_comment` (enforced at submission)
- ✅ Awaiting supervisor feedback
- ✅ **Can still be edited** by employee — employee can revise until supervisor approves
- 🔄 **If supervisor approves**: Status changes to 'approved' (immutable)

**Approved State**:
- 🔒 **Read-only** (immutable, permanently locked)
- ✅ Supervisor approved this self-assessment
- ✅ Counts toward Core Value unlock requirement
- ✅ Final record of employee's self-evaluation
- ❌ Cannot be edited or deleted

**No Rejected State**: Supervisor does not formally reject. Instead, supervisor provides feedback via comments and the employee can continue editing the self-assessment until it is approved.

**Database Constraint**:
```sql
CHECK ((status != 'submitted' AND status != 'approved') OR (submitted_at IS NOT NULL))
```

---

### 4.4. Permission Rules

**Employee Permissions**:
- ❌ **Cannot** manually create self-assessments (auto-created by system when goal approved)
- ✅ Can **read** their own self-assessments
- ✅ Can **update** their own self-assessments (draft or submitted — editable until approved)
- ✅ Can **delete** their own self-assessments (only in draft state)
- ✅ Can **submit** their own self-assessments
- ❌ **Cannot** edit approved self-assessments
- ❌ **Cannot** view/edit other employees' self-assessments

**Supervisor Permissions**:
- ✅ Can **read** subordinates' self-assessments (all statuses)
- ❌ **Cannot** create/edit/delete subordinates' self-assessments
- ✅ Can **create** supervisor feedback on submitted self-assessments

**Admin Permissions**:
- ✅ Can **read** all self-assessments (organization-wide, read-only)
- ❌ **Cannot** create/edit/delete any self-assessments

---

### 4.5. Data Integrity Rules

**Unique Constraint**:
- ✅ One self-assessment per goal (strict 1:1)
- ✅ Database index: `idx_self_assessments_goal_unique` on `goal_id` (unique)

**Cascade Deletion**:
- ✅ If a goal is deleted → self-assessment is deleted (`ON DELETE CASCADE`)
- ✅ If an evaluation period is deleted → self-assessment is deleted (`ON DELETE CASCADE`)

**Referential Integrity**:
- ✅ `goal_id` must reference an existing goal
- ✅ `period_id` must reference an existing evaluation period

---

### 4.6. Validation Summary Table

| Field | Required? | Constraints | Notes |
|-------|-----------|-------------|-------|
| `goal_id` | ✅ Yes | Must be approved goal owned by user | Unique constraint (1:1) |
| `period_id` | ✅ Yes | Must be active period | - |
| `self_rating_code` | Draft: ❌ No<br>Submit: ✅ Yes | SS\|S\|A\|B\|C\|D | Service validates per goal type |
| `self_rating` | Auto-calculated | 0.0-7.0 (decimal) | Numeric equivalent for calculations |
| `self_comment` | Draft: ❌ No<br>Submit: ✅ Yes | String, non-empty | **REQUIRED for submission** |
| `rating_data` | ❌ No | JSONB, nullable | Only for コンピテンシー goals; per-action granular ratings |
| `status` | ✅ Yes | `draft`, `submitted`, `approved` | Default: `draft` |
| `submitted_at` | Draft: ❌ No<br>Submit/Approved: ✅ Yes | Auto-set on submission | Required for submitted and approved states |

---

## 5. State Transitions (3-State System)

### 5.1. SelfAssessment State Transitions

```mermaid
stateDiagram-v2
    [*] --> Draft: System auto-creates<br/>when goal approved
    Draft --> Submitted: Employee submits
    Submitted --> Draft: Employee edits (before approval)
    Submitted --> Approved: Supervisor approves
    Approved --> [*]: Process complete

    note right of Draft
        Auto-created by system when goal approved
        Editable by employee
        Auto-save enabled
        Can delete
        Grade (rating_code) optional
        submitted_at NULL
    end note

    note right of Submitted
        submitted_at set
        Grade + Comment required
        Awaiting supervisor review
        Employee can still edit (reverts to draft)
    end note

    note right of Approved
        Locked permanently
        Status = 'approved'
        Counts toward Core Value unlock
        Final self-evaluation record
    end note
```

**State Transition Rules**:

| From State | To State | Trigger | Who | Conditions |
|------------|----------|---------|-----|------------|
| (none) | Draft | Create | **System** | Goal status changes to 'approved' → System auto-creates self-assessment in draft |
| Draft | Submitted | Submit | Employee | `self_rating_code` AND `self_comment` are provided |
| Draft | (deleted) | Delete | Employee | Still in draft state |
| Submitted | Draft | Edit | Employee | Employee edits before supervisor approves |
| Submitted | Approved | Approve | System | SupervisorFeedback.action = 'APPROVED' → Self-assessment status changes to 'approved' (immutable) |
| Approved | (none) | - | - | **Immutable** - No reverse transition |

**Edit/Resubmission Flow**:
- Employee can edit and resubmit self-assessment at any time before supervisor approves
- Supervisor provides feedback via comments (no formal rejection)
- Employee sees supervisor's comments, revises their assessment, and resubmits
- Once supervisor **approves**, self-assessment becomes **permanently locked**

### 5.2. SupervisorFeedback State Transitions

**Two-axis tracking**:
- **`status`** (SubmissionStatus): `incomplete` → `draft` → `submitted` (workflow progress)
- **`action`** (SupervisorAction): `PENDING` → `APPROVED` (supervisor decision)

```mermaid
stateDiagram-v2
    [*] --> Incomplete: Auto-created when SA submitted
    Incomplete --> Draft: Supervisor starts editing
    Draft --> Submitted: Supervisor submits feedback
    Submitted --> [*]: Process complete

    note right of Incomplete
        Auto-created, no data yet
        action = PENDING
    end note

    note right of Draft
        Supervisor editing rating/comment
        action = PENDING
    end note

    note right of Submitted
        Feedback finalized
        action = APPROVED (locks SA)
        reviewed_at set
    end note
```

**SupervisorFeedback Transition Rules**:

| Status | Action | Trigger | Conditions |
|--------|--------|---------|------------|
| incomplete | PENDING | Auto-create | Self-assessment is submitted |
| draft | PENDING | Supervisor edits | Supervisor starts working on feedback |
| submitted | APPROVED | Supervisor submits | `supervisor_rating_code` is provided. When action=APPROVED, self-assessment status → 'approved' |

**Supervisor Comment Rules**:
- ✅ **Comment is always optional** — supervisor can provide feedback but not mandatory

**Core Value Unlock Logic**:
- **Prerequisite**: Core Value goals are **only available in end-of-period evaluations (期末評価)**
  - Not available in mid-year reviews or interim evaluations
  - Period must be marked as `period_type = '期末'` or similar flag
- Core Value goals become available when **ALL** Performance + Competency self-assessments have `status = 'approved'`
- Query: `SELECT COUNT(*) FROM self_assessments WHERE status = 'approved' AND goal_category IN ('業績目標', 'コンピテンシー')`
- If ANY self-assessment is not approved (draft/submitted), Core Value phase remains locked

**Open Questions**:
- ⚠️ Can supervisor **change** approval after approving (revert to PENDING)?
- ⚠️ What happens if supervisor takes too long to review (timeout/auto-approve)?

---

## 5.3. Notification System Integration

### Badge Counter Implementation

**Frontend Context Architecture** (React Context API):

| Context | Purpose | Count Logic | API Endpoint |
|---------|---------|-------------|--------------|
| `SelfAssessmentReviewContext` | Supervisor notification | Count `self_assessments` where `status = 'submitted'` | `getSelfAssessmentsAction({ status: 'submitted' })` |
| `SelfAssessmentListContext` | Employee notification | Count `self_assessments` where `status = 'draft' AND previous_self_assessment_id IS NOT NULL` | `getSelfAssessmentsAction({ status: 'draft' })` + client filter |

**Provider Hierarchy**:
```
app/layout.tsx (Root Layout)
  └─ GoalReviewProvider (Global - existing)
     └─ SelfAssessmentReviewProvider (Global - to implement)
        └─ app/(evaluation)/layout.tsx (Evaluation Layout)
           └─ GoalListProvider (Scoped - existing)
              └─ SelfAssessmentListContext (Scoped - to implement)
                 └─ Sidebar + Pages
```

**Sidebar Display Logic** (`frontend/src/components/display/sidebar.tsx`):
```typescript
// Supervisor side - /evaluation-feedback
const { pendingSelfAssessmentsCount } = useSelfAssessmentReviewContext();
{pendingSelfAssessmentsCount > 0 && (
  <Badge variant="destructive">
    {pendingSelfAssessmentsCount > 99 ? '99+' : pendingSelfAssessmentsCount}
  </Badge>
)}
```

**Cache Strategy**:
- **Cache Tag**: `CACHE_TAGS.SELF_ASSESSMENTS` (already exists)
- **Duration**: 5 minutes (DYNAMIC)
- **Revalidation**: Automatic on mutations via `revalidateTag('SELF_ASSESSMENTS')`
- **Manual Refresh**: Pages call `refreshPendingSelfAssessmentsCount()` on data changes

**Update Flow**:
1. **Employee submits self-assessment**:
   - Backend updates `self_assessment` with `status = 'submitted'`
   - Revalidates `SELF_ASSESSMENTS` cache tag
   - Supervisor's `SelfAssessmentReviewContext` refreshes count
   - Badge appears on `/evaluation-feedback` icon

2. **Supervisor approves self-assessment**:
   - Backend updates `supervisor_feedback` with `action = 'APPROVED'`, `status = 'submitted'`
   - Backend updates `self_assessment` to `status = 'approved'`
   - Revalidates `SELF_ASSESSMENTS` cache tag
   - Supervisor's count decrements (no longer `submitted`)
   - Badge counter updates or disappears

**Reference Files**:
- Context template: `frontend/src/context/GoalReviewContext.tsx`
- Alternative pattern: `frontend/src/context/GoalListContext.tsx`
- Sidebar integration: `frontend/src/components/display/sidebar.tsx` (lines 120-153)
- API layer: `frontend/src/api/server-actions/self-assessments.ts` (already exists)

---

## 6. Open Questions

### 6.1. Submission Flow
- [x] ~~**Can employee cancel submission?**~~ → ✅ **RESOLVED**: Employee can edit and resubmit at any time before approval
- [x] ~~**Rejection flow?**~~ → ✅ **RESOLVED**: No formal rejection. 3-state system (draft/submitted/approved). Supervisor provides feedback via comments, employee edits until approved.
- [ ] **Submission deadline**: What happens to draft assessments after period deadline?
  - Auto-submit with current data?
  - Mark as incomplete?
  - Prevent submission?

### 6.2. Comment Requirements
- [x] ~~**Employee comment required?**~~ → ✅ **RESOLVED**: REQUIRED for submission
- [x] ~~**Supervisor comment required?**~~ → ✅ **RESOLVED**: Always optional (no rejection flow)
- [ ] **Minimum comment length?** (e.g., 10 characters for meaningful feedback)
- [ ] **Maximum comment length?** (e.g., 1000 characters to prevent essays)
- [ ] **Comment template or guidance?** Should UI provide prompts?

### 6.3. Notifications
- [x] ~~**Who gets notified when**~~ → ✅ **RESOLVED**: Badge counter notification system (following goal-review pattern):
  - **Employee submits self-assessment** → Badge counter appears on `/evaluation-feedback` icon in left navigation bar for supervisor (showing count of pending self-assessments)
  - Same logic already implemented for goal review
- [ ] **Notification channels**: Email notifications needed in addition to badge counters?

### 6.4. Supervisor Feedback Integration
- [ ] **Can supervisor see self-assessment before completing their own review?**
- [ ] **Are self-assessment and supervisor feedback shown side-by-side?**
- [ ] **Can supervisor override self-rating completely?**

### 6.5. Reporting and Analytics
- [ ] **Completion rate tracking**: How to measure % of goals with self-assessments?
- [ ] **Rating discrepancy analysis**: Should system flag large gaps between self-rating and supervisor rating?
- [ ] **Historical trends**: Can employees see their self-ratings over multiple periods?

### 6.6. Edge Cases
- [ ] **What if goal is edited after self-assessment is created?**
  - Invalidate self-assessment?
  - Keep old version?
- [ ] **What if goal is rejected after self-assessment submitted?**
  - Delete self-assessment?
  - Mark as orphaned?
- [ ] **Can employee create self-assessment before all goals are approved?**
  - For approved goals only (current behavior)
  - Wait until all goals approved

### 6.7. Multi-Language Support
- [ ] **Comment language**: Japanese only? Multi-language support needed?
- [ ] **UI localization**: Interface in Japanese? English? Both?

### 6.8. Core Value Sequential Flow
- [x] ~~**Period availability**~~ → ✅ **RESOLVED**: Core Value is **only available in end-of-period evaluations (期末評価)**, not in mid-year or interim reviews
- [x] ~~**Unlock trigger**~~ → ✅ **RESOLVED**: Core Value phase unlocks automatically when all Performance+Competency self-assessments are approved (only in 期末 periods)
- [ ] **Notification**: How is employee notified that Core Value goals are now available?
- [ ] **Partial approval**: What if only some Performance/Competency self-assessments are approved? Does employee wait for all?
- [ ] **Revocation handling**: If supervisor revokes approval of a Performance self-assessment after Core Value is already completed, what happens? (Currently no revocation supported)
- [ ] **Multiple Core Value goals**: Can employee have multiple Core Value goals, or just one?
- [x] ~~**Core Value approval**~~ → ✅ **RESOLVED**: Yes, Core Value self-assessment requires supervisor approval like Performance and Competency

---

## 7. Assumptions & Decisions

Based on analysis and decisions made during implementation planning:

1. ✅ **3-state system for SelfAssessment**: draft → submitted → approved (no rejection)
   - Employee can edit until supervisor approves
   - Supervisor provides feedback via comments (no formal rejection)
2. ✅ **One self-assessment per goal** (strict 1:1, unique constraint on `goal_id`)
3. ✅ **SupervisorFeedback uses two-axis tracking**: `status` (incomplete/draft/submitted) + `action` (PENDING/APPROVED)
4. ✅ **Rating input scale**: 6 levels (SS, S, A, B, C, D) stored in DB, validated per goal type at service layer:
   - 定量目標: SS, S, A, B, C, D (6 levels)
   - 定性目標: SS, S, A, B, C (5 levels, no D)
   - コンピテンシー: SS, S, A, B, C (5 levels, no D)
5. ✅ **Rating output scale**: 7 levels (SS, S, A+, A, A-, B, C) for final calculated ratings
6. ✅ **Auto-save in frontend** (not enforced by backend)
7. ✅ **Employee comment REQUIRED** for submission (enforced at service layer)
8. ✅ **Supervisor comment always optional** (no rejection = no mandatory comment)
9. ⚠️ **No explicit deadline enforcement** (evaluation period has deadline, but unclear if enforced for self-assessments)
10. ⚠️ **No character limits on comments** (unlimited currently)
11. ⚠️ **Sequential flow**: Core Value goals require ALL Performance + Competency self-assessments to be approved first - **To be implemented**
12. ✅ **Badge notification system**: Follows existing goal-review pattern with React Context API
13. ⚠️ **Badge counter contexts**: Need to implement `SelfAssessmentReviewContext` (supervisor) - **Not yet implemented**

---

## References

- **API Contract**: [api-contract.md](./api-contract.md)
- **Backend Schema**: `backend/app/schemas/self_assessment.py`
- **Backend Model**: `backend/app/database/models/self_assessment.py`
- **Frontend Types**: `frontend/src/api/types/self-assessment.ts`
- **Backend Service**: `backend/app/services/self_assessment_service.py`
- **Backend Repository**: `backend/app/database/repositories/self_assessment_repo.py`
- **Related**: Goal model (`backend/app/database/models/goal.py`)

---

**Next Steps**:
1. ✅ Review this domain model with product/business team
2. ⏭️ Answer open questions (Section 6)
3. ⏭️ Validate assumptions (Section 7)
4. ⏭️ Proceed to API Contract Definition (#415)
