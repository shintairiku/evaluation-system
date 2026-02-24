<!-- docs/implementation-storategy/0127-comprehensive-evaluation/03-frontend-mock-summary.md -->
# 総合評価（管理者向け）フロントエンド・モック実装まとめ（ステークホルダー確認用）

## リビジョン履歴

| バージョン | 日付 | 変更者 | 変更内容 |
|---|---|---|---|
| v1.8 | 2026-02-18 | AI（Codex） | `self_assessments` / `supervisor_feedback` の実装完了を反映。モック列のDB可否とM2移行手順（単一集計API）を確定。 |

---

## 1. 本資料の目的

本資料は、総合評価ページの現行UI（モック）と、実データ接続への移行方針を共有するための要約です。  
2026-02-18時点で、評価入力ループのDB基盤は整っており、総合評価ページをAPI化する段階に入っています。

---

## 2. 現在の実装状況

### 2.1 フロント（M1）

- `/admin-eval-list`（総合評価一覧）: モックデータ表示
- `/admin-eval-list/candidates`（昇格/降格対応）: モックデータ表示
- 判定ルール設定・手動確定: localStorage保存

### 2.2 バックエンド（M1.5）

- ✅ `self_assessments` スキーマ/API実装済み
- ✅ `supervisor_feedback` スキーマ/API実装済み
- ✅ `evaluation_score_mapping`（`rating_code -> score_value`）実装済み
- ⏳ 総合評価専用Read APIは未実装

---

## 3. モックデータはDBから取れるか

結論: **主要列は取得可能。全列一致は未達。**

| 区分 | 判定 | 備考 |
|---|---|---|
| 社員基本情報、部署、ステージ | 取得可 | `users` + `departments` + `stages` |
| 業績/コンピテンシーの点数・最終評価 | 取得可 | `goals` + `self_assessments` + `supervisor_feedback` で集計可能 |
| 合計点・総合評価・降格フラグ | 取得可 | 総合評価ルールテーブル導入後に確定 |
| 雇用形態 | 取得可 | `roles`（`parttime`）から判定 |
| 現在レベル/新レベル | 未取得 | `users.level` がない |
| コアバリュー最終評価 | 未取得 | 360評価の最終結果データ未接続 |
| 面談フラグ3項目 | 未取得 | 現行DBに項目なし |

---

## 4. 画面・権限（現行UI）

- 総合評価テーブル: `/admin-eval-list`
  - 閲覧: `admin` / `eval_admin`
  - 編集: `eval_admin`（モック時点はフロントガード）
- 昇格/降格対応: `/admin-eval-list/candidates`
  - 閲覧/編集: `eval_admin`

---

## 5. M2移行方針（モック -> 実データ）

### 5.1 API方針

- 新規: `GET /api/org/{org_slug}/evaluation/comprehensive-evaluation`
- Backendが集計済み行DTOを返す
- Frontendは表示/フィルタ/編集入力のみ担当

### 5.2 なぜ単一APIか（効率）

- `goals` / `self-assessments` / `supervisor-feedbacks` / `users` をFrontendで結合すると、
  - API往復が増える
  - ページング境界で整合が崩れる
  - 集計ロジックが画面側に重複する
- そのため、Backend単一集計を正式方針にする

### 5.3 フロント変更点

- `mockComprehensiveEvaluationRows` の参照を廃止
- `useComprehensiveEvaluationSettings` / `useComprehensiveEvaluationManualOverrides` の永続先をAPIへ移行
- DB未充足列は一時的に `-` / `未確定` を表示

---

## 6. ローカル保存の扱い

現状localStorageを使っている項目:

- 判定ルール設定
- 手動確定（候補者ページ）

本番移行方針:

- 判定ルール: DB永続化（`eval_admin`のみ更新）
- 手動確定: DB永続化 + 監査ログ（理由/ダブルチェック者必須）

---

## 7. 次マイルストーン（確定）

1. 総合評価Read API実装（単一集計クエリ、期間必須）
2. フロントのモック依存撤去
3. 総合評価ルール（閾値/`level_delta`）のDB化
4. 候補者ページの確定情報と監査ログのDB化

---

## 8. 参照

- 実装戦略: `docs/implementation-storategy/0127-comprehensive-evaluation/01-comprehensive-evaluation-strategy.md`
- 要件定義: `docs/implementation-storategy/0127-comprehensive-evaluation/02-comprehensive-evaluation.md`
