# Implementation Tasks: Competency Display Order Standardization

## Overview

This document breaks down the implementation of standardized competency display ordering into concrete, actionable tasks. The feature adds a `display_order` field to ensure consistent presentation across all system interfaces.

**Goal:** Enable consistent, predictable competency ordering (1→6) across all screens

**Approach:**
- Database: Add display_order column + seed data
- Backend: Update model and repository ordering
- Frontend: Update TypeScript types only (no UI changes)
- Testing: Verify ordering consistency

**Estimated Total Time:** 4-6 hours

---

## Phase 1: Database Layer

### Task 1.1: Create Migration Script
**Estimated Time:** 30 minutes
**Assignee:** Backend Developer
**Dependencies:** None
**Priority:** HIGH
**Complexity:** Low

**Description:**
Create migration script to add `display_order` column and index to competencies table.

**Acceptance Criteria:**
- [ ] File created: `backend/app/database/migrations/production/008_add_display_order_to_competencies.sql`
- [ ] Migration adds `display_order INTEGER` column (nullable)
- [ ] Migration creates index `idx_competencies_display_order`
- [ ] Migration includes rollback statements in comments
- [ ] Column comment added for documentation
- [ ] Migration runs successfully via `run_migrations.py`

**Implementation Details:**

```sql
-- File: backend/app/database/migrations/production/008_add_display_order_to_competencies.sql

-- Add display_order column to competencies table
-- This enables standardized ordering across all stages

-- Add column (nullable for backward compatibility during migration)
ALTER TABLE competencies
ADD COLUMN display_order INTEGER;

-- Add index for query performance
CREATE INDEX idx_competencies_display_order
ON competencies(display_order);

-- Add comment for documentation
COMMENT ON COLUMN competencies.display_order IS
'Display order for competency within its stage (1-6). Determines presentation order in UI.';

-- Rollback:
-- DROP INDEX IF EXISTS idx_competencies_display_order;
-- ALTER TABLE competencies DROP COLUMN display_order;
```

**Verification:**

**Using run_migrations.py (Recommended):**
```bash
# Run migration using project's migration script
cd backend
python app/database/scripts/run_migrations.py

# Expected output:
# 🚀 Running migrations...
# 📝 Running migration: 008_add_display_order_to_competencies.sql
# ✅ Migration completed
```

**Manual verification (if needed):**
```bash
# Check column exists
psql $DATABASE_URL -c "\d competencies"

# Check index exists
psql $DATABASE_URL -c "\di idx_competencies_display_order"

# Check in schema_migrations table
psql $DATABASE_URL -c "SELECT * FROM schema_migrations WHERE filename = '008_add_display_order_to_competencies.sql';"
```

**Files to Create:**
- `backend/app/database/migrations/production/008_add_display_order_to_competencies.sql`

---

### Task 1.2: Create Seed Script
**Estimated Time:** 1 hour
**Assignee:** Backend Developer
**Dependencies:** Task 1.1 (migration must exist)
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Create seed script to populate `display_order` for all existing competencies (108 total: 54 per org × 2 orgs).

**Acceptance Criteria:**
- [ ] File created: `backend/app/database/migrations/seeds/007_update_competencies_display_order.sql`
- [ ] Updates all Stage 1-9 competencies for Organization 1
- [ ] Updates all Stage 1-9 competencies for Organization 2
- [ ] Total 108 UPDATE statements (9 stages × 6 competencies × 2 orgs)
- [ ] Includes verification query at end
- [ ] Includes mapping table in comments
- [ ] Script is idempotent (can run multiple times safely)
- [ ] Seed runs successfully via `run_migrations.py`

**Implementation Details:**

See design.md Section 4.1.2 for complete script template.

**Key Points:**
- Use competency `name` to identify which row to update
- Use `stage_id` to ensure correct stage context
- Pattern: Philosophy(1) → Attitude(2) → Mindset(3) → Skills(4) → Growth(5) → Management(6)

**Organization 1 Stage IDs:**
- Stage 1: `11111111-2222-3333-4444-555555555555`
- Stage 2: `22222222-3333-4444-5555-666666666666`
- Stage 3: `33333333-4444-5555-6666-777777777777`
- Stage 4: `44444444-4444-4444-4444-444444444444`
- Stage 5: `55555555-5555-5555-5555-555555555555`
- Stage 6: `66666666-6666-6666-6666-666666666666`
- Stage 7: `77777777-7777-7777-7777-777777777777`
- Stage 8: `88888888-8888-8888-8888-888888888888`
- Stage 9: `99999999-9999-9999-9999-999999999999`

