# 設計書: Custom JWT Token Enhancement with Organization Support (Revised)

## 1. 概要

要件に基づき、JWT 検証の厳格化、組織スコープ化ルーティング、DAL における強制的な組織フィルタリング、Webhook セキュリティ強化を反映した設計を定義する。組織識別は Clerk の `org_id`/`org_slug` を使用し、内部独自の組織 ID は発行しない。

## 2. アーキテクチャ設計

### 2.1. 構成
```mermaid
graph TD
    A[Frontend Next.js] --> B[Clerk Authentication]
    B --> C[Custom JWT Token]
    C --> D[Backend FastAPI]
    D --> E[Supabase PostgreSQL]
    B --> F[Clerk Metadata]
    F --> G[Public Metadata]
    F --> H[Private Metadata]
    D --> I[Org-aware Middleware]
    I --> J[DAL Org Filtering]
    D --> K[Webhook Verification (svix)]
```

### 2.2. 技術スタック
- JWT 検証: Clerk JWKS + jose
- ルーティング: `/api/org/{org_slug}/...` + 中央ミドルウェア
- DB: `organizations` + `users.clerk_organization_id`、必要に応じて追加インデックス

## 3. JWT 検証設計

- Clerk Issuer: `CLERK_ISSUER`
- Audience: `CLERK_AUDIENCE`
- JWKS: `GET {issuer}/.well-known/jwks.json` をキャッシュ
- 検証フロー:
```python
unverified_header = jwt.get_unverified_header(token)
key = select_key_from_jwks(kid)
payload = jwt.decode(token, key, algorithms=["RS256"], audience=CLERK_AUDIENCE, issuer=CLERK_ISSUER)
```
- クレーム正規化:
  - org_id := payload.org_id || payload.organization_id
  - org_slug := payload.org_slug || payload.organization_name
  - role := payload.org_role || payload.role

## 4. ルーティング/ミドルウェア設計

### 4.1. ルート
- 組織スコープ: `/api/org/{org_slug}/...`
- 非組織: `/api/v1/account` など既存維持

### 4.2. ミドルウェア
```python
class OrgSlugGuard:
    def __call__(self, request, auth_ctx):
        url_slug = request.path_params["org_slug"]
        token_slug = auth_ctx.organization_slug  # 正規化済み
        if not token_slug or token_slug != url_slug:
            raise HTTPException(403)
```
- org_id のみの場合は `organizations.slug` を解決して比較
- 未所属ユーザーは `/api/org/...` を拒否

## 5. データアクセス層（DAL）設計

### 5.1. 共通ヘルパ
```python
class BaseRepository:
    def apply_org_scope(self, query, org_id: str):
        return query.filter(self.model.clerk_organization_id == org_id)

    def apply_org_scope_via_user(self, query, org_id: str):
        return query.join(User, self.model.user_id == User.id).filter(User.clerk_organization_id == org_id)
```

### 5.2. 適用方針
- 直接 org 列を持つモデル → `apply_org_scope`
- user_id 経由モデル → `apply_org_scope_via_user`
- 書き込み系 (UPDATE/DELETE) でも同等のチェックを必須

## 6. Webhook 設計

- 署名検証: svix (`CLERK_WEBHOOK_SECRET`)
- エンドポイント: `POST /webhooks/clerk`
- 冪等性: `event_id` の重複をスキップ（専用テーブルで管理）
- リトライ: 指数バックオフ、構造化ログ

## 7. データベース設計（補強）

- `organizations.slug` にユニークインデックス
- `domain_settings(organization_id, domain)` にユニーク制約
- 主要テーブルの `clerk_organization_id`/join 経由でのフィルタ前提のインデックス

## 8. 管理 API 設計

- `POST /api/admin/users`: 管理者ロール + リクエスト対象が同一組織
- `GET /api/admin/organizations/{clerk_org_id}/users`: 既存に準拠、組織検証あり

## 9. フロントエンド設計（補足）

- `useJWTUserInfo` は Clerk セッションから org クレームを利用
- `/admin` と `/org/[slug]` のガード: org_role と active org で判定
- **HTTP クライアントの洗練された組織スコープ対応**: `http-unified-client.ts` で実装済み
  - パターン駆動のエンドポイント分類（認証系を組織スコープから除外）
  - API バージョン対応（`/api/v1/auth/`, `/api/v2/auth/` など）
  - 二重スコープ防止（`/api/org/` パス検知）
  - サーバー/クライアント両対応

## 10. セキュリティ設計（更新）

- 未検証 decode の禁止
- ログは最小限（トークン/メールの非出力）
- キャッシュキーに org と有効フィルタを含める

## 11. 運用設計（更新）

- 環境変数: `CLERK_ISSUER`, `CLERK_AUDIENCE`, `CLERK_WEBHOOK_SECRET`, `CLERK_ORGANIZATION_ENABLED`
- ドキュメント: JWT テンプレート、Webhook 設定、ルーティング移行ガイド
# 設計書: Custom JWT Token Enhancement with Organization Support (Revised)

