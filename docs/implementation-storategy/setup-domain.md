# Vercel アプリへのカスタムサブドメイン設定ガイド（Squarespace + Google Workspace 利用者向け）

## 1. このガイドの目的

Vercel で開発したアプリケーション（例: 人事評価システム）に、社用の独自ドメインを使った分かりやすいURL（例: https://hr.shintairiku.jp）を設定します。

**Before (変更前):** https://evaluation-system-one.vercel.app  
**After (変更後):** https://hr.shintairiku.jp

### 重要なポイント:
- ドメインを新しく購入する必要はありません。
- Google Workspace で使用中のメール（...@shintairiku.jp）が停止することはありません。

## 2. 作業の全体像

作業は大きく分けて3つのステップで行います。2つのサービス（Vercel と Squarespace）の管理画面を行き来します。

### 【Vercel】で設定値を「もらう」
Vercel に「hr.shintairiku.jp を使いたいです」と申請し、設定に必要な「接続先の情報（CNAME値）」を教えてもらいます。

### 【Squarespace】で設定値を「追加する」
ドメインを管理している Squarespace にログインし、Vercel から教えてもらった「接続先の情報（CNAME値）」を新しいレコードとして追加します。

### 【Vercel】で接続を「確認する」
Vercel に戻り、「設定が完了しました」と報告（Refresh）し、接続が有効になったことを確認します。

## 3. ステップ・バイ・ステップ手順

### ステップ1： Vercel で設定値（CNAME）を確認する

1. Vercel のプロジェクトにアクセスし、Settings タブ -> Domains メニューに進みます。
2. 右上の Add Domain ボタンをクリックします。
3. Add Domain のポップアップが表示されます。
4. 入力欄に、使用したい サブドメイン名 を正確に入力します。（例: hr.shintairiku.jp や app.shintairiku.jp）
5. Redirect ... to www... のチェックボックスは、チェックを外してください。
6. Connect to an environment は Production を選択します。
7. Save ボタンをクリックします。
8. Domains の一覧画面に戻ります。
9. 今追加した hr.shintairiku.jp が、**「Invalid Configuration（無効な設定）」**という赤字のエラーと共に表示されますが、これが正常な状態です。
10. hr.shintairiku.jp の項目に、設定に必要な情報が表示されています。
11. CNAME レコード の値をコピーしてください。
    - Type: CNAME
    - Value: cname.vercel-dns.com （または cname-china.vercel-dns.com など、表示された固有の値をコピーします）

これで Vercel 側の準備は完了です。cname.vercel-dns.com の値をコピーしたまま、次のステップに進みます。

### ステップ2： Squarespace で CNAME レコードを追加する

> **!! 最も重要な注意点 !!**  
> この作業では、既存のレコード（特に MX と書かれたメール用レコード）を絶対に削除・変更しないでください。私たちは**「新しいレコードを1行追加する」**だけです。

1. Squarespace のドメイン管理ダッシュボードにアクセスします。
   - https://account.squarespace.com/domains
2. Google Workspace（旧 Google Domains）で使用していた Google アカウントでログインします。
3. ドメイン一覧から、親ドメイン（例: shintairiku.jp）をクリックします。
4. DNS 設定パネル（または DNS Settings）を開きます。
5. Custom Records（カスタムレコード）というセクションを探します。
6. Add Record（レコードを追加） ボタンをクリックします。
7. 新しいレコードの入力欄に、Vercel から指示された情報を入力します。
   - Host (ホスト): hr
     - （注意: hr.shintairiku.jp 全体ではなく、shintairiku.jp より前の部分だけを入力します）
   - Type (タイプ): CNAME
     - （プルダウンメニューから選択します）
   - Data (データ): cname.vercel-dns.com
     - （ステップ1で Vercel からコピーした値を貼り付けます）
   - TTL (時間): 1 hour （またはデフォルトのままで構いません）
8. Save（保存） をクリックして、新しいレコードを保存します。

これで Squarespace 側の設定は完了です。

### ステップ3： Vercel で設定の反映を確認する

1. DNS 設定がインターネット全体に反映されるまで、少し時間がかかります。（通常は数分～1時間程度ですが、最大48時間かかる場合もあります）
2. Vercel のプロジェクト設定（Settings -> Domains）に戻ります。
3. hr.shintairiku.jp の項目の右側にある Refresh ボタンをクリックします。
4. 「Invalid Configuration（無効な設定）」の赤字が消え、**「Valid Configuration（有効な設定）」**の緑色のチェックマークに変われば、すべての設定は成功です！
5. hr.shintairiku.jp が Production ブランチに正しく割り当てられていることを確認します。

## 4. 最終確認

1. ブラウザのアドレスバーに https://hr.shintairiku.jp を入力し、Vercel でデプロイしたアプリが正しく表示されることを確認します。
2. 念のため、Google Workspace（Gmailなど）でメールの送受信が引き続き問題なく行えることを確認します。

## 5. エンジニア側の変更（本番ドメイン切替に伴う）

本節では、公開 URL を `https://hr.shintairiku.jp` に切り替える際に必要となるエンジニアリング作業をまとめます。対象は Clerk（認証）、フロントエンド（Vercel）、バックエンド（FastAPI/Cloud Run）、CORS/セキュリティ、Webhook 構成です。

### 5.1 Clerk（ダッシュボード設定：Develop → Production）

- 本番用 Clerk アプリケーション（Production インスタンス）を使用する（必要に応じて新規作成）。
- API Keys（Publishable/Secret）を本番のものに切替。
- Allowed Origins（必須）
  - `https://hr.shintairiku.jp`
  - バックエンドの公開 URL（例：`https://backend-xxxxx.run.app`）
