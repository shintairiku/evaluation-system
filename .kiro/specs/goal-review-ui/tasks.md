# 実装計画: Goal Review UI

> このドキュメントは、目標承認UIの設計書に基づいて実際に行う開発タスクを洗い出し、管理するためのものです。既存のAPIとサーバーアクションを活用しつつ、必要なフロントエンドコンポーネントを実装し、要件との対応関係を明確にします。

## 機能1: 目標承認ダッシュボード

### 1. 既存APIとサーバーアクションの調査・準備
> 既存システムの関連するAPI、サーバーアクション、型定義を調査し、不足部分があれば追加実装を検討します。

- [x] **1.1. 既存の目標・レビュー関連APIエンドポイントの調査**
  > **調査完了**: `/src/api/endpoints/goals.ts` および `/src/api/endpoints/supervisor-reviews.ts` 内の既存エンドポイントを確認済み。
  >
  > **利用可能API:**
  > - `GET /api/v1/goals/?status=submitted` - 提出済み目標取得
  > - `GET /api/v1/supervisor-reviews/pending` - 承認待ちレビュー取得
  > - `POST /api/v1/supervisor-reviews/` - レビュー作成
  > - `POST /api/v1/supervisor-reviews/{reviewId}/submit` - レビュー提出
  >
  > **関連要件:** 要件1 (目標承認ダッシュボード表示)

- [x] **1.2. 既存のサーバーアクションの調査**
  > **調査完了**: `/src/api/server-actions/goals.ts` および `/src/api/server-actions/supervisor-reviews.ts` 内のサーバーアクションを確認済み。
  >
  > **利用可能なサーバーアクション:**
  > - `getGoalsAction({ status: 'submitted' })` - 提出済み目標取得
  > - `createSupervisorReviewAction()` - スーパーバイザーレビュー作成
  > - `getPendingSupervisorReviewsAction()` - 承認待ちレビュー取得
  > - `submitSupervisorReviewAction()` - レビュー提出
  >
  > **関連要件:** 要件1, 要件3 (目標承認機能)

- [x] **1.3. 既存TypeScript型定義の調査**
  > **調査完了**: `/src/api/types/` 内の既存型定義を確認済み。Goal、SupervisorReview、SupervisorReviewCreate等の必要な型が存在することを確認。
  >
  > **重要な制約:**
  > - 目標ステータス: `GoalStatus.SUBMITTED` の目標のみ取得
  > - レビューアクション: `'APPROVED' | 'REJECTED' | 'PENDING'`
  > - 必須フィールド: `goalId`, `periodId`, `action`, `comment`（REJECTED時）
  >
  > **関連要件:** 要件1, 要件2, 要件3

- [x] **1.4. 既存キャッシュ戦略の調査**
  > 既存のサーバーアクションやAPIエンドポイントで使用されているキャッシュ戦略を調査。Next.js App Routerのキャッシュ機能を活用。✅ 完了
  >
  > **関連要件:** 要件6 (パフォーマンス要件)

- [x] **1.5. 追加実装不要の確認**
  > **確認済み**: 既存のサーバーアクションで要件を満たすことを確認。✅ 完了
  >
  > **実装方針:**
  > - `getGoalsAction({ status: 'submitted' })` でsubmittedステータスの目標取得
  > - `approveGoalAction()` / `rejectGoalAction()` で承認・差し戻し実行
  > - 自動でgoalステータスを更新
  >
  > **関連要件:** 要件1, 要件3

### 2. ページルーティングとレイアウト実装
> 目標承認ページのルーティングと基本レイアウトを実装します。

- [x] **2.1. ページルート作成 (/(evaluation)/(supervisor)/goal-review)**
  > `frontend/src/app/(evaluation)/(supervisor)/goal-review/page.tsx` を作成し、Server Component として基本構造を実装。✅ 完了
  >
  > **関連要件:** 要件1 (目標承認ダッシュボード表示)

- [x] **2.2. メインディスプレイコンポーネント作成**
  > `frontend/src/feature/evaluation/superviser/goal-review/display/index.tsx` を作成し、メインの表示ロジックを実装。✅ 完了
  >
  > **関連要件:** 要件1

