# 実装計画: ホームページUI（マルチロール対応ダッシュボード）

> このドキュメントは、設計書に基づいて実際に行う開発タスクを洗い出し、管理するためのものです。マルチロール対応のタブ形式ダッシュボードを実装し、ユーザーが複数の役職視点でダッシュボードを切り替えられる機能を提供します。

## 機能A: マルチロール対応の基盤実装

### 1. ユーザー役職管理システム

- [x] **1.1. useUserRoles Hookの実装**
  > ユーザーの複数役職を取得・管理するカスタムフック実装。
  > ユーザーの権限階層レベルから利用可能な役職を判定する。
  >
  > **実装完了:** `/src/hooks/useUserRoles.ts` - Clerk認証連携、役職階層判定、日本語ラベル対応
  > **関連要件:** 要件1, 要件2, 要件3

- [x] **1.2. RolePermissionGuardコンポーネントの作成**
  > 役職に応じてコンポーネントの表示/非表示を制御するガード。
  > 権限チェックロジックを統一的に管理。
  >
  > **実装完了:** `/src/components/auth/RolePermissionGuard.tsx` - 複数権限戦略、HOC・Hook版も実装
  > **関連要件:** 要件1, 要件2, 要件3

- [x] **1.3. 役職マッピング定数の定義**
  > 役職名、表示ラベル、階層レベルのマッピング定数を作成。
  > 日本語ラベル対応。
  >
  > **実装完了:** `/src/hooks/useUserRoles.ts`内 - ROLE_MAPPING、DASHBOARD_ROLE_MAPPING定数
  > **関連要件:** 要件1, 要件2, 要件3

### 2. タブナビゲーション基盤

- [x] **2.1. RoleTabNavigationコンポーネントの実装**
  > shadcn/ui Tabsコンポーネントを使用した役職切り替えタブ。
  > 動的な役職数に対応したグリッドレイアウト。
  >
  > **実装完了:** `/src/components/dashboard/RoleTabNavigation.tsx` - 動的グリッド、アイコン・バッジ対応
  > **関連要件:** 要件4

- [x] **2.2. TabContentContainerコンポーネントの実装**
  > タブコンテンツのコンテナコンポーネント。
  > 遅延読み込み対応とキャッシュ機能。
  >
  > **実装完了:** `/src/components/dashboard/TabContentContainer.tsx` - Lazy loading、エラーバウンダリ、キャッシュ機能
  > **関連要件:** 要件4, 要件5

- [x] **2.3. タブ状態管理の実装**
  > アクティブタブの状態管理とURL同期。
  > ブラウザバック/フォワード対応。
  >
  > **実装完了:** `/src/hooks/useTabState.ts` - URL同期、ブラウザナビゲーション、役職検証機能
  > **関連要件:** 要件4

## 機能B: 管理者用ダッシュボード実装

### 3. 管理者向けカードコンポーネント

- [x] **3.1. SystemStatsCardコンポーネントの作成**
  > システム全体の統計情報表示カード。
  > 総ユーザー数、部門数、アクティブ評価期間数を表示。
  >
  > **実装完了:** `/src/components/dashboard/admin/SystemStatsCard.tsx` - システム統計・健康状態表示、リアルタイム更新対応
  > **関連要件:** 要件1

- [x] **3.2. PendingApprovalsCardコンポーネントの作成**
  > 承認待ち項目表示カード。
  > 承認待ちユーザー数、未完了評価数をバッジ表示。
  >
  > **実装完了:** `/src/components/dashboard/admin/PendingApprovalsCard.tsx` - 優先度別表示、クリック可能リンク対応
  > **関連要件:** 要件1

- [x] **3.3. SystemAlertsCardコンポーネントの作成**
  > システムアラート表示カード。
  > 緊急度に応じた色分け表示とアイコン。
  >
  > **実装完了:** `/src/components/dashboard/admin/SystemAlertsCard.tsx` - 緊急度別色分け、アラート削除機能
  > **関連要件:** 要件1

