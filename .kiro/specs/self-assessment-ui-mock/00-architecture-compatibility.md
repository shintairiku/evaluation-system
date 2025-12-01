# Architecture Compatibility Analysis
**Feature:** Self-Assessment UI with Mock Data
**Branch:** `feat/self-assessment-ui-mock`
**Date:** 2024-12-01

---

## ✅ COMPATIBILITY WITH CURRENT ARCHITECTURE

### 1. **Established Layer Pattern**

The current architecture follows this flow:
```
Page Component (RSC)
    ↓
Server Actions (/api/server-actions/)
    ↓
Endpoint Functions (/api/endpoints/)
    ↓
HTTP Client (/api/client/http-client.ts)
    ↓
Backend API (FastAPI)
```

### 2. **How to Implement Mock WITHOUT Breaking the Pattern**

#### ✅ RECOMMENDED APPROACH: **Environment-Based Switching**

```typescript
// frontend/src/api/endpoints/self-assessment.ts
import { getHttpClient } from '../client/http-client';
import { mockSelfAssessmentService } from '../mocks/services/self-assessment.mock.service';
import { API_ENDPOINTS } from '../constants/config';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_SELF_ASSESSMENT === 'true';

export const selfAssessmentApi = {
  getContext: async (periodId?: string) => {
    if (USE_MOCK) {
      return mockSelfAssessmentService.getContext(periodId);
    }

    // Real implementation (will be created later)
    const httpClient = getHttpClient();
    const endpoint = periodId
      ? `${API_ENDPOINTS.SELF_ASSESSMENTS.BY_PERIOD(periodId)}/context`
      : `${API_ENDPOINTS.SELF_ASSESSMENTS.LIST}/context`;
    return httpClient.get(endpoint);
  },

  saveDraft: async (entries: DraftEntry[]) => {
    if (USE_MOCK) {
      return mockSelfAssessmentService.saveDraft(entries);
    }

    // Real implementation (will be created later)
    const httpClient = getHttpClient();
    return httpClient.post(API_ENDPOINTS.SELF_ASSESSMENTS.DRAFT, { entries });
  },

  // ... other methods
};
```

#### ✅ ADVANTAGES OF THIS APPROACH:

1. **Zero Breaking Changes**: When backend is ready, just change environment variable
2. **Same Interface**: Server actions don't need to change
3. **Type Safety**: TypeScript validates both paths
4. **Easy Testing**: Can toggle between mock and real easily
5. **Gradual Migration**: Can migrate endpoint by endpoint

---

## 🎯 API CONTRACTS

### Endpoints we'll need (based on refactor branch):

```typescript
// New endpoints to be added to API_ENDPOINTS
SELF_ASSESSMENTS: {
  // ... existing
  CONTEXT: '/self-assessments/context',                    // GET - New
  DRAFT: '/self-assessments/draft',                        // POST - New
  SUBMIT: '/self-assessments/submit',                      // POST - New
  SUMMARY: (periodId: string) => `/self-assessments/summary/${periodId}`, // GET - New
},

SUPERVISOR_REVIEWS: {
  // ... existing
  PENDING_GROUPED: '/supervisor-reviews/pending/grouped',  // GET - New
  BUCKET_DECISIONS: (reviewId: string) =>                 // PATCH - New
    `/supervisor-reviews/${reviewId}/bucket-decisions`,
}
```

### TypeScript Types (partially exist already):

```typescript
// Need to add in /api/types/self-assessment.ts:

export interface SelfAssessmentContext {
  goals: Goal[];
  draft: SelfAssessmentDraftEntry[];
  summary: SelfAssessmentSummary | null;
  stageWeights: StageWeights;
  reviewStatus: 'pending' | 'approved' | 'rejected' | null;
}

export interface SelfAssessmentDraftEntry {
  goalId: string;
  bucket: string;
  ratingCode?: string;
  comment?: string;
  previousSelfAssessmentId?: string | null;
  supervisorComment?: string | null;
}

export interface SelfAssessmentSummary {
  submittedAt: string;
  finalRating: string;
  weightedTotal: number;
  perBucket?: BucketContribution[];
  flags?: {
    fail: boolean;
    notes: string[];
  };
}

export interface BucketDecision {
  bucket: string;
  employeeRating: string;
  employeeComment: string;
  employeeContribution: number;
  supervisorRating?: string;
  comment?: string;
  status: 'pending' | 'approved' | 'rejected';
}
```

---

## 📦 FOLDER STRUCTURE (Mock Implementation)

