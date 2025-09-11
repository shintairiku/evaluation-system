# feat: Server Actions Standardization and Cache Implementation
Issue #202

## 概要
- 現在のNext.jsアプリケーションでは、フロントエンドAPIレイヤーに一貫性のないパターンがあり（usersはendpoints経由、goalsは直接HTTPクライアント経由）。
- 多くのバックエンドAPIにフロントエンド対応のエンドポイントファイルやサーバーアクションが不足。この問題を解決するため、統一されたサーバーアクションパターンの実装と、すべてのバックエンドAPIエンドポイントに対応するフロントエンド実装を標準化。
- Next.jsキャッシュメカニズム（Request MemoizationとData Cache）の適用し、ページロードのレイテンシー向上を目指す。

## 主要な要件

### 1. サーバーアクションフォーマットの標準化
- すべてのサーバーアクションを統一されたパターン（endpoints経由）で実装
- 標準化されたエラーハンドリングとレスポンス形式の採用
- TypeScript型安全性の確保

### 2. 欠落しているエンドポイントファイルの実装
実装が必要なエンドポイントファイル:
- `departments.ts` - Department CRUD操作
- `roles.ts` - Role CRUD + reorder操作  
- `stages.ts` - Stage CRUD操作
- `evaluation-periods.ts` - EvaluationPeriod CRUD操作
- `competencies.ts` - Competency CRUD操作
- `self-assessments.ts` - SelfAssessment操作
- `supervisor-reviews.ts` - SupervisorReview操作
- `supervisor-feedbacks.ts` - SupervisorFeedback操作

### 3. サーバーアクションの完全実装
- 上記すべてのエンドポイントに対応するサーバーアクションの実装
- 既存のgoals.tsサーバーアクションの標準パターンへの修正
- 適切な認証とエラーハンドリングの統一

### 4. Next.jsキャッシュメカニズムの適用
- **Request Memoization**: 読み取り専用サーバーアクションに適用
- **Data Cache**: 適切なrevalidationタグとキャッシュ戦略の実装
- データ変更時の関連キャッシュ再検証

## 技術的アプローチ

### アーキテクチャ構成
```
Next.js Server Components
    ↓
Server Actions (/src/api/server-actions/)
    ↓
Endpoints Layer (/src/api/endpoints/)
    ↓  
HTTP Client (/src/api/client/)
    ↓
FastAPI Backend
```

### 標準化されたサーバーアクションパターン
```typescript
export async function get[Resource]sAction(
  params?: PaginationParams
): Promise<ServerActionResponse<[Resource]List>> {
  try {
    const response = await [resource]Api.get[Resource]s(params);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch [resources]',
      };
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Get [resources] action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching [resources]',
    };
  }
}
```

## 実装計画

### フェーズ1: エンドポイントファイルと型定義
- [ ] 欠落している8つのエンドポイントファイルの実装
- [ ] 対応する型定義ファイル（department.ts, role.ts, stage.ts等）の作成
- [ ] goals.ts エンドポイントファイルの作成

### フェーズ2: サーバーアクションの標準化
- [ ] 既存goals.tsサーバーアクションの修正（endpoints経由パターンに変更）
- [ ] 新規8つのサーバーアクションファイルの実装

### フェーズ3: キャッシュメカニズムの実装
- [ ] Request Memoization wrapper関数の作成
- [ ] Data Cache戦略の実装（静的データ vs 動的データ）
- [ ] キャッシュタグシステムと再検証ロジックの実装

### フェーズ4: 品質保証
- [ ] TypeScriptコンパイルエラーの解消
- [ ] Lintエラーの解消  
- [ ] JSDocコメントの追加
- [ ] インデックスファイルの更新

## 期待される効果

### 開発者体験の向上
- **関心の分離**: サーバーアクション（ビジネスフロー）とエンドポイント（API通信）の責務明確化
- **再利用性**: API通信ロジックの一元化により、異なるコンテキストでの再利用が容易
- **テスト容易性**: エンドポイント層をモックすることで単体テストが簡易化

### 技術的な利点
- **型安全性**: すべてのAPI呼び出しでTypeScript型チェック
- **一貫したエラーハンドリング**: 標準化されたエラーレスポンス形式
- **パフォーマンス**: Next.jsキャッシュメカニズムによる最適化
- **スケーラビリティ**: 構造的な一貫性により、APIが増加しても保守可能

## 関連ドキュメント

このIssueは以下の仕様書に基づいています:
- 📋 [要件定義書](.kiro/specs/server-actions-standardization/requirements.md)
- 🏗️ [設計書](.kiro/specs/server-actions-standardization/design.md)  
- 📝 [実装計画](.kiro/specs/server-actions-standardization/tasks.md)

## 受入基準

✅ すべてのバックエンドAPIエンドポイントに対応するフロントエンドエンドポイントファイルが存在する  
✅ すべてのAPIエンドポイントに対応するサーバーアクションが実装されている  
✅ すべてのサーバーアクションが統一されたパターン（endpoints経由）を使用している  
✅ TypeScriptコンパイルエラーとlintエラーがゼロになっている  
✅ 適切なNext.jsキャッシュメカニズムが適用されている  
✅ 標準化されたエラーハンドリングが全体で一貫している

---

**Labels:** `enhancement`, `frontend`, `api`, `standardization`, `next.js`
**Priority:** High
**Estimate:** 5-7 days