- [x] **3.4. QuickActionsCardコンポーネントの作成**
  > 管理機能への直接アクセスボタン。
  > ユーザー管理、部門管理、ステージ管理、コンピテンシー管理へのリンク。
  >
  > **実装完了:** `/src/components/dashboard/admin/QuickActionsCard.tsx` - 管理機能ショートカット、レポート・緊急対応メニュー
  > **関連要件:** 要件1

### 4. 管理者用データ取得・API連携

- [x] **4.1. getAdminDashboardData Server Actionの実装**
  > 管理者用ダッシュボードデータ取得のServer Action。
  > システム統計、承認待ち、アラート情報の取得。
  >
  > **実装完了:** `/src/api/server-actions/admin-dashboard.ts` - Server Action、APIエンドポイント、型定義、キャッシュ設定
  > **関連要件:** 要件1

- [x] **4.2. AdminDashboardレイアウトコンポーネントの実装**
  > 管理者用ダッシュボードの統合レイアウト。
  > レスポンシブ対応（3カラム→2カラム→1カラム）。
  >
  > **実装完了:** `/src/components/dashboard/admin/AdminDashboard.tsx` - レスポンシブレイアウト、状態管理、エラーハンドリング
  > **関連要件:** 要件1, 要件4

## 機能C: 上司・管理職用ダッシュボード実装

### 5. 上司向けカードコンポーネント

- [x] **5.1. TeamProgressCardコンポーネントの作成**
  > チーム進捗表示カード。
  > 部下の評価進捗サマリーをプログレスバーで表示。
  >
  > **実装完了:** `/src/components/dashboard/supervisor/TeamProgressCard.tsx` - プログレスバー、ステータス表示、スケルトン
  > **関連要件:** 要件2

- [x] **5.2. SupervisorPendingApprovalsCardコンポーネントの作成**
  > 上司用承認待ちタスク表示カード。
  > 目標承認待ち、評価フィードバック待ちの件数表示。
  >
  > **実装完了:** `/src/components/dashboard/supervisor/SupervisorPendingApprovalsCard.tsx` - 承認待ちタスク、優先度表示、クイックアクション
  > **関連要件:** 要件2

- [x] **5.3. SubordinatesCardコンポーネントの作成**
  > 部下一覧表示カード。
  > 緊急対応が必要な部下の強調表示。
  >
  > **実装完了:** `/src/components/dashboard/supervisor/SubordinatesCard.tsx` - 部下一覧、ステータス表示、緊急対応ハイライト
  > **関連要件:** 要件2

- [x] **5.4. SupervisorActionsCardコンポーネントの作成**
  > 上司機能への直接アクセスボタン。
  > 目標承認、評価フィードバック画面へのリンク。
  >
  > **実装完了:** `/src/components/dashboard/supervisor/SupervisorActionsCard.tsx` - クイックアクションボタン、ナビゲーション
  > **関連要件:** 要件2

### 6. 上司用データ取得・API連携

- [x] **6.1. getSupervisorDashboardData Server Actionの実装**
  > 上司用ダッシュボードデータ取得のServer Action。
  > 部下の進捗、承認待ちタスク、部下一覧の取得。
  >
  > **実装完了:** `/src/api/server-actions/supervisor-dashboard.ts` - Server Action、型定義、APIエンドポイント
  > **関連要件:** 要件2

- [x] **6.2. SupervisorDashboardレイアウトコンポーネントの実装**
  > 上司用ダッシュボードの統合レイアウト。
  > レスポンシブ対応。
  >
  > **実装完了:** `/src/components/dashboard/supervisor/SupervisorDashboard.tsx` - レスポンシブレイアウト、状態管理、エラーハンドリング
  > **関連要件:** 要件2, 要件4

## 機能D: 従業員・パート用ダッシュボード実装

### 7. 従業員向けカードコンポーネント

- [ ] **7.1. PersonalProgressCardコンポーネントの作成**
  > 個人評価進捗表示カード。
  > 目標設定状況、評価入力状況をステップ表示。
  >
  > **関連要件:** 要件3