## 1. 概要

要件に基づき、JWT 検証の厳格化、組織スコープ化ルーティング、DAL における強制的な組織フィルタリング、Webhook セキュリティ強化を反映した設計を定義する。組織識別は Clerk の `org_id`/`org_slug` を使用し、内部独自の組織 ID は発行しない。

## 2. アーキテクチャ設計

### 2.1. 構成
```mermaid
graph TD
    A[Frontend Next.js] --> B[Clerk Authentication]
    B --> C[Custom JWT Token]
    C --> D[Backend FastAPI]
    D --> E[Supabase PostgreSQL]
    B --> F[Clerk Metadata]
    F --> G[Public Metadata]
    F --> H[Private Metadata]
    D --> I[Org-aware Middleware]
    I --> J[DAL Org Filtering]
    D --> K[Webhook Verification (svix)]
```

### 2.2. 技術スタック
- JWT 検証: Clerk JWKS + jose
- ルーティング: `/api/org/{org_slug}/...` + 中央ミドルウェア
- DB: `organizations` + `users.clerk_organization_id`、必要に応じて追加インデックス

## 3. JWT 検証設計

- Clerk Issuer: `CLERK_ISSUER`
- Audience: `CLERK_AUDIENCE`
- JWKS: `GET {issuer}/.well-known/jwks.json` をキャッシュ
- 検証フロー:
```python
unverified_header = jwt.get_unverified_header(token)
key = select_key_from_jwks(kid)
payload = jwt.decode(token, key, algorithms=["RS256"], audience=CLERK_AUDIENCE, issuer=CLERK_ISSUER)
```
- クレーム正規化:
  - org_id := payload.org_id || payload.organization_id
  - org_slug := payload.org_slug || payload.organization_name
  - role := payload.org_role || payload.role

## 4. ルーティング/ミドルウェア設計

### 4.1. ルート
- 組織スコープ: `/api/org/{org_slug}/...`
- 非組織: `/api/v1/account` など既存維持

### 4.2. ミドルウェア
```python
class OrgSlugGuard:
    def __call__(self, request, auth_ctx):
        url_slug = request.path_params["org_slug"]
        token_slug = auth_ctx.organization_slug  # 正規化済み
        if not token_slug or token_slug != url_slug:
            raise HTTPException(403)
```
- org_id のみの場合は `organizations.slug` を解決して比較
- 未所属ユーザーは `/api/org/...` を拒否

## 5. データアクセス層（DAL）設計

### 5.1. 共通ヘルパ
```python
class BaseRepository:
    def apply_org_scope(self, query, org_id: str):
        return query.filter(self.model.clerk_organization_id == org_id)

    def apply_org_scope_via_user(self, query, org_id: str):
        return query.join(User, self.model.user_id == User.id).filter(User.clerk_organization_id == org_id)
```

### 5.2. 適用方針
- 直接 org 列を持つモデル → `apply_org_scope`
- user_id 経由モデル → `apply_org_scope_via_user`
- 書き込み系 (UPDATE/DELETE) でも同等のチェックを必須

## 6. Webhook 設計

- 署名検証: svix (`CLERK_WEBHOOK_SECRET`)
- エンドポイント: `POST /webhooks/clerk`
- 冪等性: `event_id` の重複をスキップ（専用テーブルで管理）
- リトライ: 指数バックオフ、構造化ログ

## 7. データベース設計（補強）

- `organizations.slug` にユニークインデックス
- `domain_settings(organization_id, domain)` にユニーク制約
- 主要テーブルの `clerk_organization_id`/join 経由でのフィルタ前提のインデックス

## 8. 管理 API 設計

- `POST /api/admin/users`: 管理者ロール + リクエスト対象が同一組織
- `GET /api/admin/organizations/{clerk_org_id}/users`: 既存に準拠、組織検証あり

## 9. フロントエンド設計（補足）

- `useJWTUserInfo` は Clerk セッションから org クレームを利用
- `/admin` と `/org/[slug]` のガード: org_role と active org で判定
- **HTTP クライアントの洗練された組織スコープ対応**: `http-unified-client.ts` で実装済み
  - パターン駆動のエンドポイント分類（認証系を組織スコープから除外）
  - API バージョン対応（`/api/v1/auth/`, `/api/v2/auth/` など）
  - 二重スコープ防止（`/api/org/` パス検知）
  - サーバー/クライアント両対応

## 10. セキュリティ設計（更新）

- 未検証 decode の禁止
- ログは最小限（トークン/メールの非出力）
- キャッシュキーに org と有効フィルタを含める

## 11. 運用設計（更新）

- 環境変数: `CLERK_ISSUER`, `CLERK_AUDIENCE`, `CLERK_WEBHOOK_SECRET`, `CLERK_ORGANIZATION_ENABLED`
- ドキュメント: JWT テンプレート、Webhook 設定、ルーティング移行ガイド
