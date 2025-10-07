1. `frontend/src/api/constants/config.ts`
- Fetchを行いたいBackendのエンドポイントのパスを設定する。
- すでにデフォルトとして設定されている場合には、間違いがないかの確認
```ts
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    GET_USER_BY_CLERK_ID: (clerkId: string) => `/auth/user/${clerkId}`,
    SIGNUP: '/auth/signup',
    SIGNUP_PROFILE_OPTIONS: '/auth/signup/profile-options',
  },..

}
```


2. `frontend/src/api/endpoints`
- `---.py`のようにファイルを追加、または類似するエンドポイント層のファイルがあることを確認
```
frontend/src/lib/api/endpoints/
├── index.ts # 今回はここに追加
├── auth.ts
├── users.ts
├── README.md
└── ...
```
- `index.ts`に各エンドポイントのパスを設定（必要であれば）
```ts (index.ts)
export * from './users';
export * from './auth';  // 今回はここに追加
```

3. `frontend/src/api/types/`
- 今回の場合では、`auth.ts`を作成し、必要な型を定義
- 2.の`frontend/src/api/endpoints/auth.ts`に戻り、リクエストとレスポンスで使用する必要な型をインポート。
- 型の作成は、基本的にバックエンド同じ形でOK

4. `frontend/src/api/server-actions/`
- 今回の場合は、`auth.ts`を作成し、実際のバックエンドのエンドポイントを呼び出す
- 2.で指定したエンドポイントに対応するサーバーアクションを作成（１：１の関係）
- すべてのページ（client component）に作成したサーバーアクションをインポートして、使用するイメージ

5. `frontend/src/app/`
- あとは、必要なページを定義して、コンポーネント(`frontend/src/components/`)、フィーチャー(`frontend/src/feature/`)、フック（`frontend/src/hooks/`）を作成していく。
- それで、サーバーアクションをインポートして、バックエンドと繋げる