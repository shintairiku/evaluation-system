# 評価システム5大ドメインAPI実装戦略書

## 概要
人事評価システムの核となる5つのサービスドメイン（evaluation_periods, goals, supervisor_reviews, self_assessments, supervisor_feedback）のAPI実装を段階的に行う戦略書。

## GitHub Issues

| Phase | Domain | Issue # | Title | Status |
|-------|--------|---------|-------|--------|
| Phase 1 | evaluation_periods | [#131](https://github.com/shintairiku/evaluation-system/issues/131) | [Backend] Implement Evaluation Periods API - Phase 1 Foundation Layer | Open |
| Phase 2 | goals | [#132](https://github.com/shintairiku/evaluation-system/issues/132) | [Backend] Implement Goals API - Phase 2 Core Business Logic | Open |
| Phase 3A | self_assessments | [#134](https://github.com/shintairiku/evaluation-system/issues/134) | [Backend] Implement Self Assessments API - Phase 3A Employee Self-Evaluation | Open |
| Phase 3B | supervisor_reviews | [#133](https://github.com/shintairiku/evaluation-system/issues/133) | [Backend] Implement Supervisor Reviews API - Phase 3B Supervisor Review Process | Open |
| Phase 4 | supervisor_feedback | [#135](https://github.com/shintairiku/evaluation-system/issues/135) | [Backend] Implement Supervisor Feedback API - Phase 4 Final Evaluation Loop | Open |

## 実装順序と依存関係

### 依存関係図
```
evaluation_periods (基盤)
    ↓
goals (目標設定・承認)
    ↓                    ↓
self_assessments    supervisor_reviews
(自己評価)           (上司レビュー)
    ↓
supervisor_feedback
(上司フィードバック)
```

## フェーズ別実装計画

### Phase 1: Foundation Layer
**対象:** `evaluation_periods`
**期間:** 3-4日
**優先度:** 🔴 Critical
**GitHub Issue:** [#131](https://github.com/shintairiku/evaluation-system/issues/131)

#### 実装理由
- 全ての評価プロセスの基盤となる評価期間管理
- 他の全ドメインが依存する基礎エンティティ
- 評価タイムラインと締切管理の実装

#### 実装ステップ
1. **Database Model** (`backend/app/database/models/evaluation_period.py`)
2. **Repository** (`backend/app/database/repositories/evaluation_period_repo.py`)
3. **Schemas** (`backend/app/schemas/evaluation_period.py`)
4. **Service** (`backend/app/services/evaluation_period_service.py`)
5. **API Endpoints** (`backend/app/api/v1/evaluation_periods.py`)
6. **Router Registration** (`backend/app/main.py`)

#### 完成基準
- [ ] 評価期間のCRUD操作が完全に動作
- [ ] 期間ステータスの遷移管理（upcoming → active → completed）
- [ ] 日付論理整合性チェック（start_date < end_date等）
- [ ] API全エンドポイントのテスト完了
- [ ] Swagger UIでの動作確認完了

### Phase 2: Core Business Logic
**対象:** `goals`
**期間:** 5-6日
**優先度:** 🔴 Critical
**GitHub Issue:** [#132](https://github.com/shintairiku/evaluation-system/issues/132)

#### 実装理由
- 評価プロセスの中核となる目標設定機能
- 承認ワークフローの実装
- 重み配分バリデーションの実装

#### 実装ステップ
1. **Database Model** (`backend/app/database/models/goal.py`)
2. **Repository** (`backend/app/database/repositories/goal_repo.py`)
3. **Schemas** (`backend/app/schemas/goal.py`)
4. **Service** (`backend/app/services/goal_service.py`)
5. **API Endpoints** (`backend/app/api/v1/goals.py`)
6. **Weight Validation Logic** (業績目標の重み合計100%チェック)
7. **Status Workflow** (draft → pending_approval → approved/rejected)

#### 完成基準
- [ ] 目標のCRUD操作が完全に動作
- [ ] 3つの目標カテゴリ（業績、コンピテンシー、コアバリュー）対応
- [ ] 重み配分バリデーション機能
- [ ] 承認ワークフロー（提出→承認/差し戻し）
- [ ] target_dataのJSONB構造対応
- [ ] 自動レコード作成トリガー準備

### Phase 3A: Employee Self-Evaluation
**対象:** `self_assessments`
**期間:** 3-4日
**優先度:** 🟡 High
**GitHub Issue:** [#134](https://github.com/shintairiku/evaluation-system/issues/134)

#### 実装理由
- 従業員による自己評価機能
- 目標カテゴリ別の評価ルール実装
- 比較的シンプルな業務ロジック

#### 実装ステップ
1. **Database Model** (`backend/app/database/models/self_assessment.py`)
2. **Repository** (`backend/app/database/repositories/self_assessment_repo.py`)
3. **Schemas** (`backend/app/schemas/self_assessment.py`)
4. **Service** (`backend/app/services/self_assessment_service.py`)
5. **API Endpoints** (`backend/app/api/v1/self_assessments.py`)
6. **Rating Validation** (目標カテゴリ別の評価点ルール)
7. **Auto-creation Trigger** (目標作成時の自動生成)

#### 完成基準
- [ ] 自己評価のCRUD操作が完全に動作
- [ ] コアバリュー：評価点null、その他：0-100点必須
- [ ] 提出ワークフロー（draft → submitted）
- [ ] 目標との1:1関係実装
- [ ] 自動作成機能の実装・テスト

### Phase 3B: Supervisor Review Process
**対象:** `supervisor_reviews`
**期間:** 4-5日
**優先度:** 🟡 High
**GitHub Issue:** [#133](https://github.com/shintairiku/evaluation-system/issues/133)

#### 実装理由
- 上司による目標レビュー機能
- 承認プロセスの実装
- 目標ステータスとの連携

#### 実装ステップ
1. **Database Model** (`backend/app/database/models/supervisor_review.py`)
2. **Repository** (`backend/app/database/repositories/supervisor_review_repo.py`)
3. **Schemas** (`backend/app/schemas/supervisor_review.py`)
4. **Service** (`backend/app/services/supervisor_review_service.py`)
5. **API Endpoints** (`backend/app/api/v1/supervisor_reviews.py`)
6. **Goal Status Sync** (レビュー結果による目標ステータス更新)
7. **Auto-creation Trigger** (目標提出時の自動生成)

#### 完成基準
- [ ] 上司レビューのCRUD操作が完全に動作
- [ ] レビューアクション（APPROVED/REJECTED/PENDING）
- [ ] 目標ステータスとの同期機能
- [ ] 上司-部下関係の検証
- [ ] 自動作成機能の実装・テスト

### Phase 4: Final Evaluation Loop
**対象:** `supervisor_feedback`
**期間:** 4-5日
**優先度:** 🟡 High
**GitHub Issue:** [#135](https://github.com/shintairiku/evaluation-system/issues/135)

#### 実装理由
- 評価プロセスの最終段階
- 最も複雑な依存関係（supervisor_feedback → self_assessment → goal）
- 評価完結のための重要機能

#### 実装ステップ
1. **Database Model** (`backend/app/database/models/supervisor_feedback.py`)
2. **Repository** (`backend/app/database/repositories/supervisor_feedback_repo.py`)
3. **Schemas** (`backend/app/schemas/supervisor_feedback.py`)
4. **Service** (`backend/app/services/supervisor_feedback_service.py`)
5. **API Endpoints** (`backend/app/api/v1/supervisor_feedback.py`)
6. **Complex Validation** (自己評価→目標→カテゴリ経由の評価ルール)
7. **Auto-creation Trigger** (自己評価提出時の自動生成)

#### 完成基準
- [ ] 上司フィードバックのCRUD操作が完全に動作
- [ ] 複雑な依存関係チェーン対応
- [ ] 目標カテゴリ経由の評価ルール実装
- [ ] 自己評価との1:1関係実装
- [ ] 自動作成機能の実装・テスト

## 共通実装ガイドライン

### 1. ファイル構造テンプレート
```
backend/app/
├── database/
│   ├── models/
│   │   └── [domain_name].py          # SQLAlchemyモデル
│   └── repositories/
│       └── [domain_name]_repo.py  # データアクセス層
├── schemas/
│   └── [domain_name].py              # Pydanticスキーマ
├── services/
│   └── [domain_name]_service.py      # ビジネスロジック層
└── api/v1/
    └── [domain_name]s.py             # APIエンドポイント
```

### 2. 命名規則
- **Models**: `EvaluationPeriod`, `Goal`, `SelfAssessment`, `SupervisorReview`, `SupervisorFeedback`
- **Repositories**: `EvaluationPeriodRepository`, `GoalRepository`, etc.
- **Services**: `EvaluationPeriodService`, `GoalService`, etc.
- **Endpoints**: `/evaluation-periods`, `/goals`, `/self-assessments`, `/supervisor-reviews`, `/supervisor-feedback`

### 3. 必須スキーマパターン
各ドメインで以下のスキーマを実装：
- `[Domain]Create`: 新規作成用
- `[Domain]Update`: 更新用
- `[Domain]InDB`: DB内部表現
- `[Domain]`: API応答用
- `[Domain]Detail`: 詳細表示用（リレーション含む）

### 4. 必須Repository メソッド
- `create(db: Session, *, obj_in: [Domain]Create) -> [Domain]`
- `get_by_id(db: Session, *, id: UUID) -> Optional[[Domain]]`
- `get_all(db: Session, *, skip: int = 0, limit: int = 100) -> List[[Domain]]`
- `update(db: Session, *, db_obj: [Domain], obj_in: [Domain]Update) -> [Domain]`
- `delete(db: Session, *, id: UUID) -> [Domain]`

### 5. 必須Service メソッド
- `create_[domain](*, db: Session, [domain]_in: [Domain]Create, current_user: User) -> [Domain]`
- `get_[domain](*, db: Session, [domain]_id: UUID, current_user: User) -> [Domain]`
- `update_[domain](*, db: Session, [domain]_id: UUID, [domain]_in: [Domain]Update, current_user: User) -> [Domain]`
- `delete_[domain](*, db: Session, [domain]_id: UUID, current_user: User) -> [Domain]`

## 実装時の注意事項

### 1. データベース制約の実装
- **Check制約**: 日付論理整合性、評価点範囲、ステータス整合性
- **Foreign Key制約**: 全ての外部キー関係を正確に実装
- **Unique制約**: 一意性制約（特に複合ユニーク制約）を忘れずに実装

### 2. 認証・認可の実装
- **Admin**: 全操作可能
- **Supervisor**: 部下関連データの読み取り・更新
- **Employee**: 自分のデータのみ操作可能
- **部下-上司関係**: `users_supervisors`テーブルでの検証必須

### 3. バリデーション実装
- **業績目標重み合計**: 同一ユーザー・期間・カテゴリで100%
- **評価点ルール**: コアバリューはnull、その他は0-100必須
- **ステータス遷移**: 不正な状態遷移を防ぐ

### 4. 自動作成トリガー
- **Goals → SelfAssessments**: 目標作成時
- **Goals (pending_approval) → SupervisorReviews**: 目標提出時
- **SelfAssessments (submitted) → SupervisorFeedback**: 自己評価提出時

### 5. エラーハンドリング
- **HTTP 400**: バリデーションエラー、業務ルール違反
- **HTTP 403**: 認可エラー（アクセス権限不足）
- **HTTP 404**: リソースが見つからない
- **HTTP 409**: 制約違反（重複データ等）

## テスト戦略

### 1. 各フェーズでの必須テスト
- **Unit Tests**: Repository, Service層の単体テスト
- **Integration Tests**: API エンドポイントの統合テスト
- **Database Tests**: 制約、トリガーの動作確認
- **Authorization Tests**: 権限制御の確認

### 2. API テスト手順
1. **Docker環境起動**: `docker-compose up -d --build`
2. **Swagger UI**: `http://localhost:8000/docs`
3. **認証設定**: Adminキーでの認証
4. **CRUD操作テスト**: 全エンドポイントの動作確認
5. **エラーケーステスト**: 不正データでのバリデーション確認

### 3. 依存関係テスト
- **Phase 2完了後**: Goal作成→SelfAssessment自動作成の確認
- **Phase 3B完了後**: Goal提出→SupervisorReview自動作成の確認
- **Phase 4完了後**: SelfAssessment提出→SupervisorFeedback自動作成の確認

## リスク管理と対策

### 1. 技術的リスク
- **複雑な依存関係**: 段階的実装で依存関係を明確化
- **データ整合性**: 制約とバリデーションの二重実装
- **パフォーマンス**: インデックス設計と効率的なクエリ

### 2. 実装リスク
- **仕様理解不足**: 各フェーズ開始前の仕様レビュー必須
- **テスト不足**: 各フェーズで包括的テスト実施
- **統合問題**: フェーズ間の結合テスト重視

### 3. 対策
- **Daily Check**: 毎日の進捗確認とブロッカー解消
- **Code Review**: 各フェーズ完了時のコードレビュー
- **Documentation**: 実装時の決定事項を逐次記録

## 完成判定基準

### 全フェーズ完了時の最終チェックリスト
- [ ] 5つのドメインAPI全て実装完了
- [ ] 自動作成トリガー全て動作確認
- [ ] 権限制御が全エンドポイントで正常動作
- [ ] データベース制約が全て実装・動作
- [ ] Swagger UIで全API動作確認完了
- [ ] 統合テストで評価フロー完走確認
- [ ] パフォーマンステスト完了
- [ ] セキュリティテスト完了

## Next Actions
1. **Phase 1開始**: evaluation_periods実装着手 ([Issue #131](https://github.com/shintairiku/evaluation-system/issues/131))
2. **環境準備**: 開発環境の確認・設定
3. **Issue管理**: GitHub Issueでの進捗トラッキング
4. **進捗管理**: 日次でのプロジェクト進捗確認

## GitHub Issue Management
- **進捗更新**: 各フェーズの完了時にIssueをCloseする
- **依存関係**: 前フェーズのIssueがCloseされてから次フェーズを開始する
- **ブロッカー**: 問題が発生した場合はIssueにコメントを追加する
- **レビュー**: 各Issue完了時にPull Requestを作成し、コードレビューを実施する

この戦略書に従って段階的に実装を進めることで、堅牢で保守性の高い評価システムAPIを構築する。