**Organization 2 Stage IDs:** (Same pattern with 'a' prefix)
- Stage 1: `a1111111-2222-3333-4444-555555555555`
- ... (continues with 'a' prefix)

**Verification Query:**
```sql
-- Verify all competencies have display_order set
SELECT
    s.name as stage_name,
    c.display_order,
    c.name as competency_name,
    c.organization_id
FROM competencies c
JOIN stages s ON c.stage_id = s.id
ORDER BY c.organization_id, s.name, c.display_order;

-- Check for missing display_order
SELECT COUNT(*) FROM competencies WHERE display_order IS NULL;
-- Expected: 0

-- Verify each stage has orders 1-6
SELECT
    stage_id,
    array_agg(display_order ORDER BY display_order) as orders
FROM competencies
GROUP BY stage_id;
-- Expected: Each stage has [1,2,3,4,5,6]
```

**Verification:**

**Using run_migrations.py (Recommended):**
```bash
# Run all pending migrations (including seeds)
cd backend
python app/database/scripts/run_migrations.py

# Expected output:
# 📝 Running migration: 007_update_competencies_display_order.sql
# ✅ Migration completed
```

**Verify data:**
```bash
# Check all competencies have display_order
psql $DATABASE_URL -c "SELECT COUNT(*) as total, COUNT(display_order) as with_order FROM competencies;"
# Expected: total=108, with_order=108

# Check specific stage ordering
psql $DATABASE_URL -c "SELECT display_order, name FROM competencies WHERE stage_id = '11111111-2222-3333-4444-555555555555' ORDER BY display_order;"
# Expected: Returns 6 rows in order 1-6
```

**Files to Create:**
- `backend/app/database/migrations/seeds/007_update_competencies_display_order.sql`

---

## Phase 2: Backend Application Layer

### Task 2.1: Update Competency Model
**Estimated Time:** 15 minutes
**Assignee:** Backend Developer
**Dependencies:** Task 1.1 (migration must run first)
**Priority:** HIGH
**Complexity:** Low

**Description:**
Add `display_order` field to Competency SQLAlchemy model.

**Acceptance Criteria:**
- [ ] File updated: `backend/app/database/models/stage_competency.py`
- [ ] `display_order` field added to Competency class
- [ ] Field type is `Integer`
- [ ] Field is nullable (for backward compatibility)
- [ ] Import statement added if needed
- [ ] No breaking changes to existing fields

**Implementation Details:**

```python
# File: backend/app/database/models/stage_competency.py

from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID, JSONB
from sqlalchemy.orm import relationship

from .base import Base


class Competency(Base):
    __tablename__ = "competencies"

    id = Column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(50), ForeignKey("organizations.id"), nullable=False)
    stage_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("stages.id"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(JSONB)
    display_order = Column(Integer, nullable=True)  # NEW: Display order within stage (1-6)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    stage = relationship("Stage", back_populates="competencies")
```

**Changes:**
- Line 15: Add `display_order = Column(Integer, nullable=True)`
- Line 2: Ensure `Integer` is imported from `sqlalchemy`

**Verification:**
```python
# Test in Python console
from app.database.models.stage_competency import Competency
assert hasattr(Competency, 'display_order')
print("✓ display_order field exists")
```

**Files to Modify:**
- `backend/app/database/models/stage_competency.py`

---

### Task 2.2: Update CompetencyRepository Ordering
**Estimated Time:** 30 minutes
**Assignee:** Backend Developer
**Dependencies:** Task 2.1 (model must have display_order field)
**Priority:** HIGH
**Complexity:** Low

**Description:**
Update CompetencyRepository to order results by `display_order` instead of `name`.

**Acceptance Criteria:**
- [ ] File updated: `backend/app/database/repositories/competency_repo.py`
- [ ] Method `get_by_stage_id()` orders by display_order (Line ~104)
- [ ] Method `get_all()` orders by display_order (Line ~117)
- [ ] Method `search()` orders by display_order (Line ~143)
- [ ] Uses `.nullslast()` for graceful handling of NULL values
- [ ] Falls back to `name` ordering as secondary sort
- [ ] No breaking changes to method signatures

**Implementation Details:**