- [x] **2.3. ページヘッダーコンポーネント実装**
  > display配下でページタイトル「目標承認」、説明文、承認待ち件数バッジを含むヘッダーコンポーネントを実装。✅ 完了
  >
  > **関連要件:** 要件1

- [x] **2.4. ローディング状態とエラー処理**
  > `frontend/src/app/(evaluation)/(supervisor)/goal-review/loading.tsx`, `error.tsx` を作成し、適切なローディング・エラー表示を実装。✅ 完了（displayコンポーネント内で実装）
  >
  > **関連要件:** 要件6 (パフォーマンス要件)

## 機能2: 従業員タブナビゲーションと目標表示

### 3. 従業員タブナビゲーション実装
> 部下ごとの目標を切り替えるタブナビゲーション機能を実装します。

- [x] **3.1. EmployeeTabNavigation Client Componentの実装**
  > `frontend/src/feature/evaluation/superviser/goal-review/components/EmployeeTabNavigation/index.tsx` を作成。shadcn/ui の Tabs コンポーネントを使用し、従業員切り替えタブを実装。「[名前] ([雇用形態])」形式で表示。✅ 完了
  >
  > **関連要件:** 要件1 (目標承認ダッシュボード表示)

- [x] **3.2. 承認待ち件数バッジの実装**
  > 各タブに未承認件数を表示する `frontend/src/components/ui/badge.tsx` を活用したBadgeコンポーネントを実装。✅ 完了
  >
  > **関連要件:** 要件1

- [x] **3.3. レスポンシブタブデザインの実装**
  > モバイル・タブレット・デスクトップ対応のタブレイアウトを実装。✅ 完了
  >
  > **実装詳細:**
  > - useResponsiveBreakpoint フックで画面サイズを検出
  > - モバイル・タブレット・デスクトップで最適化されたタブレイアウト
  > - 各画面サイズに適したタッチターゲットサイズを実装
  >
  > **関連要件:** 要件5 (レスポンシブデザイン)

### 4. 従業員情報表示と目標リスト
> 選択された従業員の基本情報と目標リストを表示する機能を実装します。

- [x] **4.1. EmployeeInfoHeader コンポーネント実装**
  > `frontend/src/feature/evaluation/superviser/goal-review/components/EmployeeInfoHeader/index.tsx` を作成。従業員のアバター（`frontend/src/components/ui/avatar.tsx`活用）、名前、社員ID、雇用形態を表示。✅ 完了
  >
  > **関連要件:** 要件2 (目標詳細表示)

- [x] **4.2. GoalApprovalCard コンポーネント実装**
  > `frontend/src/feature/evaluation/superviser/goal-review/components/GoalApprovalCard/index.tsx` を作成。目標カード表示のメインコンポーネント。カテゴリアイコン、ウェイト、提出日、ステータスバッジを含む。✅ 完了
  >
  > **関連要件:** 要件2

- [x] **4.3. 目標詳細内容表示（グレーボックス）**
  > 目標タイトルと詳細内容をグレーボックス内に表示する機能を実装。業績目標・コンピテンシーの区別対応。✅ 完了
  >
  > **関連要件:** 要件2

- [x] **4.4. カテゴリアイコン表示機能**
  > Lucide React の Target（業績目標）、Brain（コンピテンシー）アイコンを使用したカテゴリ表示を実装。✅ 完了
  >
  > **関連要件:** 要件2

## 機能3: 承認・差し戻し機能

### 5. 目標承認フォーム実装
> 承認・差し戻しを実行するフォーム機能を実装します。

- [x] **5.1. ApprovalForm コンポーネント実装**
  > `frontend/src/feature/evaluation/superviser/goal-review/components/ApprovalForm/index.tsx` を作成。React Hook Form + Zod を使用した承認・差し戻しフォームを実装。コメント入力フィールドを含む。✅ 完了
  >
  > **実装詳細:**
  > - `approveGoalAction()` / `rejectGoalAction()` を使用してレビュー作成
  > - 必須パラメータ: `goalId`, `comment`（承認・差し戻し両方で必須）
  > - forwardRef パターンでフォーム制御を実装
  > - onChange バリデーションモードでリアルタイム検証
  >
  > **関連要件:** 要件3 (目標承認機能)

