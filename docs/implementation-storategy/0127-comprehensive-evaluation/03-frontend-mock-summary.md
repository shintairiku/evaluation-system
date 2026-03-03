<!-- docs/implementation-storategy/0127-comprehensive-evaluation/03-frontend-mock-summary.md -->
# 総合評価（管理者向け）フロントエンド・モック実装まとめ（ステークホルダー確認用）

## リビジョン履歴

| バージョン | 日付 | 変更者 | 変更内容 |
|---|---|---|---|
| v2.0 | 2026-02-26 | AI（Codex） | 評価期間確定フローを追加。`eval_admin`のみ確定可能、確認モーダル経由で`completed`化し、確定時に全ユーザーのレベルを総合結果で一括更新。 |
| v1.9 | 2026-02-20 | AI（Codex） | M2+M3+M4実装を反映。モック/localStorage依存を撤去し、総合評価API・設定API・手動確定API接続後の状態へ更新。 |
| v1.8 | 2026-02-18 | AI（Codex） | `self_assessments` / `supervisor_feedback` の実装完了を反映。モック列のDB可否とM2移行手順（単一集計API）を確定。 |

---

## 1. 本資料の目的

本資料は、総合評価ページのモック実装から本番実装への移行結果を共有するための要約です。  
2026-02-20時点で、M2+M3+M4の実装反映が完了しています。

---

## 2. 現在の実装状況

### 2.1 フロント（M2+M3+M4反映後）

- `/admin-eval-list`（総合評価一覧）: `GET /evaluation/comprehensive-evaluation` で表示
- `/admin-eval-list/candidates`（昇格/降格対応）: 同一覧APIで表示し、手動確定はAPI永続化
- 判定ルール設定: `GET/PUT /evaluation/comprehensive-evaluation/settings` に接続
- 手動確定: `PUT/DELETE /evaluation/comprehensive-evaluation/manual-decisions/{user_id}` に接続
- 評価期間確定: `POST /evaluation/comprehensive-evaluation/finalize` に接続（確認モーダル経由）

### 2.2 バックエンド

- ✅ `self_assessments` スキーマ/API実装済み
- ✅ `supervisor_feedback` スキーマ/API実装済み
- ✅ `evaluation_score_mapping`（`rating_code -> score_value`）実装済み
- ✅ 総合評価専用Read API実装済み
- ✅ 判定ルール設定永続化API実装済み
- ✅ 手動確定/解除API + 履歴API実装済み

---

## 3. モックデータはDBから取れるか

結論: **主要列は取得可能。全列一致は未達。**

| 区分 | 判定 | 備考 |
|---|---|---|
| 社員基本情報、部署、ステージ | 取得可 | `users` + `departments` + `stages` |
| 業績/コンピテンシーの点数・最終評価 | 取得可 | `goals` + `self_assessments` + `supervisor_feedback` で集計可能 |
| 合計点・総合評価・降格フラグ | 取得可 | 総合評価ルールテーブルに基づき算出 |
| 雇用形態 | 取得可 | `roles`（`parttime`）から判定 |
| 現在レベル/新レベル | 取得可 | `users.level` + `level_delta` |
| コアバリュー最終評価 | 未取得 | 360評価の最終結果データ未接続 |
| 面談フラグ3項目 | 未取得 | 現行DBに項目なし |

---

## 4. 画面・権限（現行UI）

- 総合評価テーブル: `/admin-eval-list`
  - 閲覧: `admin` / `eval_admin`
  - 編集: `eval_admin`
  - 評価期間確定（`completed`化 + レベル一括反映）: `eval_admin` のみ
- 昇格/降格対応: `/admin-eval-list/candidates`
  - 閲覧: `admin` / `eval_admin`
  - 編集: `eval_admin`（期間`completed`後は編集不可）

---

## 5. 実装後のAPI方針

### 5.1 API方針

- `GET /api/org/{org_slug}/evaluation/comprehensive-evaluation`
- Backendが集計済み行DTOを返す
- Frontendは表示/フィルタ/編集入力のみ担当（計算ロジックはBackend集約）

### 5.2 なぜ単一APIか（効率）

- `goals` / `self-assessments` / `supervisor-feedbacks` / `users` をFrontendで結合すると、
  - API往復が増える
  - ページング境界で整合が崩れる
  - 集計ロジックが画面側に重複する
- そのため、Backend単一集計を正式方針にする

### 5.3 実装済み変更点

- `mockComprehensiveEvaluationRows` の参照を廃止
- `useComprehensiveEvaluationSettings` / `useComprehensiveEvaluationManualOverrides` の永続先をAPIへ移行
- DB未充足列は一時的に `-` / `未確定` を表示

---

## 6. ローカル保存の扱い

localStorage依存は廃止済み:

- 判定ルール設定: DB永続化（`eval_admin`のみ更新）
- 手動確定: DB永続化 + 監査ログ（理由/ダブルチェック者必須）
- 評価期間確定: 確認モーダルで最終確認後に実行し、実行後はスコア編集を停止

---

## 7. 実装完了チェック

1. 総合評価Read API（単一集計クエリ、期間必須）: 完了
2. フロントのモック依存撤去: 完了
3. 総合評価ルール（閾値/`level_delta`）のDB化: 完了
4. 候補者ページの確定情報と監査ログのDB化: 完了

---

## 8. 参照

- 実装戦略: `docs/implementation-storategy/0127-comprehensive-evaluation/01-comprehensive-evaluation-strategy.md`
- 要件定義: `docs/implementation-storategy/0127-comprehensive-evaluation/02-comprehensive-evaluation.md`
