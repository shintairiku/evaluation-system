# Frontend Review Tasks (Self-Assessment + Goal Review)

## Self-Assessment 承認 Page (Supervisor)
- Nova página dedicada (não alterar goal-review existente) com badge de pendências apenas para self-assessment.
- Lista “自己評価承認” agrupados por funcionário.
  - Mostrar pesos do stage, nota final, rating/comentário por bucket do funcionário.
  - Controles de Aprovar/Rejeitar por bucket; rejeição exige comentário.
  - Submit chama endpoint de decisão de self-assessment review.
- Estado vazio: mensagem específica.
- Layout (estilo planilha):
  - Colunas: Performance（業績：定量＋定性）, Competency（コンピテンシー）, Core Value（コアバリュー）.
  - Cada coluna mostra nota do funcionário, peso % e pontos; opcional linha recalculada pelo supervisor.
  - Bloco de resumo à direita com 合計（点） e 総合評価, atualizando conforme decisões.

## Self-Assessment Page (Employee)
- Submitted summary shows supervisor status per bucket and comment.
- Buckets marked rejected become editable; approved remain read-only.
- On resubmit, call existing submit endpoint (may need new payload field) to trigger fresh supervisor draft and refresh summary.

## Data Layer
- Update self-assessment server actions/types to carry `summary.status`, `perBucketStatus[]`, and supervisor comment.
- Add hooks/queries for supervisor review list and decision submit.

## UI Components
- New bucket review card for supervisor (reuse goal-review styles where possible).
- Status badges: pending, approved, rejected, in_review.
- Comment textarea with validation on reject.

## Edge Cases
- Loading/optimistic UI: disable buttons while submitting decisions.
- Concurrency: handle 409/412 if outdated; prompt to refresh.
- Access: hide controls if user lacks permission.
