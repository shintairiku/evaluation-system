# Requirements Document: Competency Display Order Standardization

## 1. Overview

This document defines the requirements for implementing a standardized display order for competencies across the HR evaluation system. The feature ensures consistent, predictable presentation of competencies by introducing a `display_order` field to replace the current alphabetical ordering.

**Problem Statement:**
- Competencies currently display in alphabetical order by name
- Order varies unpredictably across different stages
- Users cannot find competencies quickly or intuitively
- Inconsistent presentation reduces evaluation quality
- No logical grouping or pattern exists

**Target Users:**
- **Primary**: Employees filling out evaluations/goals
- **Secondary**: Supervisors reviewing evaluations
- **Tertiary**: Administrators managing competency data

**Business Value:**
- **Consistency**: Same competency type always appears in same position
- **Efficiency**: ~10% faster evaluation completion time
- **Usability**: Predictable, logical ordering reduces cognitive load
- **Quality**: Better evaluation quality through improved navigation
- **Scalability**: Foundation for future UI enhancements (grouping, categories)

**Scope:**
- ✅ Add `display_order` field to competencies table
- ✅ Update all 54 existing competencies with display order (9 stages × 6 competencies)
- ✅ Modify backend to order by display_order instead of name
- ✅ Update TypeScript types to include displayOrder field
- ❌ **NOT in scope**: Admin UI for reordering (future enhancement)
- ❌ **NOT in scope**: Category labels or grouping (see Option 1 analysis)
- ❌ **NOT in scope**: Frontend UI changes (only type updates)

---

## 2. Functional Requirements

### 2.1 Display Order Pattern

**FR-1: Standardized 6-Position Pattern**
- **Requirement**: All stages must follow the same 6-position display order pattern
- **Rationale**: Provides predictable, intuitive navigation across all career stages
- **Pattern**:
  1. Philosophy/Company Values (理念関連)
  2. Work Attitude/Goal Achievement (仕事の姿勢/目標達成)
  3. Mindset/Thinking Skills (考え方/思考力)
  4. Skills/Execution Ability (スキル/実行力)
  5. Growth Activities/Productivity (成長活動/生産性)
  6. Management/Talent Development (マネジメント/人材育成)

**FR-2: Competency-to-Order Mapping**
- **Requirement**: Each competency must be assigned a display_order value (1-6)
- **Validation**:
  - display_order must be an integer
  - display_order must be between 1 and 6 (inclusive)
  - Each stage should have exactly 6 competencies with unique display_order values

**FR-3: Stage-Specific Examples**

| Stage | Order 1 | Order 2 | Order 3 | Order 4 | Order 5 | Order 6 |
|-------|---------|---------|---------|---------|---------|---------|
| Stage 1 | 理念理解 | 積極性 | ストレスコントロール | 伝達力 | 興味・好奇心 | 自己管理 |
| Stage 2 | 理念共感 | 誠実な対応 | タフさ | 品質基準のクリア | 成長意欲 | 他者へのサポート |
| Stage 3 | 理念の浸透/習得 | 顧客との信頼構築 | 粘り強さ | スペシャリティ | 情報の活用と共有化 | チームワークの率先 |
| Stage 4 | 理念の発信 | 目標達成へのコミット（小チーム） | 他者受容 | ゼロベース思考 | 生産性向上 | チームマネジメント |
| Stage 5 | 理念体現 | 目標達成へのコミット（複数チーム） | システム思考 | 企画力 | チームの生産性向上 | 人材育成 |
| Stage 6 | 理念体現の手本 | 目標達成へのコミット（部門） | プロフィット | 企画実行力 | 部門の生産性向上 | 部門の士気向上 |
| Stage 7 | 理念体現の支援 | 目標達成へのコミット | ファイナンシャル思考 | ビジネスモデル構築力 | 組織の制度設計 | 自主性発揮の支援 |
| Stage 8 | 理念の伝播 | 目標達成へのコミット（全社） | 事業創出 | ビジョンを実現する戦略策定 | グローバル視点 | マネジメント人材の育成 |
| Stage 9 | 理念体現の象徴 | 目標達成へのコミット（グループ） | 投資思考 | グループビジョンを実現する戦略策定 | グローバル構築 | 後継者の育成 |