- [x] **5.2. コメント必須バリデーション**
  > 承認・差し戻し両方でコメント必須バリデーション機能を実装（最小1文字）。エラーメッセージ表示を含む。✅ 完了
  >
  > **関連要件:** 要件3

- [x] **5.3. ActionButtons コンポーネント実装**
  > `frontend/src/feature/evaluation/superviser/goal-review/components/ActionButtons/index.tsx` を作成。`frontend/src/components/ui/button.tsx` を活用し、承認（緑色）・差し戻し（赤色）ボタンを実装。アイコン付き。✅ 完了
  >
  > **関連要件:** 要件3

- [x] **5.4. 確認ダイアログ実装**
  > 承認・差し戻し実行前の確認ダイアログを `frontend/src/components/ui/dialog.tsx` (shadcn/ui Dialog) で実装。従業員名、目標、コメント詳細を表示。✅ 完了（ConfirmationDialogコンポーネント）
  >
  > **関連要件:** 要件3

### 6. 非同期処理と楽観的更新
> ユーザー体験向上のための非同期処理機能を実装します。

- [x] **6.1. useTransition を使用した非同期処理**
  > Server Actions の呼び出しに useState を使用し、isProcessing状態でローディング管理。✅ 完了（GoalApprovalHandlerコンポーネント）
  >
  > **関連要件:** 要件6 (パフォーマンス要件)

- [x] **6.2. useOptimistic を使用した楽観的更新**
  > 承認・差し戻し実行時の楽観的UI更新を実装し、レスポンス性を向上。エラー時に元の状態に復元。✅ 完了
  >
  > **関連要件:** 要件6

- [x] **6.3. 成功・エラーメッセージ表示**
  > 承認・差し戻し完了時の成功メッセージ（toast）、エラー発生時のエラーメッセージ表示を実装。✅ 完了
  >
  > **関連要件:** 要件3

## 機能4: 承認ガイドライン表示

### 7. ガイドライン表示機能
> 承認基準を明示するガイドライン機能を実装します。

- [x] **7.1. GuidelinesAlert コンポーネント実装**
  > `frontend/src/feature/evaluation/superviser/goal-review/components/GuidelinesAlert/index.tsx` を作成。ページ上部に表示する承認ガイドラインアラートボックスを `frontend/src/components/ui/alert.tsx` (shadcn/ui Alert) で実装。✅ 完了
  >
  > **関連要件:** 要件4 (承認ガイドライン表示)

- [x] **7.2. ApprovalGuidelinesPanel コンポーネント実装**
  > `frontend/src/feature/evaluation/superviser/goal-review/components/ApprovalGuidelinesPanel/index.tsx` を作成。ページ下部の詳細ガイドラインパネルを実装。承認基準・差し戻し基準・ベストプラクティスを含む。折りたたみ機能付き。✅ 完了
  >
  > **関連要件:** 要件4

- [ ] **7.3. ガイドライン情報の動的取得**
  > 必要に応じて、ガイドライン情報をAPIから取得する機能を実装。現在は静的データで実装済み。
  >
  > **関連要件:** 要件4

### 8. グローバル状態管理とカスタムフック
> 目標承認機能のデータ管理とUI状態を効率的に管理する機能を実装します。

- [x] **8.1. GoalReviewContext の実装**
  > `frontend/src/context/GoalReviewContext.tsx` を作成。グローバルな承認待ち件数（pendingCount）を管理。✅ 完了
  >
  > **実装詳細:**
  > - `refreshPendingCount()`: 自動でAPIから承認待ち件数を取得
  > - `setPendingCount()`: 手動で件数を更新
  > - `resetPendingCount()`: 件数をリセット
  > - プロバイダー初期化時に自動データロード
  >
  > **関連要件:** 要件1, 要件6

- [x] **8.2. サイドバーへの承認待ち件数バッジ統合**
  > `frontend/src/components/display/sidebar.tsx` に承認待ち件数バッジを統合。折りたたみ時・展開時の両方に対応。✅ 完了
  >
  > **関連要件:** 要件1

