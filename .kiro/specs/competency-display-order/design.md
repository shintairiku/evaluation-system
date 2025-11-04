# Design Document: Competency Display Order Standardization

## 1. Executive Summary

This document outlines the technical design for implementing standardized display ordering of competencies in the HR evaluation system. The design introduces a `display_order` field to the competencies table, enabling consistent presentation across all system interfaces while maintaining backward compatibility and performance.

**Key Design Principles:**
- **Minimal Changes**: Add single field, update ordering logic
- **Backward Compatible**: Optional field in API responses
- **Performance Optimized**: Indexed display_order for fast queries
- **Data-Driven**: Order defined in seed data, not hardcoded
- **Simple Implementation**: ~4-6 hours total work

**Technical Approach:**
- Database: Add `display_order INTEGER` column with index
- Backend: Update CompetencyRepository ORDER BY clause
- Backend: Update Competency model with new field
- Frontend: Add optional `displayOrder` to TypeScript interface
- Migration: Create seed script to populate display_order for all competencies

---

## 2. Current State Analysis

### 2.1 Existing Implementation

**Database Schema** (backend/app/database/migrations/production/001_core_schema.sql:78-91):
```sql
CREATE TABLE competencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description JSONB,
    stage_id UUID REFERENCES stages(id),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_competencies_stage_id ON competencies(stage_id);
```

**Repository Ordering** (backend/app/database/repositories/competency_repo.py):
```python
# Line 104: get_by_stage_id()
.order_by(Competency.name)

# Line 117: get_all()
.order_by(Competency.name)

# Line 143: search()
.order_by(Competency.name)
```

**Current Behavior:**
- ❌ Competencies ordered alphabetically by name
- ❌ Order varies across stages
- ❌ No logical grouping or pattern
- ❌ Unpredictable for users

---

### 2.2 Problem Analysis

**Issue 1: Alphabetical Ordering is Arbitrary**

Stage 1 current order (alphabetical):
```
1. ストレスコントロール        (Stress Control)
2. 伝達力（コミュニケーション力） (Communication)
3. 理念理解                    (Philosophy Understanding)
4. 積極性                      (Proactiveness)
5. 興味・好奇心                (Curiosity)
6. 自己管理                    (Self-Management)
```