**Change 1: get_by_stage_id() - Line 99-110**

```python
async def get_by_stage_id(self, stage_id: UUID, org_id: str) -> list[Competency]:
    """Get all competencies for a specific stage within organization scope."""
    try:
        query = select(Competency).options(
            joinedload(Competency.stage)
        ).filter(Competency.stage_id == stage_id).order_by(
            Competency.display_order.nullslast(),  # NEW: Primary sort
            Competency.name                         # Fallback sort
        )
        query = self.apply_org_scope_direct(query, Competency.organization_id, org_id)
        result = await self.session.execute(query)
        return result.scalars().unique().all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching competencies for stage {stage_id} in org {org_id}: {e}")
        raise
```

**Change 2: get_all() - Line 112-123**

```python
async def get_all(self, org_id: str) -> list[Competency]:
    """Get all competencies with stage information within organization scope."""
    try:
        query = select(Competency).options(
            joinedload(Competency.stage)
        ).order_by(
            Competency.display_order.nullslast(),  # NEW: Primary sort
            Competency.name                         # Fallback sort
        )
        query = self.apply_org_scope_direct(query, Competency.organization_id, org_id)
        result = await self.session.execute(query)
        return result.scalars().unique().all()
    except SQLAlchemyError as e:
        logger.error(f"Error fetching all competencies for org {org_id}: {e}")
        raise
```

**Change 3: search() - Line 125-149**

```python
query = query.order_by(
    Competency.display_order.nullslast(),  # NEW: Primary sort
    Competency.name                         # Fallback sort
)
```

**Verification:**
```bash
# Start backend
cd backend
uvicorn app.main:app --reload

# Test API
curl -X GET "http://localhost:8000/api/org/{org_slug}/competencies?stageId={stage1_id}" \
  -H "Authorization: Bearer {token}" \
  | jq '.items | map({name, displayOrder})'

# Expected: displayOrder values are 1, 2, 3, 4, 5, 6
```

**Files to Modify:**
- `backend/app/database/repositories/competency_repo.py`

---

## Phase 3: Frontend Layer

### Task 3.1: Update TypeScript Interfaces
**Estimated Time:** 15 minutes
**Assignee:** Frontend Developer
**Dependencies:** None (can be done in parallel with backend)
**Priority:** MEDIUM
**Complexity:** Low

**Description:**
Add `displayOrder` field to Competency TypeScript interfaces.

**Acceptance Criteria:**
- [ ] File updated: `frontend/src/api/types/competency.ts`
- [ ] `displayOrder?: number` added to `Competency` interface
- [ ] `displayOrder?: number` added to `CompetencyCreate` interface
- [ ] `displayOrder?: number` added to `CompetencyUpdate` interface
- [ ] Field is optional (uses `?:`) for backward compatibility
- [ ] Field uses camelCase naming convention
- [ ] No breaking changes to existing types

**Implementation Details:**

```typescript
// File: frontend/src/api/types/competency.ts

import { UUID } from './common';
import type { UserDetailResponse } from './user';

/**
 * Competency type definitions
 * These types match the backend Pydantic schemas for Competency-related operations
 */

export interface CompetencyDescription {
  [key: string]: string; // Keys should be "1", "2", "3", "4", "5"
}

export interface Competency {
  id: UUID;
  name: string;
  description?: CompetencyDescription;
  stageId: UUID;
  displayOrder?: number;  // NEW: Optional display order (1-6)
  createdAt: string;
  updatedAt: string;
}

export interface CompetencyDetail extends Competency {
  users?: UserDetailResponse[];
}

export interface CompetencyCreate {
  name: string;
  description?: CompetencyDescription;
  stageId: UUID;
  displayOrder?: number;  // NEW: Optional for creation
}

export interface CompetencyUpdate {
  name?: string;
  description?: CompetencyDescription;
  stageId?: UUID;
  displayOrder?: number;  // NEW: Optional for updates
}
```

**Verification:**
```bash
# Type check
cd frontend
npm run type-check

# Expected: No TypeScript errors
```

**Files to Modify:**
- `frontend/src/api/types/competency.ts`

---

## Phase 4: Testing

### Task 4.1: Database Testing
**Estimated Time:** 30 minutes
**Assignee:** Backend Developer / QA
**Dependencies:** Tasks 1.1, 1.2 (migration and seed must run)
**Priority:** HIGH
**Complexity:** Low

