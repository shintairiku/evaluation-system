# Working Agreement: Self-Assessment Scoring & UI Initiative

## 1. Document Stack & Ownership
- `requirements.md`, `design.md`, `tasks.md` in this folder are the single source of truth for scope. Update them **before** implementing.
- HR stakeholders (meeting owners) review requirements; engineering leads review design; feature squad lead tracks tasks.
- When spreadsheets change (new thresholds, policy toggles), capture the delta here first, then ship migrations.

## 2. Collaboration Flow
1. **Requirement sign-off** – Confirm user stories + acceptance criteria with HR/PM. Do not start design before sign-off.
2. **Design walkthrough** – Pair FastAPI + Next.js leads walk through sections 3–6 of the design doc; record open questions inline.
3. **Task slicing** – Use `tasks.md` checkboxes to create Linear/Jira tickets; each ticket links back to requirement IDs.
4. **Implementation** – Follow repository conventions (2-space TS, 4-space Python). Avoid hardcoded rating numbers anywhere in code.
5. **Validation** – Demo against spreadsheet fixtures (Employee 00001 / 00002) and attach screenshots of the new `/self-assessment` page with fail + pass cases.

## 3. Data Intake from Spreadsheet / Images
- Numeric mappings: SS=7, S=6, A+=5, A=4, A-=3, B=2, C=1, D=0.
- Grade ladder thresholds (総合評価・点数対応表): SS ≥ 6.5, S ≥ 5.5, A+ ≥ 4.5, A ≥ 3.7, A- ≥ 2.7, B ≥ 1.7, C ≥ 1.0, else D.
- Promotion memo (昇格基準): Stage-up requires total A+ **and** competency sheet A+, plus leadership clearance (credit review, leader interview, presentation, board approval). Reflect as notes in `flags.notes` when backend marks `promotionCandidate=true` (future scope) – keep text handy for PMs.
- Demotion memo (降格基準): If both semi-annual MBO rows hit D, or self-assessment reveals stage mismatch, HR can force stage-down; we model this today via `mbo_d_is_fail` flag that flips final grade to D and sets fail reason.

## 4. Definition of Done Checklist
- [ ] Requirements, design, tasks updated & re-reviewed after any scope change.
- [ ] Migrations deployed to staging with seed data verified via `SELECT * FROM rating_thresholds`.
- [ ] Backend unit + integration tests passing locally (`cd backend && pytest`).
- [ ] Frontend lint/tests passing (`cd frontend && npm run lint && npm run test` if available).
- [ ] `/self-assessment` page tested on desktop + mobile widths, JP + EN locales, keyboard navigation.
- [ ] Screenshots of grade ladder + fail badge attached to PR for QA/HR review.

## 5. Rollout & Support
- Ship behind a feature flag (Next.js environment var `NEXT_PUBLIC_ENABLE_SELF_ASSESSMENT`, FastAPI setting) so we can dark-launch.
- Add Supabase dashboard alert on `evaluation_score_mapping` edits; notify HR before changing seeds.
- Schedule a follow-up meeting with HR two weeks post-release to compare system totals vs. spreadsheet exports (ensures credibility).