- Redirect URLs / Paths（サインイン/サインアップ後のリダイレクト）
  - `https://hr.shintairiku.jp/sign-in`
  - `https://hr.shintairiku.jp/sign-up`
  - 必要に応じて `afterSignInUrl`/`afterSignUpUrl` を `https://hr.shintairiku.jp/` に設定
- JWT Templates（Issuer/Audience）
  - Issuer（例）：`https://<your-clerk-id>.clerk.accounts.dev`
  - Audience を利用する場合は `hr.shintairiku.jp` を設定（後述のバックエンド設定と一致が必要）
- Webhooks（ユーザー/組織同期を利用している場合）
  - Endpoint：`POST https://<backend-domain>/api/webhooks/clerk`
  - 署名シークレット（`whsec_...`）を取得し、後述バックエンドに反映

### 5.2 フロントエンド（Vercel）

- Vercel の Project → Settings → Domains に `hr.shintairiku.jp` を追加（本書 3章の手順済み想定）。
- Environment Variables（Production）を本番鍵に切替：
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`
  - `CLERK_SECRET_KEY=sk_live_...`（サーバーオンリー。Vercel では暗号化変数として保存）
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`（既存のまま）
  - `NEXT_PUBLIC_API_BASE_URL`（バックエンド URL が変わる場合のみ更新）
- Redirect/Callback URLs は Clerk 側の設定に合わせ、アプリ内のリンク先は従来どおり `/sign-in`, `/sign-up` を利用（`frontend/src/app/layout.tsx` の `ClerkProvider` でパス指定済）。

### 5.3 バックエンド（FastAPI / Cloud Run）

- 環境変数（Production）を更新：
  - `CLERK_SECRET_KEY=sk_live_...`
  - `CLERK_ISSUER=https://<your-clerk-id>.clerk.accounts.dev`
  - `CLERK_AUDIENCE=hr.shintairiku.jp`（Issuer とセットで検証に使用）
  - `CLERK_WEBHOOK_SECRET=whsec_...`（Webhook を利用する場合）
  - `FRONTEND_URL=https://hr.shintairiku.jp`（CORS 用）
  - 必要に応じて `ADDITIONAL_CORS_ORIGINS` にプレビュー/検証用ドメインをカンマ区切りで指定
- JWT 検証は `AuthService.get_user_from_token` で `issuer`/`audience` を厳格検証（署名/JWKS を含む）。環境変数の値を本番用に揃える。
- 任意（推奨）: `azp`（Authorized Party）検証を導入する場合は `CLERK_AUTHORIZED_PARTIES=hr.shintairiku.jp` を設定し、バックエンドで `azp` チェックを有効化（実装が未導入の場合は別途タスク化）。
- CORS は `backend/app/main.py` と `backend/app/core/config.py` の設定に従い、`FRONTEND_URL` を `https://hr.shintairiku.jp` にすることで許可。

### 5.4 Webhook（Clerk → Backend）

- Clerk ダッシュボードの Webhook エンドポイントを確認：`https://<backend-domain>/api/webhooks/clerk`
- バックエンドの `CLERK_WEBHOOK_SECRET` を本番の Signing Secret に更新。
- ログで検証：テストイベント送信 → Cloud Run のログで受信・署名検証成功を確認。

### 5.5 OAuth/SAML（必要時）

- Google/OAuth を Clerk 経由で利用している場合は、Clerk 側の Allowed Origins/Redirect URLs を `hr.shintairiku.jp` で更新（多くは Clerk 側で集約管理のためアプリ側変更は不要）。

### 5.6 リリース手順（推奨順）

1. Clerk 本番インスタンスで Allowed Origins / Redirect URLs / JWT Issuer/Audience を設定
2. バックエンド本番（Cloud Run）の環境変数を更新（`CLERK_*`, `FRONTEND_URL`）しリビルド
3. Vercel（Production）環境変数を本番鍵へ切替し再デプロイ
4. DNS（Squarespace）の CNAME を追加済みであることを確認し、Vercel 側で `Valid Configuration` を確認
5. 動作確認（下記チェックリスト）

### 5.7 動作確認チェックリスト

- サインイン/サインアップ/サインアウトが新ドメインで完結する
- 組織必須ページで未所属ユーザーが `/org` にリダイレクトされる
- 管理者専用ページで `org:admin` 以外は `/access-denied` に遷移する
- API リクエストが 200/401/403 を期待どおり返す（Authorization: Bearer が保持される）
- Webhook が受信・署名検証 OK（リトライ/冪等制御も正常動作）
- CORS エラーがブラウザに出ない（`FRONTEND_URL`/Allowed Origins が一致）

### 5.8 ロールバック指針

- Vercel の Production 環境変数を旧（Develop）鍵に戻す
- Cloud Run の `CLERK_ISSUER`/`CLERK_AUDIENCE`/`FRONTEND_URL` を旧値に戻す
- Clerk の Allowed Origins / Redirect URLs を旧ドメインに戻す
- DNS の CNAME を一時的に旧ドメインへ切替（伝播に最大 48 時間）

---

参考：
- バックエンドの JWT 設定と CORS
  - `backend/app/core/config.py` の `CLERK_ISSUER`, `CLERK_AUDIENCE`, `FRONTEND_URL`, `CORS_ORIGINS`
  - `backend/app/main.py` の CORS ミドルウェア設定
- Clerk Webhook ハンドラ
  - `backend/app/api/webhooks/clerk.py`
- フロントエンドの Clerk 初期化
  - `frontend/src/app/layout.tsx` の `ClerkProvider`