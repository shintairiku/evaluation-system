# [TASK-07] Competency Display Order Standardization (コンピテンシー表示順序の標準化)

## 📋 Overview

Implement a standardized display order for competencies to ensure consistent presentation across all system screens. Currently, competencies are displayed in alphabetical order by name, causing inconsistent and confusing user experience. This feature adds a `display_order` field to maintain a fixed, logical ordering pattern.

**Scope**: Database schema update, backend ordering logic, and frontend type updates

**Related Specifications**:
- Requirements: `.kiro/specs/competency-display-order/requirements.md`
- Design: `.kiro/specs/competency-display-order/design.md`
- Tasks: `.kiro/specs/competency-display-order/tasks.md`

**GitHub Issue**: [#306](https://github.com/shintairiku/evaluation-system/issues/306)

---

## 🎯 Problem Statement

**Current Behavior:**
- Competencies are ordered alphabetically by `name` field
- Display order varies randomly as competency names differ across stages
- Example Stage 1 current order: "ストレスコントロール" → "伝達力" → "理念理解" → "積極性" → "興味・好奇心" → "自己管理"
- Users cannot predict where to find specific competency types
- Inconsistent ordering reduces evaluation readability

**Issues:**
1. **Inconsistent Presentation**: Same competency category appears in different positions across stages
2. **Reduced Readability**: Evaluators waste time searching for specific competencies
3. **User Confusion**: No logical grouping or predictable pattern
4. **Navigation Difficulty**: Hard to locate desired competencies quickly

**Business Impact:**
- ⏱️ Increased evaluation completion time (~10-15% slower)
- 😕 User complaints about confusing competency order
- 📉 Reduced evaluation quality due to rushed reviews
- 🎯 Missed competency categories during evaluation

---

## 🎯 Desired Solution

**Standardized Display Order (1-6):**

All 9 stages follow the same logical pattern based on competency type:

| Order | Category Type | Stage 1 Example | Stage 5 Example |
|-------|---------------|-----------------|-----------------|
| 1 | **Philosophy/Company Values** | 理念理解 | 理念体現 |
| 2 | **Work Attitude/Goal Achievement** | 積極性 | 目標達成へのコミット（複数チーム） |
| 3 | **Mindset/Thinking Skills** | ストレスコントロール | システム思考（標準化への取り組み） |
| 4 | **Skills/Execution Ability** | 伝達力（コミュニケーション力） | 企画力 |
| 5 | **Growth Activities/Productivity** | 興味・好奇心 | チームの生産性向上 |
| 6 | **Management/Talent Development** | 自己管理（セルフマネジメント初級） | 人材育成 |

**Expected Behavior:**
- ✅ Competencies always display in order 1→2→3→4→5→6
- ✅ Same category type always appears in same position (e.g., Philosophy is always #1)
- ✅ Consistent across all screens: goal input, evaluation, reports, admin views
- ✅ Independent of competency name (ordered by `display_order` field)

---

## ✅ Acceptance Criteria

### AC-1: Database Schema Updated
```gherkin
GIVEN the competencies table exists
WHEN I check the table schema
THEN the table has a `display_order` INTEGER column
AND all existing competencies have display_order values set (1-6)
AND display_order is indexed for performance
```

### AC-2: Backend Orders by Display Order
```gherkin
GIVEN I call GET /api/org/{org_slug}/competencies?stageId={stage1_id}
WHEN the response is returned
THEN competencies are ordered by display_order ASC
AND the first competency has display_order = 1
AND the last competency has display_order = 6
```

### AC-3: Consistent Ordering Across All Screens
```gherkin
GIVEN I view competencies on the goal input screen
WHEN the competencies are loaded
THEN they appear in order 1, 2, 3, 4, 5, 6

GIVEN I view competencies on the evaluation screen
WHEN the competencies are loaded
THEN they appear in the same order 1, 2, 3, 4, 5, 6

GIVEN I view competencies on the admin management screen
WHEN the competencies are loaded
THEN they appear in the same order 1, 2, 3, 4, 5, 6
```

### AC-4: All 9 Stages Have Correct Order
```gherkin
GIVEN there are 9 stages in the system
WHEN I fetch competencies for each stage
THEN each stage has exactly 6 competencies
AND each competency set is ordered 1, 2, 3, 4, 5, 6
AND Philosophy-related competency is always #1
AND Management-related competency is always #6
```

### AC-5: Frontend Types Updated
```gherkin
GIVEN the Competency TypeScript interface
WHEN I check the interface definition
THEN it includes an optional displayOrder?: number field
AND the field is properly camelCased (not snake_case)
```

---

## 📊 Success Metrics

**User Experience:**
- 🎯 100% consistent competency order across all screens
- ⏱️ ~10% reduction in evaluation completion time
- 😊 Zero user complaints about competency ordering
- 📈 Improved evaluation quality scores

**Technical:**
- ✅ All 54 competencies (9 stages × 6) have display_order set
- ✅ All API endpoints return ordered competencies
- ✅ No N+1 query issues (display_order indexed)
- ✅ Backward compatible (display_order is optional in TypeScript)

---

## 🔄 Related Work

**Similar Features:**
- Role hierarchy order (`roles.hierarchy_order` field)
- Stage progression order (implicit in stage IDs)

**Future Enhancements (Out of Scope):**
- Admin UI to reorder competencies via drag-and-drop
- Category labels for visual grouping (see Option 1 in analysis)
- Competency templates for new organizations

---

## 📝 Notes

**Why Option 2 (Display Order Only)?**
- Solves the immediate problem (consistent ordering)
- Minimal complexity (1 field vs 2)
- Follows YAGNI principle (category labels not currently used in UI)
- Can add category labels later if needed

**Implementation Approach:**
- Add `display_order` column to competencies table
- Update all 54 existing competencies with correct order
- Modify repository to ORDER BY display_order
- Update TypeScript types to include displayOrder field
- No frontend UI changes required (just type updates)

**Migration Strategy:**
- Non-breaking: display_order is nullable initially
- Seed data: Set all display_order values immediately after migration
- Index: Add for query performance
- Backward compatible: Frontend displayOrder is optional

---

## 🔗 References

- GitHub Issue: https://github.com/shintairiku/evaluation-system/issues/306
- Design Analysis: Decision between Option 1 (order + category) vs Option 2 (order only)
- Competency Seed Data: `backend/app/database/migrations/seeds/002_competencies_data_org1.sql`
- Stage Seed Data: `backend/app/database/migrations/seeds/001_essential_data.sql`
