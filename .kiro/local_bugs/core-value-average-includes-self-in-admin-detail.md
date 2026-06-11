# Bug: コアバリュー 平均/総合平均 inclui o self no modal admin 評価詳細 (deveria ser 3者)

## Status
Open

## Severity
Low (apenas visual — não afeta nenhum cálculo/decisão)

## Description
Na grade de コアバリュー do modal **評価詳細** (tela admin 同僚評価進捗管理 / peer-review-assignments), a coluna **平均** (por core value) e o **総合平均** são calculados como a média das **4 fontes** (自己 + 同僚① + 同僚② + 上長), **incluindo o self**.

A regra oficial do sistema para コアバリュー é a média dos **3 (sem self)** — supervisor + 2 peers. Isso é o que o cálculo do 総合評価 usa de fato (`coreValueFinalRank`). Portanto o número exibido nesse modal pode divergir do que a página do funcionário (評価結果一覧) mostra e do critério oficial.

**Importante:** é divergência **somente de exibição**. Os ratings por fonte (自己/同僚/上長) estão corretos e iguais em todo lugar; e o 総合評価/`coreValueFinalRank` sempre usou 3者 (não olha esse valor exibido). Nenhum cálculo, promoção/降格 ou nível é afetado.

## Steps to Reproduce
1. Logar como admin/eval_admin → menu 同僚評価進捗管理 (`/peer-review-assignments`), selecionar um período.
2. Na tabela de progresso, clicar no ícone de "olho" de um usuário que tenha self + 2 peers + 上長 submetidos.
3. No modal 評価詳細, observar a coluna **平均** e o **総合平均** da grade コアバリュー.
4. Comparar com a página do funcionário (評価結果一覧) para o mesmo usuário/período: os números de 平均/総合平均 diferem em algumas linhas (admin inclui o self; funcionário não).

## Expected Behavior
平均/総合平均 = média dos **3 (同僚① + 同僚② + 上長)**, excluindo o self — igual à página do funcionário e ao critério oficial (`coreValueFinalRank`). A coluna 自己 continua aparecendo como referência.

## Actual Behavior
平均/総合平均 = média dos **4** (inclui o self).

## Root Cause
**File:** `backend/app/services/peer_review_service.py` — `_build_evaluation_detail`

- Per-row 平均 (`average_rating`): inclui `self_rating` quando `average_excludes_self=False`.
- 総合平均 (`overall_rating`): inclui `self_avg` quando `average_excludes_self=False`.

O caminho admin `get_evaluation_detail` chama o helper com o default (`average_excludes_self=False`) → **4者**. O caminho do funcionário `get_my_evaluation_detail` já passa `average_excludes_self=True` → **3者** (correto).

Regra oficial (referência): `backend/app/database/repositories/comprehensive_evaluation_repo.py` — o `core_value_raw_score` usa supervisor + 2 peers com `HAVING COUNT(source_avg) = 3` (sem self).

## Affected Files
- `backend/app/services/peer_review_service.py` — `get_evaluation_detail` (chamada do helper)

## Affected Pages
- Admin **同僚評価進捗管理** (`/peer-review-assignments`) → modal 評価詳細 (`EvaluationDetailSheet` → `CoreValueScoreGrid` coluna 平均 + `OverallRatingSummary` 総合平均).
- NÃO afeta: 評価結果一覧 (funcionário, já 3者), admin-eval-list/総合評価 (sempre 3者).

## Proposed Fix
Tornar o cálculo de 平均/総合平均 sempre **3者 (sem self)** no `_build_evaluation_detail` — alinhar o caminho admin ao do funcionário e à regra oficial.

Opção simples: no `get_evaluation_detail` (admin), passar `average_excludes_self=True`. Ou remover o parâmetro e fazer o helper sempre excluir o self (já que ambos os caminhos devem ser 3者).

Adicionar também a anotação **「※自分を除く3人の平均です」** no modal admin (como já existe na página do funcionário) para deixar claro.

## Why the Fix is Safe
- É só exibição: os campos `averageRating`/`overallRating` do `EvaluationDetailResponse` só alimentam `CoreValueScoreGrid`/`OverallRatingSummary`; não são gravados nem usados pelo comprehensive.
- O 総合評価 (`coreValueFinalRank`) é calculado independentemente (3者) e não muda.
- As colunas por fonte (自己/同僚①/②/上長) permanecem inalteradas.
