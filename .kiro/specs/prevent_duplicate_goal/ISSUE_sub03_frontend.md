# [TASK-04] sub03 - Prevent duplicate Goal creation - Frontend Implementation

## 📝 Description
Implement frontend validation and visual feedback for users when attempting to create duplicate Goals after submission.

**Scope Note:** This task implements **basic error feedback only**. The complete UI for viewing/editing submitted goals is handled in TASK-05.

## ✅ Implementation Checklist

### 1. Proactive Validation (on period selection)
- [ ] Modify `usePeriodSelection.ts` or `index.tsx`
- [ ] After period selection, call:
  ```typescript
  const response = await getGoalsAction({
    periodId,
    status: ['submitted', 'approved']
  });
  ```
- [ ] Create state: `const [hasSubmittedGoals, setHasSubmittedGoals] = useState(false)`
- [ ] If `response.data.items.length > 0`: set `hasSubmittedGoals = true`

### 2. Informational Alert (`index.tsx`)
- [ ] Import `Alert` component from shadcn/ui
- [ ] Add conditional rendering:
  ```tsx
  {hasSubmittedGoals && (
    <Alert variant="info">
      <AlertTitle>目標は既に提出されています</AlertTitle>
      <AlertDescription>
        提出済みの目標があるため、新しい目標を作成できません。
        目標一覧ページで確認してください。
      </AlertDescription>
    </Alert>
  )}
  ```
- [ ] Position alert at top of page
- [ ] **Note:** Do NOT build detailed goal list UI here - that's TASK-05 scope

### 3. Error Handling 409 (`useGoalAutoSave.ts`)
- [ ] Add try-catch in goal creation
- [ ] Detect `error.status === 409`
- [ ] Show toast with backend message:
  ```typescript
  if (error.status === 409) {
    toast.error(error.detail);
  }
  ```
- [ ] Update `hasSubmittedGoals = true` if needed

### 4. (Optional) Disable Buttons
- [ ] Pass `hasSubmittedGoals` to `PerformanceGoalsStep` and `CompetencyGoalsStep`
- [ ] Disable/hide "Add Goal" button when `hasSubmittedGoals === true`
- [ ] Add tooltip: "提出済みの目標があるため追加できません"

## 📁 Files Modified
```
frontend/src/hooks/usePeriodSelection.ts (or index.tsx)
frontend/src/feature/goal-input/display/index.tsx
frontend/src/hooks/useGoalAutoSave.ts
frontend/src/feature/goal-input/display/PerformanceGoalsStep.tsx (optional)
frontend/src/feature/goal-input/display/CompetencyGoalsStep.tsx (optional)
```

## ✅ Definition of Done
- [ ] Code implemented and committed
- [ ] Frontend linting OK (`npm run lint` and `npm run type-check`)
- [ ] Visual alert working correctly
- [ ] Error toast appears in 409 scenario
- [ ] Manual testing completed (see sub04 for E2E scenarios)

## 📊 Estimate
**1 day** (implementation only, no automated tests)

## 🔗 Related
- Parent: #272
- Depends on: [TASK-04] sub02 (soft dependency)
- Blocks: [TASK-04] sub04

## 📋 Specifications
See: `.kiro/specs/prevent_duplicate_goal/`
- requirements.md
- design.md
- tasks.md

## 🏷️ Labels
`frontend`, `enhancement`, `goal-management`, `UX`
