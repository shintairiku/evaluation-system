# 実装計画: Custom JWT Token Enhancement with Organization Support

> [このドキュメントは、設計書に基づいて実際に行う開発タスクを洗い出し、管理するためのものです。タスクは階層的に分割し、関連する要件を明記することで、進捗とトレーサビリティを確保します。]

## 機能A: Clerk設定とメタデータ管理

### 1. [Clerk組織機能の有効化と設定]
> [Clerkダッシュボードでの組織機能設定とカスタムJWTクレームの設定]

- [x] **1.1. [Clerkダッシュボードで組織機能を有効化]**
  > Clerkの管理画面で組織機能を有効にし、必要なロールと権限を設定する
  > Org_ID: "org_32a4qh6ZhszNNK1kW1xyNgYimhZ"
  > Slug: "shintairiku"
  > **関連要件:** 3.1, 3.2

- [x] **1.2. [カスタムJWTクレームの設定]**
  > JWT templateでuser_id, email, role, organization_id, organization_nameを含むカスタムクレームを設定する
  > これら５つのデータはサインアップ時に行われるべきだが、今回は手動で直接的にClerkアカウントにて設定した。
  > ```json
  > {
  >   	"role": "{{user.public_metadata.role}}",
	>     "email": "{{user.private_metadata.email}}",
	>     "organization_id": "{{org.id}}",
	>     "internal_user_id": "{{user.public_metadata.users_table_id}}",
	>     "organization_name": "{{org.name}}"
  > }
  > ```
  > **関連要件:** 1.1, 1.2

- [ ] **1.3. [Public/Private Metadataスキーマの定義]**
  > TypeScript interfaceを定義し、メタデータの構造を明確化する
  >
  > **関連要件:** 2.1, 2.2

- [x] **1.4. [Webhook設定（user.created, user.updated, organization.created）]**
  > ユーザー作成・更新・組織作成時のWebhookエンドポイントをClerkに設定する
  > 
  > **Clerk Dashboard設定内容:**
  > - Webhook URL: `https://play.svix.com/in/e_iZo03eeRZLV7pprOONlEOxkCISn/`
  > - Events: `user.created`, `user.updated`, `organization.created`
  > - Signing Secret: 環境変数として設定
  >
  > **関連要件:** 2.2

### 2. [データベーススキーマの更新]

- [ ] **2.1. [organizationsテーブルの作成]**
  > Clerk組織IDをプライマリキーとする組織テーブルを作成する
  >
  > **関連要件:** 3.1

- [ ] **2.2. [usersテーブルにclerk_organization_idカラム追加]**
  > 既存のusersテーブルにClerk組織IDのカラムを追加し、外部キー制約を設定する
  >
  > **関連要件:** 3.1, 5.1

- [ ] **2.3. [マイグレーションスクリプトの作成と実行]**
  > データベーススキーマ変更用のマイグレーションスクリプトを作成・実行する
  >
  > **関連要件:** 3.1

## 機能B: バックエンドAPIの更新

### 3. [認証ミドルウェアの実装]

- [ ] **3.1. [組織認証ミドルウェアの作成]**
  > JWTトークンからClerk組織IDを抽出し、アクセス制御を行うミドルウェアを実装する
  >
  > **関連要件:** 5.1

- [ ] **3.2. [管理者権限チェックミドルウェアの実装]**
  > JWTトークンからroleを抽出し、管理者権限をチェックするミドルウェアを実装する
  >
  > **関連要件:** 4.1, 4.2

- [ ] **3.3. [既存エンドポイントへの組織フィルタリング適用]**
  > すべての既存APIエンドポイントに組織IDによるデータフィルタリングを適用する
  >
  > **関連要件:** 5.1, 5.2

### 4. [管理者向けAPIエンドポイントの実装]

- [ ] **4.1. [POST /api/admin/users エンドポイント実装]**
  > 管理者が組織内ユーザーを作成するAPIエンドポイントを実装する
  >
  > **関連要件:** 4.1

- [ ] **4.2. [GET /api/admin/organizations/{clerk_org_id}/users エンドポイント実装]**
  > 組織内ユーザー一覧取得APIを実装する
  >
  > **関連要件:** 4.1

- [ ] **4.3. [PUT /api/users/{user_id}/metadata エンドポイント実装]**
  > ユーザー情報更新時のClerkメタデータ同期APIを実装する
  >
  > **関連要件:** 2.2

### 5. [Webhookハンドラーの実装]

- [ ] **5.1. [Webhook署名検証の実装]**
  > Clerkから送信されるWebhookの署名を検証するミドルウェアを実装する
  > - svix ライブラリを使用した署名検証
  > - 環境変数からSigning Secretを読み込み
  > - 不正なリクエストの拒否処理
  >
  > **関連要件:** セキュリティ要件

- [ ] **5.2. [POST /api/webhooks/clerk エンドポイント実装]**
  > Clerkからのwebhookを受信する統一エンドポイントを実装する
  > - webhook typeに基づくイベント処理の分岐
  > - エラーハンドリングとログ記録
  > - レスポンス形式の標準化
  >
  > **関連要件:** 2.1, 2.2

- [ ] **5.3. [user.created Webhookハンドラー実装]**
  > ユーザー作成時のメタデータ設定とデータベース登録処理を実装する
  > - 新規ユーザーレコードの作成（組織IDを含む）
  > - Public Metadata（users_table_id, profile_completed）の設定
  > - Private Metadata（email）の設定
  > - デフォルトロール（employee）の設定
  >
  > **関連要件:** 2.1, 2.2

