<!-- docs/implementation-storategy/0127-comprehensive-evaluation/05-stage-level-change-history.md -->
# ステージ・レベル変更履歴（総合評価連携）実装計画（Backend/DB）

## リビジョン履歴

| バージョン | 日付 | 変更者 | 変更内容 |
|---|---|---|---|
| v1.0 | 2026-02-02 | AI（Codex） | 「総合評価」起点のステージ/レベル変更をDBに監査ログとして永続化する計画を作成 |
| v1.1 | 2026-02-04 | AI（Codex） | 昇格/降格（ステージ変更）は手動確定とし、ステージ変更時のレベルも手動確定（正社員は必須）に統一 |

---

## 1. 目的

管理画面「総合評価（/admin-eval-list）」で確認する **ステージ/レベル** について、運用上の手動反映（特例・確定処理など）を含め、**変更のたびに必ずDBへ履歴（監査ログ）を残す**。

要件:
- ステージ/レベルの変更は **必ず履歴が残る**（抜け漏れ防止）
- **理由** と **ダブルチェック**（確認者情報）を必須として記録する
- 監査用途で「誰が・いつ・何を（Before/After）」が追える
- 昇格フラグ/降格フラグ点灯者に対するステージ変更（アップ/ダウンの確定）は **`eval_admin` が手動で行う**
  - 確定時は「反映後ステージ」と「反映後レベル（正社員のみ）」を **確定値として手動入力** する（増減入力はしない）

---

## 2. 監査ログの基本方針

- **append-only（追記のみ）**: 履歴テーブルは原則UPDATE/DELETEしない（誤操作や改ざんの検知をしやすくする）
- **トランザクションで一括**: 「ユーザーの現在値更新」と「履歴挿入」を同一トランザクションで行う
- **単一の更新経路**: ステージ/レベル更新は “必ず履歴を残す” サービス関数（API）を経由する（直接UPDATEを禁止する運用/実装に寄せる）

---

## 3. データモデル案（推奨）

### 3.1 現在値（Users）

- `users.stage_id` は既存を利用
- `users.level`（正社員のみ・`1..30`、パートは `NULL`）を追加
  - DB制約（例）: `CHECK (level IS NULL OR (level BETWEEN 1 AND 30))`
  - パート判定はDB制約で表現しづらいので、アプリ側（更新API）で `parttime` の場合は `NULL` 強制にする

### 3.2 履歴テーブル（例）

テーブル例: `comprehensive_evaluation_stage_level_history`

必須カラム:
- `id`（UUID）
- `organization_id`
- `evaluation_period_id`（総合評価の評価期間に紐づける）
- `user_id`（対象ユーザー）
- `actor_user_id`（更新者）
- `double_checked_by`（確認者: 当面はTEXT。将来 `double_checked_by_user_id` に拡張可）
- `reason`（必須）
- `stage_id_before`, `stage_id_after`
- `level_before`, `level_after`
- `changed_at`（TIMESTAMPTZ）

索引（例）:
- `(organization_id, user_id, changed_at DESC)`（個人の履歴一覧用）
- `(organization_id, evaluation_period_id, changed_at DESC)`（評価期間内の監査・集計用）

---

## 4. API/サービス実装方針（概要）

### 4.1 変更API（例）

- `POST /api/org/{org_slug}/comprehensive-evaluation/users/{user_id}/stage-level`
  - 入力: `evaluationPeriodId`, `stageIdAfter`, `levelAfter`（nullable）, `reason`（必須）, `doubleCheckedBy`（必須）
  - 認可: `eval_admin` 相当（サーバ側で強制）
  - 処理:
    1) org/period/user/stage の存在確認
    2) `levelAfter` バリデーション（`NULL` or `1..30`、パートは `NULL` 強制）
       - 追加要件: `stageIdAfter` が変更される（昇格/降格）場合、**正社員は `levelAfter` 必須**（空のまま確定させない）
    3) `users.stage_id` / `users.level` を「After値」で更新
    4) 履歴テーブルに before/after を INSERT
    5) コミット

### 4.2 履歴取得API（例）

- `GET /api/org/{org_slug}/comprehensive-evaluation/users/{user_id}/stage-level-history?evaluationPeriodId=...&limit=20`
  - 監査画面/ユーザー詳細から参照できるようにする

---

## 5. フロント（モック）との接続方針

現状は **フロントのみモック（localStorage保存）** のため、Backend/DBが入るタイミングで以下を差し替える:
- 特例反映（手動上書き）の「反映」操作:
  - 現状: localStorage に保存
  - 将来: `POST .../stage-level` を呼び出し、成功時に画面を再取得（または楽観更新）
- 「履歴」表示:
  - 将来: `GET .../stage-level-history` の結果を表示

---

## 6. ロールアウト手順（実行計画）

1) DB migration
   - `users.level` の追加
   - 履歴テーブル + index の追加
2) Backend API/Service 実装（履歴必須の更新経路を用意）
3) フロントの保存先を localStorage → API に切替
4) 監査UI（履歴表示）の追加（必要なら）
5) 運用ルール
   - 「手動反映は理由・ダブルチェック必須」
   - 例外的な直UPDATE禁止（必ず専用API経由）