**Description:**
Verify database schema and data integrity after migration and seed.

**Acceptance Criteria:**
- [ ] All competencies have `display_order` set (no NULL values)
- [ ] Display_order values are between 1 and 6
- [ ] Each stage has exactly 6 competencies
- [ ] Each stage has unique display_order values (1, 2, 3, 4, 5, 6)
- [ ] Index exists and is being used by queries
- [ ] Both organizations have correct data

**Test Queries:**

```sql
-- Test 1: Check all competencies have display_order
SELECT COUNT(*) as total, COUNT(display_order) as with_order
FROM competencies;
-- Expected: total=108, with_order=108

-- Test 2: Verify display_order range
SELECT MIN(display_order), MAX(display_order) FROM competencies;
-- Expected: MIN=1, MAX=6

-- Test 3: Check each stage has 6 competencies with orders 1-6
SELECT
    s.name as stage_name,
    COUNT(*) as count,
    array_agg(c.display_order ORDER BY c.display_order) as orders
FROM competencies c
JOIN stages s ON c.stage_id = s.id
GROUP BY s.id, s.name
ORDER BY s.name;
-- Expected: Each stage has count=6, orders=[1,2,3,4,5,6]

-- Test 4: Check for duplicates within stages
SELECT stage_id, display_order, COUNT(*)
FROM competencies
GROUP BY stage_id, display_order
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)

-- Test 5: Verify index is being used
EXPLAIN ANALYZE
SELECT * FROM competencies
WHERE stage_id = '11111111-2222-3333-4444-555555555555'
ORDER BY display_order, name;
-- Expected: Uses idx_competencies_display_order

-- Test 6: Verify specific ordering for Stage 1
SELECT display_order, name
FROM competencies
WHERE stage_id = '11111111-2222-3333-4444-555555555555'
ORDER BY display_order;
-- Expected:
-- 1 | 理念理解
-- 2 | 積極性
-- 3 | ストレスコントロール
-- 4 | 伝達力（コミュニケーション力）
-- 5 | 興味・好奇心
-- 6 | 自己管理（セルフマネジメント初級）
```

**Test Results Document:**
Create file: `.kiro/specs/competency-display-order/test-results.md`

---

### Task 4.2: Backend API Testing
**Estimated Time:** 30 minutes
**Assignee:** Backend Developer / QA
**Dependencies:** Tasks 2.1, 2.2 (backend code must be deployed)
**Priority:** HIGH
**Complexity:** Low

**Description:**
Test API endpoints return competencies in correct display_order.

**Acceptance Criteria:**
- [ ] GET `/competencies?stageId={stage1}` returns competencies ordered 1→6
- [ ] Order is consistent across multiple requests
- [ ] All 9 stages return correct order
- [ ] Response includes `displayOrder` field
- [ ] displayOrder values match expected pattern

**Test Cases:**

```bash
# Test 1: Get Stage 1 competencies
curl -X GET "http://localhost:8000/api/org/{org_slug}/competencies?stageId=11111111-2222-3333-4444-555555555555" \
  -H "Authorization: Bearer {token}" \
  | jq '.items | map({name, displayOrder})'

# Expected Output:
# [
#   { "name": "理念理解", "displayOrder": 1 },
#   { "name": "積極性", "displayOrder": 2 },
#   { "name": "ストレスコントロール", "displayOrder": 3 },
#   { "name": "伝達力（コミュニケーション力）", "displayOrder": 4 },
#   { "name": "興味・好奇心", "displayOrder": 5 },
#   { "name": "自己管理（セルフマネジメント初級）", "displayOrder": 6 }
# ]

# Test 2: Verify order array
curl ... | jq '.items | map(.displayOrder)'
# Expected: [1, 2, 3, 4, 5, 6]

# Test 3: Test all 9 stages (loop)
for stage_num in {1..9}; do
  echo "Testing Stage $stage_num"
  curl -X GET "http://localhost:8000/api/org/{org_slug}/competencies?stageId={stage_id}" \
    -H "Authorization: Bearer {token}" \
    | jq '.items | map(.displayOrder)'
done
# Expected: Each stage returns [1, 2, 3, 4, 5, 6]

# Test 4: Get all competencies (no filter)
curl -X GET "http://localhost:8000/api/org/{org_slug}/competencies?limit=100" \
  -H "Authorization: Bearer {token}" \
  | jq '.items | group_by(.stageId) | map({stage: .[0].stageId, orders: map(.displayOrder)})'
# Expected: Each stage group has orders [1,2,3,4,5,6]
```