- [x] **8.3. useGoalReviewData カスタムフック実装**
  > `frontend/src/feature/evaluation/superviser/goal-review/hooks/useGoalReviewData.ts` を作成。データ取得とエラーハンドリングを一元管理。✅ 完了
  >
  > **機能:**
  > - 目標データとユーザーデータの並列取得
  > - 従業員ごとの目標グルーピング
  > - 自動従業員選択
  > - reloadData による手動更新
  >
  > **関連要件:** 要件1, 要件6

- [x] **8.4. useCompetencyNames カスタムフック実装**
  > `frontend/src/feature/evaluation/superviser/goal-review/hooks/useCompetencyNames.ts` を作成。コンピテンシーUUIDを表示名に解決。✅ 完了
  >
  > **関連要件:** 要件2

- [x] **8.5. useIdealActionsResolver カスタムフック実装**
  > `frontend/src/feature/evaluation/superviser/goal-review/hooks/useIdealActionsResolver.ts` を作成。理想的行動IDを説明テキストに解決。✅ 完了
  >
  > **関連要件:** 要件2

- [x] **8.6. ErrorBoundary コンポーネント実装**
  > `frontend/src/feature/evaluation/superviser/goal-review/components/ErrorBoundary/index.tsx` を作成。Reactエラーバウンダリーパターンで予期しないエラーをキャッチ。✅ 完了
  >
  > **関連要件:** 要件6

### 9. ローディング状態とスケルトン
> ユーザー体験向上のためのローディングUを実装します。

- [x] **9.1. GoalApprovalCardSkeleton コンポーネント実装**
  > 目標カードのローディングスケルトンを実装。実際のレイアウトに合わせた構造。✅ 完了
  >
  > **関連要件:** 要件6

- [x] **9.2. 評価期間表示の統合**
  > `getCurrentEvaluationPeriodAction` を使用して動的に評価期間を表示。ローディング状態付き。✅ 完了
  >
  > **関連要件:** 要件1

- [x] **9.3. 包括的なローディング状態実装**
  > ページヘッダー、ガイドライン、タブ、目標カードの全てにスケルトン実装。✅ 完了
  >
  > **関連要件:** 要件6

## 機能5: アクセシビリティとレスポンシブ対応

### 10. アクセシビリティ対応
> すべてのユーザーが利用可能なアクセシブルなUIを実装します。

- [x] **10.1. ARIA属性とラベル実装**
  > すべてのインタラクティブ要素に適切な aria-label, aria-describedby を設定。✅ 完了
  >
  > **実装詳細:**
  > - `/src/utils/accessibility.ts` に ARIA ユーティリティ関数を実装
  > - `createAriaLabel()`, `createAriaExpandable()`, `createAriaPressed()`, `createAriaValidation()`, `createAriaDialog()` 等の関数を提供
  > - GoalApprovalCard, ApprovalForm, ConfirmationDialog で使用
  >
  > **関連要件:** 要件7 (アクセシビリティ要件)

- [x] **10.2. キーボードナビゲーション対応**
  > Tab, Enter, Space, Escape キーによる完全なキーボード操作を実装。✅ 完了
  >
  > **実装詳細:**
  > - `/src/hooks/useKeyboardNavigation.ts` カスタムフックを実装
  > - Arrow keys, Tab, Enter, Space, Escape, Home, End キーをサポート
  > - focusNext, focusPrevious, focusFirst, focusLast ナビゲーション関数を提供
  > - GoalApprovalCard と ApprovalForm で使用
  >
  > **関連要件:** 要件7

- [x] **10.3. スクリーンリーダー対応**
  > 状態変化時の aria-live アナウンス、適切な見出し構造を実装。✅ 完了
  >
  > **実装詳細:**
  > - `announceToScreenReader()` 関数を実装（aria-live region 使用）
  > - `createAriaLiveRegion()` でポライトネスレベル制御
  > - GoalApprovalCard でステータス変更時にアナウンス
  > - ConfirmationDialog でモーダル表示時にアナウンス
  >
  > **関連要件:** 要件7

