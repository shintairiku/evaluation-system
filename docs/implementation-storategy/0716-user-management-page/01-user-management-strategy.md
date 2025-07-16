# ユーザー管理ページ実装戦略書

## 📋 基本情報

- **機能名**: ユーザー管理ページ (/user-profiles)
- **フェーズ**: Phase 1 (MVP)
- **優先度**: High (🔴)
- **作成日**: 2025-07-16
- **対象URL**: `/user-profiles`

## 🎯 実装目標

### 主要機能
1. **全ユーザー一覧表示**
   - 全ユーザー表示（権限制御なし - フロントエンドイメージ確認用）
   - 3つの表示モード切り替え

2. **3つの表示モード**
   - **テーブルビュー**: 詳細データをテーブル形式で表示
   - **ギャラリービュー**: カード形式でビジュアル重視表示
   - **組織図ビュー**: 組織階層構造で表示

3. **検索・フィルタリングシステム**
   - 名前・従業員コード検索
   - 部署・ステージ・ロール・ステータス別フィルタ
   - 複数条件組み合わせ対応

4. **ユーザー管理操作**
   - ユーザー詳細表示
   - ユーザー情報編集
   - 承認待ちユーザー管理

## 📊 現状分析

### ✅ 実装済み（バックエンド）
- **API完全実装**: 全CRUD操作、権限制御、検索・フィルタリング
- **型定義完備**: TypeScript型、スキーマ定義
- **権限システム**: RBAC実装済み
- **データ構造**: 関係性管理（部署、ステージ、ロール、上司-部下）

### ✅ 実装済み（フロントエンド API層）
- **サーバーアクション**: 7つの主要関数実装済み
- **エンドポイント関数**: HTTP Client統合済み
- **型安全性**: バックエンドとの完全対応
- **認証統合**: Clerk自動トークン注入

### 🔄 未実装（フロントエンド UI層）
- ユーザー管理ページUI
- 3つの表示モード切り替え機能
- 検索・フィルタコンポーネント
- ユーザー詳細・編集モーダル

## 🏗️ 実装戦略

### Phase 1-A: ページ構造と表示モード切り替え
1. **ページコンポーネント作成**
   - `/user-profiles/page.tsx`
   - メインレイアウト（Header + Sidebar + Content）

2. **表示モード切り替えUI**
   - 3つのモード選択ボタン（Table / Gallery / Organization）
   - shadcn/ui Tabsコンポーネント使用

3. **フィルター・検索UI**
   - 横並び検索・フィルターバー
   - shadcn/ui Input, Select, Comboboxコンポーネント

### Phase 1-B: 各表示モードの実装
1. **テーブルビュー**
   - shadcn/ui Table + DataTableパターン
   - ソート・ページネーション
   - アクションボタン

2. **ギャラリービュー**
   - shadcn/ui Cardコンポーネント
   - Grid レイアウト
   - レスポンシブ対応

3. **組織図ビュー**
   - 階層構造表示
   - 上司-部下関係の可視化

### Phase 1-C: 詳細機能
1. **ユーザー詳細モーダル**
   - shadcn/ui Dialog
   - 情報表示・編集機能

2. **承認待ちユーザー管理**
   - Badge表示
   - アクションボタン

## 📁 ファイル構造

```
frontend/src/
├── app/(evaluation)/(admin)/user-profiles/
│   └── page.tsx                           # メインページ
├── feature/evaluation/admin/user-management/
│   ├── display/
│   │   ├── index.tsx                      # メインコンポーネント
│   │   ├── ViewModeSelector.tsx           # 表示モード選択（Tabs）
│   │   ├── FilterBar.tsx                  # 検索・フィルターバー
│   │   ├── UserTableView.tsx              # テーブルビュー
│   │   ├── UserGalleryView.tsx            # ギャラリービュー  
│   │   ├── UserOrganizationView.tsx       # 組織図ビュー
│   │   ├── UserDetailModal.tsx            # ユーザー詳細モーダル
│   │   └── UserEditModal.tsx              # ユーザー編集モーダル
│   └── hooks/
│       ├── useUserManagement.ts           # ユーザー管理ロジック
│       ├── useUserFilters.ts              # フィルタリングロジック
│       └── useViewMode.ts                 # ビューモード管理
└── components/ui/
    ├── data-table.tsx                     # shadcn/ui DataTable
    ├── user-card.tsx                      # ユーザーカードコンポーネント
    └── organization-tree.tsx              # 組織図ツリーコンポーネント
```