**Performance Test:**
```bash
# Test query performance
time curl -X GET "http://localhost:8000/api/org/{org_slug}/competencies" \
  -H "Authorization: Bearer {token}" \
  > /dev/null

# Expected: < 100ms response time
```

---

### Task 4.3: Frontend Integration Testing
**Estimated Time:** 30 minutes
**Assignee:** Frontend Developer / QA
**Dependencies:** Tasks 2.1, 2.2, 3.1 (full stack deployed)
**Priority:** HIGH
**Complexity:** Low

**Description:**
Verify competencies display in correct order across all frontend screens.

**Acceptance Criteria:**
- [ ] Goal input page displays competencies in order 1→6
- [ ] Evaluation page displays competencies in order 1→6
- [ ] Admin competency management displays competencies in order 1→6
- [ ] Order is consistent across all screens
- [ ] Philosophy competency always appears first
- [ ] Management competency always appears last
- [ ] No console errors or TypeScript errors

**Test Procedure:**

1. **Goal Input Page:**
   ```
   1. Navigate to /goal-input
   2. Select an evaluation period
   3. Navigate to competency goals step
   4. Verify competencies appear in this order:
      - 理念理解 (Philosophy)
      - 積極性 (Attitude)
      - ストレスコントロール (Mindset)
      - 伝達力（コミュニケーション力） (Skills)
      - 興味・好奇心 (Growth)
      - 自己管理（セルフマネジメント初級） (Management)
   5. Check browser console for errors (expect: none)
   ```

2. **Evaluation Page:**
   ```
   1. Navigate to evaluation page
   2. Select a goal with competencies
   3. Verify competencies display in same order as goal input
   4. Check consistency across multiple evaluations
   ```

3. **Admin Competency Management (if exists):**
   ```
   1. Navigate to /admin/competency-management
   2. Filter by Stage 1
   3. Verify competencies listed in order 1→6
   4. Repeat for other stages
   ```

4. **Cross-Stage Consistency:**
   ```
   1. Test with different user stages (Stage 1, 2, 3, etc.)
   2. Verify Philosophy competency always appears first
   3. Verify Management competency always appears last
   4. Verify middle positions follow pattern
   ```

**Manual Test Checklist:**
- [ ] Goal input page: Order correct
- [ ] Evaluation page: Order correct
- [ ] Admin page: Order correct
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Cross-stage consistency verified

---

## Phase 5: Documentation

### Task 5.1: Update Code Comments
**Estimated Time:** 15 minutes
**Assignee:** Backend Developer
**Dependencies:** All implementation tasks complete
**Priority:** LOW
**Complexity:** Low

**Description:**
Add comments to code explaining display_order field and ordering logic.

**Acceptance Criteria:**
- [ ] Model field has docstring explaining purpose
- [ ] Repository methods have comments explaining ordering
- [ ] Migration includes explanatory comments
- [ ] Seed script includes mapping table in comments

**Implementation:**

```python
# backend/app/database/models/stage_competency.py
class Competency(Base):
    # ...
    display_order = Column(Integer, nullable=True)
    """Display order for competency within its stage (1-6).

    Determines presentation order in UI:
    1. Philosophy/Company Values
    2. Work Attitude/Goal Achievement
    3. Mindset/Thinking Skills
    4. Skills/Execution Ability
    5. Growth Activities/Productivity
    6. Management/Talent Development
    """
```

```python
# backend/app/database/repositories/competency_repo.py
async def get_by_stage_id(self, stage_id: UUID, org_id: str) -> list[Competency]:
    """Get all competencies for a specific stage within organization scope.

    Returns competencies ordered by display_order (1-6), then by name.
    Uses nullslast() to handle any missing display_order values gracefully.
    """
    # ...
```

---

### Task 5.2: Update README/Documentation (Optional)
**Estimated Time:** 15 minutes
**Assignee:** Any Developer
**Dependencies:** Task 5.1
**Priority:** LOW
**Complexity:** Low

**Description:**
Update project documentation to mention competency ordering feature.

**Acceptance Criteria:**
- [ ] Feature mentioned in CHANGELOG or release notes
- [ ] Migration notes updated (if migration docs exist)
- [ ] API documentation updated (if OpenAPI/Swagger docs exist)