- [ ] **7.2. TodoTasksCardコンポーネントの作成**
  > 実行すべきタスク表示カード。
  > 「目標入力が必要」「評価入力が必要」等のアクションアイテム。
  >
  > **関連要件:** 要件3

- [ ] **7.3. DeadlineAlertsCardコンポーネントの作成**
  > 期限警告表示カード。
  > 期限までの残り日数を警告色で表示。
  >
  > **関連要件:** 要件3

- [ ] **7.4. HistoryAccessCardコンポーネントの作成**
  > 履歴アクセスカード。
  > 目標・評価履歴への直接アクセスボタン。
  >
  > **関連要件:** 要件3

### 8. 従業員用データ取得・API連携

- [ ] **8.1. getEmployeeDashboardData Server Actionの実装**
  > 従業員用ダッシュボードデータ取得のServer Action。
  > 評価期間、個人進捗、TODO、期限情報の取得。
  >
  > **関連要件:** 要件3

- [ ] **8.2. EmployeeDashboardレイアウトコンポーネントの実装**
  > 従業員用ダッシュボードの統合レイアウト。
  > レスポンシブ対応。
  >
  > **関連要件:** 要件3, 要件4

## 機能E: バックエンドAPIエンドポイント実装

### 9. 管理者用APIエンドポイント

- [ ] **9.1. GET /api/v1/admin/dashboard エンドポイントの実装**
  > 管理者用ダッシュボードの完全データを返すエンドポイント。
  > システム統計、承認待ち、アラート情報を統合して返す。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py` (新規作成)
  > **関連要件:** 要件1

- [ ] **9.2. GET /api/v1/admin/dashboard/stats エンドポイントの実装**
  > システム統計情報のみを返すエンドポイント。
  > 総ユーザー数、部門数、アクティブ評価期間数。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件1

- [ ] **9.3. GET /api/v1/admin/dashboard/approvals エンドポイントの実装**
  > 承認待ち情報のみを返すエンドポイント。
  > 承認待ちユーザー数、未完了評価数。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件1

- [ ] **9.4. GET /api/v1/admin/dashboard/alerts エンドポイントの実装**
  > システムアラート情報を返すエンドポイント。
  > 緊急度別アラートリスト。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件1

- [ ] **9.5. POST /api/v1/admin/dashboard/alerts/{alert_id}/dismiss エンドポイントの実装**
  > アラートを削除(無効化)するエンドポイント。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件1

### 10. 上司・管理職用APIエンドポイント

- [ ] **10.1. GET /api/v1/supervisor/dashboard/{user_id} エンドポイントの実装**
  > 上司用ダッシュボードの完全データを返すエンドポイント。
  > チーム進捗、承認待ちタスク、部下一覧を統合して返す。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件2

- [ ] **10.2. GET /api/v1/supervisor/dashboard/{user_id}/team-progress エンドポイントの実装**
  > チーム進捗情報のみを返すエンドポイント。
  > 部下の評価進捗サマリー。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件2

- [ ] **10.3. GET /api/v1/supervisor/dashboard/{user_id}/pending-tasks エンドポイントの実装**
  > 承認待ちタスク情報を返すエンドポイント。
  > 目標承認待ち、評価フィードバック待ち件数。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件2

- [ ] **10.4. GET /api/v1/supervisor/dashboard/{user_id}/subordinates エンドポイントの実装**
  > 部下一覧と状態を返すエンドポイント。
  > 緊急対応が必要な部下の識別含む。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件2

### 11. 従業員・パート用APIエンドポイント

- [ ] **11.1. GET /api/v1/employee/dashboard/{user_id} エンドポイントの実装**
  > 従業員用ダッシュボードの完全データを返すエンドポイント。
  > 現在の評価期間、個人進捗、TODOタスク、期限情報を統合して返す。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件3

- [ ] **11.2. GET /api/v1/employee/dashboard/{user_id}/progress エンドポイントの実装**
  > 個人評価進捗情報のみを返すエンドポイント。
  > 目標設定状況、評価入力状況。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件3

- [ ] **11.3. GET /api/v1/employee/dashboard/{user_id}/todos エンドポイントの実装**
  > 実行すべきタスク一覧を返すエンドポイント。
  > 目標入力、評価入力等の必要アクション。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件3

- [ ] **11.4. GET /api/v1/employee/dashboard/{user_id}/deadlines エンドポイントの実装**
  > 期限情報を返すエンドポイント。
  > 評価期限、目標提出期限等。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件3

### 12. ダッシュボードサービス層の実装

- [ ] **12.1. DashboardServiceクラスの作成**
  > ダッシュボード用のビジネスロジックを集約するサービス層。
  > 各役職別のデータ取得ロジックを実装。
  >
  > **実装ファイル:** `backend/app/services/dashboard_service.py` (新規作成)
  > **関連要件:** 要件1, 要件2, 要件3

- [ ] **12.2. 管理者用データ集計ロジックの実装**
  > UserRepository, DepartmentRepository, EvaluationPeriodRepositoryを統合して統計情報を算出。
  > アラート生成ロジックの実装。
  >
  > **実装ファイル:** `backend/app/services/dashboard_service.py`
  > **関連要件:** 要件1

- [ ] **12.3. 上司用データ集計ロジックの実装**
  > GoalRepository, EvaluationRepositoryから部下データを集計。
  > 承認待ちタスクの抽出ロジック。
  >
  > **実装ファイル:** `backend/app/services/dashboard_service.py`
  > **関連要件:** 要件2

- [ ] **12.4. 従業員用データ集計ロジックの実装**
  > 個人の評価状態、TODOタスク、期限情報の算出。
  > 期限警告ロジックの実装。
  >
  > **実装ファイル:** `backend/app/services/dashboard_service.py`
  > **関連要件:** 要件3

### 13. ダッシュボードレスポンスモデルの定義

- [ ] **13.1. Pydanticスキーマの定義**
  > AdminDashboardResponse, SupervisorDashboardResponse, EmployeeDashboardResponseの定義。
  > フロントエンドの型定義と1:1対応させる。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py` または `backend/app/schemas/dashboard.py` (新規作成)
  > **関連要件:** 要件1, 要件2, 要件3

