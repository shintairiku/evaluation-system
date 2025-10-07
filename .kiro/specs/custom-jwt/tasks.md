# 実装計画: Custom JWT Token Enhancement with Organization Support

> このドキュメントは、JWT 検証の厳格化、組織スコープ化ルーティング、DAL 強制フィルタリング、Webhook 強化の設計書に基づいて実際に行う開発タスクを洗い出し、管理するためのものです。実装中の変更も記録し、後から振り返りを容易にします。

## 機能A: 認証基盤とメタデータ管理

### 1. Clerk 組織機能とカスタムクレーム設定
> Clerk の組織機能を活用し、JWT にネイティブ組織クレームを含める基盤を構築します。

- [x] **1.1. 組織機能の有効化とJWT テンプレート設定**
  > Clerk Dashboard で組織機能を有効化し、JWT テンプレートに org_id, org_slug, org_role を含める設定を行います。
  >
  > **関連要件:** セキュリティ要件 1.1, 1.2
  > **実装メモ:** 既存設定を利用

- [x] **1.2. カスタム JWT クレームとメタデータ型定義**
  > Public/Private Metadata の型定義とカスタムクレームのフォールバック機能を実装します。
  >
  > **関連要件:** セキュリティ要件 1.3
  > **実装メモ:** 既存実装を強化

- [x] **1.3. Webhook 設定と署名検証**
  > 組織とユーザーイベントの Webhook エンドポイントを設定し、署名検証機能を実装します。
  >
  > **関連要件:** セキュリティ要件 1.4
  > **実装メモ:** svix ライブラリ使用

### 2. データベーススキーマ組織対応
> 既存のデータベーススキーマに組織スコープ機能を追加します。

- [x] **2.1. 組織テーブルとユーザー関連付け**
  > `organizations` テーブルと `users.clerk_organization_id` 列の追加、インデックス設定を行います。
  >
  > **関連要件:** データ要件 2.1
  > **実装メモ:** 既存マイグレーション利用

- [x] **2.2. 組織識別子とドメイン制約**
  > `organizations.slug` のユニーク制約と `domain_settings` の組織スコープ制約を追加します。
  >
  > **関連要件:** データ要件 2.2

## 機能B: バックエンド認証とデータアクセス制御

### 3. JWT 検証とクレーム処理の強化
> JWT の署名検証を厳格化し、組織クレームの正規化処理を実装します。

- [x] **3.1. JWKS による署名検証実装**
  > `AuthService.get_user_from_token` に JWKS ベースの署名検証を実装し、iss/aud/exp/nbf チェックを追加します。
  >
  > **関連要件:** セキュリティ要件 3.1
  > **実装メモ:** `get_auth_context` で実装済み

- [x] **3.2. 組織クレーム正規化処理**
  > JWT の org_id/org_slug/org_role を優先し、カスタムクレームをフォールバックとする正規化処理を実装します。
  >
  > **関連要件:** セキュリティ要件 3.2
  > **実装メモ:** AuthContext で実装済み

- [x] **3.3. 環境変数とセキュリティ設定**
  > `CLERK_ISSUER`, `CLERK_AUDIENCE` 等の必須環境変数を追加し、検証設定を強化します。
  >
  > **関連要件:** セキュリティ要件 3.3
  > **実装メモ:** 環境設定完了

### 4. 組織スコープ化ルーティング
> 組織スラッグベースのルーティングシステムを構築します。

- [x] **4.1. 組織スコープAPIルートの導入**
  > `/api/org/{org_slug}/...` 形式の新しいルート体系を最小セットから導入します。
  >
  > **関連要件:** API要件 4.1
  > **実装状況:** ✅ 完了 - 全業務エンドポイントを組織スコープ化、フロントエンド API クライアント対応済み

- [x] **4.2. OrgSlug ガードミドルウェア実装**
  > URL の org_slug と JWT の組織情報を照合し、org_id→slug 解決を行うミドルウェアを実装します。
  >
  > **関連要件:** API要件 4.2
  > **実装状況:** ✅ 完了 - `OrgSlugValidationMiddleware` 実装済み、JWT クレーム検証・組織アクセス制御機能

- [x] **4.3. 非所属ユーザーのアクセス制御**
  > 組織に所属していないユーザーの `/api/org/...` アクセスを拒否する仕組みを実装します。
  >
  > **関連要件:** セキュリティ要件 4.3
  > **実装状況:** ✅ 完了 - ミドルウェアレベルで組織所属検証、非所属ユーザーは 403/404 エラー

