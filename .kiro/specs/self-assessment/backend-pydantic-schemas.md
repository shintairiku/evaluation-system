# Backend Pydantic Schemas: Self-Assessment

**Status:** Review
**Last Updated:** 2024-12-18
**Related Issues:** #417

---

## 1. Overview

This document reviews and validates the Pydantic schemas for Self-Assessment feature to ensure alignment with the API Contract and frontend TypeScript types.

---

## 2. Current Implementation

**File:** `backend/app/schemas/self_assessment.py`

### 2.1. Existing Schemas

```python
# Document current schemas here
```

---

## 3. API Contract Alignment

### 3.1. Schema Comparison

| API Contract Field | Pydantic Field | Type | Validation | Status |
|-------------------|----------------|------|------------|--------|
| `selfRating` | `self_rating` | `float` | `ge=0, le=100` | ✅ / ❌ |
| `selfComment` | `self_comment` | `str` | `max_length=1000` | ✅ / ❌ |
| `status` | `status` | `SubmissionStatus` | Literal enum | ✅ / ❌ |

---

## 4. Frontend Type Alignment

### 4.1. Field Mapping (Pydantic ↔ TypeScript)

| Pydantic (Backend) | TypeScript (Frontend) | Aligned? |
|-------------------|----------------------|----------|
| `self_rating: float` | `selfRating: number` | ✅ / ❌ |
| `self_comment: str` | `selfComment: string` | ✅ / ❌ |
| `status: SubmissionStatus` | `status: SubmissionStatus` | ✅ / ❌ |

---

## 5. Business Rules Validation

### 5.1. Required Validators

- [ ] Rating range validation (0-100)
- [ ] Comment max length validation (1000 chars)
- [ ] Submission requirements validation
- [ ] Status transition validation

### 5.2. Field Validators

```python
# Add field validator implementations here
```

### 5.3. Model Validators

```python
# Add model validator implementations here
```

---

## 6. Required Changes

### 6.1. Missing Validators

[List any missing validators]

### 6.2. Schema Updates

[List any schemas that need to be updated]

### 6.3. Documentation Improvements

[List documentation that needs to be added]

---

## 7. Schema Definitions (Updated)

```python
"""
Self-Assessment Pydantic Schema Definitions
Maps to frontend: src/api/types/self-assessment.ts
API Contract: .kiro/specs/self-assessment/api-contract.md
"""

# Add updated schema definitions here
```

---

## 8. Validation Examples

```python
# Example: Valid self-assessment creation
valid_assessment = SelfAssessmentCreate(
    self_rating=85.5,
    self_comment="Exceeded expectations in Q4",
    status=SubmissionStatus.DRAFT
)

# Example: Invalid - rating out of range
# Should raise ValidationError

# Add more examples
```

---

## 9. Unit Tests

**File:** `backend/tests/schemas/test_self_assessment_schemas.py`

```python
# Add unit test examples here
```

---

## 10. Validation Checklist

- [ ] All fields match API Contract
- [ ] Field names use snake_case (Python convention)
- [ ] Aliases configured for camelCase JSON (using `alias=`)
- [ ] Field validators added for all business rules
- [ ] Model validators added for complex rules
- [ ] Docstrings added to all schemas
- [ ] Config classes properly set (`from_attributes`, `populate_by_name`)
- [ ] Schema examples added (`json_schema_extra`)
- [ ] Unit tests created
- [ ] All tests passing

---

## References

- API Contract: [api-contract.md](./api-contract.md)
- Frontend Types: `frontend/src/api/types/self-assessment.ts`
- Current Schema: `backend/app/schemas/self_assessment.py`
- Guide: [MOCK_DATA_IMPLEMENTATION_GUIDE.md](../../docs/development/MOCK_DATA_IMPLEMENTATION_GUIDE.md)