**Files to Update (if exist):**
- `CHANGELOG.md`
- `docs/api.md`
- `docs/database.md`
- `README.md`

---

## Phase 6: Deployment

### Task 6.1: Deploy to Staging
**Estimated Time:** 30 minutes
**Assignee:** DevOps / Backend Lead
**Dependencies:** All implementation and testing complete
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Deploy changes to staging environment and perform smoke tests.

**Acceptance Criteria:**
- [ ] Run migration on staging database
- [ ] Run seed script on staging database
- [ ] Deploy backend code to staging
- [ ] Deploy frontend code to staging
- [ ] Verify API endpoints return correct order
- [ ] Verify UI displays correct order
- [ ] No errors in logs
- [ ] Performance acceptable

**Deployment Steps:**

```bash
# 1. Backup staging database
pg_dump -U postgres evaluation_system > backup_pre_display_order.sql

# 2. Pull latest code
cd backend
git pull origin feat/competency-display-order

# 3. Run migrations using project script (automatic)
python app/database/scripts/run_migrations.py

# Expected output:
# 🚀 Running migrations...
# 📁 Found 2 pending migrations:
#   - 008_add_display_order_to_competencies.sql
#   - 007_update_competencies_display_order.sql
# 📝 Running migration 1/2: 008_add_display_order_to_competencies.sql
# ✅ Migration 1 completed
# 📝 Running migration 2/2: 007_update_competencies_display_order.sql
# ✅ Migration 2 completed

# 4. Verify database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM competencies WHERE display_order IS NULL;"
# Expected: 0

# 5. Deploy backend
docker-compose up -d --build

# 6. Deploy frontend
cd ../frontend
git pull
npm run build
# ... deploy frontend

# 7. Smoke test
curl -X GET "https://staging.example.com/api/org/{org_slug}/competencies?stageId={stage1}" \
  -H "Authorization: Bearer {token}" \
  | jq '.items | map(.displayOrder)'
# Expected: [1, 2, 3, 4, 5, 6]

# 8. Check logs
docker-compose logs backend --tail=100
# Expected: No errors related to display_order

# 9. Verify migration tracking
psql $DATABASE_URL -c "SELECT * FROM schema_migrations WHERE filename LIKE '%display_order%';"
# Expected: 2 rows (migration + seed)
```

**Rollback Plan (if needed):**
```bash
# Restore database backup
psql -U postgres evaluation_system < backup_pre_display_order.sql

# Deploy previous code version
git checkout <previous-commit>
docker-compose up -d --build
```

---

### Task 6.2: Deploy to Production
**Estimated Time:** 30 minutes
**Assignee:** DevOps / Backend Lead
**Dependencies:** Task 6.1 (staging deployment successful)
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Deploy changes to production environment with monitoring.

**Acceptance Criteria:**
- [ ] Staging tests passed
- [ ] Deployment plan reviewed and approved
- [ ] Maintenance window scheduled (if needed)
- [ ] Backup created
- [ ] Migration successful
- [ ] Seed script successful
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Smoke tests passed
- [ ] No increase in error rates
- [ ] Performance metrics normal

**Deployment Steps:**

```bash
# 1. Create production backup
pg_dump $DATABASE_URL > backup_prod_$(date +%Y%m%d_%H%M%S).sql

# 2. Pull latest code
cd backend
git pull origin feat/competency-display-order

# 3. Run migrations using project script (automatic)
python app/database/scripts/run_migrations.py

# Expected output:
# 🚀 Running migrations...
# 📝 Running migration: 008_add_display_order_to_competencies.sql
# ✅ Migration completed
# 📝 Running migration: 007_update_competencies_display_order.sql
# ✅ Migration completed

# 4. Verify database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM competencies WHERE display_order IS NULL;"
# Expected: 0

# 5. Verify migration tracking
psql $DATABASE_URL -c "SELECT * FROM schema_migrations WHERE filename LIKE '%display_order%' ORDER BY applied_at;"
# Expected: 2 rows

# 6. Deploy backend (blue-green or rolling update)
docker-compose up -d --build

# 7. Deploy frontend
cd ../frontend
git pull
npm run build
# ... deploy frontend

# 8. Smoke tests - Test all 9 stages
for stage_id in $(psql $DATABASE_URL -t -c "SELECT id FROM stages ORDER BY name"); do
  echo "Testing stage: $stage_id"
  curl -X GET "https://app.example.com/api/org/{org_slug}/competencies?stageId=$stage_id" \
    -H "Authorization: Bearer {token}" \
    | jq '.items | map(.displayOrder)'
done
# Expected: Each returns [1, 2, 3, 4, 5, 6]

# 9. Monitor logs and metrics
docker-compose logs backend --tail=200 | grep -i "display_order\|error"
```

