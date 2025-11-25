# Code Analysis Report: Self-Assessment & Self-Assessment-Review Features

## Summary
This report identifies duplicated code, unused code, and refactoring opportunities across the self-assessment and self-assessment-review features in both frontend and backend.

---

## 1. DUPLICATED CODE

### Frontend Duplicates

#### 1.1 Duplicate `formatDate` Function
**Files Affected:**
- `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/employee/self-assessment/components/PendingReviewCard/index.tsx` (lines 40-50)
- `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/employee/self-assessment/components/ApprovedSummaryCard/index.tsx` (lines 14-24)
- `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/employee/self-assessment/components/RejectionFeedbackCard/index.tsx` (lines 58-68)

**Issue:** The `formatDate` function is implemented identically in three components:
```tsx
const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
```

**Priority:** HIGH
**Suggested Refactoring:**
- Create a shared utility function at `/src/utils/dateFormatters.ts` or `/src/hooks/useDateFormatters.ts`
- Export as `formatDateJP` and import in all three components
- This eliminates 30 lines of duplication and improves maintainability

---

#### 1.2 Duplicate `bucketLabels` Object
**Files Affected:**
- `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/superviser/self-assessment-review/display/index.tsx` (lines 20-23) as `BUCKET_LABELS`
- `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/employee/self-assessment/components/RejectionFeedbackCard/index.tsx` (lines 70-74) as `bucketLabels`
- `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/employee/self-assessment/components/PendingReviewCard/index.tsx` (lines 89-93) as `bucketLabels`

**Issue:** Three different implementations of the same label mapping:
```tsx
// SelfAssessmentReviewPage
const BUCKET_LABELS = {
  performance: '目標達成(定量＋定性)',
  competency: 'コンピテンシー',
};

// RejectionFeedbackCard & PendingReviewCard
const bucketLabels: Record<string, string> = {
  quantitative: '定量目標',
  qualitative: '定性目標',
  competency: 'コンピテンシー'
};
```

**Priority:** HIGH
**Suggested Refactoring:**
- Create a centralized constant file: `/src/constants/bucketLabels.ts`
- Define both mappings (performance/competency and quantitative/qualitative/competency)
- Consider creating a utility function to convert between mapping types
- This improves consistency and makes it easier to update labels globally

---

#### 1.3 Duplicate `RATING_OPTIONS` Array
**Files Affected:**
- `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/employee/self-assessment/display/SelfAssessmentPage.tsx` (lines 44-53)
- `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/superviser/self-assessment-review/components/BucketReviewCard.tsx` (lines 26-35)

**Issue:** Rating options are defined identically in two places:
```tsx
const ratingOptions = [
  { value: 'SS', label: 'SS - 卓越 (Outstanding)' },
  { value: 'S', label: 'S - 優秀 (Excellent)' },
  // ... 6 more options
];
```

**Priority:** HIGH
**Suggested Refactoring:**
- Move to `/src/constants/ratingOptions.ts`
- Import as `RATING_OPTIONS` in both files
- This reduces duplication and ensures rating consistency

---

### Backend Duplicates

#### 1.4 Duplicate Helper Functions in `SelfAssessmentService`
**File:** `/Users/reiminagao/新大陸/evaluation-system/backend/app/services/self_assessment_service.py`

**Issue:** The `_get()` helper function is defined THREE times:
- Lines 229-238 (in `save_draft`)
- Lines 264-273 (in `submit`)
- Lines 319-328 (in `submit`, again)

```python
def _get(entry, *keys):
    if isinstance(entry, dict):
        for key in keys:
            if key in entry:
                return entry.get(key)
        return None
    for key in keys:
        if hasattr(entry, key):
            return getattr(entry, key)
    return None
```

**Priority:** HIGH
**Suggested Refactoring:**
- Move `_get()` to a class-level private method (already exists as helper, but duplicated locally)
- Create as `self._get_entry_value(entry, *keys)` at class level
- Reuse in all three locations
- This eliminates 30 lines of duplication

---

#### 1.5 Duplicate Bucket Comment/Rating Map Building
**File:** `/Users/reiminagao/新大陸/evaluation-system/backend/app/services/self_assessment_service.py`

**Issues:**
1. **In `get_self_assessment_context` method (lines 156-174):** Manually building comment and rating maps from supervisor feedback
```python
supervisor_comment_map = self._build_bucket_comment_map(latest_feedback)
supervisor_rating_map = self._build_bucket_rating_map(latest_feedback)
```

