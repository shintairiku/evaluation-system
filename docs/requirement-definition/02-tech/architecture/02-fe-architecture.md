# フロントエンド開発ガイド

このドキュメントは、バックエンドエンドポイントと連携するフロントエンド機能を実装するための包括的なガイドです。一貫性のある適切なアーキテクチャを維持するために、以下の手順に従ってください。

## アーキテクチャ概要

### ディレクトリ構造
```
frontend/src/
├── api/                    # API統合レイヤー
│   ├── client/            # HTTPクライアント設定
│   ├── constants/         # API設定定数
│   ├── endpoints/         # APIエンドポイント関数（バックエンドと1:1対応）
│   ├── server-actions/    # Next.jsサーバーアクション（SSR用）
│   └── types/            # TypeScript型定義（バックエンドスキーマと一致）
├── app/                   # Next.js App Router（ページ定義）
├── components/            # 再利用可能なUIコンポーネント
│   ├── ui/               # 基本UIコンポーネント（shadcn/ui）
│   ├── display/          # 表示専用コンポーネント
│   └── constants/        # 定数定義
├── feature/              # 機能別コンポーネント
├── hooks/                # カスタムReactフック
├── lib/                  # ユーティリティ関数
├── types/                # グローバル型定義
└── middleware.ts         # Next.jsミドルウェア
```

## 開発フロー

### 1. APIエンドポイント設定 (`frontend/src/api/constants/config.ts`)

バックエンドのエンドポイントパスを設定します。

```ts
export const API_ENDPOINTS = {
  // 認証エンドポイント
  AUTH: {
    GET_USER_BY_CLERK_ID: (clerkId: string) => `/auth/user/${clerkId}`,
    SIGNUP: '/auth/signup',
    SIGNUP_PROFILE_OPTIONS: '/auth/signup/profile-options',
  },
  
  // ユーザーエンドポイント
  USERS: {
    LIST: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    CREATE: '/users',
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
  },
  
  // 新しいリソースを追加する場合
  NEW_RESOURCE: {
    LIST: '/new-resource',
    BY_ID: (id: string) => `/new-resource/${id}`,
    CREATE: '/new-resource',
    UPDATE: (id: string) => `/new-resource/${id}`,
    DELETE: (id: string) => `/new-resource/${id}`,
  },
} as const;
```

### 2. 型定義作成 (`frontend/src/api/types/`)

バックエンドのスキーマと一致するTypeScript型を定義します。

```ts
// frontend/src/api/types/new-resource.ts
import { UUID } from './common';

export interface NewResource {
  id: UUID;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface NewResourceCreate {
  name: string;
  description?: string;
}

export interface NewResourceUpdate {
  name?: string;
  description?: string;
}

export interface NewResourceDetailResponse {
  id: UUID;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}
```

### 3. エンドポイント関数作成 (`frontend/src/api/endpoints/`)

バックエンドエンドポイントと1:1対応する関数を作成します。

```ts
// frontend/src/api/endpoints/new-resource.ts
import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type {
  NewResourceDetailResponse,
  NewResourceCreate,
  NewResourceUpdate,
  ApiResponse,
  UUID,
} from '../types';

const httpClient = getHttpClient();

export const newResourceApi = {
  /**
   * リソース一覧を取得
   */
  getNewResources: async (): Promise<ApiResponse<NewResourceDetailResponse[]>> => {
    return httpClient.get<NewResourceDetailResponse[]>(API_ENDPOINTS.NEW_RESOURCE.LIST);
  },

  /**
   * 特定のリソースをIDで取得
   */
  getNewResourceById: async (id: UUID): Promise<ApiResponse<NewResourceDetailResponse>> => {
    return httpClient.get<NewResourceDetailResponse>(API_ENDPOINTS.NEW_RESOURCE.BY_ID(id));
  },

  /**
   * 新しいリソースを作成
   */
  createNewResource: async (data: NewResourceCreate): Promise<ApiResponse<NewResourceDetailResponse>> => {
    return httpClient.post<NewResourceDetailResponse>(API_ENDPOINTS.NEW_RESOURCE.CREATE, data);
  },

  /**
   * 既存のリソースを更新
   */
  updateNewResource: async (id: UUID, data: NewResourceUpdate): Promise<ApiResponse<NewResourceDetailResponse>> => {
    return httpClient.put<NewResourceDetailResponse>(API_ENDPOINTS.NEW_RESOURCE.UPDATE(id), data);
  },

  /**
   * リソースを削除
   */
  deleteNewResource: async (id: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete<void>(API_ENDPOINTS.NEW_RESOURCE.DELETE(id));
  },
};
```

### 4. サーバーアクション作成 (`frontend/src/api/server-actions/`)

SSR用のサーバーアクションを作成します。