**Issue 2: No Logical Grouping**
- Philosophy competency (理念理解) appears in middle (#3)
- Management competency (自己管理) appears at end (#6) by coincidence
- No consistent pattern across stages

**Issue 3: User Confusion**
- Users cannot predict where to find specific competency types
- Each stage has different alphabetical order
- Reduces evaluation efficiency

---

## 3. Proposed Solution

### 3.1 Solution Overview

**Add Single Field: `display_order`**
```
competencies table
├── id UUID
├── name TEXT
├── description JSONB
├── stage_id UUID
├── organization_id VARCHAR(50)
├── display_order INTEGER  ← NEW
├── created_at TIMESTAMP
└── updated_at TIMESTAMP
```

**Benefits:**
- ✅ Simple implementation (1 field, 1 index, 3 ORDER BY changes)
- ✅ Data-driven ordering (no hardcoded logic)
- ✅ Backward compatible (nullable column, optional TypeScript field)
- ✅ Performance efficient (indexed column)
- ✅ Future-proof (can add category labels later if needed)

---

### 3.2 Display Order Pattern

**Standardized 6-Position Pattern:**

| Position | Category Type | Stage 1 Example | Stage 5 Example | Rationale |
|----------|---------------|-----------------|-----------------|-----------|
| 1 | Philosophy/Values | 理念理解 | 理念体現 | Foundation of company culture |
| 2 | Work Attitude/Goals | 積極性 | 目標達成へのコミット（複数チーム） | Core work behavior |
| 3 | Mindset/Thinking | ストレスコントロール | システム思考 | Mental approach to work |
| 4 | Skills/Execution | 伝達力 | 企画力 | Practical abilities |
| 5 | Growth/Productivity | 興味・好奇心 | チームの生産性向上 | Continuous improvement |
| 6 | Management/Development | 自己管理 | 人材育成 | Leadership and development |

**Consistency Across Stages:**
- Position 1 always: Philosophy-related (理念理解 → 理念共感 → ... → 理念体現の象徴)
- Position 6 always: Management-related (自己管理 → 他者へのサポート → ... → 後継者の育成)
- Predictable pattern enables intuitive navigation

---

## 4. Technical Design

### 4.1 Database Layer

#### 4.1.1 Migration Script

**File**: `backend/app/database/migrations/production/008_add_display_order_to_competencies.sql`

**Note**: This migration will be automatically executed by `run_migrations.py` script.

```sql
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
```

**Migration Characteristics:**
- **Non-breaking**: Column is nullable
- **Fast**: ALTER TABLE on small table (~100 rows) completes in < 5 seconds
- **Reversible**: Can DROP COLUMN if rollback needed
- **Indexed**: Performance impact minimal

---

#### 4.1.2 Seed Script

**File**: `backend/app/database/migrations/seeds/007_update_competencies_display_order.sql`

**Note**: This seed script will be automatically executed by `run_migrations.py` after the migration.

```sql
-- Update competencies with standardized display order
-- Pattern: Philosophy(1) → Attitude(2) → Mindset(3) → Skills(4) → Growth(5) → Management(6)

-- =====================================================
-- ORGANIZATION 1: org_32a4qh6ZhszNNK1kW1xyNgYimhZ
-- =====================================================

-- Stage 1: スタート
UPDATE competencies SET display_order = 1 WHERE name = '理念理解' AND stage_id = '11111111-2222-3333-4444-555555555555';
UPDATE competencies SET display_order = 2 WHERE name = '積極性' AND stage_id = '11111111-2222-3333-4444-555555555555';
UPDATE competencies SET display_order = 3 WHERE name = 'ストレスコントロール' AND stage_id = '11111111-2222-3333-4444-555555555555';
UPDATE competencies SET display_order = 4 WHERE name = '伝達力（コミュニケーション力）' AND stage_id = '11111111-2222-3333-4444-555555555555';
UPDATE competencies SET display_order = 5 WHERE name = '興味・好奇心' AND stage_id = '11111111-2222-3333-4444-555555555555';
UPDATE competencies SET display_order = 6 WHERE name = '自己管理（セルフマネジメント初級）' AND stage_id = '11111111-2222-3333-4444-555555555555';

-- Stage 2: 自己完結
UPDATE competencies SET display_order = 1 WHERE name = '理念共感' AND stage_id = '22222222-3333-4444-5555-666666666666';
UPDATE competencies SET display_order = 2 WHERE name = '誠実な対応' AND stage_id = '22222222-3333-4444-5555-666666666666';
UPDATE competencies SET display_order = 3 WHERE name = 'タフさ' AND stage_id = '22222222-3333-4444-5555-666666666666';
UPDATE competencies SET display_order = 4 WHERE name = '品質基準のクリア' AND stage_id = '22222222-3333-4444-5555-666666666666';
UPDATE competencies SET display_order = 5 WHERE name = '成長意欲' AND stage_id = '22222222-3333-4444-5555-666666666666';
UPDATE competencies SET display_order = 6 WHERE name = '他者へのサポート' AND stage_id = '22222222-3333-4444-5555-666666666666';

-- Stage 3: 品質基準のクリア
UPDATE competencies SET display_order = 1 WHERE name = '理念の浸透/習得' AND stage_id = '33333333-4444-5555-6666-777777777777';
UPDATE competencies SET display_order = 2 WHERE name = '顧客との信頼構築' AND stage_id = '33333333-4444-5555-6666-777777777777';
UPDATE competencies SET display_order = 3 WHERE name = '粘り強さ' AND stage_id = '33333333-4444-5555-6666-777777777777';
UPDATE competencies SET display_order = 4 WHERE name = 'スペシャリティ（専門分野の確立）' AND stage_id = '33333333-4444-5555-6666-777777777777';
UPDATE competencies SET display_order = 5 WHERE name = '情報の活用と共有化' AND stage_id = '33333333-4444-5555-6666-777777777777';
UPDATE competencies SET display_order = 6 WHERE name = 'チームワークの率先' AND stage_id = '33333333-4444-5555-6666-777777777777';

-- Stage 4: 成果創出＆小チームリーダー
UPDATE competencies SET display_order = 1 WHERE name = '理念の発信' AND stage_id = '44444444-4444-4444-4444-444444444444';
UPDATE competencies SET display_order = 2 WHERE name = '目標達成へのコミット（小チーム）' AND stage_id = '44444444-4444-4444-4444-444444444444';
UPDATE competencies SET display_order = 3 WHERE name = '他者受容（他者貢献）' AND stage_id = '44444444-4444-4444-4444-444444444444';
UPDATE competencies SET display_order = 4 WHERE name = 'ゼロベース思考' AND stage_id = '44444444-4444-4444-4444-444444444444';
UPDATE competencies SET display_order = 5 WHERE name = '生産性向上' AND stage_id = '44444444-4444-4444-4444-444444444444';
UPDATE competencies SET display_order = 6 WHERE name = 'チームマネジメント' AND stage_id = '44444444-4444-4444-4444-444444444444';

-- Stage 5: 成果創出＆チームリーダー
UPDATE competencies SET display_order = 1 WHERE name = '理念体現' AND stage_id = '55555555-5555-5555-5555-555555555555';
UPDATE competencies SET display_order = 2 WHERE name = '目標達成へのコミット（複数チーム）' AND stage_id = '55555555-5555-5555-5555-555555555555';
UPDATE competencies SET display_order = 3 WHERE name = 'システム思考（標準化への取り組み）' AND stage_id = '55555555-5555-5555-5555-555555555555';
UPDATE competencies SET display_order = 4 WHERE name = '企画力' AND stage_id = '55555555-5555-5555-5555-555555555555';
UPDATE competencies SET display_order = 5 WHERE name = 'チームの生産性向上' AND stage_id = '55555555-5555-5555-5555-555555555555';
UPDATE competencies SET display_order = 6 WHERE name = '人材育成' AND stage_id = '55555555-5555-5555-5555-555555555555';

-- Stage 6: 成果創出＆部門マネジメント
UPDATE competencies SET display_order = 1 WHERE name = '理念体現の手本' AND stage_id = '66666666-6666-6666-6666-666666666666';
UPDATE competencies SET display_order = 2 WHERE name = '目標達成へのコミット（部門）' AND stage_id = '66666666-6666-6666-6666-666666666666';
UPDATE competencies SET display_order = 3 WHERE name = 'プロフィット（部門利益へのこだわり）' AND stage_id = '66666666-6666-6666-6666-666666666666';
UPDATE competencies SET display_order = 4 WHERE name = '企画実行力' AND stage_id = '66666666-6666-6666-6666-666666666666';
UPDATE competencies SET display_order = 5 WHERE name = '部門の生産性向上' AND stage_id = '66666666-6666-6666-6666-666666666666';
UPDATE competencies SET display_order = 6 WHERE name = '部門の士気向上' AND stage_id = '66666666-6666-6666-6666-666666666666';

-- Stage 7: 成果創出＆複数部門マネジメント
UPDATE competencies SET display_order = 1 WHERE name = '理念体現の支援' AND stage_id = '77777777-7777-7777-7777-777777777777';
UPDATE competencies SET display_order = 2 WHERE name = '目標達成へのコミット' AND stage_id = '77777777-7777-7777-7777-777777777777';
UPDATE competencies SET display_order = 3 WHERE name = 'ファイナンシャル思考' AND stage_id = '77777777-7777-7777-7777-777777777777';
UPDATE competencies SET display_order = 4 WHERE name = 'ビジネスモデル構築力' AND stage_id = '77777777-7777-7777-7777-777777777777';
UPDATE competencies SET display_order = 5 WHERE name = '組織の制度設計' AND stage_id = '77777777-7777-7777-7777-777777777777';
UPDATE competencies SET display_order = 6 WHERE name = '自主性発揮の支援' AND stage_id = '77777777-7777-7777-7777-777777777777';

-- Stage 8: 全社マネジメント
UPDATE competencies SET display_order = 1 WHERE name = '理念の伝播' AND stage_id = '88888888-8888-8888-8888-888888888888';
UPDATE competencies SET display_order = 2 WHERE name = '目標達成へのコミット（全社）' AND stage_id = '88888888-8888-8888-8888-888888888888';
UPDATE competencies SET display_order = 3 WHERE name = '事業創出' AND stage_id = '88888888-8888-8888-8888-888888888888';
UPDATE competencies SET display_order = 4 WHERE name = 'ビジョンを実現する戦略策定' AND stage_id = '88888888-8888-8888-8888-888888888888';
UPDATE competencies SET display_order = 5 WHERE name = 'グローバル視点' AND stage_id = '88888888-8888-8888-8888-888888888888';
UPDATE competencies SET display_order = 6 WHERE name = 'マネジメント人材の育成' AND stage_id = '88888888-8888-8888-8888-888888888888';

-- Stage 9: グループ経営
UPDATE competencies SET display_order = 1 WHERE name = '理念体現の象徴' AND stage_id = '99999999-9999-9999-9999-999999999999';
UPDATE competencies SET display_order = 2 WHERE name = '目標達成へのコミット（グループ）' AND stage_id = '99999999-9999-9999-9999-999999999999';
UPDATE competencies SET display_order = 3 WHERE name = '投資思考' AND stage_id = '99999999-9999-9999-9999-999999999999';
UPDATE competencies SET display_order = 4 WHERE name = 'グループビジョンを実現する戦略策定' AND stage_id = '99999999-9999-9999-9999-999999999999';
UPDATE competencies SET display_order = 5 WHERE name = 'グローバル構築' AND stage_id = '99999999-9999-9999-9999-999999999999';
UPDATE competencies SET display_order = 6 WHERE name = '後継者の育成' AND stage_id = '99999999-9999-9999-9999-999999999999';

-- =====================================================
-- ORGANIZATION 2: org_32lvjKZKHDCKVmRhMhNx4mfP3c5
-- =====================================================
-- (Same pattern, update stage_id UUIDs with 'a' prefix)

-- Stage 1
UPDATE competencies SET display_order = 1 WHERE name = '理念理解' AND stage_id = 'a1111111-2222-3333-4444-555555555555';
UPDATE competencies SET display_order = 2 WHERE name = '積極性' AND stage_id = 'a1111111-2222-3333-4444-555555555555';
UPDATE competencies SET display_order = 3 WHERE name = 'ストレスコントロール' AND stage_id = 'a1111111-2222-3333-4444-555555555555';
UPDATE competencies SET display_order = 4 WHERE name = '伝達力（コミュニケーション力）' AND stage_id = 'a1111111-2222-3333-4444-555555555555';
UPDATE competencies SET display_order = 5 WHERE name = '興味・好奇心' AND stage_id = 'a1111111-2222-3333-4444-555555555555';
UPDATE competencies SET display_order = 6 WHERE name = '自己管理（セルフマネジメント初級）' AND stage_id = 'a1111111-2222-3333-4444-555555555555';

-- ... (repeat for stages 2-9 with 'a' prefix stage IDs)

-- Verification query
SELECT
    s.name as stage_name,
    c.display_order,
    c.name as competency_name
FROM competencies c
JOIN stages s ON c.stage_id = s.id
WHERE c.organization_id = 'org_32a4qh6ZhszNNK1kW1xyNgYimhZ'
ORDER BY s.name, c.display_order;
```

**Seed Script Characteristics:**
- **Updates 108 rows**: 54 competencies × 2 organizations
- **Fast**: UPDATE statements complete in < 2 seconds
- **Idempotent**: Can run multiple times safely
- **Verifiable**: Includes test query at end

---

### 4.2 Backend Application Layer

#### 4.2.1 Model Update

**File**: `backend/app/database/models/stage_competency.py`

```python
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
- Line 37: Add `display_order = Column(Integer, nullable=True)`
- **Nullable**: For backward compatibility during migration
- **Type**: Integer (sufficient for small values 1-6)

---

#### 4.2.2 Repository Update

**File**: `backend/app/database/repositories/competency_repo.py`

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
async def search(self, org_id: str, search_term: str = "", stage_ids: Optional[list[UUID]] = None) -> list[Competency]:
    """
    Search competencies by name or description with optional stage filtering within organization scope.
    """
    try:
        query = select(Competency).options(joinedload(Competency.stage))
        query = self.apply_org_scope_direct(query, Competency.organization_id, org_id)

        if search_term:
            search_ilike = f"%{search_term.lower()}%"
            query = query.filter(
                func.lower(Competency.name).ilike(search_ilike) |
                func.lower(Competency.description).ilike(search_ilike)
            )

        if stage_ids:
            query = query.filter(Competency.stage_id.in_(stage_ids))

        query = query.order_by(
            Competency.display_order.nullslast(),  # NEW: Primary sort
            Competency.name                         # Fallback sort
        )

        result = await self.session.execute(query)
        return result.scalars().unique().all()
    except SQLAlchemyError as e:
        logger.error(f"Error searching competencies for org {org_id}: {e}")
        raise
```

**Key Design Decision: `.nullslast()`**
- During migration, display_order may be NULL temporarily
- `.nullslast()` ensures NULL values sort to end
- After seed script runs, all values are non-NULL
- Provides graceful degradation during deployment

---

### 4.3 Frontend Layer

#### 4.3.1 TypeScript Type Update

**File**: `frontend/src/api/types/competency.ts`

```typescript
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

**Changes:**
- Line 17: Add `displayOrder?: number` to Competency interface
- Line 30: Add `displayOrder?: number` to CompetencyCreate
- Line 36: Add `displayOrder?: number` to CompetencyUpdate
- **Optional**: Uses `?:` for backward compatibility
- **CamelCase**: Follows frontend naming convention (backend uses snake_case)

---

#### 4.3.2 No UI Changes Required

**Current Behavior (Already Correct):**

Components receive competencies from API and display them in received order:

```tsx
// Example: CompetencyGoalsStep.tsx (Line 58-74)
useEffect(() => {
  const loadCompetencies = async () => {
    const result = await getCompetenciesAction({ limit: 100 });
    if (result.success && result.data?.items) {
      setCompetencies(result.data.items);  // ← Uses API order directly
    }
  };
  loadCompetencies();
}, []);

// ...

{competencies.map(comp => (  // ← Maps in received order
  <CompetencyCard key={comp.id} competency={comp} />
))}
```

**Why No Changes Needed:**
- ✅ Frontend already trusts backend ordering
- ✅ No client-side sorting logic exists
- ✅ Components simply map over received array
- ✅ Adding displayOrder field doesn't break existing code

---

## 5. Data Flow

### 5.1 Request Flow

```
User Request
    ↓
[Frontend Component]
    ↓
getCompetenciesAction({ stageId: 'stage-1-id' })
    ↓
GET /api/org/{org_slug}/competencies?stageId=stage-1-id
    ↓
[FastAPI Endpoint] → competencies.py
    ↓
[GoalService] → get_competencies()
    ↓
[CompetencyRepository] → get_by_stage_id()
    ↓
SELECT * FROM competencies
WHERE stage_id = 'stage-1-id'
ORDER BY display_order NULLSLAST, name  ← NEW
    ↓
[PostgreSQL] → Returns ordered rows
    ↓
[Response] → { items: [...] }  ← Competencies in display_order
    ↓
[Frontend] → setCompetencies(data.items)
    ↓
[UI] → Displays in received order ✅
```

---

### 5.2 Deployment Flow

```
1. Run Migration
   ↓
   ALTER TABLE competencies ADD COLUMN display_order INTEGER
   CREATE INDEX idx_competencies_display_order
   ↓
   Status: Column exists, all values NULL

2. Run Seed Script
   ↓
   UPDATE competencies SET display_order = X WHERE name = '...'
   (108 UPDATE statements)
   ↓
   Status: All competencies have display_order (1-6)

3. Deploy Backend Code
   ↓
   Update model, repository
   ↓
   Status: Backend orders by display_order

4. Deploy Frontend Code
   ↓
   Update TypeScript types
   ↓
   Status: displayOrder field available in types

5. Verify
   ↓
   Check UI: Competencies in correct order ✅
```

---

## 6. Performance Considerations

### 6.1 Query Performance

**Before (Alphabetical):**
```sql
SELECT * FROM competencies
WHERE stage_id = '...'
ORDER BY name;  -- Uses name column (not indexed specifically for sorting)
```

**After (Display Order):**
```sql
SELECT * FROM competencies
WHERE stage_id = '...'
ORDER BY display_order NULLSLAST, name;  -- Uses display_order index
```

**Performance Impact:**
- Index on display_order improves sort performance
- Small dataset (~6 rows per query) - negligible difference
- No N+1 queries introduced
- Query time remains < 100ms

**Index Strategy:**
```sql
CREATE INDEX idx_competencies_stage_id ON competencies(stage_id);        -- Existing
CREATE INDEX idx_competencies_display_order ON competencies(display_order);  -- New
```

**Composite Index Not Needed:**
- Stage filtering uses existing idx_competencies_stage_id
- Sort uses new idx_competencies_display_order
- Query planner can use both indexes efficiently
- Small dataset size doesn't warrant composite index

---

### 6.2 Migration System

**Project Uses `run_migrations.py` Script:**

The project has a built-in migration runner at `backend/app/database/scripts/run_migrations.py` that:
- ✅ Automatically scans `migrations/production/` and `migrations/seeds/` directories
- ✅ Tracks applied migrations in `schema_migrations` table
- ✅ Executes pending migrations in alphabetical order
- ✅ Runs each migration in a transaction (automatic rollback on error)
- ✅ Prevents duplicate execution

**File Naming Convention:**
```
backend/app/database/migrations/production/
  ├── 005_roles_uuid_migration.sql
  ├── 006_add_subordinate_id_to_supervisor_reviews.sql
  ├── 007_add_previous_goal_id_to_goals.sql
  └── 008_add_display_order_to_competencies.sql  ← NEW

backend/app/database/migrations/seeds/
  ├── 004_roles_data.sql
  ├── 005_parttime_stages_competencies.sql
  ├── 006_parttime_stages_org2.sql
  └── 007_update_competencies_display_order.sql  ← NEW
```

**Running Migrations:**
```bash
cd backend
python app/database/scripts/run_migrations.py

# Output:
# 🚀 Running migrations...
# 📁 Scanned backend/app/database/migrations/production
# 📁 Scanned backend/app/database/migrations/seeds
# 📁 Found 2 pending migrations:
#   - 008_add_display_order_to_competencies.sql
#   - 007_update_competencies_display_order.sql
# 📝 Running migration 1/2: 008_add_display_order_to_competencies.sql
# ✅ Migration 1 completed
# 📝 Running migration 2/2: 007_update_competencies_display_order.sql
# ✅ Migration 2 completed
```

---

### 6.3 Migration Performance

**ALTER TABLE Performance:**
```
Table size: ~100-200 rows (2 orgs × 9 stages × 6 competencies)
Operation: ADD COLUMN INTEGER
Expected time: < 5 seconds
Locking: Minimal (PostgreSQL 11+ supports fast ADD COLUMN)
Transaction: Managed by run_migrations.py (automatic rollback on error)
```

**UPDATE Performance:**
```
Number of rows: 108
Operation: UPDATE single column
Expected time: < 2 seconds
Approach: Individual UPDATE statements (clear, auditable)
```

**Total Downtime:**
- Migration: ~5 seconds
- Seed: ~2 seconds
- Total: < 10 seconds
- Impact: Minimal for production deployment

---

## 7. Error Handling and Edge Cases

### 7.1 Edge Case: NULL display_order

**Scenario:** Seed script fails partially, some competencies have NULL display_order

**Mitigation:**
```python
# Repository uses .nullslast() fallback
.order_by(
    Competency.display_order.nullslast(),  # NULLs sort to end
    Competency.name                         # Alphabetical fallback
)
```

**Result:**
- Competencies with display_order appear first (1, 2, 3, 4, 5, 6)
- Competencies without display_order appear last (alphabetically)
- System remains functional during migration

---

### 7.2 Edge Case: Duplicate display_order

**Scenario:** Two competencies in same stage have same display_order

**Mitigation:**
```python
# Secondary sort by name breaks ties
.order_by(
    Competency.display_order.nullslast(),
    Competency.name  # Deterministic tie-breaker
)
```

**Prevention:**
- Seed script uses unique names per stage
- Future: Add unique constraint `UNIQUE (stage_id, display_order)` if needed

---

### 7.3 Edge Case: Frontend receives no displayOrder

**Scenario:** Old backend version doesn't send displayOrder field

**Mitigation:**
```typescript
export interface Competency {
  displayOrder?: number;  // Optional field
}

// Usage
const order = competency.displayOrder ?? 999;  // Default high value
```

**Result:**
- TypeScript doesn't error on missing field
- Component can provide default behavior if needed
- Backward compatible with old API versions

---

## 8. Testing Strategy

### 8.1 Database Testing

```sql
-- Test 1: Verify all competencies have display_order
SELECT
    COUNT(*) as total,
    COUNT(display_order) as with_order,
    COUNT(*) - COUNT(display_order) as missing_order
FROM competencies;
-- Expected: total=108, with_order=108, missing_order=0

-- Test 2: Verify display_order range (1-6)
SELECT
    MIN(display_order) as min_order,
    MAX(display_order) as max_order
FROM competencies;
-- Expected: min_order=1, max_order=6

-- Test 3: Verify each stage has 6 competencies with orders 1-6
SELECT
    s.name as stage_name,
    COUNT(*) as count,
    array_agg(c.display_order ORDER BY c.display_order) as orders
FROM competencies c
JOIN stages s ON c.stage_id = s.id
GROUP BY s.name
ORDER BY s.name;
-- Expected: Each stage has count=6, orders=[1,2,3,4,5,6]

-- Test 4: Check for duplicates within stages
SELECT
    stage_id,
    display_order,
    COUNT(*) as duplicate_count
FROM competencies
GROUP BY stage_id, display_order
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)
```

---

### 8.2 API Testing

```bash
# Test 1: Get competencies for Stage 1 (Organization 1)
curl -X GET "http://localhost:8000/api/org/org-slug/competencies?stageId=11111111-2222-3333-4444-555555555555" \
  -H "Authorization: Bearer {token}"

# Expected Response:
# {
#   "items": [
#     { "id": "...", "name": "理念理解", "displayOrder": 1, ... },
#     { "id": "...", "name": "積極性", "displayOrder": 2, ... },
#     { "id": "...", "name": "ストレスコントロール", "displayOrder": 3, ... },
#     { "id": "...", "name": "伝達力（コミュニケーション力）", "displayOrder": 4, ... },
#     { "id": "...", "name": "興味・好奇心", "displayOrder": 5, ... },
#     { "id": "...", "name": "自己管理（セルフマネジメント初級）", "displayOrder": 6, ... }
#   ],
#   "total": 6
# }

# Test 2: Verify order is consistent across requests
curl ... | jq '.items | map(.displayOrder)'
# Expected: [1, 2, 3, 4, 5, 6]

# Test 3: Check all stages have correct order
for stage_id in {stage1..stage9}; do
  curl -X GET "http://localhost:8000/api/org/org-slug/competencies?stageId=$stage_id" \
    | jq '.items | map(.displayOrder)'
done
# Expected: Each stage returns [1, 2, 3, 4, 5, 6]
```

---

### 8.3 Frontend Testing

**Manual Testing:**
1. Open goal input page
2. Navigate to competency selection
3. Verify competencies appear in expected order:
   - 理念理解 (first)
   - 積極性 (second)
   - ストレスコントロール (third)
   - 伝達力（コミュニケーション力） (fourth)
   - 興味・好奇心 (fifth)
   - 自己管理（セルフマネジメント初級） (last)
4. Switch between different stages
5. Verify order remains consistent across stages (position 1 always Philosophy, position 6 always Management)

**Automated Testing (Optional):**
```typescript
// Test: Competencies are displayed in displayOrder
describe('Competency Display Order', () => {
  it('should display competencies in displayOrder ascending', async () => {
    const competencies = await getCompetenciesAction({ stageId: 'stage-1-id' });

    const orders = competencies.data?.items.map(c => c.displayOrder);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('should maintain order across all stages', async () => {
    for (const stageId of STAGE_IDS) {
      const competencies = await getCompetenciesAction({ stageId });
      const orders = competencies.data?.items.map(c => c.displayOrder);
      expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });
});
```

---

## 9. Rollback Plan

### 9.1 Rollback Steps

**If issues are discovered after deployment:**

```sql
-- Step 1: Revert backend code (deploy previous version)
-- This reverts ORDER BY changes in repository

-- Step 2: (Optional) Remove display_order column if needed
ALTER TABLE competencies DROP COLUMN display_order;
DROP INDEX IF EXISTS idx_competencies_display_order;

-- Step 3: Revert frontend code (deploy previous version)
-- This removes displayOrder from TypeScript types
```

**Rollback is Safe:**
- ✅ Backend gracefully handles missing display_order (falls back to name)
- ✅ Frontend displayOrder is optional (doesn't break if missing)
- ✅ Can drop column without data loss (other columns unaffected)
- ✅ No dependent features (display_order is isolated change)

---

### 9.2 Partial Rollback

**Scenario:** Keep column but revert to alphabetical ordering

```python
# Repository (revert to original)
.order_by(Competency.name)  # Remove display_order from ORDER BY
```

**Result:**
- display_order column remains (no data loss)
- Backend reverts to alphabetical ordering
- Can re-enable display_order ordering later without re-running migration

---

## 10. Future Enhancements (Out of Scope)

### 10.1 Admin Reordering UI

**Feature:** Drag-and-drop interface to reorder competencies

```tsx
// Example future component
<DraggableCompetencyList
  competencies={competencies}
  onReorder={(newOrder) => {
    // Update display_order via API
    updateCompetencyOrder(newOrder);
  }}
/>
```

**API Endpoint:**
```python
@router.patch("/competencies/reorder")
async def reorder_competencies(
    updates: List[CompetencyOrderUpdate],
    context: AuthContext = Depends(get_auth_context)
):
    # Update display_order for multiple competencies
    for update in updates:
        await competency_service.update_display_order(
            competency_id=update.id,
            new_order=update.displayOrder
        )
```

---

### 10.2 Category Labels (Option 1)

**Feature:** Add `category_label` field for visual grouping

```sql
ALTER TABLE competencies ADD COLUMN category_label TEXT;

UPDATE competencies
SET category_label = '会社理解'
WHERE name = '理念理解';

UPDATE competencies
SET category_label = '成果を生み出す仕事の姿勢'
WHERE name = '積極性';
```

**UI with Categories:**
```tsx
<Accordion>
  {categories.map(category => (
    <AccordionItem key={category}>
      <AccordionTrigger>{category}</AccordionTrigger>
      <AccordionContent>
        {competenciesByCategory[category].map(comp => (
          <CompetencyCard competency={comp} />
        ))}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

---

## 11. References

### 11.1 Related Files

**Database:**
- Schema: `backend/app/database/migrations/production/001_core_schema.sql`
- Seed (Org 1): `backend/app/database/migrations/seeds/002_competencies_data_org1.sql`
- Seed (Org 2): `backend/app/database/migrations/seeds/002_competencies_data_org2.sql`

**Backend:**
- Model: `backend/app/database/models/stage_competency.py`
- Repository: `backend/app/database/repositories/competency_repo.py`
- Service: `backend/app/services/competency_service.py`
- API: `backend/app/api/v1/competencies.py`

**Frontend:**
- Types: `frontend/src/api/types/competency.ts`
- Server Actions: `frontend/src/api/server-actions/competencies.ts`
- Endpoints: `frontend/src/api/endpoints/competencies.ts`
- Component: `frontend/src/feature/goal-input/display/CompetencyGoalsStep.tsx`
- Static Data: `frontend/src/feature/goal-input/data/stage1-competencies.json`

---

### 11.2 Specification Documents

- Issue: `.kiro/specs/competency-display-order/ISSUE.md`
- Requirements: `.kiro/specs/competency-display-order/requirements.md`
- Tasks: `.kiro/specs/competency-display-order/tasks.md`
- GitHub Issue: [#306](https://github.com/shintairiku/evaluation-system/issues/306)

---

## 12. Conclusion

This design implements a minimal, effective solution for standardized competency ordering:

**Strengths:**
- ✅ Simple: 1 field, 3 ORDER BY changes
- ✅ Backward compatible: Optional field, graceful degradation
- ✅ Performant: Indexed column, small dataset
- ✅ Data-driven: Order in seed data, not hardcoded
- ✅ Future-proof: Foundation for admin reordering UI

**Implementation Effort:**
- Database: 1.5 hours (migration + seed)
- Backend: 1 hour (model + repository)
- Frontend: 0.5 hour (types only)
- Testing: 1 hour
- **Total: 4-6 hours**

**Next Steps:**
1. Review and approve this design
2. Implement per tasks.md
3. Test on staging environment
4. Deploy to production
5. Monitor for issues
6. Consider future enhancements (admin UI, categories)