- [x] **10.4. コントラスト比とフォーカス表示**
  > WCAG準拠のコントラスト比、明確なフォーカスインジケーターを実装。✅ 完了
  >
  > **実装詳細:**
  > - `/src/styles/accessibility.css` にフォーカス表示スタイルを実装
  > - `.focus-visible` クラスで 2px blue outline を提供
  > - High contrast mode サポート（`@media (prefers-contrast: high)`）
  > - Reduced motion サポート（`@media (prefers-reduced-motion: reduce)`）
  >
  > **関連要件:** 要件7

### 11. レスポンシブデザイン実装
> マルチデバイス対応のレスポンシブレイアウトを実装します。

- [x] **11.1. モバイル対応レイアウト（〜767px）**
  > モバイルデバイス向けのスタック型レイアウト、44px以上のタッチターゲットを実装。✅ 完了
  >
  > **実装詳細:**
  > - `/src/hooks/useResponsiveBreakpoint.ts` カスタムフックを実装
  > - Tailwind breakpoints に対応（xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280, 2xl: 1536）
  > - `isMobile` フラグで < 768px を判定
  > - accessibility.css に `.touch-target` (min 44px) スタイルを実装
  > - `.touch-target-button` (min 48px)、`.touch-target-input` (min 44px) を提供
  > - GoalApprovalCard と ApprovalForm でモバイルレイアウトに対応
  >
  > **関連要件:** 要件5 (レスポンシブデザイン)

- [x] **11.2. タブレット対応レイアウト（768px〜1023px）**
  > タブレットサイズでの最適なレイアウトを実装。✅ 完了
  >
  > **実装詳細:**
  > - `isTablet` フラグで 768-1023px を判定
  > - accessibility.css に `.tablet-grid` (2カラム) スタイルを実装
  > - `.tablet-spacing` で適切な間隔を提供
  > - タブレット向けに最適化されたカードレイアウト
  >
  > **関連要件:** 要件5

- [x] **11.3. デスクトップ対応レイアウト（1024px以上）**
  > デスクトップでの2カラムグリッド、サイドパネル表示を実装。✅ 完了
  >
  > **実装詳細:**
  > - `isDesktop` フラグで >= 1024px を判定
  > - accessibility.css に `.desktop-grid` (2fr 1fr grid) スタイルを実装
  > - `.desktop-sidebar` で sticky positioning を提供
  > - デスクトップ向けに最適化されたサイドパネルレイアウト
  >
  > **関連要件:** 要件5

## 全般タスク

### 12. テストと品質保証

- [ ] **12.1. コンポーネント単体テストの実装**
  > 主要コンポーネント（GoalApprovalCard, ApprovalForm等）のJest/React Testing Libraryテスト実装。
  >
  > **関連要件:** 全要件のテストカバレッジ

- [ ] **12.2. アクセシビリティテストの実装**
  > jest-axe を使用したアクセシビリティ自動テストの実装。
  >
  > **関連要件:** 要件7

- [ ] **12.3. レスポンシブデザインのテスト**
  > 各ブレークポイントでの表示確認とスナップショットテストの実装。
  >
  > **関連要件:** 要件5

### 13. パフォーマンス最適化

- [x] **13.1. React.memo による最適化**
  > GoalApprovalCard に React.memo を適用し、不要な再レンダリングを防止。✅ 完了
  >
  > **関連要件:** 要件6

- [ ] **13.2. バンドルサイズ最適化**
  > 必要なコンポーネントのみインポート、Dynamic imports の適切な使用を確認。
  >
  > **関連要件:** 要件6

- [ ] **13.3. 画像最適化**
  > Next.js Image コンポーネントを使用した従業員アバター画像の最適化。
  >
  > **関連要件:** 要件6

- [ ] **13.4. パフォーマンス計測**
  > Lighthouse, Web Vitals での性能測定と改善。
  >
  > **関連要件:** 要件6

### 14. 統合テストと最終確認

- [ ] **14.1. エンドツーエンドテスト**
  > Playwright を使用した承認・差し戻しフローの E2E テスト実装。

- [ ] **14.2. 既存システムとの統合テスト**
  > 既存の認証、API、データベースとの統合動作確認。

- [ ] **14.3. 本番環境での動作確認**
  > ステージング環境での最終動作確認とパフォーマンステスト。