```ts
// frontend/src/api/server-actions/new-resource.ts
'use server';

import { newResourceApi } from '../endpoints/new-resource';
import type { 
  NewResourceDetailResponse, 
  NewResourceCreate, 
  NewResourceUpdate,
  UUID 
} from '../types';

/**
 * リソース一覧を取得するサーバーアクション
 */
export async function getNewResourcesAction(): Promise<{
  success: boolean;
  data?: NewResourceDetailResponse[];
  error?: string;
}> {
  try {
    const response = await newResourceApi.getNewResources();
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'リソースの取得に失敗しました',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get new resources action error:', error);
    return {
      success: false,
      error: 'リソースの取得中に予期しないエラーが発生しました',
    };
  }
}

/**
 * 特定のリソースをIDで取得するサーバーアクション
 */
export async function getNewResourceByIdAction(id: UUID): Promise<{
  success: boolean;
  data?: NewResourceDetailResponse;
  error?: string;
}> {
  try {
    const response = await newResourceApi.getNewResourceById(id);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'リソースの取得に失敗しました',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get new resource by ID action error:', error);
    return {
      success: false,
      error: 'リソースの取得中に予期しないエラーが発生しました',
    };
  }
}

/**
 * 新しいリソースを作成するサーバーアクション
 */
export async function createNewResourceAction(data: NewResourceCreate): Promise<{
  success: boolean;
  data?: NewResourceDetailResponse;
  error?: string;
}> {
  try {
    const response = await newResourceApi.createNewResource(data);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'リソースの作成に失敗しました',
      };
    }
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Create new resource action error:', error);
    return {
      success: false,
      error: 'リソースの作成中に予期しないエラーが発生しました',
    };
  }
}
```

### 5. エクスポート設定

各ファイルのindex.tsにエクスポートを追加します。

```ts
// frontend/src/api/endpoints/index.ts
export * from './users';
export * from './auth';
export * from './new-resource'; // 新しく追加

// frontend/src/api/server-actions/index.ts
export * from './users';
export * from './auth';
export * from './new-resource'; // 新しく追加

// frontend/src/api/types/index.ts
export * from './common';
export * from './auth';
export * from './user';
export * from './new-resource'; // 新しく追加
```

### 6. ページとコンポーネント実装

#### ページコンポーネント (`frontend/src/app/`)

```tsx
// frontend/src/app/(evaluation)/(admin)/new-resource/page.tsx
import IndexPage from "@/feature/evaluation/admin/new-resource/display/index";
import Sidebar from "@/components/display/sidebar";
import Header from "@/components/display/header";

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex mt-[45px]">
        <div className="fixed left-0 top-[45px] h-[calc(100vh-45px)]">
          <Sidebar />
        </div>
        <main className="flex-1 ml-[314px] p-5">
          <IndexPage />
        </main>
      </div>
    </div>
  );
}
```

#### フィーチャーコンポーネント (`frontend/src/feature/`)

```tsx
// frontend/src/feature/evaluation/admin/new-resource/display/index.tsx
import { getNewResourcesAction } from '@/api/server-actions';
import { NewResourceList } from './NewResourceList';
import { CreateNewResourceForm } from './CreateNewResourceForm';

export default async function NewResourceIndexPage() {
  const result = await getNewResourcesAction();
  
  if (!result.success) {
    return (
      <div className="p-6">
        <div className="text-red-600">エラー: {result.error}</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">リソース管理</h1>
        <CreateNewResourceForm />
      </div>
      <NewResourceList resources={result.data || []} />
    </div>
  );
}
```

#### 表示コンポーネント (`frontend/src/feature/evaluation/admin/new-resource/display/`)

```tsx
// frontend/src/feature/evaluation/admin/new-resource/display/NewResourceList.tsx
'use client';

import { NewResourceDetailResponse } from '@/api/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NewResourceListProps {
  resources: NewResourceDetailResponse[];
}

export function NewResourceList({ resources }: NewResourceListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {resources.map((resource) => (
        <Card key={resource.id}>
          <CardHeader>
            <CardTitle>{resource.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {resource.description || '説明なし'}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

#### フォームコンポーネント

```tsx
// frontend/src/feature/evaluation/admin/new-resource/display/CreateNewResourceForm.tsx
'use client';

import { useState } from 'react';
import { createNewResourceAction } from '@/api/server-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function CreateNewResourceForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
    };

    const result = await createNewResourceAction(data);
    
    if (result.success) {
      // 成功時の処理（リダイレクトやリフレッシュなど）
      window.location.reload();
    } else {
      setError(result.error || '作成に失敗しました');
    }
    
    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">名前</Label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <Label htmlFor="description">説明</Label>
        <Textarea id="description" name="description" />
      </div>
      {error && <div className="text-red-600">{error}</div>}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? '作成中...' : '作成'}
      </Button>
    </form>
  );
}
```

## ベストプラクティス

### 1. サーバーコンポーネント優先
- SEOとパフォーマンスのため、可能な限りサーバーコンポーネントを使用
- データフェッチはサーバーサイドで実行

### 2. 型安全性
- すべてのAPI呼び出しでTypeScript型を使用
- バックエンドスキーマと一致する型定義を維持

### 3. エラーハンドリング
- 一貫したエラーハンドリングパターンを使用
- ユーザーフレンドリーなエラーメッセージを表示

### 4. コンポーネント設計
- 単一責任の原則に従う
- 再利用可能なコンポーネントを作成
- 適切なprops型定義

### 5. パフォーマンス
- 不要な再レンダリングを避ける
- 適切なメモ化を使用
- 画像の最適化

## 環境変数設定

`.env.local`ファイルに以下を追加：

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
```

## 開発ツール

### 開発コマンド
```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# リント
npm run lint

# 型チェック
npx tsc --noEmit
```

## トラブルシューティング

### よくある問題

1. **API接続エラー**
   - 環境変数の設定を確認
   - バックエンドサーバーが起動しているか確認

2. **型エラー**
   - バックエンドスキーマとの整合性を確認
   - 型定義ファイルの更新

3. **認証エラー**
   - Clerk設定の確認
   - トークンの有効性確認

4. **SSRエラー**
   - サーバーアクションの'use server'ディレクティブ確認
   - クライアントコンポーネントでの適切な使用