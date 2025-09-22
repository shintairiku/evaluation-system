# 要件定義書: Custom JWT Token Enhancement with Organization Support (Revised)

## 1. 概要

Clerk を用いたマルチテナント基盤において、Clerk は認証・組織所属の「アイデンティティ層」を提供するが、データ分離の最終責任はバックエンドにある。本書は既存の要件に加え、JWT の厳格検証、組織スコープ付きルーティング、データアクセス層での強制的な組織フィルタリング、Webhook セキュリティ強化を明示する。

## 2. 追加/更新された要件一覧

### 要件1: JWT 検証の厳格化（バックエンド）

- 概要: Clerk の JWT をバックエンドで必ず検証する。署名・発行者(iss)・対象(aud)・有効期限(exp)・NotBefore(nbf) をチェックし、トークン改ざん・誤用を防ぐ。
- 受入基準:
```gherkin
GIVEN クライアントが Authorization: Bearer <JWT> を付与してAPIへアクセス
WHEN バックエンドがトークンを検証する
THEN Clerk JWKS による署名検証, iss/aud/exp/nbf チェックが行われること
AND 無効なトークンは 401 を返すこと
```
- 補足:
  - Clerk ネイティブの org クレーム (org_id, org_slug, org_role) を優先し、カスタムクレーム (organization_id, organization_name, role) はフォールバックとして扱う。

### 要件2: API ルートの組織スコープ化とガード

- 概要: 組織に紐づく操作は `/api/org/{org_slug}/...` パターンのルートを導入し、URL とトークンの組織整合性を中央ミドルウェアで検証する。
- 受入基準:
```gherkin
GIVEN ユーザーが org_slug の付いたルートにアクセス
WHEN ミドルウェアが URL の org_slug と JWT 内の org_slug を比較
THEN 不一致は 403/404 で拒否されること
AND org_id のみがある場合はDBの organizations から slug を解決して比較すること
```
- 個人用途の非組織ルート（例: /api/v1/account）は従来どおりアクセス可能。
- **フロントエンド自動対応**: HTTP クライアントが認証エンドポイントを除く全てのエンドポイントに自動的に組織スコープを適用し、認証エンドポイントは組織スコープから除外する洗練された仕組みを実装済み。

### 要件3: データベースと DAL の組織分離の強制

- 概要: テナントデータを扱う全テーブルは組織でフィルタされなければならない。全ての SELECT/UPDATE/DELETE は `organization_id` 条件が必要。
- 受入基準:
```gherkin
WHEN 任意のテナントデータにアクセスするクエリが実行される
THEN リポジトリ層で organization_id による WHERE 句が常に適用されること
AND user_id 経由のテーブルは users.clerk_organization_id へ join してフィルタされること
AND UPDATE/DELETE でも同様に組織整合性が検証されること
```
- ベースリポジトリ/共通ヘルパにより自動適用を推奨（事故防止）。

### 要件4: 組織に属さないユーザーの扱い

- 概要: active org を持たないユーザーは `/api/org/...` にはアクセスできない。一方、個人向けの非組織エンドポイントは許可する。
- 受入基準:
```gherkin
GIVEN ユーザーが組織に未所属
WHEN /api/org/... にアクセス
THEN 403 を返す
AND /api/v1/account 等の個人ルートはアクセス可能
```

### 要件5: Webhook セキュリティと冪等性

- 概要: Clerk Webhook は svix による署名検証を行い、イベントの重複処理を避けるための冪等性を実装する。
- 受入基準:
```gherkin
WHEN Clerk から webhook が届く
THEN svix 署名ヘッダ(svix-id, svix-timestamp, svix-signature)を検証し, 不正なら 401
AND event_id の重複はスキップされる（冪等性）
AND 処理はリトライ/指数バックオフを備える
```

### 要件6: 管理者/管理 API

- 概要: 組織内ユーザー管理は管理者のみ可能。管理 API は組織スコープとロールチェックを同時に満たすこと。
- 受入基準:
```gherkin
WHEN 管理者が /api/admin/... を呼び出す
THEN admin ロールを要求し, 対象ユーザーが同一組織であることを検証
```

### 要件7: 非機能要件（更新）

- セキュリティ:
  - 検証済み JWT のみを信頼し、未検証デコードの使用禁止。
  - ログに機微情報（トークン本体, メール等）は出力しない。
  - キャッシュキーはアクティブ組織と有効フィルタを含む（クロステナント汚染防止）。
- パフォーマンス:
  - 組織フィルタ列・slug に適切なインデックスを付与。
- 可用性:
  - Webhook はバックオフ付きリトライ・監視ログを備える。

## 3. 既存要件の補足/明確化

- Clerk メタデータ管理は継続。ただし JWT 内の org 情報は原則として Clerk のネイティブクレーム (org_id, org_slug, org_role) を利用。
- 組織 ID は Clerk の Organization ID をそのまま利用（内部で別 ID を発行しない）。

## 4. 環境変数/設定（新規）

- CLERK_ISSUER: 例 `https://<your-subdomain>.clerk.accounts.dev`
- CLERK_AUDIENCE: Clerk 推奨の aud 値
- CLERK_WEBHOOK_SECRET: svix 署名検証用
- CLERK_ORGANIZATION_ENABLED: 組織機能のフラグ

## 5. 受入テスト（追加）

- 無効署名/誤 iss/誤 aud/期限切れ/nbf 未到来の JWT → 401
- org_slug 不一致（URL vs JWT）→ 403/404
- 組織未所属ユーザーの org ルート → 403
- すべてのテナントクエリに org フィルタがあること（SELECT/UPDATE/DELETE）
- Webhook 署名不正 → 401、重複 event_id → スキップ、バックオフでの再試行
# 要件定義書: Custom JWT Token Enhancement with Organization Support (Revised)