- [x] **4.4. 旧ルートの段階的非推奨化**
  > `/api/v1/...` ルートの段階的非推奨化と互換レイヤを実装します。
  >
  > **関連要件:** 互換性要件 4.4
  > **実装状況:** ✅ 完了 - 直接移行アプローチ採用、認証系のみ `/api/v1/auth/` 保持、全業務ルート削除

### 5. データアクセス層の組織フィルタリング強制
> 全てのデータアクセスに組織スコープフィルタを強制適用します。

- [x] **5.1. 組織フィルタ共通ヘルパ実装**
  > `apply_org_scope`, `apply_org_scope_via_user`, `apply_org_scope_via_goal` 等の共通ヘルパを実装します。
  >
  > **関連要件:** データ要件 5.1
  > **実装メモ:** 全リポジトリで実装済み

- [x] **5.2. 全クエリの組織フィルタ適用**
  > 全ての SELECT/UPDATE/DELETE クエリに組織フィルタを適用し、抜け漏れを監査します。
  >
  > **関連要件:** データ要件 5.2
  > **実装メモ:** 全リポジトリで適用済み
  >
  > **実装詳細（2025-01-XX 完了）:**
  > - **StageService 修正**: `current_user_context.organization_id` を全リポジトリ呼び出しに適用
  >   - `get_all()`, `get_by_id()`, `create()`, `update()`, `delete()`, `count_users_by_stage()` メソッドに org_id パラメータ追加
  > - **RoleService 修正**: 全リポジトリ呼び出しに org_id パラメータ適用
  >   - `get_all()`, `get_by_id()`, `create_role()`, `update_role()` メソッドに org_id パラメータ追加
  >   - バリデーション用ヘルパーメソッド (`_validate_role_*`) にも org_id パラメータ適用
  > - **UserService 修正**: バリデーション系呼び出しに org_id パラメータ適用
  >   - `_validate_user_creation()`, `_validate_user_update()` メソッドで role/stage 存在チェックに org_id 適用
  > - **CompetencyService 修正**: stage 存在チェックに org_id パラメータ適用
  >   - `create_competency()`, `update_competency()` メソッドで `get_by_id()` 呼び出しに org_id 適用
  > - **DepartmentService 修正**: 全 CRUD 操作に org_id パラメータ適用
  >   - `create_department()`, `update_department()`, `delete_department()` メソッドに org_id パラメータ追加
  >   - バリデーション用ヘルパーメソッド (`_validate_department_*`) にも org_id パラメータ適用
  > - **DepartmentRepository 修正**: `update_department()`, `delete_department()` メソッドに org_id パラメータ追加
  >   - 組織スコープでのユーザーカウントチェックと削除処理に org_id 適用
  > - **Repository メソッドシグネチャ統一**: 全ての `get_by_id()`, `get_all()` 系メソッドで org_id パラメータ必須化

- [x] **5.3. 書込み時の組織整合性検証**
  > データ作成・更新時に対象レコードが同一組織であることを検証する仕組みを実装します。
  >
  > **関連要件:** データ要件 5.3
  > **実装メモ:** 全サービスで検証済み
  >
  > **実装詳細（2025-01-XX 完了）:**
  > - **StageService**: `get_by_id()` 呼び出しで存在チェック時に org_id 検証
  > - **RoleService**: 作成/更新時の `get_by_name()` 呼び出しで同名重複チェックに org_id 適用
  > - **UserService**: role/stage 存在チェック時に org_id 検証
  > - **CompetencyService**: stage 存在チェック時に org_id 検証
  > - **DepartmentService**: 作成/更新/削除時の `get_by_name()` 呼び出しで同名重複チェックに org_id 適用
  > - **Repository レベル検証**: `StageRepository.get_by_name()`, `RoleRepository.get_by_name()`, `DepartmentRepository.get_by_name()` で org_id 必須化

### 6. 管理者 API の簡略化
> Clerk UI コンポーネントを活用した管理機能の設計変更を実装します。

- [x] **6.1. 管理者API の設計変更**
  > ユーザー招待と組織メンバー管理を Clerk UI で代替し、admin.py を簡略化します。
  >
  > **関連要件:** 管理要件 6.1
  > **実装メモ:** Clerk の `<OrganizationProfile />` コンポーネントを利用する設計に変更
  > **変更理由:** 重複機能を排除し、Clerk のネイティブ機能を活用することで保守性を向上

### 7. Webhook ハンドラーの強化
> 組織とユーザーイベントの Webhook 処理を強化します。

