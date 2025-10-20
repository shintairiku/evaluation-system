# Software Development Workflow Guidelines

## 1. Introduction

This document defines a standardized workflow for efficiently developing high-quality software. It systematizes the process from idea to release, centered around three main documents: requirements definition, design, and task breakdown.

The purpose of this workflow is:
- **Reduce Rework:** By forming consensus at each phase, we prevent major specification changes in later stages.
- **Improve Quality:** Clear requirements and design lead to stable implementation quality.
- **Facilitate Communication:** Using documents as a common language eliminates misunderstandings with team members and stakeholders.
- **Project Visibility:** Concrete tasks make progress management easier.

## 2. Overall Development Workflow

The development process proceeds through the following phases. The principle is to complete and get approval for the previous phase before moving to the next.

### Phase 1: Requirements Definition (Requirements)
- **Purpose:** Clearly define "what to build" and reach consensus among stakeholders.
- **Deliverable Creation:**
  - Use `.kiro/specs/templates/requirements.md` to create a **"Requirements Document"** (`Optimize_goal_list_performance/requirements.md`).
  - Work with users and product managers to write specific user stories and acceptance criteria.
- **Review and Approval:**
  - Review the created "Requirements Document" with all stakeholders (requesters, users, project managers, etc.).
  - Reflect feedback from reviews and modify content.
  - Finally, get approval from stakeholders that "we will proceed with development based on this content." **This approval is a prerequisite for proceeding to the design phase.**

### Phase 2: Design (Design)
- **Purpose:** Transform approved requirements into technical plans of "how to build."
- **Deliverable Creation:**
  - Using the approved "Requirements Document" as input, use `.kiro/specs/templates/design.md` to create a **"Design Document"** (`Optimize_goal_list_performance/design.md`).
  - Define technical specifications in detail, including architecture, components, data models, API interfaces, etc.
- **Review and Finalization:**
  - Review the created "Design Document" with the development team (engineers, designers, etc.).
  - Discuss and refine the design from perspectives of technical feasibility, performance, security, etc.
  - Once team consensus is reached, finalize this design document as "correct" for development.

### Phase 3: Task Breakdown (Tasks)
- **Purpose:** Create a list of specific "implementation work" based on the design document.
- **Deliverable Creation:**
  - Based on the finalized "Design Document," use the `.kiro/specs/templates/tasks.md` template to create an **"Implementation Task List"** (`Optimize_goal_list_performance/tasks.md`).
  - Break down components and features from the design document into implementable units of concrete tasks (e.g., "Implement batch review repository method").
  - Link each task to related items in the requirements document to ensure traceability.

### Phase 4: Implementation and Testing (Implementation & Testing)
- **Purpose:** Code according to the task list and ensure quality.
- **Implementation:**
  - Developers start coding their assigned tasks according to the "Implementation Task List."
- **Testing:**
  - Conduct unit tests and integration tests based on the test strategy defined in the "Design Document."
  - Verify that acceptance criteria in the "Requirements Document" are met.
  - **Performance Testing:** Validate that page load time is < 1 second and HTTP requests are ≤ 3.

### Phase 5: Release and Operations (Release & Maintenance)
- **Purpose:** Deliver completed products to users and continuously improve.
- **Release:**
  - Deploy deliverables that have passed all tests to the production environment.
  - **Performance Monitoring:** Track response times, SQL query counts, and error rates.
- **Operations & Maintenance:**
  - Based on user feedback and monitoring data, perform bug fixes and feature improvements.
  - New improvement requests return to the "Phase 1: Requirements Definition" process for consideration.

## 3. Summary

This workflow is a compass to guide projects to success. By adhering to the principle of **"no proceeding to the next phase without approval,"** the entire team can face the same direction and produce consistent, high-quality products.

## 4. Specific Guidelines for Performance Optimization

This task focuses on **performance optimization** of an existing feature (goal-list page). Special considerations:

### Before Implementation
- ✅ **Measure Baseline:** Document current performance metrics (load time, request count, SQL queries)
- ✅ **Set Clear Targets:** Define specific performance goals (e.g., < 1 second load time)
- ✅ **Identify Bottlenecks:** Profile and analyze where time is being spent

### During Implementation
- ✅ **Maintain Backward Compatibility:** Ensure existing functionality continues to work
- ✅ **Incremental Changes:** Implement optimizations incrementally (backend first, then frontend)
- ✅ **Test Performance:** Measure performance after each change to validate improvements

### After Implementation
- ✅ **Verify Improvements:** Compare before/after metrics to validate success
- ✅ **Monitor Production:** Track performance in production environment
- ✅ **Document Learnings:** Record what worked and what didn't for future reference

### Performance Testing Checklist
- [ ] Measure page load time with browser DevTools
- [ ] Count HTTP requests in Network tab
- [ ] Check SQL query count in backend logs
- [ ] Test with various data sizes (10, 50, 100 goals)
- [ ] Test with various rejection depths (1, 3, 5 levels)
- [ ] Verify no regressions in existing functionality
- [ ] Load test with concurrent users (if applicable)