## 1. 概要

Clerk を用いたマルチテナント基盤において、Clerk は認証・組織所属の「アイデンティティ層」を提供するが、データ分離の最終責任はバックエンドにある。本書は既存の要件に加え、JWT の厳格検証、組織スコープ付きルーティング、データアクセス層での強制的な組織フィルタリング、Webhook セキュリティ強化を明示する。

## 2. 追加/更新された要件一覧

### 要件1: JWT 検証の厳格化（バックエンド）

- 概要: Clerk の JWT をバックエンドで必ず検証する。署名・発行者(iss)・対象(aud)・有効期限(exp)・NotBefore(nbf) をチェックし、トークン改ざん・誤用を防ぐ。
- 受入基準:
```gherkin
GIVEN クライアントが Authorization: Bearer <JWT> を付与してAPIへアクセス
WHEN バックエンドがトークンを検証する
THEN Clerk JWKS による署名検証, iss/aud/exp/nbf チェックが行われること
AND 無効なトークンは 401 を返すこと
```
- 補足:
  - Clerk ネイティブの org クレーム (org_id, org_slug, org_role) を優先し、カスタムクレーム (organization_id, organization_name, role) はフォールバックとして扱う。

### 要件2: API ルートの組織スコープ化とガード

- 概要: 組織に紐づく操作は `/api/org/{org_slug}/...` パターンのルートを導入し、URL とトークンの組織整合性を中央ミドルウェアで検証する。
- 受入基準:
```gherkin
GIVEN ユーザーが org_slug の付いたルートにアクセス
WHEN ミドルウェアが URL の org_slug と JWT 内の org_slug を比較
THEN 不一致は 403/404 で拒否されること
AND org_id のみがある場合はDBの organizations から slug を解決して比較すること
```
- 個人用途の非組織ルート（例: /api/v1/account）は従来どおりアクセス可能。
- **フロントエンド自動対応**: HTTP クライアントが認証エンドポイントを除く全てのエンドポイントに自動的に組織スコープを適用し、認証エンドポイントは組織スコープから除外する洗練された仕組みを実装済み。

### 要件3: データベースと DAL の組織分離の強制

- 概要: テナントデータを扱う全テーブルは組織でフィルタされなければならない。全ての SELECT/UPDATE/DELETE は `organization_id` 条件が必要。
- 受入基準:
```gherkin
WHEN 任意のテナントデータにアクセスするクエリが実行される
THEN リポジトリ層で organization_id による WHERE 句が常に適用されること
AND user_id 経由のテーブルは users.clerk_organization_id へ join してフィルタされること
AND UPDATE/DELETE でも同様に組織整合性が検証されること
```
- ベースリポジトリ/共通ヘルパにより自動適用を推奨（事故防止）。

### 要件4: 組織に属さないユーザーの扱い

- 概要: active org を持たないユーザーは `/api/org/...` にはアクセスできない。一方、個人向けの非組織エンドポイントは許可する。
- 受入基準:
```gherkin
GIVEN ユーザーが組織に未所属
WHEN /api/org/... にアクセス
THEN 403 を返す
AND /api/v1/account 等の個人ルートはアクセス可能
```

### 要件5: Webhook セキュリティと冪等性

- 概要: Clerk Webhook は svix による署名検証を行い、イベントの重複処理を避けるための冪等性を実装する。
- 受入基準:
```gherkin
WHEN Clerk から webhook が届く
THEN svix 署名ヘッダ(svix-id, svix-timestamp, svix-signature)を検証し, 不正なら 401
AND event_id の重複はスキップされる（冪等性）
AND 処理はリトライ/指数バックオフを備える
```

### 要件6: 管理者/管理 API

- 概要: 組織内ユーザー管理は管理者のみ可能。管理 API は組織スコープとロールチェックを同時に満たすこと。
- 受入基準:
```gherkin
WHEN 管理者が /api/admin/... を呼び出す
THEN admin ロールを要求し, 対象ユーザーが同一組織であることを検証
```

### 要件7: 非機能要件（更新）

- セキュリティ:
  - 検証済み JWT のみを信頼し、未検証デコードの使用禁止。
  - ログに機微情報（トークン本体, メール等）は出力しない。
  - キャッシュキーはアクティブ組織と有効フィルタを含む（クロステナント汚染防止）。
- パフォーマンス:
  - 組織フィルタ列・slug に適切なインデックスを付与。
- 可用性:
  - Webhook はバックオフ付きリトライ・監視ログを備える。

## 3. 既存要件の補足/明確化

- Clerk メタデータ管理は継続。ただし JWT 内の org 情報は原則として Clerk のネイティブクレーム (org_id, org_slug, org_role) を利用。
- 組織 ID は Clerk の Organization ID をそのまま利用（内部で別 ID を発行しない）。

## 4. 環境変数/設定（新規）

- CLERK_ISSUER: 例 `https://<your-subdomain>.clerk.accounts.dev`
- CLERK_AUDIENCE: Clerk 推奨の aud 値
- CLERK_WEBHOOK_SECRET: svix 署名検証用
- CLERK_ORGANIZATION_ENABLED: 組織機能のフラグ

## 5. 受入テスト（追加）

- 無効署名/誤 iss/誤 aud/期限切れ/nbf 未到来の JWT → 401
- org_slug 不一致（URL vs JWT）→ 403/404
- 組織未所属ユーザーの org ルート → 403
- すべてのテナントクエリに org フィルタがあること（SELECT/UPDATE/DELETE）
- Webhook 署名不正 → 401、重複 event_id → スキップ、バックオフでの再試行