- [ ] **13.2. SystemStatsスキーマの定義**
  > total_users, total_departments, active_evaluation_periodsの定義。
  >
  > **実装ファイル:** `backend/app/schemas/dashboard.py`
  > **関連要件:** 要件1

- [ ] **13.3. PendingApprovalsスキーマの定義**
  > users, evaluationsの承認待ち件数定義。
  >
  > **実装ファイル:** `backend/app/schemas/dashboard.py`
  > **関連要件:** 要件1, 要件2

- [ ] **13.4. SystemAlertスキーマの定義**
  > type, message, count, priorityの定義。
  >
  > **実装ファイル:** `backend/app/schemas/dashboard.py`
  > **関連要件:** 要件1

### 14. APIルーター統合

- [ ] **14.1. dashboard routerの作成とメインルーターへの統合**
  > `/api/v1/dashboard`配下のエンドポイントをまとめたルーター作成。
  > `backend/app/main.py`への統合。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`, `backend/app/main.py`
  > **関連要件:** 要件1, 要件2, 要件3

- [ ] **14.2. 権限チェックミドルウェアの実装**
  > 管理者エンドポイントはadmin権限必須。
  > 上司エンドポイントはsupervisor権限必須。
  > 従業員エンドポイントは本人または上司の権限必須。
  >
  > **実装ファイル:** `backend/app/api/v1/dashboard.py`
  > **関連要件:** 要件1, 要件2, 要件3

## 機能F: 統合ダッシュボード実装

### 15. メインダッシュボードコンポーネント

- [ ] **15.1. EnhancedDashboardコンポーネントの実装**
  > 既存のWelcomeDashboardを置き換えるメインコンポーネント。
  > 役職タブとコンテンツ統合。
  >
  > **関連要件:** 要件1, 要件2, 要件3

- [ ] **15.2. DashboardFactoryコンポーネントの実装**
  > 役職に応じて適切なダッシュボードを生成するファクトリー。
  > コンポーネントの動的読み込み対応。
  >
  > **関連要件:** 要件1, 要件2, 要件3

- [ ] **15.3. page.tsxの更新**
  > メインページでWelcomeDashboardからEnhancedDashboardに変更。
  > Suspense境界とエラーバウンダリーの追加。
  >
  > **関連要件:** 要件1, 要件2, 要件3

### 16. 共通UIコンポーネント

- [ ] **16.1. DashboardCardコンポーネントの実装**
  > 統一されたカードレイアウトコンポーネント。
  > shadcn/ui Cardコンポーネントをベースにした拡張。
  >
  > **関連要件:** 要件1, 要件2, 要件3

- [ ] **16.2. StatisticsBadgeコンポーネントの実装**
  > 数値表示用バッジコンポーネント。
  > 優先度に応じた色分け対応。
  >
  > **関連要件:** 要件1, 要件2, 要件3

- [ ] **16.3. AlertIndicatorコンポーネントの実装**
  > 注意喚起用インジケーターコンポーネント。
  > アニメーション効果付き。
  >
  > **関連要件:** 要件1, 要件2, 要件3

- [ ] **16.4. QuickActionButtonコンポーネントの実装**
  > アクション実行ボタンコンポーネント。
  > アイコン付きボタンの統一実装。
  >
  > **関連要件:** 要件1, 要件2, 要件3

## 機能G: レスポンシブ対応とパフォーマンス最適化

### 17. レスポンシブデザイン実装

- [ ] **17.1. モバイル向けレイアウトの実装**
  > 768px未満での1カラム縦並びレイアウト。
  > 重要な情報の上部表示。
  >
  > **関連要件:** 要件4

- [ ] **17.2. タブレット向けレイアウトの実装**
  > 768px-1024pxでの2カラムレイアウト。
  > 効率的な情報配置。
  >
  > **関連要件:** 要件4

- [ ] **17.3. デスクトップ向けレイアウトの実装**
  > 1024px以上での3カラム以上レイアウト。
  > 豊富な情報の一覧表示。
  >
  > **関連要件:** 要件4

### 18. パフォーマンス最適化

- [ ] **18.1. 遅延読み込み機能の実装**
  > タブが選択されたときのみデータ取得。
  > React.lazy()を使用したコンポーネント分割。
  >
  > **関連要件:** 要件5

- [ ] **18.2. データキャッシュ機能の実装**
  > 役職別データのキャッシュ機能。
  > SWRパターンによる効率的なデータ管理。
  >
  > **関連要件:** 要件5

- [ ] **18.3. ローディングUXの実装**
  > Skeleton UIコンポーネントの実装。
  > 各ダッシュボード用のローディング状態。
  >
  > **関連要件:** 要件5

## 全般タスク

### 19. テストと品質保証

- [ ] **19.1. 単体テストの実装 (カバレッジ80%以上)**
  > 各ダッシュボードコンポーネントの単体テスト。
  > Hook、Server Actionのテスト。
  > バックエンドAPIエンドポイントとサービスの単体テスト。

- [ ] **19.2. 統合テストシナリオの作成と実施**
  > マルチロール切り替えのE2Eテスト。
  > 権限チェックのテスト。
  > フロントエンド-バックエンド統合テスト。

- [ ] **19.3. アクセシビリティテストの実施**
  > ARIA属性、キーボードナビゲーション対応確認。
  > スクリーンリーダー対応テスト。

### 20. デプロイメントと監視

- [ ] **20.1. TypeScript型チェックとLintの実行**
  > npm run type-check、npm run lintの実行。
  > コード品質の確保。

- [ ] **20.2. Python型チェックとLintの実行**
  > mypy、ruff checkの実行。
  > バックエンドコード品質の確保。

- [ ] **20.3. パフォーマンス計測の実施**
  > 要件5の受入基準（2秒以内、1秒以内等）の検証。
  > Core Web Vitalsの測定。

- [ ] **20.4. ドキュメント更新**
  > README.mdの更新。
  > コンポーネントドキュメントの作成。
  > APIドキュメント(OpenAPI)の更新。