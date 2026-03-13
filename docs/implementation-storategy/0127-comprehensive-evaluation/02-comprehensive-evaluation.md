<!-- docs/implementation-storategy/0127-comprehensive-evaluation/02-comprehensive-evaluation.md -->
# 総合評価（Comprehensive Evaluation）要件定義（管理者向けテーブル）

## リビジョン履歴

| バージョン | 日付 | 変更者 | 変更内容 | 承認状況 |
|---|---|---|---|---|
| v1.6 | 2026-02-26 | AI（Codex） | 評価期間確定フローを追加。`eval_admin`のみ期間確定、確定時にユーザーレベル一括反映、確定後スコア編集ロック。 | 🔄 レビュー中 |
| v1.5 | 2026-02-20 | AI（Codex） | M2+M3+M4を実装反映。`users.level` 追加、総合評価API/設定永続化/手動確定履歴、`eval_admin` ロール運用、rawスコア集計（`/10`正規化なし）に更新。 | 🔄 レビュー中 |

---

## TL;DR（結論）

- `self_assessments` / `supervisor_feedback` のDBスキーマとAPIは利用中
- M2+M3+M4として、総合評価一覧API・設定永続化・手動確定/履歴APIを実装済み
- 本番はFrontend集約ではなく、Backendが集計済み行DTOを返す
  - `GET /api/org/{org_slug}/evaluation/comprehensive-evaluation`
  - 期間必須、フィルタ/検索/ページング対応
  - N+1禁止、単一集計クエリを基本とする
- `evaluation_score_mapping` は「個別評価コード（SS/S/A/B/C/D）→数値」の責務に固定し、総合評価用閾値は別テーブルで管理する
- 総合評価の点数はDBのraw永続値（`self_rating` / `supervisor_rating`）を使用し、`/10` 正規化は行わない

---

## 1. 目的 / 背景

従来の総合評価シート（スプレッドシート）をシステム化し、管理者が評価期間ごとの最終判定を一画面で確認・確定できるようにする。

- 業績目標/コンピテンシーの上司評価を集計し、総合評価を算出する
- コアバリューは合計点には含めず、同一画面で並列表示する
- 昇格/降格フラグの検知と、`eval_admin` による手動確定を行う

---

## 2. 対象スコープ

### 2.1 対象（今回）

- 管理者向け総合評価テーブル（単一ページ）
- DB実データ（`goals` / `self_assessments` / `supervisor_feedback` / `users`）を使った集計表示
- 総合評価判定基準の管理（`eval_admin` 編集）
- 昇格/降格対象者の手動確定（理由・ダブルチェック者必須）

### 2.2 対象外（別途）

- CSV/Excelエクスポート
- 360評価の詳細集計ロジック（本書では「最終結果を表示する前提」のみ扱う）
- 給与計算の自動反映

---

## 3. 実装済み前提（2026-02-20時点）

### 3.1 DB / API 反映済み

| 領域 | 状態 | 要点 |
|---|---|---|
| `self_assessments` | ✅ 実装済み | `self_rating_code`, `self_rating`（組織マップ済みraw値）, `rating_data`, `status(draft/submitted/approved)` |
| `supervisor_feedback` | ✅ 実装済み | `supervisor_rating_code`, `supervisor_rating`（組織マップ済みraw値）, `rating_data`, `action(PENDING/APPROVED)`, `status` |
| `evaluation_score_mapping` | ✅ 実装済み | 組織別 `rating_code -> score_value`（`SS/S/A/B/C/D`） |
| 総合評価専用API | ✅ 実装済み | `GET/PUT/DELETE /evaluation/comprehensive-evaluation*` を提供 |
| 総合評価設定テーブル群 | ✅ 実装済み | `comprehensive_overall_rank_rules`, `comprehensive_decision_rule_groups`, `comprehensive_decision_rules` |
| 手動確定テーブル群 | ✅ 実装済み | `comprehensive_manual_decisions`, `comprehensive_manual_decision_history`, `comprehensive_settings_audit_log` |
| `users.level` | ✅ 実装済み | nullable + `CHECK (level IS NULL OR (level >= 1 AND level <= 30))` |
| `eval_admin` ロール | ✅ 実装済み | 組織単位でseed、write権限を担当 |