## 🔧 実装手順

### Step 1: 基盤準備
1. **ページファイル作成**
   ```typescript
   // app/(evaluation)/(admin)/user-profiles/page.tsx
   import UserManagementIndex from "@/feature/evaluation/admin/user-management/display/index";
   
   export default function UserProfilesPage() {
     return <UserManagementIndex />;
   }
   ```

2. **メインコンポーネント作成**
   - サーバーアクションでデータフェッチ
   - 初期状態設定（権限チェックなし）

### Step 2: UI構造実装
1. **ViewModeSelector.tsx作成**
   - shadcn/ui Tabsコンポーネント
   - Table/Gallery/Organization 3モード

2. **FilterBar.tsx実装**
   - shadcn/ui Input（検索）
   - shadcn/ui Select（フィルタ）
   - 横並びレイアウト

### Step 3: テーブルビュー実装
1. **UserTableView.tsx作成**
   - shadcn/ui data-table パターン
   - ソート・ページネーション
   - アクションボタン

### Step 4: ギャラリー・組織図ビュー
1. **UserGalleryView.tsx**
   - shadcn/ui Card Grid
   - レスポンシブ対応

2. **UserOrganizationView.tsx**
   - 階層構造表示

### Step 5: 詳細・編集機能
1. **UserDetailModal.tsx**
   - shadcn/ui Dialog
   - ユーザー情報表示

2. **UserEditModal.tsx**
   - フォーム実装

## 🎨 UI/UX 設計

### レイアウト構造
```
┌─────────────────────────────────────────────────────┐
│                    Header                           │
├──────────┬──────────────────────────────────────────┤
│          │  ┌─ ViewModeSelector (Tabs) ─┐           │
│ Sidebar  │  │ [Table] [Gallery] [Org]   │           │
│          │  └───────────────────────────┘           │
│          │  ┌─ FilterBar ─────────────────┐         │
│          │  │ [Search] [Dept] [Stage] ... │         │
│          │  └─────────────────────────────┘         │
│          │  ┌─ Current View ──────────────┐         │
│          │  │                             │         │
│          │  │    Table/Gallery/Org        │         │
│          │  │                             │         │
│          │  └─────────────────────────────┘         │
└──────────┴──────────────────────────────────────────┘
```

### shadcn/ui コンポーネント設計

#### 1. ViewModeSelector (Tabs)
```tsx
<Tabs defaultValue="table" className="w-full">
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="table">テーブル</TabsTrigger>
    <TabsTrigger value="gallery">ギャラリー</TabsTrigger>
    <TabsTrigger value="organization">組織図</TabsTrigger>
  </TabsList>
</Tabs>
```

#### 2. FilterBar (横並び)
```tsx
<div className="flex items-center space-x-4 mb-6">
  <Input placeholder="名前・従業員コードで検索..." />
  <Select>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="部署を選択" />
    </SelectTrigger>
  </Select>
  <Select>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="ステージを選択" />
    </SelectTrigger>
  </Select>
</div>
```

#### 3. テーブルビュー
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>名前</TableHead>
      <TableHead>メール</TableHead>
      <TableHead>部署</TableHead>
      <TableHead>ステージ</TableHead>
      <TableHead>ステータス</TableHead>
      <TableHead>アクション</TableHead>
    </TableRow>
  </TableHeader>
</Table>
```

#### 4. ギャラリービュー
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {users.map(user => (
    <Card key={user.id}>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <Badge>{user.department}</Badge>
        <Badge>{user.stage}</Badge>
      </CardContent>
    </Card>
  ))}
</div>
```

