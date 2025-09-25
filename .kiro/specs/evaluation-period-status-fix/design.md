# Design Document

## Overview

This design addresses the evaluation period status inconsistency issue by implementing a frontend status mapping system that translates English database status values to user-friendly Japanese labels. The backend will continue to use English status values as defined in the database constraints, while the frontend will provide a seamless Japanese user experience through proper status mapping and display logic.

## Architecture

The solution follows a frontend-focused approach:

1. **Database Layer**: Keep existing English status constraints ('draft', 'active', 'completed', 'cancelled')
2. **Backend Layer**: Update enum to match database constraints and ensure consistent English status handling
3. **API Layer**: Return English status values as per database schema
4. **Frontend Layer**: Implement status mapping system to translate English values to Japanese display labels

## Components and Interfaces

### 1. Backend Status Handling Update

**EvaluationPeriodStatus Enum** (needs to be updated to match database):
```python
class EvaluationPeriodStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
```

**Repository Layer**: Update to use English status values matching database constraints

**Service Layer**: Update status filtering and categorization to use English values

### 2. Frontend Status Mapping System

**Status Display Mapping** (English to Japanese):
```typescript
const STATUS_DISPLAY_MAP = {
  'draft': {
    label: '準備中',
    description: '開始前',
    variant: 'secondary' as const,
    color: 'blue'
  },
  'active': {
    label: '実施中', 
    description: '進行中',
    variant: 'default' as const,
    color: 'green'
  },
  'completed': {
    label: '完了',
    description: '終了済み', 
    variant: 'outline' as const,
    color: 'gray'
  },
  'cancelled': {
    label: 'キャンセル済み',
    description: '中止',
    variant: 'destructive' as const,
    color: 'red'
  }
} as const;
```

**Status Utility Functions**:
```typescript
export const getStatusDisplay = (status: string) => {
  return STATUS_DISPLAY_MAP[status as keyof typeof STATUS_DISPLAY_MAP] || {
    label: status,
    description: '不明',
    variant: 'secondary' as const,
    color: 'gray'
  };
};

export const getStatusVariant = (status: string) => {
  return getStatusDisplay(status).variant;
};
```

### 3. Server Action Updates

**getCategorizedEvaluationPeriodsAction**: Update status filtering logic to use English values:

```typescript
const current = allPeriods.find(p => p.status === 'active') || null;
const upcoming = allPeriods.filter(p => p.status === 'draft');
const completed = allPeriods.filter(p => p.status === 'completed');
```

### 4. Frontend Component Updates

**EvaluationPeriodSelector Component**:
- Update `getStatusVariant` function to use English-to-Japanese status mapping
- Display Japanese labels while processing English status values internally
- Add better error handling for status edge cases

**Goal Input Page**:
- Verify that period selection works with English status values from API
- Ensure loading states work correctly
- Add debugging for status-related issues

## Data Models

### Database Constraints (Keep Current)

**Current Constraint** (no changes needed):
```sql
CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'cancelled'::text]))
```

### Backend Type Updates

**EvaluationPeriodStatus Type** (frontend):
```typescript
export type EvaluationPeriodStatus = 'draft' | 'active' | 'completed' | 'cancelled';
```

### Status Mapping Configuration

```typescript
type StatusMapping = {
  [K in EvaluationPeriodStatus]: {
    label: string;
    description: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    color: string;
  };
};
```

## Error Handling

### Backend Status Validation
- **Enum Validation**: Ensure backend enum matches database constraints exactly
- **Status Consistency**: Verify all status operations use English values consistently

### Frontend Error Handling
- **Unknown Status Values**: Display fallback status with appropriate styling
- **API Errors**: Show user-friendly error messages when evaluation periods cannot be loaded
- **Loading States**: Provide clear feedback during data fetching

### Backend Error Handling
- **Status Validation**: Ensure only valid English status values are accepted (matching database constraints)
- **Enum Consistency**: Verify backend enum values match database constraint values exactly

## Testing Strategy

### Database Testing
1. **Constraint Validation**: Verify existing constraint properly validates English status values
2. **Data Consistency**: Ensure all existing evaluation periods have valid English status values

### Backend Testing
1. **Service Layer Testing**: Test status filtering and categorization with English values
2. **Repository Testing**: Verify that status-based queries work correctly with English values
3. **API Testing**: Ensure endpoints return consistent English status values

### Frontend Testing
1. **Component Testing**: Test EvaluationPeriodSelector with English status values and Japanese display
2. **Integration Testing**: Verify goal-input page works with English-to-Japanese status mapping
3. **Status Display Testing**: Ensure all English status values map to correct Japanese labels

### End-to-End Testing
1. **User Flow Testing**: Test complete goal-input workflow with Japanese status display
2. **Cross-browser Testing**: Verify Japanese status display consistency across browsers
3. **Accessibility Testing**: Ensure Japanese status information is accessible to screen readers

## Performance Considerations

### Database Performance
- **Index Optimization**: Ensure status-based queries with English values remain performant
- **Query Optimization**: Verify that status filtering doesn't impact query performance

### Frontend Performance
- **Status Mapping**: Use efficient lookup for status display mapping
- **Component Rendering**: Ensure status updates don't cause unnecessary re-renders
- **Caching**: Leverage existing caching for evaluation period data

## Security Considerations

### Status Validation
- **Input Validation**: Validate English status values on both frontend and backend
- **SQL Injection Prevention**: Use parameterized queries for status operations
- **Authorization**: Ensure proper permissions for status changes
- **Frontend Security**: Prevent manipulation of status display mapping

## Deployment Strategy

### Phase 1: Backend Updates
1. Update backend enum to use English status values matching database constraints
2. Update backend services to use English status values consistently
3. Verify API endpoints return correct English status values

### Phase 2: Frontend Updates  
1. Deploy status mapping system for English-to-Japanese translation
2. Update components to use status mapping for display
3. Test evaluation period selection functionality with Japanese labels

### Phase 3: Validation and Monitoring
1. Monitor for any status-related errors
2. Verify user experience improvements with Japanese labels
3. Collect feedback on Japanese status display clarity

### Rollback Plan
1. **Code Rollback**: Ability to quickly revert to previous frontend version
2. **Backend Rollback**: Revert backend enum changes if needed
3. **Monitoring**: Real-time monitoring to detect issues early