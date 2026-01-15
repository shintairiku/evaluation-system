# UI Implementation with Mock Data: Self-Assessment

**Status:** Todo
**Last Updated:** 2024-12-18
**Related Issues:** #418

---

## 1. Overview

Implementation plan for Self-Assessment UI with complete mock data system to enable frontend development independent of backend availability.

---

## 2. Mock Data System

### 2.1. Directory Structure

```
frontend/src/api/mocks/
├── data/
│   └── self-assessment-data.json
├── scenarios/
│   └── self-assessment.scenarios.ts
└── services/
    └── self-assessment.mock.service.ts
```

### 2.2. Mock Data (JSON)

**File:** `frontend/src/api/mocks/data/self-assessment-data.json`

```json
{
  "user001": [

  ]
}
```

[Add mock data structure]

---

### 2.3. TypeScript Scenarios

**File:** `frontend/src/api/mocks/scenarios/self-assessment.scenarios.ts`

**Scenarios to implement:**
- [ ] `onlyDrafts` - User has only draft assessments
- [ ] `hasSubmitted` - User has submitted assessments
- [ ] `empty` - New user with no assessments
- [ ] `error` - Error case for testing

```typescript
// Add scenario implementation
```

---

### 2.4. Mock Service

**File:** `frontend/src/api/mocks/services/self-assessment.mock.service.ts`

**Methods to implement:**
- [ ] `getSelfAssessments()` - List with filters
- [ ] `getSelfAssessmentByGoal()` - Get by goal ID
- [ ] `createSelfAssessment()` - Create with validation
- [ ] `updateSelfAssessment()` - Update with state checks
- [ ] `submitSelfAssessment()` - Submit with validation
- [ ] `deleteSelfAssessment()` - Delete with state checks

```typescript
// Add mock service implementation
```

---

### 2.5. Endpoint Switch Logic

**File:** `frontend/src/api/endpoints/self-assessments.ts`

```typescript
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_SELF_ASSESSMENT === 'true';

export const selfAssessmentsApi = {
  getSelfAssessments: async (params?) => {
    if (USE_MOCK) {
      return mockSelfAssessmentService.getSelfAssessments(params);
    }
    return httpClient.get<SelfAssessmentList>(endpoint);
  },
  // Add for all methods
};
```

---

### 2.6. Environment Configuration

**File:** `.env.local`

```bash
# Enable mock data for Self-Assessment
NEXT_PUBLIC_USE_MOCK_SELF_ASSESSMENT=true
```

---

## 3. UI Implementation

### 3.1. Page Structure

**File:** `frontend/src/app/(employee)/self-assessment/page.tsx`

```typescript
// Server component implementation
```

---

### 3.2. Components

#### 3.2.1. Main Container

**File:** `frontend/src/feature/self-assessment/display/SelfAssessmentView.tsx`

```typescript
// Client component - main view
```

---

#### 3.2.2. Form Component

**File:** `frontend/src/feature/self-assessment/components/SelfAssessmentForm.tsx`

**Features:**
- [ ] Rating input (0-100 slider)
- [ ] Comment textarea
- [ ] Form validation
- [ ] Auto-save functionality
- [ ] Save draft button
- [ ] Submit button

```typescript
// Form component implementation
```

---

#### 3.2.3. Rating Slider

**File:** `frontend/src/feature/self-assessment/components/RatingSlider.tsx`

**Features:**
- [ ] 0-100 range slider
- [ ] Visual feedback
- [ ] Numeric display
- [ ] Color coding (red → yellow → green)

---

#### 3.2.4. Submit Button

**File:** `frontend/src/feature/self-assessment/components/SubmitButton.tsx`

**Features:**
- [ ] Disabled when invalid
- [ ] Loading state
- [ ] Confirmation dialog

---

#### 3.2.5. Status Badge

**File:** `frontend/src/feature/self-assessment/components/StatusBadge.tsx`

**Features:**
- [ ] Draft indicator
- [ ] Submitted indicator
- [ ] Color coding

---

### 3.3. Server Actions

**File:** `frontend/src/api/server-actions/self-assessment.ts`

**Actions to implement:**
- [ ] `getSelfAssessmentsAction()` - with cache
- [ ] `getSelfAssessmentByGoalAction()`
- [ ] `createSelfAssessmentAction()` - with revalidation
- [ ] `updateSelfAssessmentAction()` - with revalidation
- [ ] `submitSelfAssessmentAction()` - with revalidation
- [ ] `deleteSelfAssessmentAction()` - with revalidation

```typescript
'use server';

// Add server action implementations
```

---

## 4. Features

### 4.1. Auto-Save

- [ ] Save draft every 30 seconds
- [ ] Save on input blur
- [ ] Show "Saving..." indicator
- [ ] Show "Saved" confirmation

### 4.2. Form Validation

- [ ] Rating required for submission
- [ ] Rating range (0-100)
- [ ] Comment max length (1000 chars)
- [ ] Disable submit if invalid

### 4.3. State Management

- [ ] Draft state (editable)
- [ ] Submitted state (read-only)
- [ ] Loading states
- [ ] Error states

---

## 5. Testing Plan

### 5.1. Mock Data Testing

- [ ] Test with `USE_MOCK=true`
- [ ] Test all scenarios (draft, submitted, empty, error)
- [ ] Verify mock service latency
- [ ] Verify mock validation rules

### 5.2. UI Testing

- [ ] Test form validation
- [ ] Test auto-save
- [ ] Test submit flow
- [ ] Test error handling
- [ ] Test loading states
- [ ] Test all UI states

### 5.3. Integration Testing

- [ ] Test switching `USE_MOCK=false` (when backend ready)
- [ ] Verify API compatibility

---

## 6. Implementation Checklist

### Phase A: Mock System
- [ ] Create directory structure
- [ ] Create mock data JSON
- [ ] Create TypeScript scenarios
- [ ] Implement mock service
- [ ] Add USE_MOCK switch to endpoints
- [ ] Configure environment variable
- [ ] Test mock system

### Phase B: UI Components
- [ ] Create page component
- [ ] Create SelfAssessmentView
- [ ] Create SelfAssessmentForm
- [ ] Create RatingSlider
- [ ] Create SubmitButton
- [ ] Create StatusBadge
- [ ] Create server actions
- [ ] Test all components

### Phase C: Features
- [ ] Implement auto-save
- [ ] Implement form validation
- [ ] Implement state management
- [ ] Test all features

### Phase D: Testing
- [ ] Test with mock data
- [ ] Test all UI states
- [ ] Test error scenarios
- [ ] Performance testing

---

## 7. Documentation

### 7.1. Component Documentation

[Add component API documentation]

### 7.2. Mock Usage Guide

```bash
# Enable mock data
NEXT_PUBLIC_USE_MOCK_SELF_ASSESSMENT=true npm run dev

# Switch scenarios (in browser console)
mockSelfAssessmentService.setScenario('empty')
mockSelfAssessmentService.setScenario('hasSubmitted')
```

### 7.3. Troubleshooting

[Add common issues and solutions]

---

## References

- Domain Model: [domain-model.md](./domain-model.md)
- API Contract: [api-contract.md](./api-contract.md)
- Frontend Types: [frontend-typescript-types.md](./frontend-typescript-types.md)
- Backend Schemas: [backend-pydantic-schemas.md](./backend-pydantic-schemas.md)
- Guide: [MOCK_DATA_IMPLEMENTATION_GUIDE.md](../../docs/development/MOCK_DATA_IMPLEMENTATION_GUIDE.md)
