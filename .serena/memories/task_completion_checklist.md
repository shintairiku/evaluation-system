# Task Completion Checklist

## When a Development Task is Completed

### Code Quality Checks
1. **Frontend Linting**
   ```bash
   cd frontend
   npm run lint
   ```

2. **Backend Linting**
   ```bash
   cd backend
   ruff check .
   ```

3. **Type Checking**
   ```bash
   # Frontend (if type-check script exists)
   cd frontend
   npm run type-check
   
   # Backend
   cd backend
   mypy .
   ```

### Testing
1. **Run Tests**
   ```bash
   # Frontend tests (if available)
   cd frontend
   npm test
   
   # Backend tests
   cd backend
   pytest
   ```

2. **Verify Test Coverage**
   - Ensure new code has appropriate test coverage
   - Run tests with coverage reporting if available

### Build Verification
1. **Frontend Build**
   ```bash
   cd frontend
   npm run build
   ```

2. **Docker Build** (if changes affect containers)
   ```bash
   docker-compose up --build
   ```

### Final Checks
- [ ] Code follows project conventions
- [ ] No console.log statements in production code
- [ ] No hardcoded secrets or sensitive data
- [ ] API types match backend schemas
- [ ] Error handling is implemented
- [ ] Documentation updated if needed

### Git Workflow
1. **Check Status**
   ```bash
   git status
   git diff
   ```

2. **Commit Changes** (only when user explicitly requests)
   ```bash
   git add .
   git commit -m "descriptive message"
   ```

## Important Notes
- **NEVER commit changes unless explicitly asked by the user**
- Always run linting and type checking before considering a task complete
- If linting/type checking commands are not found, ask the user for the correct commands
- Suggest adding commands to CLAUDE.md for future reference
- Prioritize code quality and consistency over speed