```
frontend/src/api/
├── mocks/
│   ├── data/                           # Static JSON files
│   │   ├── goals.json                  # Base goals data
│   │   ├── stage-weights.json          # Weights per stage
│   │   └── employees.json              # Employee list
│   │
│   ├── scenarios/                      # TypeScript combining JSONs
│   │   ├── self-assessment.scenarios.ts
│   │   └── review.scenarios.ts
│   │
│   └── services/                       # Mock services
│       ├── self-assessment.mock.service.ts
│       └── review.mock.service.ts
│
├── endpoints/                          # ✅ NO CHANGES
│   ├── goals.ts                        # Already exists
│   └── self-assessment.ts              # NEW - with mock/real switch
│
├── server-actions/                     # ✅ NO CHANGES
│   ├── goals.ts                        # Already exists
│   └── self-assessment.ts              # NEW - calls endpoints
│
└── types/                              # ✅ ADD TYPES
    ├── index.ts                        # Re-export
    └── self-assessment.ts              # UPDATE with new types
```

---

## 🔄 MIGRATION FLOW MOCK → REAL

### PHASE 1: Mock Only (NOW)
```
Page → Server Action → Endpoint (USE_MOCK=true) → Mock Service → JSON/Scenarios
```

### PHASE 2: Backend Ready (FUTURE)
```
Page → Server Action → Endpoint (USE_MOCK=false) → HTTP Client → Backend API
```

**Required changes:**
1. ✅ Add real endpoints in backend
2. ✅ Change `NEXT_PUBLIC_USE_MOCK_SELF_ASSESSMENT=false`
3. ❌ **NO need to change:** Pages, Components, Server Actions
4. ❌ **NO need to change:** TypeScript types (already correct)

---

## ⚠️ KEY POINTS

### ✅ WHAT IS GUARANTEED:

1. **API Response Format**: Mock returns `ApiResponse<T>` same as HTTP client
2. **Error Handling**: Mock simulates errors with same structure
3. **Type Safety**: All TypeScript types shared
4. **Cache Tags**: Server actions already use `revalidateTag()` - works with mock
5. **Authentication**: Mock doesn't need Clerk token (bypass)

### ⚠️ WHAT NEEDS ATTENTION:

1. **Latency Simulation**: Mock should have `await delay()` for realistic UX
2. **State Management**: Mock uses local state - backend will be database
3. **Validation**: Mock should replicate backend validations
4. **Error Codes**: Mock should return same HTTP status codes

---

## 🧪 STRATEGY TO ENSURE COMPATIBILITY

### 1. **Contract-First Development**
```typescript
// 1. Define TypeScript types FIRST
export interface SelfAssessmentContext { ... }

// 2. Mock implements the contract
mockService.getContext(): Promise<ApiResponse<SelfAssessmentContext>>

// 3. Backend implements the SAME contract
fastapi.get("/self-assessments/context"): SelfAssessmentContext
```

### 2. **Shared Validation Logic**
```typescript
// frontend/src/api/validation/self-assessment.ts
export const validateDraftEntry = (entry: DraftEntry) => {
  // Shared validation for mock + future backend client-side
  if (!entry.ratingCode) return { valid: false, error: 'Rating required' };
  if (entry.comment && entry.comment.length > 500) {
    return { valid: false, error: 'Comment too long' };
  }
  return { valid: true };
};
```

### 3. **Integration Test Checklist**
```typescript
// When backend is ready:
describe('Self Assessment API Integration', () => {
  it('should match mock response structure', async () => {
    const mockResponse = await mockService.getContext();
    const realResponse = await realApi.getContext();

    // Validate structure is identical
    expect(mockResponse).toMatchStructure(realResponse);
  });
});
```

---

## ✅ CONCLUSION: COMPATIBILITY GUARANTEED

### ✅ YES, the approach is compatible IF:

1. ✅ **Use environment variable switch** (`NEXT_PUBLIC_USE_MOCK_*`)
2. ✅ **Keep same folder structure** (`endpoints/` + `server-actions/`)
3. ✅ **Define TypeScript types** based on refactor branch design.md
4. ✅ **Mock returns ApiResponse<T>** same as HTTP client
5. ✅ **Add endpoints to API_ENDPOINTS** even in mock

### ❌ NOT compatible IF:

1. ❌ Create components that access mock directly (bypass server actions)
2. ❌ Use different types in mock vs backend
3. ❌ Different response structure
4. ❌ Ignore existing error handling patterns

---

## 📋 IMPLEMENTATION CHECKLIST

- [ ] Create TypeScript types in `/api/types/self-assessment.ts`
- [ ] Add endpoints in `/api/constants/config.ts`
- [ ] Create mock service in `/api/mocks/services/`
- [ ] Create endpoint functions in `/api/endpoints/` with switch
- [ ] Create server actions in `/api/server-actions/`
- [ ] Implement pages using server actions (NOT mock directly)
- [ ] Add environment variable in `.env.local`
- [ ] Document in README how to switch mock → real

---

## 🎯 NEXT STEPS

1. ✅ Validate this document with team
2. ✅ Create detailed spec structure
3. ✅ Implement TypeScript types
4. ✅ Create mock data & services
5. ✅ Implement endpoints with switch
6. ✅ Implement server actions
7. ✅ Implement pages
8. ⏳ When backend ready: change env var and validate