- [x] **7.1. 署名検証の本番化**
  > svix ライブラリによる署名検証を本番環境対応し、必須環境変数とエラー処理を追加します。
  >
  > **関連要件:** セキュリティ要件 7.1
  > **実装メモ:** WebhookEventRepository で実装済み

- [x] **7.2. 冪等性とイベント記録**
  > `event_id` による重複スキップと冪等性を確保するイベント記録機能を実装します。
  >
  > **関連要件:** 信頼性要件 7.2
  > **実装メモ:** 重複検証機能実装済み

- [x] **7.3. イベントハンドラーの完全化**
  > `user.created`/`user.updated`/`organization.created`/`organization.updated` の完全なハンドラーを実装します。
  >
  > **関連要件:** 機能要件 7.3
  > **実装メモ:** 全イベントタイプ対応済み

- [x] **7.4. リトライと構造化ログ**
  > 指数バックオフによるリトライ機能と構造化ログを実装します。
  >
  > **関連要件:** 運用要件 7.4
  > **実装メモ:** ログ機能強化済み

## 機能C: フロントエンド組織対応

### 8. JWT クレーム活用とルーティング
> フロントエンドで JWT の組織クレームを活用し、組織スコープルーティングを実装します。

- [ ] **8.1. useJWTUserInfo フックの実装**
  > JWT から組織クレームを抽出・活用する React フックを実装します。
  >
  > **関連要件:** フロントエンド要件 8.1

- [ ] **8.2. 組織ベースルートガード**
  > `/admin`, `/org/[slug]` のルートで組織ロールとアクティブ組織をチェックするガードを実装します。
  >
  > **関連要件:** フロントエンド要件 8.2

- [ ] **8.3. フロントエンド組織スコープルーティング**
  > `/app/org/` ディレクトリベースの組織スコープルーティングを実装します。
  >
  > **関連要件:** フロントエンド要件 8.3
  > **実装状況:** `/app/org/` ディレクトリ作成中

### 9. 認証クライアントとUI強化
> フロントエンドの認証関連機能を組織対応に強化します。

- [ ] **9.1. JWT トークン処理の改善**
  > `auth-helper.ts` で JWT トークンの組織情報処理を改善します。
  >
  > **関連要件:** フロントエンド要件 9.1
  > **実装状況:** 進行中

- [x] **9.2. HTTP クライアントの組織スコープ対応**
  > `http-unified-client.ts` で組織スコープに対応したリクエスト処理を実装します。
  >
  > **関連要件:** フロントエンド要件 9.2
  > **実装状況:** ✅ 完了 - 洗練された組織スコープ自動適用システムを実装
  >
  > **実装詳細:**
  > - **組織スラッグの自動取得とキャッシュ**: JWT トークンから組織情報を取得し、効率的にキャッシュ
  > - **パターン駆動のエンドポイント分類**: 認証エンドポイントを組織スコープから除外し、業務エンドポイントにのみ適用
  > - **API バージョン対応**: `/api/v1/auth/`, `/api/v2/auth/` などの将来の API バージョン変更にも対応
  > - **二重スコープ防止**: 既に組織スコープされているエンドポイント（`/api/org/`）を検知して重複適用を防止
  > - **環境対応**: サーバーサイド（Clerk auth）とクライアントサイド（ClientAuth）の両方で動作
  > - **テスト機能**: 包括的なテストケースと検証機能を実装
  >
  > **技術的特徴:**
  > - 認証エンドポイント: `/api/v1/auth/user/123` → 組織スコープなし（正しい）
  > - 業務エンドポイント: `/api/v1/users` → `/api/org/acme-corp/users`（自動適用）
  > - 既存組織エンドポイント: `/api/org/acme-corp/users` → 二重適用防止（正しい）
  > - フォールバック: 組織情報なしの場合、従来のURLを使用（認証エンドポイント対応）
  >
  > **実装完了日:** 2025-01-XX
  > **影響範囲:** 既存のサーバーアクションとエンドポイントに変更不要、自動組織スコープ適用

- [ ] **9.3. 組織同期フックの実装**
  > `useAuthSync.ts` で組織情報の同期機能を実装します。
  >
  > **関連要件:** フロントエンド要件 9.3
  > **実装状況:** 進行中

- [ ] **9.4. エラーハンドリングの強化**
  > `error-handling.ts` で組織関連エラーのハンドリングを強化します。
  >
  > **関連要件:** フロントエンド要件 9.4
  > **実装状況:** 進行中

