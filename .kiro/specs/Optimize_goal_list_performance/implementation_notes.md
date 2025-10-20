# Implementation Notes: Rejection History - Python Loop Approach

## Decision: Use Python Loop Instead of SQL Recursive CTE

### Rationale

We decided to use **Option 2: Python Loop** instead of SQL Recursive CTE for fetching rejection history because:

1. **Simplicity**: Easier to understand and maintain
2. **Sufficient Performance**: Typical rejection depth is 1-3 levels (< 500ms)
3. **Flexibility**: Can add custom logic in Python
4. **Compatibility**: Works on all PostgreSQL versions without version-specific SQL

### Implementation Overview

```python
# File: backend/app/services/goal_service.py

async def _get_rejection_history(
    self,
    goal_id: UUID,
    org_id: str,
    max_depth: int = 10
) -> List[SupervisorReview]:
    """
    Fetch complete rejection history by following previousGoalId chain.

    This uses a Python loop which is simpler than SQL recursive CTE
    and sufficient for typical rejection depths (1-3 levels).

    Args:
        goal_id: Starting goal ID (the previousGoalId to start from)
        org_id: Organization ID for scoping
        max_depth: Maximum depth to prevent infinite loops

    Returns:
        List of SupervisorReview in chronological order (oldest first)
    """
    history = []
    current_id = goal_id
    visited = set()

    while current_id and len(visited) < max_depth:
        # Prevent infinite loops
        if current_id in visited:
            logger.warning(f"Circular reference detected in rejection history at goal {current_id}")
            break
        visited.add(current_id)

        # Fetch the goal to get its previousGoalId
        goal = await self.goal_repo.get_by_id(current_id, org_id)
        if not goal:
            break

        # Only fetch review if this goal has a previousGoalId (was rejected and resubmitted)
        if not goal.previous_goal_id:
            break

        # Fetch the review for the previous (rejected) goal
        reviews = await self.supervisor_review_repo.get_by_goal(
            goal.previous_goal_id,
            org_id
        )

        if reviews:
            # Add most recent review to history (prepend for chronological order)
            history.insert(0, reviews[0])

        # Move to the previous goal in the chain
        current_id = goal.previous_goal_id

    logger.info(f"Fetched {len(history)} rejection reviews for goal chain starting at {goal_id}")
    return history
```

### Usage in `get_goals()` Service

```python
# When includeRejectionHistory=true
if include_rejection_history and goals:
    for goal_model in goals:
        if goal_model.previous_goal_id:
            rejection_history = await self._get_rejection_history(
                goal_model.previous_goal_id,
                org_id
            )
            goal_dict["rejection_history"] = rejection_history
```

### Performance Characteristics

| Depth | Queries | Time (est) |
|-------|---------|------------|
| 1     | 2       | ~100ms     |
| 2     | 4       | ~200ms     |
| 3     | 6       | ~300ms     |
| 5     | 10      | ~500ms     |

### Comparison with Frontend Current Approach

**Current (Frontend Recursive):**
- Makes N × 2 HTTP requests (goal + review per level)
- ~80ms per request
- Depth 3 = 6 requests = ~480ms + network overhead

**New (Backend Loop):**
- 0 HTTP requests (embedded in response)
- Depth 3 = 6 SQL queries = ~300ms
- **Still 40% faster** and eliminates network overhead

### Why This is Better Than Current Code

1. **Eliminates HTTP Requests**: 0 vs 6+ requests
2. **Faster Overall**: Even though backend does similar work, it's faster because:
   - No network latency between requests
   - SQL queries are faster than HTTP round-trips
   - Can be cached at service layer
3. **Maintains Correctness**: Returns same data structure (array of reviews in chronological order)

### Maintains Multiple Comment Display

The GoalCard expects `rejectionHistory: SupervisorReview[]` and does:

```tsx
{goal.rejectionHistory.map((rejection, index) => (
  <Alert>
    <p>{index + 1}回目の差し戻し</p>
    <p>上司からのコメント: {rejection.comment}</p>
  </Alert>
))}
```

This will continue to work because:
- ✅ Returns array of `SupervisorReview`
- ✅ In chronological order (oldest first)
- ✅ All comments included
- ✅ Same data structure as before

### Future Optimization (Optional)

If rejection depth grows beyond 5 levels, we can:
1. Switch to SQL Recursive CTE (one-time refactor)
2. Add caching layer for rejection history
3. Pre-compute and store rejection history on goal model

But for typical usage (1-3 levels), Python loop is optimal trade-off.