**Post-Deployment Monitoring (first 24 hours):**
- Monitor error logs for display_order related errors
- Check API response times (should remain < 100ms)
- Track user feedback/complaints
- Verify no increase in support tickets

---

## Task Summary

### By Priority

**HIGH Priority** (Must complete):
- Task 1.1: Create migration script (30min)
- Task 1.2: Create seed script (1h)
- Task 2.1: Update model (15min)
- Task 2.2: Update repository (30min)
- Task 4.1: Database testing (30min)
- Task 4.2: API testing (30min)
- Task 4.3: Frontend testing (30min)
- Task 6.1: Deploy to staging (30min)
- Task 6.2: Deploy to production (30min)

**MEDIUM Priority** (Should complete):
- Task 3.1: Update TypeScript types (15min)

**LOW Priority** (Nice to have):
- Task 5.1: Update code comments (15min)
- Task 5.2: Update documentation (15min)

---

### By Phase

| Phase | Time | Tasks |
|-------|------|-------|
| Phase 1: Database | 1.5h | 1.1, 1.2 |
| Phase 2: Backend | 0.75h | 2.1, 2.2 |
| Phase 3: Frontend | 0.25h | 3.1 |
| Phase 4: Testing | 1.5h | 4.1, 4.2, 4.3 |
| Phase 5: Documentation | 0.5h | 5.1, 5.2 |
| Phase 6: Deployment | 1h | 6.1, 6.2 |
| **Total** | **~5.5h** | |

---

### By Developer

**Backend Developer:**
- Tasks 1.1, 1.2, 2.1, 2.2, 4.1, 4.2, 5.1
- Estimated: 4 hours

**Frontend Developer:**
- Tasks 3.1, 4.3
- Estimated: 0.75 hours

**DevOps:**
- Tasks 6.1, 6.2
- Estimated: 1 hour

**Total Team Effort:** ~5.5-6 hours

---

## Dependencies Graph

```
1.1 (Migration)
  ↓
1.2 (Seed) → 2.1 (Model) → 2.2 (Repository) → 4.1 (DB Test) → 4.2 (API Test)
                                                                      ↓
3.1 (Types) ──────────────────────────────────────────────────→ 4.3 (Frontend Test)
                                                                      ↓
5.1 (Comments) → 5.2 (Docs) ──────────────────────────────────→ 6.1 (Staging)
                                                                      ↓
                                                                 6.2 (Production)
```

---

## Risk Mitigation

| Risk | Mitigation | Responsible |
|------|------------|-------------|
| Migration fails | Test on staging first, create rollback script | DevOps |
| Seed script incomplete | Verification queries, manual check | Backend Dev |
| Performance degradation | Add index, test on staging | Backend Dev |
| Frontend breaks | Make displayOrder optional, test thoroughly | Frontend Dev |
| Production deployment issues | Blue-green deployment, quick rollback plan | DevOps |

---

## Definition of Done

A task is considered "done" when:
- [ ] Code is written and reviewed
- [ ] Tests pass (automated or manual)
- [ ] Documentation updated
- [ ] Code merged to main branch
- [ ] Deployed to staging successfully
- [ ] Staging tests passed
- [ ] Deployed to production successfully
- [ ] Production smoke tests passed
- [ ] No critical bugs reported within 24 hours

Feature is considered "complete" when:
- [ ] All HIGH priority tasks completed
- [ ] All acceptance criteria met
- [ ] Competencies display in order 1→6 on all screens
- [ ] Order is consistent across all stages
- [ ] No performance degradation
- [ ] No user complaints or critical bugs
- [ ] Documentation updated

---

## References

- ISSUE.md: `.kiro/specs/competency-display-order/ISSUE.md`
- Requirements: `.kiro/specs/competency-display-order/requirements.md`
- Design: `.kiro/specs/competency-display-order/design.md`
- GitHub Issue: [#306](https://github.com/shintairiku/evaluation-system/issues/306)