---

### 2.2 Backend Requirements

**FR-4: Database Schema**
- **Requirement**: Add `display_order` column to competencies table
- **Specification**:
  ```sql
  ALTER TABLE competencies ADD COLUMN display_order INTEGER;
  CREATE INDEX idx_competencies_display_order ON competencies(display_order);
  ```
- **Constraints**:
  - Column type: INTEGER
  - Nullable: Yes (for backward compatibility during migration)
  - Default: NULL (will be set by seed script)
  - Index: Yes (for query performance)

**FR-5: Data Migration**
- **Requirement**: All existing competencies must have display_order values set
- **Specification**:
  - Update all 54 competencies (9 stages × 6 competencies per stage)
  - For Organization 1 (org_32a4qh6ZhszNNK1kW1xyNgYimhZ): 54 competencies
  - For Organization 2 (org_32lvjKZKHDCKVmRhMhNx4mfP3c5): 54 competencies
  - Total: 108 competencies to update
- **Approach**: Create seed script to update display_order based on competency name

**FR-6: Repository Ordering**
- **Requirement**: CompetencyRepository must order results by display_order
- **Current Behavior**: `.order_by(Competency.name)` (alphabetical)
- **New Behavior**: `.order_by(Competency.display_order, Competency.name)` (display_order primary, name fallback)
- **Affected Methods**:
  - `get_by_stage_id()` - Line 104
  - `get_all()` - Line 117
  - `search()` - Line 143

**FR-7: Backend Model Update**
- **Requirement**: Competency SQLAlchemy model must include display_order field
- **Specification**:
  ```python
  # File: backend/app/database/models/stage_competency.py
  class Competency(Base):
      # ... existing fields ...
      display_order = Column(Integer, nullable=True)
  ```

---

### 2.3 Frontend Requirements

**FR-8: TypeScript Type Definition**
- **Requirement**: Competency interface must include displayOrder field
- **Current Definition** (frontend/src/api/types/competency.ts):
  ```typescript
  export interface Competency {
    id: UUID;
    name: string;
    description?: CompetencyDescription;
    stageId: UUID;
    createdAt: string;
    updatedAt: string;
  }
  ```
- **New Definition**:
  ```typescript
  export interface Competency {
    id: UUID;
    name: string;
    description?: CompetencyDescription;
    stageId: UUID;
    displayOrder?: number;  // NEW: Optional for backward compatibility
    createdAt: string;
    updatedAt: string;
  }
  ```

**FR-9: No UI Changes Required**
- **Requirement**: Frontend UI does not need modification
- **Rationale**:
  - Ordering is handled by backend
  - Frontend simply displays competencies in received order
  - No re-sorting or custom logic needed in frontend
- **Verification**: Existing components should work without changes

**FR-10: Remove Static JSON Dependency (Optional)**
- **Current State**: `stage1-competencies.json` used in ConfirmationStep
- **Recommendation**: Replace with API call for consistency
- **Priority**: Low (not critical for this task)
- **Future Work**: Refactor ConfirmationStep to use API instead of static JSON

---

## 3. Non-Functional Requirements

### 3.1 Performance

**NFR-1: Query Performance**
- **Requirement**: Adding display_order must not degrade query performance
- **Specification**:
  - Display_order must be indexed
  - Queries should complete in < 100ms for typical dataset (500 competencies)
  - No N+1 query issues introduced

**NFR-2: Migration Performance**
- **Requirement**: Migration and seed scripts must complete quickly
- **Specification**:
  - Migration (ALTER TABLE): < 5 seconds
  - Seed script (UPDATE 108 rows): < 2 seconds
  - Total downtime: < 10 seconds

