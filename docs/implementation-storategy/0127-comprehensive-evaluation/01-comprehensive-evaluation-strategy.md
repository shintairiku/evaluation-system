<!-- docs/implementation-storategy/0127-comprehensive-evaluation/01-comprehensive-evaluation-strategy.md -->
# 総合評価（管理者向けテーブル）実装戦略 / 実行計画

## リビジョン履歴

| バージョン | 日付 | 変更者 | 変更内容 |
|---|---|---|---|
| v1.4 | 2026-02-18 | AI（Codex） | `self_assessments` / `supervisor_feedback` の実装反映、モック列のDB可否を確定、総合評価データ取得の最終方針（単一集計API）を追記 |

---

## TL;DR

- `self_assessments` / `supervisor_feedback` のDBスキーマとAPIは実装済み
- 総合評価モック行は **大部分をDBから再構築可能**（不足列あり）
  - 未充足: `現在レベル`（`users.level`未実装）、`コアバリュー最終評価`（360評価系未接続）、面談系フラグ（DB項目なし）
- 本番化は「Backend集計済み行DTOを返す単一API」で進める（Frontendで多重API集約しない）
- `evaluation_score_mapping` は現行責務（`rating_code -> score_value`）のまま維持し、総合評価用の閾値/`level_delta`は別テーブルで管理する

---

## 現在地（2026-02-18）

| 項目 | 状態 | 補足 |
|---|---|---|
| フロントモック（`/admin-eval-list`, `/admin-eval-list/candidates`） | ✅ 完了 | localStorage + `mock.ts` 運用 |
| `self_assessments` スキーマ/API | ✅ 完了 | `self_rating_code/self_rating/rating_data/status` を運用 |
| `supervisor_feedback` スキーマ/API | ✅ 完了 | `supervisor_rating_code/supervisor_rating/rating_data/action/status` を運用 |
| 総合評価専用Read API | ⏳ 未実装 | 既存は `/evaluation/goal-list-page` のみ |
| 判定基準CRUD（総合評価） | ⏳ 未実装 | `evaluation_score_mapping` は個別評価コード用のみ |
| 特例反映（手動確定）API + 監査ログ | ⏳ 未実装 | localStorage運用をAPI化する必要あり |

---

## マイルストーン（更新版）

### M1（完了）: フロントのみモック

- 参照: `docs/implementation-storategy/0127-comprehensive-evaluation/03-frontend-mock-summary.md`

### M1.5（完了）: 評価入力ループのDB化

- `self_assessments` / `supervisor_feedback` がDB・APIで稼働
- 総合評価ページで必要な一次データ（目標・自己評価・上司評価）は取得可能な状態

### M2（次）: 総合評価Read API（単一集計） + Frontend実データ接続

- Backend:
  - `GET /api/org/{org_slug}/evaluation/comprehensive-evaluation`
  - `periodId` 必須、部署/ステージ/雇用形態/検索/ページング対応
  - 1回の集計クエリで行DTOを返却（N+1禁止）
- Frontend:
  - `mockComprehensiveEvaluationRows` 依存を廃止
  - `/admin-eval-list` と `/admin-eval-list/candidates` を同APIに接続

### M3: 総合評価判定基準の永続化

- `evaluation_score_mapping` は継続利用（個別評価コードの点数化）
- 総合評価用に別テーブル追加（例: `comprehensive_overall_rank_rules`）
  - 合計点レンジ -> 総合評価ランク -> `level_delta`
- CRUD権限:
  - read: `admin` / `eval_admin`
  - write: `eval_admin`

### M4: 特例反映（手動確定）API + 監査ログ

- `/admin-eval-list/candidates` の確定情報（判定、反映後ステージ、反映後レベル、理由、ダブルチェック者）をDB化
- append-only履歴テーブルを追加し、更新と履歴挿入を同一トランザクションで実行

### M5（任意）: 給与連携/エクスポート

- 総合評価確定結果を給与計算・CSV出力に接続

---

## データ取得方針（最終）

- 方針: **Backend集計済み行DTOを返す**
- 非推奨: Frontendで `goals` / `self-assessments` / `supervisor-feedbacks` / `users` を多重取得して結合
  - 理由: API往復増加、ページ跨ぎで整合性が崩れやすい、集計ロジック重複
- 推奨: Backendで期間単位に集約し、ページング済みReadモデルとして返却

---

## 実装チェックリスト（更新）

### 確定済み

- [x] `self_assessments` のDBスキーマ/制約/API
- [x] `supervisor_feedback` のDBスキーマ/制約/API
- [x] `evaluation_score_mapping`（`rating_code -> score_value`）の組織別運用

### M2で実装

- [ ] 総合評価Read API（単一集計クエリ）
- [ ] モック列のうちDB欠損列の扱いを固定（`-` / `未対応` など）
- [ ] `/admin-eval-list` / `/admin-eval-list/candidates` をAPI接続

### M3以降で実装

- [ ] 総合評価判定基準テーブル（レンジ/ランク/`level_delta`）
- [ ] 特例反映（手動確定）API
- [ ] 監査ログ（append-only）と履歴表示

---

## 関連ドキュメント（読む順）

1. 本書: 実行計画（何をいつ作るか）
2. 要件・算出仕様・データモデル: `docs/implementation-storategy/0127-comprehensive-evaluation/02-comprehensive-evaluation.md`
3. フロントモック現状: `docs/implementation-storategy/0127-comprehensive-evaluation/03-frontend-mock-summary.md`