- [ ] **9.5. ミドルウェア組織検証**
  > `middleware.ts` で組織検証機能を実装します。
  >
  > **関連要件:** フロントエンド要件 9.5
  > **実装状況:** 進行中

### 10. レイアウトとUIコンポーネントの組織対応
> レイアウトとUIコンポーネントを組織スコープに対応させます。

- [ ] **10.1. ヘッダーコンポーネントの組織情報表示**
  > `header.tsx` で組織情報の表示機能を実装します。
  >
  > **関連要件:** UI要件 10.1
  > **実装状況:** 進行中

- [ ] **10.2. 評価レイアウトの組織スコープ対応**
  > `(evaluation)/layout.tsx` で組織スコープに対応したレイアウトを実装します。
  >
  > **関連要件:** UI要件 10.2
  > **実装状況:** 進行中

- [ ] **10.3. ゴールサーバーアクションの組織スコープ対応**
  > `goals server-actions` で組織スコープに対応したサーバーアクションを実装します。
  >
  > **関連要件:** サーバーアクション要件 10.3
  > **実装状況:** 進行中

---

## 実装で発見された詳細指針（参考資料）

### 組織フィルタリング方針

- **原則**
  - 認証済みユーザーのコンテキストから `org_id` を取得し、サービス層→全リポジトリに必ず渡す。
  - 組織フィルタなしの全件アクセスは不可。`org_id=None` は明示的に例外にする（公開テーブルを除く）。
  - 書込みは、対象レコード（または親レコード）が同一組織であることを検証してから実行。

- **リレーションに応じたスコープ適用パターン**
  - 直接列を持つテーブル（例: `organizations` 等）
    - `apply_org_scope_direct(query, Model.clerk_organization_id, org_id)`
  - ユーザー外部キーを持つテーブル（例: `goals.user_id`）
    - `apply_org_scope_via_user(query, Model.user_id, org_id)` → `JOIN users ON Model.user_id = users.id AND users.clerk_organization_id = :org_id`
  - ゴール経由のテーブル（例: `self_assessments.goal_id`, `supervisor_reviews.goal_id`, `supervisor_feedbacks.goal_id`）
    - `apply_org_scope_via_goal(query, Model.goal_id, org_id)` → `JOIN goals` → `JOIN users` → `users.clerk_organization_id = :org_id`
  - 上記以外は、最も近いユーザーに到達するJOINパスで `users.clerk_organization_id = :org_id` を強制する。

- **参考実装（SQLAlchemy）**
```python
# 直接列
def apply_org_scope_direct(query, org_col, org_id: str):
    return query.where(org_col == org_id)

# users 経由
def apply_org_scope_via_user(query, user_fk_col, org_id: str):
    from ..models.user import User
    return query.join(User, user_fk_col == User.id).where(User.clerk_organization_id == org_id)

# goals → users 経由
def apply_org_scope_via_goal(query, goal_fk_col, org_id: str):
    from ..models.goal import Goal
    from ..models.user import User
    return (query
            .join(Goal, goal_fk_col == Goal.id)
            .join(User, Goal.user_id == User.id)
            .where(User.clerk_organization_id == org_id))
```

- **テーブルごとの想定スコープ**
  - `users`: 直接列（`clerk_organization_id`）でフィルタ
  - `goals`: ユーザー経由でフィルタ
  - `self_assessments`/`supervisor_reviews`/`supervisor_feedbacks`: ゴール→ユーザー経由でフィルタ
  - `departments`/`roles`/`stages`/`competencies`: スキーマに `organization_id` を追加し、`apply_org_scope_direct` を適用

- **サービス層の取り決め**
  - すべてのクエリ系/変更系メソッドは `org_id: str` を引数に持つ（省略不可）。
  - 親リソースIDを受けた変更は、親の組織整合性をまず検証してから子を操作する。

- **性能/インデックス**
  - `users.clerk_organization_id` にインデックス必須。
  - `goals.user_id` などJOINキーにインデックス。
  - 大量データが想定される場合は、必要に応じて複合インデックスやクエリヒントを検討。

- **キャッシュ/観測**
  - キャッシュキーには必ず `org_id` と実効フィルタ（JOIN先を解決した後に効いている条件）を含める（クロステナント汚染防止）。
  - 監査ログには、どのスコープ（direct/user/goal）でフィルタしたかと `org_id` を記録。

