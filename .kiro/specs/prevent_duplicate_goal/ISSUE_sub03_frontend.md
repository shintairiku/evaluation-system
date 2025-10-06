# [TASK-04] sub03 - Prevent duplicate Goal creation - Frontend Implementation

## 📝 Description
Implement frontend validation and visual feedback for users when attempting to create duplicate Goals after submission.

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
        承認待ちの目標を編集する場合は、目標一覧から編集してください。
        新しい目標を作成するには、提出済みの目標を下書きに戻す必要があります。
      </AlertDescription>
    </Alert>
  )}
  ```
- [ ] Position alert at top of page

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

## 🧪 Unit Tests Included

### Component Tests (`GoalInputPage.test.tsx`)
- [ ] `test_renders_alert_when_submitted_goals_exist()`
- [ ] `test_does_not_render_alert_when_no_submitted_goals()`
- [ ] `test_calls_api_with_correct_status_filter()`
- [ ] `test_displays_toast_on_409_error()`
- [ ] `test_disables_add_buttons_when_submitted_goals_exist()` (if implemented)

### Hook Tests (`useGoalAutoSave.test.ts`)
- [ ] `test_handles_409_error_correctly()`
- [ ] `test_shows_toast_with_backend_message()`
- [ ] `test_updates_state_on_409_error()`

## ✅ Definition of Done
- [ ] Code implemented and committed
- [ ] All unit tests passing
- [ ] Frontend linting OK (`npm run lint` and `npm run type-check`)
- [ ] Visual alert working correctly
- [ ] Error toast appears in 409 scenario

## 📊 Estimate
**1-1.5 days**

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
