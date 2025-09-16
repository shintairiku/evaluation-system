# 実装計画: Custom JWT Token Enhancement with Organization Support (Revised)

> 本タスク群は、JWT 検証の厳格化、組織スコープ化ルーティング、DAL 強制フィルタリング、Webhook 強化を実装するためのもの。段階的移行とテスト完備を前提とする。

## 機能A: Clerk設定とメタデータ管理

### 1. Clerk 組織機能とカスタムクレーム
- [x] 組織機能の有効化（既存）
- [x] カスタム JWT クレームの設定（既存）
- [x] Public/Private Metadata 型定義（既存）
- [x] Webhook 設定（既存）
- [ ] JWT テンプレートの見直し: org ネイティブクレーム（org_id, org_slug, org_role）を前提に、カスタムはフォールバック用途として明記

### 2. DB スキーマの更新（補強）
- [x] `organizations`/`users.clerk_organization_id` 追加（既存）
- [ ] `organizations.slug` ユニークインデックス追加
- [ ] `domain_settings(organization_id, domain)` ユニーク制約追加

## 機能B: バックエンド API の更新

### 3. 認証/JWT 検証
- [ ] JWKS による署名検証を `AuthService.get_user_from_token` に実装（iss/aud/exp/nbf）
- [ ] クレーム正規化 (org_id/org_slug/org_role 優先, カスタムはフォールバック)
- [ ] 設定/環境変数追加: `CLERK_ISSUER`, `CLERK_AUDIENCE`

### 4. 組織スコープ化ルーティング
- [ ] `/api/org/{org_slug}/...` ルートの導入（最小セットから）
- [ ] OrgSlug ガードミドルウェア実装（URL と JWT の org_slug 照合 / org_id→slug 解決）
- [ ] 非所属ユーザーの `/api/org/...` 拒否
- [ ] 旧 `/api/v1/...` ルートの段階的非推奨化と互換レイヤ

### 5. DAL（リポジトリ/サービス）強制フィルタリング
- [ ] 共通ヘルパ: `apply_org_scope` / `apply_org_scope_via_user` 実装
- [ ] すべての SELECT/UPDATE/DELETE に組織フィルタ適用（抜け漏れ監査）
- [ ] 書込み時の組織整合性検証（対象レコードが同一組織）

### 6. 管理者 API（補強）
- [ ] `POST /api/admin/users` 実装（管理者 + 同一組織）
- [ ] 既存 `GET /api/admin/organizations/{clerk_org_id}/users` のテスト/監査

### 7. Webhook ハンドラー（強化）
- [ ] svix 署名検証導線の本番化（必須環境変数, エラー処理）
- [ ] 冪等性: `event_id` 記録と重複スキップ
- [ ] `user.created`/`user.updated`/`organization.created`/`organization.updated` の完全化
- [ ] リトライ/指数バックオフ/構造化ログの明確化

## 機能C: フロントエンド（補足）

### 8. JWT クレーム活用
- [ ] `useJWTUserInfo` 実装（org クレーム利用）
- [ ] `/admin`, `/org/[slug]` のルートガード（org_role / active org）

## 全般タスク（更新）

### 9. テストと品質保証
- [ ] JWT 検証ユニットテスト（無効署名/誤 iss/誤 aud/exp/nbf）
- [ ] OrgSlug ガード統合テスト（URL vs JWT mismatch → 403/404）
- [ ] DAL フィルタ強制テスト（SELECT/UPDATE/DELETE 全網羅）
- [ ] 管理 API 統合テスト（同一組織制約, 非所属拒否）
- [ ] Webhook 署名/冪等/リトライのテスト

### 10. 環境変数/運用
- [ ] `docker-compose.yml` に `CLERK_ISSUER`, `CLERK_AUDIENCE`, `CLERK_WEBHOOK_SECRET`, `CLERK_ORGANIZATION_ENABLED` を追加
- [ ] README 更新（JWT テンプレ, ルーティング移行ガイド, Webhook 設定）

### 11. ロールアウト/後方互換
- [ ] 段階的リリース: 非本番→本番
- [ ] 旧ルートの非推奨アナウンスと移行期間設定

### 12. 監査/観測性
- [ ] セキュアログ（機微非出力、相関ID、イベント粒度）
- [ ] キャッシュキーに org と有効フィルタを組み込む（クロステナント汚染防止）