- **例外的バイパス**
  - システム管理者がクロス組織で参照する必要がある場合は、明示的なスコープ指定（例: `Scope.BYPASS_ORG`）を導入し、使用箇所を厳格に監査ログで記録。


#### 5.2 実装済みの変更点（Repositories / Services）

- 目的: 5.1 の方針に沿って、全リポジトリ/サービスの読み書きに組織スコープと一貫した RBAC を適用。

- **最新修正（2025-01-XX）: org_id パラメータ抜け漏れの包括的修正**
  - **StageService** (`stage_service.py`)
    - 全リポジトリ呼び出しに `current_user_context.organization_id` を適用
    - `get_all_stages()`, `get_stages_with_user_count()`, `get_stage()`, `create_stage()`, `update_stage()`, `delete_stage()` で org_id 必須化
  - **RoleService** (`role_service.py`)
    - 全リポジトリ呼び出しに `current_user_context.organization_id` を適用
    - `get_all()`, `get_by_id()`, `create_role()`, `update_role()`, `delete_role()` で org_id 必須化
    - バリデーション用ヘルパーメソッドにも org_id パラメータ適用
  - **UserService** (`user_service.py`)
    - `_validate_user_creation()`, `_validate_user_update()` で role/stage 存在チェックに org_id 適用
    - `update_user_stage()` で stage 存在チェックに org_id 適用
  - **CompetencyService** (`competency_service.py`)
    - `create_competency()`, `update_competency()` で stage 存在チェックに org_id 適用
  - **DepartmentService** (`department_service.py`)
    - 全 CRUD 操作に `current_user_context.organization_id` を適用
    - バリデーション用ヘルパーメソッドにも org_id パラメータ適用
  - **DepartmentRepository** (`department_repo.py`)
    - `update_department()`, `delete_department()` に org_id パラメータ追加
    - 組織スコープでのユーザーカウントチェックと削除処理に org_id 適用

- Repositories（主な変更）
  - users (`backend/app/database/repositories/user_repo.py`)
    - ほぼ全メソッドで `org_id` 必須化。`get_subordinates(supervisor_id, org_id)` を org スコープ化。
    - `get_active_users(org_id)`, `get_user_by_id_with_details(id, org_id)` 等を org スコープで実装/利用。
  - goals (`goal_repo.py`)
    - `get_goal_by_id(_with_details)(id, org_id)` を `apply_org_scope_via_user` でフィルタ。
    - 検索/集計系 `search_goals` / `count_goals` は `org_id` を必須に。
    - 重み検証系 `get_weight_totals_by_category` / `update_goal_status` なども org スコープで検証。
  - self_assessments (`self_assessment_repo.py`)
    - 取得/検索/集計（`get_by_period`, `get_by_status`, `search_assessments`, `count_assessments`）に `org_id` を追加。
    - 変更系（`update_assessment`, `submit_assessment`, `delete_assessment`）とバリデータで org 整合性を検証。
    - スコープは `apply_org_scope_via_goal` を採用。
  - supervisor_reviews（`supervisor_review_repository.py`）
    - すべての CRUD/検索系に `org_id` を追加し、ゴール→ユーザー経由で組織フィルタ適用。
    - `create` は org スコープ上のユニーク性（(goal, period, supervisor)）チェックを実施。
  - supervisor_feedbacks（`supervisor_feedback_repo.py`）
    - `get_by_id(_with_details)`, `search_feedbacks`, `count_feedbacks` ほか全系で org フィルタ適用（ゴール→ユーザー経由）。
  - evaluation_periods（`evaluation_period_repo.py`）
    - `check_name_exists`, `check_date_overlap` などのユーティリティを org スコープ化。変更系も org 整合性を検証。
  - departments/stages/roles
    - いずれも `organization_id` での `apply_org_scope_direct` を適用。`RoleRepository.get_user_roles(user_id, org_id)` を org スコープ化。

- Services（主な変更）
  - GoalService
    - すべての repo 呼び出しに `org_id` を付与。バリデーションで `evaluation_period_repo` / `competency_repo` を org スコープで参照。
    - ウェイト合計検証と承認系のロジックは org スコープで一貫。
  - SupervisorReviewService
    - RBAC を集中化（`RBACHelper.get_accessible_user_ids`）して分岐し、重複チェックを削除。
    - すべての repo/goal 参照に `org_id` を付与（`get_review(s)`, `update/delete`, `pending` 等）。
  - SupervisorFeedbackService
    - RBAC 集中化＆ org スコープ適用。検索/集計/取得/更新/提出/破棄の全系で `org_id` を付与。
    - 評価期間/ゴール参照のバリデーションも org スコープで実施。
  - UserService
    - 検索・取得・組織図系で `org_id` 必須。`get_profile_options(context)` は org スコープの repo を使用。
    - キャッシュキーに `org_id` と実効フィルタを含める（`role_ids` キー生成の不具合を修正）。