- [ ] **5.4. [user.updated Webhookハンドラー実装]**
  > ユーザー更新時のメタデータ同期処理を実装する
  > - 既存ユーザーレコードの更新
  > - Clerkメタデータとの整合性確保
  > - 組織変更時の処理
  >
  > **関連要件:** 2.2

- [ ] **5.5. [organization.created Webhookハンドラー実装]**
  > 組織作成時のorganizationsテーブルへの登録処理を実装する
  > - 新規組織レコードの作成
  > - 組織名・作成日時の記録
  > - 初期管理者ロールの設定
  >
  > **関連要件:** 3.1

- [ ] **5.6. [Webhook処理のリトライ機構実装]**
  > Webhook処理失敗時のリトライとエラー処理を実装する
  > - データベース接続エラー時のリトライ
  > - Clerk API呼び出し失敗時の対応
  > - Dead Letter Queue的な仕組みの検討
  >
  > **関連要件:** 信頼性要件

## 機能C: フロントエンドの実装

### 6. [JWTトークン活用機能の実装]

- [ ] **6.1. [useJWTUserInfo カスタムフックの実装]**
  > JWTトークンからユーザー情報を抽出するReactフックを実装する
  >
  > **関連要件:** 1.1

- [ ] **6.2. [JWTUserInfo TypeScript interfaceの定義]**
  > JWTトークンから取得するユーザー情報の型定義を作成する
  >
  > **関連要件:** 1.1

- [ ] **6.3. [既存コンポーネントでのJWTユーザー情報活用]**
  > APIコールを減らすため、既存コンポーネントでJWTユーザー情報を活用する
  >
  > **関連要件:** 1.1

### 7. [管理者機能のフロントエンド実装]

- [ ] **7.1. [/admin レイアウトコンポーネントの実装]**
  > 管理者権限チェック機能付きのレイアウトコンポーネントを作成する
  >
  > **関連要件:** 4.1, 4.2

- [ ] **7.2. [管理者向けユーザー管理ページの実装]**
  > 組織内ユーザーの一覧表示・作成・編集機能を実装する
  >
  > **関連要件:** 4.1

- [ ] **7.3. [組織セレクターコンポーネントの実装]**
  > Clerkの組織機能を活用した組織切り替えコンポーネントを実装する
  >
  > **関連要件:** 3.1

### 8. [認証・認可の統合]

- [ ] **8.1. [Clerk組織機能のフロントエンド統合]**
  > ClerkのOrganizationProvider等を使用して組織機能をアプリに統合する
  >
  > **関連要件:** 3.1

- [ ] **8.2. [ルート保護の実装]**
  > 組織メンバーシップと管理者権限に基づくルート保護機能を実装する
  >
  > **関連要件:** 4.1, 4.2

## 全般タスク

### 9. テストと品質保証

- [ ] **9.1. [JWTトークン処理の単体テスト実装]**
  > JWTトークンのデコードとユーザー情報抽出機能のテストを作成する

- [ ] **9.2. [組織認証ミドルウェアのテスト実装]**
  > 組織アクセス制御とロールベース認証のテストを作成する

- [ ] **9.3. [管理者APIエンドポイントの統合テスト]**
  > 管理者向けAPIの権限制御と機能のテストを作成する

- [ ] **9.4. [Webhookハンドラーのテスト実装]**
  > Clerk Webhookの処理とデータ同期のテストを作成する
  > - Webhook署名検証のテスト
  > - 各イベント型（user.created, user.updated, organization.created）のハンドリングテスト
  > - エラー状況でのリトライ機構テスト
  > - モックClerk Webhookペイロードを使用した統合テスト

### 10. Clerk Account設定

- [x] **10.1. [Clerk Dashboardでのwebhook設定]**
  > Clerk管理画面でWebhook設定を行う
  > 
  > **設定完了:**
  > - **Endpoint URL**: `https://play.svix.com/in/e_iZo03eeRZLV7pprOONlEOxkCISn/` (開発用)
  > - **Events**: `user.created`, `user.updated`, `organization.created`
  > - **Status**: アクティブ (Error Rate: 0.0%)
  > - **備考**: 本番デプロイ時に実際のアプリケーションURLに変更予定

- [ ] **10.2. [Webhook送信テスト]**
  > ClerkからのWebhook送信をテストする
  > - Clerk Dashboard の "Send test webhook" 機能を使用
  > - 各イベント型のテストWebhookを送信
  > - バックエンドでの受信とログ確認
  > - 署名検証が正しく動作することを確認

### 11. ドキュメントと設定

- [ ] **11.1. [環境変数設定の更新]**
  > Clerk組織機能とWebhookに必要な環境変数をdocker-compose.ymlと.envに追加する
  > - `CLERK_WEBHOOK_SECRET`: Webhook署名検証用
  > - `CLERK_WEBHOOK_URL`: WebhookエンドポイントURL
  > - `CLERK_ORGANIZATION_ENABLED`: 組織機能フラグ
  > - 既存のClerk環境変数の確認・更新

- [ ] **11.2. [requirements.txt更新]**
  > Webhook処理に必要なPythonライブラリを追加する
  > - `svix`: Webhook署名検証ライブラリ
  > - その他依存ライブラリの確認

- [ ] **11.3. [README.mdの更新]**
  > 組織機能・管理者機能・Webhook設定の使用方法をドキュメントに追加する
  > - Clerk Dashboard設定手順
  > - Webhook URL設定方法
  > - 環境変数設定例

- [ ] **11.4. [型定義ファイルの更新]**
  > JWTクレーム、組織関連、Webhook関連の型定義をapi/typesに追加する
  > - ClerkWebhookEvent型定義
  > - WebhookPayload型定義
  > - JWTClaims型定義の拡張