2. **Actual helper methods (lines 1072-1094):** 
   - `_build_bucket_comment_map()` (lines 1072-1082)
   - `_build_bucket_rating_map()` (lines 1084-1094)

3. **Similar logic in supervisor feedback update (lines 965-992):** Manually extracting bucket data within `_auto_create_supervisor_feedback_for_summary`

**Priority:** MEDIUM
**Suggested Refactoring:**
- Consolidate bucket data extraction logic
- Create a unified method: `_extract_bucket_data_from_feedback(feedback)` that returns all bucket data at once
- This reduces redundant iteration over bucket arrays

---

#### 1.6 Duplicate Bucket Decision Updates
**Files Affected:**
- `self_assessment_service.py` lines 965-992 (in `_auto_create_supervisor_feedback_for_summary`)
- `supervisor_feedback_service.py` lines 584-594 (in `update_bucket_decisions`)

**Issue:** Both files have similar logic for building/updating bucket decision JSON structures:
```python
# In self_assessment_service.py
bucket_decisions_json.append({
    "bucket": "performance",
    "employeeWeight": round(perf_weight, 2),
    "employeeContribution": round(perf_contrib, 2),
    "employeeRating": final_rating,
    "status": "pending",
    "supervisorRating": None,
    "comment": None
})

# In supervisor_feedback_service.py
bucket_decisions_json.append({
    "bucket": bd.bucket,
    "employeeWeight": bd.employee_weight,
    "employeeContribution": bd.employee_contribution,
    "employeeRating": bd.employee_rating,
    "status": bd.status,
    "supervisorRating": bd.supervisor_rating,
    "comment": bd.comment
})
```

**Priority:** MEDIUM
**Suggested Refactoring:**
- Create a shared utility module: `/app/services/bucket_decision_utils.py`
- Implement `BucketDecisionBuilder` class or factory functions
- Use in both services to eliminate duplication

---

## 2. UNUSED CODE

### Frontend Unused Code

#### 2.1 Unused State Variable in SelfAssessmentPage
**File:** `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/employee/self-assessment/display/SelfAssessmentPage.tsx`

**Issue:** Line 205 defines `entries` state but the normalization logic suggests it might be overwritten
```tsx
const [entries, setEntries] = useState<DraftEntryState[]>([]);
```

**Analysis:** The state is used and essential. No unused code here, but the initialization pattern could be cleaner.

**Priority:** LOW

---

#### 2.2 Unused Variable in ApprovedSummaryCard
**File:** `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/employee/self-assessment/components/ApprovedSummaryCard/index.tsx`

**Issue:** Lines 59-86 show logic for building `displayBuckets` but the structure is complex and may have unused branches.

**Analysis:** All branches appear to be used. Code is working as intended but could be simplified.

**Priority:** LOW

---

### Backend Unused Code

#### 2.3 Unused Method in SelfAssessmentService
**File:** `/Users/reiminagao/新大陸/evaluation-system/backend/app/services/self_assessment_service.py`

**Issue:** Line 127 has `get_current_context` which is a simple wrapper:
```python
async def get_current_context(self, current_user_context: AuthContext):
    return await self.get_self_assessment_context(current_user_context)
```

**Analysis:** This wrapper appears redundant. Check if it's used in endpoints or if direct calls to `get_self_assessment_context` are preferred.

**Priority:** LOW
**Action:** Check API endpoints to see if this is actively used; if not, remove it.

---

#### 2.4 Unused Local Variables in Bucket Decision Logic
**File:** `/Users/reiminagao/新大陸/evaluation-system/backend/app/services/supervisor_feedback_service.py`

**Issue:** Line 597 clones bucket decisions that might already be handled:
```python
bucket_decisions_json = self._clone_bucket_decisions(existing_feedback.bucket_decisions)
```

**Analysis:** Used in the else clause when bucket_decisions_data is not provided. This is appropriate defensive programming.

**Priority:** LOW

---

## 3. REFACTORING OPPORTUNITIES

### 3.1 Complex Nested Data Normalization
**File:** `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/employee/self-assessment/display/SelfAssessmentPage.tsx`