- API（関連）
  - `GET /api/v1/users/profile-options` は `AuthContext` を受け取り、サービスに渡して org スコープのデータを提供可能に。

- RBAC ポリシー（整理）
  - 粗いゲート: デコレータ（`@require_permission`, `@require_any_permission`）。
  - 細粒度: `RBACHelper.get_accessible_user_ids` により、実効ユーザー集合で repo 検索を分岐。
  - 重複チェックを排除（例: SupervisorReview の `get_reviews`）。

- コントラクト
  - サービス/リポジトリは `org_id` を必須パラメータとし、`None` はエラー。
  - `apply_org_scope_*` の適用はすべての SELECT/UPDATE/DELETE で必須。


### 6. 管理者 API（補強） ✅
- [x] ~~`POST /api/admin/users` 実装（管理者 + 同一組織）~~ → Clerk UIで代替のため削除
- [x] ~~既存 `GET /api/admin/organizations/{clerk_org_id}/users` のテスト/監査~~ → Clerk UIで代替のため削除
- [x] admin.py簡略化: Clerk UI コンポーネントでユーザー招待・組織メンバー管理を代替する設計に変更

### 7. Webhook ハンドラー（強化） ✅
- [x] svix 署名検証導線の本番化（必須環境変数, エラー処理）
- [x] 冪等性: `event_id` 記録と重複スキップ
- [x] `user.created`/`user.updated`/`organization.created`/`organization.updated` の完全化
- [x] リトライ/指数バックオフ/構造化ログの明確化

## 機能C: フロントエンド（補足）

### 8. JWT クレーム活用
- [ ] `useJWTUserInfo` 実装（org クレーム利用）
- [ ] `/admin`, `/org/[slug]` のルートガード（org_role / active org）
- [ ] フロントエンド組織スコープルーティング (`/app/org/` ディレクトリ実装中)

## 全般タスク

### 11. テストと品質保証

- [ ] **11.1. JWT 検証ユニットテスト**
  > 無効署名、誤 issuer/audience、期限切れ等の JWT 検証テストを実装します。
  >
  > **関連要件:** 品質要件 11.1

- [ ] **11.2. 組織スコープガード統合テスト**
  > URL の org_slug と JWT の組織情報不一致時の 403/404 レスポンステストを実装します。
  >
  > **関連要件:** 品質要件 11.2

- [ ] **11.3. データアクセス層フィルタテスト**
  > 全ての SELECT/UPDATE/DELETE の組織フィルタ強制をテストします。
  >
  > **関連要件:** 品質要件 11.3

- [ ] **11.4. 管理API統合テスト**
  > 同一組織制約と非所属ユーザー拒否の動作をテストします。
  >
  > **関連要件:** 品質要件 11.4

- [ ] **11.5. Webhook処理テスト**
  > 署名検証、冪等性、リトライ機能のテストを実装します。
  >
  > **関連要件:** 品質要件 11.5

### 12. 環境設定と運用

- [ ] **12.1. Docker環境変数設定**
  > `docker-compose.yml` に必須環境変数を追加します。
  >
  > **関連要件:** 運用要件 12.1

- [ ] **12.2. ドキュメント更新**
  > README に JWT テンプレート、ルーティング移行ガイド、Webhook 設定を追加します。
  >
  > **関連要件:** ドキュメント要件 12.2

### 13. ロールアウトと互換性

- [ ] **13.1. 段階的リリース計画**
  > 非本番環境から本番環境への段階的リリースを実施します。
  >
  > **関連要件:** 運用要件 13.1

- [ ] **13.2. 旧ルート非推奨化**
  > `/api/v1/` ルートの非推奨アナウンスと移行期間を設定します。
  >
  > **関連要件:** 互換性要件 13.2

### 14. 監査と観測性

- [ ] **14.1. セキュアログ実装**
  > 機微情報非出力、相関ID、適切なイベント粒度のログを実装します。
  >
  > **関連要件:** セキュリティ要件 14.1

- [ ] **14.2. キャッシュ汚染防止**
  > キャッシュキーに組織IDと有効フィルタを組み込み、クロステナント汚染を防止します。
  >
  > **関連要件:** セキュリティ要件 14.2