### 3.2 現行スキーマ上の制約（重要）

- `users` に `employment_type` はない
  - 雇用形態は `roles`（例: `parttime`）から判定する
- コアバリュー目標は評価コード入力を許可しない運用
  - `coreValueFinalRank` は別系統の評価結果ソースが必要

---

## 4. ロール / 権限制御

| 操作 | `admin` | `eval_admin` |
|---|---:|---:|
| 総合評価テーブル閲覧 | ✅ | ✅ |
| フィルタ/検索 | ✅ | ✅ |
| 判定基準閲覧 | ✅ | ✅ |
| 判定基準作成/更新/削除 | ❌ | ✅ |
| 特例反映（手動確定） | ❌ | ✅ |
| 評価期間確定（`completed`化 + レベル反映） | ❌ | ✅ |

---

## 5. 算出仕様（DB実データ前提）

### 5.1 使用テーブル

- `goals`（`goal_category`, `weight`, `status`, `user_id`, `period_id`）
- `self_assessments`（`goal_id`, `status`, `self_rating_code`, `self_rating`）
- `supervisor_feedback`（`self_assessment_id`, `status`, `action`, `supervisor_rating_code`, `supervisor_rating`）
- `users`, `departments`, `stages`, `user_roles`, `roles`

### 5.2 基本集計（合計点）

- 基本は上司評価（`supervisor_feedback.supervisor_rating`）を採用
- `業績スコア = Σ(業績目標の supervisor_rating × goal.weight) / 100`
- `コンピテンシースコア = Σ(コンピテンシー目標の supervisor_rating × goal.weight) / 100`
- `合計点 = 業績スコア + コンピテンシースコア`
- raw永続値をそのまま利用し、`/10` 正規化は行わない

### 5.3 総合評価ランク

- `合計点` を総合評価ランク閾値テーブルで判定する
- ランク別 `level_delta` は同ルールテーブルで管理する
- 既存 `evaluation_score_mapping` は個別評価コードの点数化専用として使用する

### 5.4 フラグ判定

- 昇格フラグ: 正社員相当かつ昇格判別ルールにヒット
- 降格フラグ: 降格判別ルールにヒット
- ステージ変更は自動反映しない（`eval_admin` 手動確定）

### 5.5 未確定データの扱い

- 必須入力不足でカテゴリ点を算出できない場合は `-` 表示
- 合計点が `NULL` の行は `総合評価` を `未確定` 扱い

---

## 6. モック列のDB可否（確定）

| モック列 | DB取得可否 | 取得元 / 補足 |
|---|---|---|
| 社員番号・氏名・部署 | ✅ | `users` + `departments` |
| 雇用形態 | ✅ | `roles.name = parttime` ならパート、それ以外は正社員扱い |
| 現在ステージ | ✅ | `users.stage_id -> stages.name` |
| 業績/コンピテンシー 点数 | ✅ | `goals` + `self_assessments` + `supervisor_feedback` の集計 |
| 業績/コンピテンシー 最終評価 | ✅ | 集計点を総合評価用ルールでマッピング |
| 合計点 / 総合評価 | ✅ | 上記集計 + 閾値マッピング |
| 昇格/降格フラグ | ✅ | 昇格: ルールヒットかつ正社員、降格: 降格ルールヒット |
| 処理状態（processed/unprocessed） | ✅ | `goals/self_assessments/supervisor_feedback` の状態から導出 |
| コアバリュー最終評価 | ⚠️ 要別ソース | 360評価結果テーブル等が必要 |
| 現在レベル / 新レベル | ✅ | `users.level` と `level_delta` から算出（`level`未設定時は `NULL`） |
| 面談系フラグ（3列） | ❌ | 現行DBに項目なし（モック専用） |

---

## 7. データ取得API要件（効率方針を確定）

### 7.1 エンドポイント

- `GET /api/org/{org_slug}/evaluation/comprehensive-evaluation`

### 7.2 クエリパラメータ

- 必須: `periodId`
- 任意: `departmentId`, `stageId`, `employmentType`, `search`, `processingStatus`, `page`, `limit`

### 7.3 取得戦略（最終）