**Issue:** Lines 248-258 normalize draft entries with multiple fallback options
```tsx
const normalizedDraft = (result.data.draft ?? [])
  .map(entry => ({
    goalId: `${entry.goalId ?? entry.goal_id ?? entry.goalid ?? ''}`,
    bucket: entry.bucket,
    ratingCode: entry.ratingCode ?? entry.rating_code,
    comment: entry.comment ?? '',
    previousSelfAssessmentId: entry.previousSelfAssessmentId ?? entry.previous_self_assessment_id ?? null,
    supervisorComment: entry.supervisorComment ?? entry.supervisor_comment ?? null,
  }))
```

**Priority:** MEDIUM
**Suggested Refactoring:**
- Create a utility function `normalizeDraftEntry()` in `/src/utils/draftNormalizers.ts`
- Encapsulates the snake_case/camelCase fallback logic
- Makes it testable and reusable
- Reduces component complexity

---

### 3.2 Magic Timeout Values
**File:** `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/superviser/self-assessment-review/components/BucketReviewCard.tsx`

**Issues:**
- Line 86: `}, 1500)` - 1.5 second debounce
- Lines 78, 116: `}, 3000)` - 3 second timeout

**Priority:** MEDIUM
**Suggested Refactoring:**
- Create constants at top of file:
```tsx
const AUTO_SAVE_DEBOUNCE_MS = 1500;
const AUTO_SAVE_INDICATOR_DURATION_MS = 3000;
```
- Document the intent (debounce for user input, indicator timeout for feedback)
- Makes values easily adjustable and self-documenting

---

### 3.3 Large Component with Multiple Concerns
**File:** `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/employee/self-assessment/display/SelfAssessmentPage.tsx`

**Issues:**
- 860 lines in a single file
- Handles: state management, data loading, form handling, validation, submission, period switching
- Complex nested JSX with `GoalDetailsCard` component defined inline

**Priority:** MEDIUM
**Suggested Refactoring:**
1. Extract `GoalDetailsCard` to its own file: `/src/feature/evaluation/employee/self-assessment/components/GoalDetailsCard/index.tsx`
2. Create separate hook for period management: `/src/feature/evaluation/employee/self-assessment/hooks/usePeriodManagement.ts`
3. Extract bucket rating/comment logic into custom hook
4. Break JSX into smaller sub-components (BucketSection, RatingSection, CommentSection)
5. This reduces main component to ~400-500 lines and improves testability

---

### 3.4 Repetitive Bucket Section UI
**File:** `/Users/reiminagao/新大陸/evaluation-system/frontend/src/feature/evaluation/employee/self-assessment/display/SelfAssessmentPage.tsx`

**Issues:**
- Lines 646-722: Performance bucket section
- Lines 725-801: Competency bucket section
- Nearly identical structure with only category name differences

**Priority:** MEDIUM
**Suggested Refactoring:**
- Create reusable `BucketSection` component:
```tsx
<BucketSection
  category={performanceCategory}
  goals={context.goals.filter(...)}
  weight={stageWeights.quantitative + stageWeights.qualitative}
  rating={bucketRatings[performanceCategory]}
  onRatingChange={applyBucketRating}
  comment={bucketComments[performanceCategory]}
  onCommentChange={applyBucketComment}
  readOnly={readOnly}
/>
```
- Reduces duplication by ~150 lines

---

### 3.5 Inconsistent String Constants
**File:** Multiple frontend files

**Issues:**
- "業績" (performance) vs "業績目標" used interchangeably
- "コンピテンシー" used in multiple spellings
- Status strings ('draft', 'submitted', 'pending', 'approved', 'rejected') scattered throughout

**Priority:** MEDIUM
**Suggested Refactoring:**
- Create enum-like constants: `/src/constants/evaluationTerms.ts`
```tsx
export const EVALUATION_TERMS = {
  PERFORMANCE: '目標達成(定量＋定性)',
  PERFORMANCE_GOAL: '業績目標',
  QUANTITATIVE: '定量目標',
  QUALITATIVE: '定性目標',
  COMPETENCY: 'コンピテンシー',
  CORE_VALUES: 'コアバリュー',
} as const;

export const STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
```
- Use throughout codebase for consistency

---

### 3.6 Inline Helper Functions in Large Services
**File:** `/Users/reiminagao/新大陸/evaluation-system/backend/app/services/self_assessment_service.py`