---

### 3.2 Data Integrity

**NFR-3: Data Consistency**
- **Requirement**: All competencies must have valid display_order after migration
- **Validation**:
  - No NULL display_order values after seed script completes
  - All display_order values are between 1 and 6
  - Each stage has exactly 6 competencies with display_order 1-6

**NFR-4: Backward Compatibility**
- **Requirement**: System must function during migration process
- **Approach**:
  - Column is nullable during migration
  - Repository orders by display_order if present, falls back to name
  - Frontend displayOrder is optional (TypeScript `?:`)

---

### 3.3 Maintainability

**NFR-5: Seed Data Documentation**
- **Requirement**: Display order mapping must be documented
- **Location**: In seed script comments
- **Content**: Mapping table showing competency name → display_order for each stage

**NFR-6: Future Extensibility**
- **Requirement**: Design must support future enhancements
- **Considerations**:
  - Admin UI for reordering (future)
  - Category labels (Option 1 - future)
  - Custom ordering per organization (future)

---

## 4. Constraints and Assumptions

### 4.1 Constraints

**C-1: Fixed Competency Count**
- Each stage has exactly 6 competencies
- Display order values are 1, 2, 3, 4, 5, 6
- No duplicate display_order values within a stage

**C-2: Two Organizations**
- System currently has 2 organizations
- Both organizations follow same 9-stage, 6-competency-per-stage structure
- Both must have display_order values set

**C-3: No Breaking Changes**
- Existing API responses must remain valid
- Frontend must work with or without displayOrder field
- Migration must be reversible (rollback plan)

---

### 4.2 Assumptions

**A-1: Competency Names are Stable**
- Competency names will not change during migration
- Name-based mapping in seed script is reliable

**A-2: Single Display Order Pattern**
- All stages follow the same 6-position pattern
- No stage-specific ordering exceptions needed

**A-3: No Custom Competencies Yet**
- All competencies are from seed data
- No user-created custom competencies exist

---

## 5. Out of Scope

The following features are explicitly **NOT** included in this implementation:

**OS-1: Admin Reordering UI**
- Drag-and-drop interface for changing display order
- **Reason**: Not needed for current requirements
- **Future Work**: Separate task/issue

**OS-2: Category Labels**
- Adding `category_label` field (Option 1 from analysis)
- Visual grouping by category in UI
- **Reason**: Not currently used in UI, follows YAGNI principle
- **Future Work**: Can be added later if needed

**OS-3: Frontend UI Redesign**
- Accordion grouping by category
- Visual separators or headers
- **Reason**: Current UI works fine with consistent ordering
- **Future Work**: Separate UX enhancement task

**OS-4: Competency Templates**
- Predefined competency sets for new organizations
- Bulk import/export of competencies
- **Reason**: Out of scope for this feature
- **Future Work**: Separate administration feature

**OS-5: API Versioning**
- Creating v2 API with breaking changes
- **Reason**: Changes are backward compatible
- **Approach**: Extend existing API with optional field

---

## 6. Success Criteria

### 6.1 Functional Success

- ✅ All 108 competencies have display_order values set (54 per org × 2 orgs)
- ✅ Backend returns competencies ordered by display_order
- ✅ Order is consistent across all API endpoints
- ✅ TypeScript types include displayOrder field
- ✅ No errors or warnings in logs

### 6.2 User Experience Success

- ✅ Competencies display in same order on all screens
- ✅ Philosophy-related competency always appears first
- ✅ Management-related competency always appears last
- ✅ Users can navigate competencies predictably
- ✅ No user confusion or complaints

### 6.3 Technical Success

- ✅ Migration completes without errors
- ✅ Seed script updates all competencies correctly
- ✅ Query performance remains acceptable (< 100ms)
- ✅ No N+1 queries introduced
- ✅ Tests pass (if applicable)
- ✅ Code review approved

