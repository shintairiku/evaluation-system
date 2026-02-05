<!-- docs/implementation-storategy/0127-comprehensive-evaluation/01-comprehensive-evaluation-strategy.md -->
# 総合評価（管理者向けテーブル）実装戦略 / 実行計画

## TL;DR

- Backendで集計した「行DTO」を返す一覧APIを作り、Frontendは表示/フィルタ/編集UIに専念する
- 判定基準（`evaluation_score_mapping`）は `eval_admin` のみ編集可能（`admin` は閲覧のみ）
- 昇格/降格フラグは固定ルールで点灯し、ステージ変更と反映後レベルは `eval_admin` が手動確定 + 監査ログ必須
  - 昇格フラグ: 正社員のみ `新レベル >= 30`
  - 降格フラグ: （単一の）評価期間の `総合評価 = D`

## 関連ドキュメント（読む順）

1. 本書: 実行計画（何をいつ作るか）
2. 要件・算出仕様・データモデル: `docs/implementation-storategy/0127-comprehensive-evaluation/02-comprehensive-evaluation.md`
3. ステークホルダー確認用（フロントモックの現状）: `docs/implementation-storategy/0127-comprehensive-evaluation/03-frontend-mock-summary.md`

---

## 前提（確定ルール）

- 合計点 = 業績点 + コンピテンシー点（コアバリューは合計に含めない）
- 昇格/降格フラグの点灯は固定（上記 TL;DR の通り）
- ステージ変更（アップ/ダウン）は自動反映しない
  - フラグ点灯者に対して `eval_admin` が手動で確定し、理由 + ダブルチェック者 + 監査ログを必須とする
  - 確定時の「反映後レベル（正社員のみ）」は 1〜30 を手動確定（増減入力ではなく確定値入力）
- 将来拡張（任意）として、複合条件（`AND`/`OR`）のルールを持てる設計にする（ただし判定ロジックはBackendに集約）

---

## マイルストーン

### M1（完了）: フロントのみモック（localStorage）

- 参照: `docs/implementation-storategy/0127-comprehensive-evaluation/03-frontend-mock-summary.md`

### M2: Backend集計API + Frontend実データ接続（閲覧）

- Backend: 総合評価一覧API（行DTO）を実装
- Frontend: `/admin-eval-list` をAPI接続に切替（フィルタ/検索/表示）

### M3: 判定基準の永続化（`evaluation_score_mapping` CRUD）

- `evaluation_score_mapping` のCRUDを追加（`eval_admin` のみ編集可能）
- 範囲重複などのバリデーションをBackendで強制

### M4: 特例反映（手動確定）の永続化 + 監査ログ

- ステージ/レベル更新API（理由/ダブルチェック必須） + 履歴API
- `/admin-eval-list/candidates` を localStorage → API に切替

### M5（任意）: 給与表示/エクスポート/シミュレーション

- 仕様は `docs/implementation-storategy/0127-comprehensive-evaluation/02-comprehensive-evaluation.md` の「ステージ・レベル・給与」節を前提に追加検討

---

## 実装チェックリスト

### 着手前（決める）

- [ ] `evaluation_score_mapping` の実スキーマ確認（`mapping_type` 等の有無）
- [ ] 「現在レベル」のデータソース確定（`users.level` 追加の是非）
- [ ] ステージ/給与マスタ確定（正社員: stage別レベル給、パート: stage別時給）

### Backend

- [ ] `evaluation_score_mapping` CRUD（RBAC: read `admin`/`eval_admin`, write `eval_admin`）
- [ ] 総合評価集計サービス + `GET /reports/comprehensive-evaluation`
- [ ] （M4）ステージ/レベル更新API + 履歴テーブル（append-only）
- [ ] テスト: 点数算出/境界/欠損、範囲重複、権限、履歴

### Frontend

- [ ] `/admin-eval-list` をAPI接続に切替（列/表示はモックと同等）
- [ ] 判定基準編集UIをAPI接続に切替（`eval_admin` のみ）
- [ ] `/admin-eval-list/candidates` を特例反映APIに切替（理由/ダブルチェック必須）

