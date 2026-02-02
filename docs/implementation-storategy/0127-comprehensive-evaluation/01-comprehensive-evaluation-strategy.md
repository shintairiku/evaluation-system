# 総合評価（管理者向けテーブル）実装戦略書

## 概要

管理者が「総合評価（Comprehensive Evaluation）」をスプレッドシート同等の表形式で確認できるようにする。

- 業績（定量+定性）とコンピテンシーの点数を合算し、総合評価を算出
- コアバリュー評価は合算対象外だが同一ビューに表示
- 昇格/降格/昇給/レベル増減などの結果を表示
- 判定基準（`evaluation_score_mapping`）は「総合評価アドミン（`eval_admin`）」ロールのみ編集可能（`admin`は閲覧のみ）

要件定義: `docs/requirement-definition/04-feature/02-comprehensive-evaluation.md`

---

## 前提（重要）

- `evaluation_score_mapping` テーブルは既に存在している（スキーマは実装前に必ず確認する）
- ステージの重み（`stages.quantitative_weight`, `stages.qualitative_weight`, `stages.competency_weight`）は既に導入済み
  - デフォルト: 業績（定量+定性）合計100%、コンピテンシー10%（合計110%）
- 現在レベル（数値）の保持場所が未確定な場合は、まずデータソースを確定する

---

## 実装方針（大枠）

### 方針A（推奨）：サーバー側で集計し、フロントは表示に専念

- Backendで「総合評価テーブル1行分」のDTOを組み立て、一覧APIで返す
- Frontendはフィルタ/並び替え/表示・編集UIのみ担当

メリット:
- 計算ロジックを一箇所（バックエンド）に集約でき、監査/テストしやすい
- フロントのロジック肥大化を防げる

---

## 実装ステップ

### Step 0. 仕様確定・スキーマ確認（着手前に必須）

1. `evaluation_score_mapping`の実スキーマ確認
   - 例: `min_score`, `max_score`, `rank`, `level_delta`, `promotion_flag`, `salary_action`等があるか
   - 「＜最終評価・点数対応表＞」と「＜総合評価・点数対応表＞」を同一テーブルで保持する場合は、`mapping_type`等で識別できるか確認する
2. 「現在レベル」のデータソース確認
   - `users`にカラム追加が必要か、外部マスタ参照か
3. ステージ/レベルと給与（基本給/時給）マスタの確定
   - 正社員: ステージ内レベル（1〜30）と、ステージ別「レベルあたり増額」をどう保持するか
   - パートタイム: レベルなし、ステージに紐づく時給をどう保持するか
   - 仕様: `docs/implementation-storategy/0127-comprehensive-evaluation/04-stage-level-compensation.md`
4. MBO D評価フラグの正式要件化
   - 「上期/下期」の評価期間紐付け（年次と半期の関係モデル）

---

### Step 1. Backend：`evaluation_score_mapping`アクセス層

目的: 判定基準を読み書きできるようにする（編集は`eval_admin`のみ）。

- Model（SQLAlchemy）
  - `backend/app/database/models/evaluation_score_mapping.py`（新規）
- Repository
  - `backend/app/database/repositories/evaluation_score_mapping_repo.py`（新規）
  - orgスコープの適用（既存repoと同様の方針）
- Service
  - `backend/app/services/evaluation_score_mapping_service.py`（新規）
  - レンジ重複チェック（同一`mapping_type`内）、境界ルール統一（`min <= score < max`等）
- API
  - `backend/app/api/v1/evaluation_score_mappings.py`（新規）
  - `GET`（閲覧: `admin`/`eval_admin`）
  - `POST/PUT/DELETE`（編集: `eval_admin`）

RBAC:
- Backendは `require_role(["eval_admin"])` を使用して編集を保護（`admin`は閲覧のみ）

---

### Step 2. Backend：総合評価テーブル集計サービス

目的: 画面に必要な「一覧の行データ」を1回のAPIで返す。

- Service
  - `backend/app/services/comprehensive_evaluation_service.py`（新規）
  - 主要責務:
    - 対象ユーザー一覧（部署/ステージ等で絞り込み）
    - 目標・上司評価点の取得（カテゴリ別、期間別）
    - 点数算出（業績点/コンピテンシー点/合計点）
    - `evaluation_score_mapping`でカテゴリ別の最終評価（目標達成/コンピテンシー）と、合計点からの総合評価・昇降格/昇給/レベル増減を決定
    - 欠損値（未評価）の扱いを統一（例: `null`で返す）
- Schema（Pydantic）
  - `backend/app/schemas/comprehensive_evaluation.py`（新規）
  - 行DTO: `ComprehensiveEvaluationRow`
  - レスポンス: `ComprehensiveEvaluationListResponse`（ページング/合計件数も考慮）
- API
  - `backend/app/api/v1/reports.py` or `backend/app/api/v1/comprehensive_evaluation.py`（新規）
  - `GET /reports/comprehensive-evaluation`
  - アクセス: `admin`/`eval_admin`

パフォーマンス:
- 可能な限りDB集計（GROUP BY / JOIN）でN+1を回避
- まずは「期間ID + 組織ID」で必要データをまとめて取得し、Python側で最終合成するのが現実的

---

### Step 3. Frontend：管理者向けページ（単一ページ）

目的: 添付スプレッドシート同等の一覧を表示し、必要に応じて基準編集UIを提供する。

- Route（案）
  - `frontend/src/app/(evaluation)/(admin)/admin-eval-list/page.tsx`
- UI実装（案）
  - フィルタバー（評価期間/部署/ステージ/検索）
  - テーブル（固定ヘッダー/横スクロール）
  - 未確定（`null`）表示の統一（例: `-`）
  - 新レベル>=31の強調（アラート色/バッジ）
- 権限制御
  - `RolePermissionGuard`でページ閲覧を制御
  - `eval_admin`のみ「基準編集」ボタン表示
- 基準編集UI（案）
  - 同一ページ内のモーダル/ドロワーで`evaluation_score_mapping`を編集
  - レンジ重複や必須入力はフロントでもバリデーション（最終責務はバックエンド）

---

### Step 4. テスト / 検証

Backend（優先）:
- 点数算出のユニットテスト（境界値、欠損値、重み未満、丸め）
- `evaluation_score_mapping`のレンジ判定テスト（重複禁止、境界ルール）
- 権限テスト（`admin`は編集不可、`eval_admin`は編集可）

Frontend（必要に応じて）:
- 表示レンダリングのスナップショット/コンポーネントテスト
- 権限に応じたボタン表示の切り替え

---

## リリース順（推奨）

1. 閲覧のみ（テーブル表示 + 合計点 + 総合評価 + 昇降格/レベル増減表示）
2. `evaluation_score_mapping`の編集（`eval_admin`限定）
3. 例外ルール（MBO Dフラグの年次/半期連携）
4. エクスポート、シミュレーション等の拡張