### カラースキーム（shadcn/ui準拠）
- **Primary**: `bg-primary text-primary-foreground`
- **Secondary**: `bg-secondary text-secondary-foreground`  
- **Success**: `bg-green-100 text-green-800`
- **Warning**: `bg-yellow-100 text-yellow-800`
- **Danger**: `bg-red-100 text-red-800`

## 🔐 権限制御実装

### 権限制御の方針
**今回はフロントエンドイメージ確認のため権限制御は実装しません**

- 全ユーザーデータを表示
- 全機能にアクセス可能
- 権限チェック処理はスキップ

### 将来の権限実装準備
```typescript
// useUserPermissions.ts (将来実装用)
export function useUserPermissions() {
  // 現在は権限チェックなし、全権限を返す
  return {
    canViewAllUsers: true,      // 将来: Admin のみ
    canEditUsers: true,         // 将来: Admin + 上司（部下のみ）
    canViewStages: true,        // 将来: Admin + 上司のみ
    canApproveUsers: true,      // 将来: Admin のみ
  };
}
```

## 📱 レスポンシブ対応

### ブレークポイント
- **Mobile**: < 768px - シンプルリスト表示
- **Tablet**: 768px - 1024px - 2カラムレイアウト
- **Desktop**: > 1024px - フル機能表示

### モバイル最適化
- タッチフレンドリーな操作
- スワイプジェスチャー
- コンパクトな情報表示

## 🧪 テスト戦略

### Unit Tests
- カスタムフック（useUserManagement, useUserFilters）
- ユーティリティ関数
- 権限制御ロジック

### Integration Tests
- サーバーアクション統合
- API呼び出し
- データフロー

### E2E Tests
- ユーザー検索・フィルタリング
- 編集フロー
- 権限ベースアクセス

## 🚀 パフォーマンス最適化

### データ管理
- **仮想化**: large datasets対応
- **キャッシュ**: 検索結果キャッシュ
- **遅延読み込み**: 画像・詳細情報

### Bundle最適化
- **Code Splitting**: ページレベル分割
- **Tree Shaking**: 未使用コード除去
- **Dynamic Import**: モーダル等の遅延読み込み

## 📋 完成基準

### 必須機能
- [ ] ユーザー一覧表示（全ユーザー）
- [ ] 3つの表示モード切り替え（Table/Gallery/Organization）
- [ ] 検索・フィルタリング
- [ ] ページネーション（テーブルビュー）
- [ ] ユーザー詳細表示
- [ ] ユーザー編集機能
- [ ] レスポンシブ対応

### 品質基準
- [ ] TypeScript型安全性100%
- [ ] ESLint・Prettier適用
- [ ] アクセシビリティ対応
- [ ] パフォーマンス最適化
- [ ] エラーハンドリング

### UX基準
- [ ] 直感的な操作性
- [ ] 高速な応答性（< 500ms）
- [ ] 明確なフィードバック
- [ ] 一貫したデザイン

## 🔄 次のアクション

1. **Phase 1-A完了後**: ViewModeSelector + FilterBar のUI確認
2. **Phase 1-B完了後**: 3つの表示モードのビジュアル確認  
3. **Phase 1-C完了後**: 詳細・編集機能のインタラクション確認

## 📚 参考実装

### プロフィールページパターン
- データフェッチ: ProfileFormWrapper.tsx
- エラーハンドリング: try-catch + user-friendly messages
- フォーム実装: useState + custom validation
- 認証統合: Clerk + server actions

### 既存コンポーネント活用
- Header: `/components/display/header`
- Sidebar: `/components/display/sidebar`
- UI Components: `/components/ui/*`

---

**shadcn/ui ベース実装準備完了**: このドキュメントに基づき、3つの表示モードを持つモダンなユーザー管理画面の実装を開始します。権限制御は後回しとし、まずはフロントエンドUIの完成度を高めることを優先します。