---

## 7. Acceptance Testing

### 7.1 Database Verification

```sql
-- Test 1: Check all competencies have display_order
SELECT COUNT(*) FROM competencies WHERE display_order IS NULL;
-- Expected: 0

-- Test 2: Check display_order range
SELECT MIN(display_order), MAX(display_order) FROM competencies;
-- Expected: MIN=1, MAX=6

-- Test 3: Check each stage has 6 competencies with orders 1-6
SELECT stage_id, COUNT(*), array_agg(display_order ORDER BY display_order)
FROM competencies
GROUP BY stage_id;
-- Expected: Each stage has count=6, array=[1,2,3,4,5,6]
```

### 7.2 API Testing

```bash
# Test 1: Get competencies for Stage 1
curl -X GET "http://localhost:8000/api/org/{org_slug}/competencies?stageId={stage1_id}" \
  -H "Authorization: Bearer {token}"
# Expected: Competencies ordered by display_order (1,2,3,4,5,6)

# Test 2: Get all competencies
curl -X GET "http://localhost:8000/api/org/{org_slug}/competencies" \
  -H "Authorization: Bearer {token}"
# Expected: All competencies returned, ordered by display_order within each stage
```

### 7.3 Frontend Verification

1. Open goal input page
2. Navigate to competency selection step
3. Verify competencies appear in order: 理念理解 → 積極性 → ストレスコントロール → 伝達力 → 興味・好奇心 → 自己管理
4. Repeat for different stages
5. Verify order is consistent

---

## 8. Dependencies

### 8.1 Technical Dependencies

- PostgreSQL database (existing)
- SQLAlchemy ORM (existing)
- FastAPI backend (existing)
- TypeScript frontend (existing)

### 8.2 Data Dependencies

- Competency seed data (`002_competencies_data_org1.sql`, `002_competencies_data_org2.sql`)
- Stage seed data (`001_essential_data.sql`)
- Organization data (2 organizations exist)

### 8.3 Team Dependencies

- Database migration approval
- Code review by backend lead
- QA testing after deployment

---

## 9. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Migration fails mid-execution | HIGH | LOW | Test on staging first, create rollback script |
| Display order conflicts with existing data | MEDIUM | LOW | Validate seed data before deployment |
| Performance degradation | MEDIUM | LOW | Add index, test with large dataset |
| Frontend breaks without displayOrder | LOW | LOW | Make field optional in TypeScript |
| Incorrect ordering in seed script | MEDIUM | MEDIUM | Peer review, manual verification |

---

## 10. Timeline and Milestones

**Total Estimated Time**: 4-6 hours

| Milestone | Tasks | Time | Deliverable |
|-----------|-------|------|-------------|
| **Backend Schema** | Migration + seed script | 1.5h | SQL files |
| **Backend Code** | Model + repository updates | 1h | Python code |
| **Frontend Types** | TypeScript updates | 0.5h | Type definitions |
| **Testing** | Manual + automated tests | 1h | Test results |
| **Documentation** | Update specs, comments | 0.5h | Documentation |
| **Deployment** | Staging + production | 0.5h | Deployed feature |

---

## 11. References

- GitHub Issue: [#306](https://github.com/shintairiku/evaluation-system/issues/306)
- ISSUE.md: `.kiro/specs/competency-display-order/ISSUE.md`
- Design Doc: `.kiro/specs/competency-display-order/design.md`
- Tasks Doc: `.kiro/specs/competency-display-order/tasks.md`
- Competency Seed File: `backend/app/database/migrations/seeds/002_competencies_data_org1.sql`
- Competency Model: `backend/app/database/models/stage_competency.py`
- Competency Repository: `backend/app/database/repositories/competency_repo.py`
- TypeScript Types: `frontend/src/api/types/competency.ts`