- **Backend単一集計クエリ**（CTE）で行DTOを作成して返す
- Frontendは一覧表示・フィルタ入力・手動確定操作のみ担当
- Frontendで4系統APIを横断結合する方式は禁止

推奨クエリ構成:

1. `target_users`: 組織 + フィルタ済みユーザー集合  
2. `target_goals`: 期間 + 対象ユーザーの目標  
3. `joined_scores`: `goals` と `self_assessments` / `supervisor_feedback` を結合  
4. `aggregated`: ユーザー単位にカテゴリ点・件数・状態を集計  
5. 閾値テーブルとJOINして `overallRank` / `levelDelta` を確定  

### 7.4 パフォーマンス要件

- DBラウンドトリップ: 一覧取得は原則1回
- N+1クエリ: 禁止
- `limit`: デフォルト50 / 最大200
- 必要に応じて `periodId` + フィルタ単位で短TTLキャッシュ（30〜60秒）

### 7.5 インデックス方針

既存活用:

- `goals`: `idx_goals_user_period`
- `self_assessments`: `idx_self_assessments_period_status`, `idx_self_assessments_goal_unique`
- `supervisor_feedback`: `idx_supervisor_feedback_period_status`, `idx_supervisor_feedback_assessment_unique`

追加推奨（集計API導入時）:

- `goals(period_id, user_id, goal_category, status)`
- `self_assessments(period_id, goal_id, status)`
- `supervisor_feedback(period_id, self_assessment_id, status, action)`

---

## 8. 判定基準管理（整理）

### 8.1 現行テーブルの責務

- `evaluation_score_mapping`:
  - 目的: `rating_code -> score_value`
  - 対象: 個別目標評価（`self_assessments` / `supervisor_feedback`）
  - 維持方針: 現行責務のまま運用

### 8.2 総合評価ルール（新規）

総合評価ページ用に別テーブルを追加する。

例:

- `comprehensive_overall_rank_rules`
  - `organization_id`, `min_score`, `max_score`, `overall_rank`, `level_delta`, `display_order`, `is_active`

将来拡張:

- `comprehensive_decision_rules`
  - `AND/OR` 条件式、優先順位、適用範囲

### 8.3 バリデーション

- 同一組織内の点数レンジ重複禁止
- 境界ルール統一（例: `min <= score < max`）
- 変更は `eval_admin` のみ
- 変更履歴を監査ログとして保持

---

## 9. 特例反映（手動確定）/ 監査ログ

### 9.1 要件

- 昇格/降格対象に対して `eval_admin` が手動確定
- 必須入力: 判定、理由、ダブルチェック者
- 正社員は反映後レベルを確定（判定が`対象外`以外のとき必須）

### 9.2 実装方針

- ローカル保存（現行）を廃止しDB永続化へ移行
- 更新と履歴挿入を同一トランザクションで実施
- append-only履歴テーブルを採用

---

## 10. 受け入れ条件（Acceptance Criteria）

- [x] `/admin-eval-list` がモックではなく総合評価APIから表示される
- [x] 合計点/総合評価がDBデータで算出される（raw永続値、`/10`正規化なし）
- [x] モック列の不足項目は仕様通りに `-` / `未確定` 表示される
- [x] `admin` は閲覧のみ、`eval_admin` は判定基準編集可能
- [x] 一覧取得が単一集計クエリで動作し、N+1が発生しない
- [x] 特例反映がAPI経由で永続化され、監査ログを追跡できる
- [x] `eval_admin`のみ評価期間を確定でき、確定時に全ユーザーのレベルが反映される
- [x] 評価期間確定後、スコア変更系操作（自己評価/上司評価）は拒否される

---

## 11. 未決定事項 / 要確認

- コアバリュー最終評価の正式データソース（360評価結果）をどこに置くか
- ステージ・レベル・給与連携の確定仕様
- 面談系フラグを総合評価対象に含めるか（含めるならDB設計が必要）

---

## 12. 関連資料

- 実装戦略 / 実行計画: `docs/implementation-storategy/0127-comprehensive-evaluation/01-comprehensive-evaluation-strategy.md`
- フロントモックまとめ: `docs/implementation-storategy/0127-comprehensive-evaluation/03-frontend-mock-summary.md`
- 機能一覧: `docs/requirement-definition/04-feature/01-feature-list.md`