**Issues:**
- `map_bucket_keys()` defined inline in `submit()` method (lines 330-344)
- Should be a class method for reusability

**Priority:** MEDIUM
**Suggested Refactoring:**
- Move to class method: `def _map_bucket_keys(self, raw_bucket: Optional[str]) -> List[str]:`
- Document the mapping rules clearly
- Reuse in `_auto_create_supervisor_feedback_for_summary()` if needed

---

### 3.7 Complex Conditional Logic for Review Status
**File:** `/Users/reiminagao/新大陸/evaluation-system/backend/app/services/self_assessment_service.py`

**Issues:**
- Lines 189-202 map supervisor feedback status to review status with manual if/elif chain
```python
review_status = None
if latest_feedback:
    if latest_feedback.status in ['draft', 'submitted']:
        review_status = 'pending'
    elif latest_feedback.status == 'approved':
        review_status = 'approved'
    elif latest_feedback.status == 'rejected':
        review_status = 'rejected'
```

**Priority:** LOW
**Suggested Refactoring:**
- Create a mapping dictionary:
```python
FEEDBACK_STATUS_TO_REVIEW_STATUS = {
    'draft': 'pending',
    'submitted': 'pending',
    'approved': 'approved',
    'rejected': 'rejected',
}
review_status = FEEDBACK_STATUS_TO_REVIEW_STATUS.get(latest_feedback.status) if latest_feedback else None
```

---

### 3.8 Duplicated Permission Checks
**File:** `/Users/reiminagao/新大陸/evaluation-system/backend/app/services/supervisor_feedback_service.py`

**Issues:**
- Lines 637-675: `_get_accessible_filters()` method
- Similar logic to `_validate_filtering_permissions()` at lines 676-712
- Both iterate over accessible users and validate access

**Priority:** MEDIUM
**Suggested Refactoring:**
- Consolidate into single method: `_validate_and_get_accessible_filters()`
- Returns both validated filters and permissions in one call
- Reduces redundant logic

---

### 3.9 Incomplete Schema Field Documentation
**File:** `/Users/reiminagao/新大陸/evaluation-system/backend/app/schemas/self_assessment_summary.py`

**Issues:**
- Lines 7-11: `BucketBreakdown` class uses "avgScore" alias but inconsistent with other fields
- No docstrings explaining field purposes

**Priority:** LOW
**Suggested Refactoring:**
- Add docstrings to all schema classes
- Document field purposes and valid value ranges
- Example:
```python
class BucketBreakdown(BaseModel):
    """Score breakdown for a single evaluation bucket"""
    bucket: str  # "quantitative", "qualitative", or "competency"
    weight: float  # Percentage weight (0-100)
    avg_score: float = Field(..., alias="avgScore")  # Average rating score
    contribution: float  # Contribution to final score
```

---

## 4. PRIORITY SUMMARY

### Critical (Should do immediately)
1. **Duplicate RATING_OPTIONS** - HIGH
2. **Duplicate formatDate function** - HIGH  
3. **Duplicate bucketLabels** - HIGH
4. **Duplicate _get() helper in SelfAssessmentService** - HIGH

### Important (Should do this sprint)
5. **Large SelfAssessmentPage component** - MEDIUM
6. **Repetitive bucket section UI** - MEDIUM
7. **Magic timeout values** - MEDIUM
8. **Inconsistent string constants** - MEDIUM
9. **Duplicate bucket decision building logic** - MEDIUM

### Nice to Have (Could do next)
10. **Complex data normalization** - MEDIUM
11. **Unused get_current_context wrapper** - LOW
12. **Complex conditional logic for review status** - LOW
13. **Incomplete schema documentation** - LOW

---

## 5. IMPLEMENTATION ROADMAP

**Phase 1 (High Priority - 2-3 hours):**
1. Extract `formatDate` to utility
2. Extract `RATING_OPTIONS` to constants
3. Consolidate `bucketLabels` 
4. Move `_get()` to class-level method

**Phase 2 (Medium Priority - 4-6 hours):**
1. Create `BucketSection` component
2. Extract constants file for evaluation terms
3. Add timeout value constants
4. Move `map_bucket_keys` to class method

**Phase 3 (Nice to Have - 6+ hours):**
1. Full refactor of SelfAssessmentPage
2. Complete schema documentation
3. Consolidate permission/filter logic
4. Add integration tests for refactored code

