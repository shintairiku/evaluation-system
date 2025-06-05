# データベース制約仕様 (Database Constraint Specifications)

---

## 1. ENUM型定義 (ENUM Type Definitions)

-   **雇用形態 (employment_type)**
    -   説明: 従業員の雇用形態
    -   許容値: 'auditor' (監査役), 'supervisor' (管理職), 'employee' (正社員), 'parttime' (パート)
    -   対象テーブル・カラム: `users.employment_type`

-   **ユーザーステータス (user_status)**
    -   説明: ユーザーアカウントの状態
    -   許容値: 'active' (有効), 'inactive' (無効)
    -   対象テーブル・カラム: `users.status`

-   **目標ステータス (goal_status)**
    -   説明: 目標の進捗状況
    -   許容値: 'draft' (下書き), 'pending_approval' (承認待ち), 'approved' (承認済み), 'rejected' (却下)
    -   対象テーブル・カラム: `goals.status`

-   **評価期間ステータス (evaluation_period_status)**
    -   説明: 評価期間の状態
    -   許容値: 'upcoming' (準備中), 'active' (実施中), 'completed' (完了)
    -   対象テーブル・カラム: `evaluation_periods.status`

-   **評価ステータス (assessment_status)**
    -   説明: 自己評価や上司フィードバックの提出状況
    -   許容値: 'draft' (下書き), 'submitted' (提出済み)
    -   対象テーブル・カラム: `self_assessments.status`, `supervisor_feedback.status`, `supervisor_reviews.status`

-   **上司レビューアクション (supervisor_action)**
    -   説明: 上司による目標レビュー時のアクション
    -   許容値: 'approved' (承認), 'rejected' (却下), 'pending' (保留)
    -   対象テーブル・カラム: `supervisor_reviews.action`

---

## 2. チェック制約 (Check Constraints)

### 2.1 `users` テーブル

-   **ClerkユーザーIDフォーマットチェック (`check_clerk_user_id_format`)**
    -   条件: `clerk_user_id` カラムの値は、Clerk指定のフォーマット（`user_xxx` または `usr_xxx` で始まり、その後に24文字以上の英数字が続く文字列）であるか、NULLである必要
    -   目的: Clerkシステムとの連携において、IDの形式的な正しさを保証

### 2.2 `goals` テーブル

-   **目標の重み範囲チェック (`check_goal_weight_range`)**
    -   条件: `weight` カラムの値は、0以上100以下である必要
    -   目的: 目標の重みがパーセンテージとして適切な範囲に収まることを保証

-   **目標承認情報の一貫性チェック (`check_approval_consistency`)**
    -   条件: `approved_by` カラムがNULLである場合、`approved_at` カラムもNULL。逆に、`approved_by` カラムがNULLでない場合、`approved_at` カラムもNULLでない
    -   目的: 目標の承認者と承認日時情報が常にペアで存在するか、あるいは両方存在しない状態を保ち、データ不整合を防ぐ

### 2.3 `self_assessments` テーブル

-   **自己評価点範囲チェック (`check_self_rating_range`)**
    -   条件: `self_rating` カラムの値は、0以上100以下であるか、NULLである必要
    -   目的: 自己評価点が0から100の範囲、または未入力（NULL）であることを保証

-   **コアバリュー目標の自己評価点チェック (`check_core_value_rating`)**
    -   条件: 関連する `goals` テーブルの `goal_category_id` が3（コアバリュー）である場合、`self_assessments` テーブルの `self_rating` カラムはNULL
    -   目的: コアバリュー目標については数値評価を行わないというビジネスルールを強制します。

-   **業績目標・コンピテンシー目標の自己評価点必須チェック (`check_performance_competency_rating`)**
    -   条件: 関連する `goals` テーブルの `goal_category_id` が3（コアバリュー）でない場合、`self_assessments` テーブルの `self_rating` カラムは必須
    -   目的: 業績目標やコンピテンシー目標については数値評価が必須であるというビジネスルールを強制

-   **自己評価提出状態と提出日時の一貫性チェック (`check_assessment_submission`)**
    -   条件: `status` カラムが 'draft' の場合 `submitted_at` カラムはNULL、`status` カラムが 'submitted' の場合 `submitted_at` カラムは必須
    -   目的: 評価の提出状態と提出日時の論理的な整合性を保証

### 2.4 `supervisor_feedback` テーブル

-   **上司評価点範囲チェック (`check_supervisor_rating_range`)**
    -   条件: `rating` カラムの値は、0以上100以下であるか、NULLである必要
    -   目的: 上司評価点が0から100の範囲、または未入力（NULL）であることを保証

-   **コアバリュー目標の上司評価点チェック (`check_supervisor_core_value_rating`)**
    -   条件: 関連する目標（`self_assessments` テーブル経由で `goals` テーブルを参照）の `goal_category_id` が3（コアバリュー）である場合、`supervisor_feedback` テーブルの `rating` カラムはNULL。
    -   目的: コアバリュー目標については上司も数値評価を行わないというビジネスルール

-   **業績目標・コンピテンシー目標の上司評価点必須チェック (`check_supervisor_performance_competency_rating`)**
    -   条件: 関連する目標の `goal_category_id` が3（コアバリュー）でない場合、`supervisor_feedback` テーブルの `rating` カラムは必須。
    -   目的: 業績目標やコンピテンシー目標については上司による数値評価が必須であるというビジネスルール

-   **上司フィードバック提出状態と提出日時の一貫性チェック (`check_feedback_submission`)**
    -   条件: `status` カラムが 'draft' の場合 `submitted_at` カラムはNULL、`status` カラムが 'submitted' の場合 `submitted_at` カラムは必須
    -   目的: 上司フィードバックの提出状態と提出日時の論理的な整合性を保証

### 2.5 `supervisor_reviews` テーブル

-   **上司レビュー提出状態とレビュー日時の一貫性チェック (`check_review_submission`)**
    -   条件: `status` カラムが 'draft' の場合 `reviewed_at` カラムはNULL、`status` カラムが 'submitted' の場合 `reviewed_at` カラムは必須
    -   目的: 上司レビューの提出状態とレビュー日時の論理的な整合性を保証

### 2.6 `evaluation_periods` テーブル

-   **評価期間の日付論理整合性チェック (`check_period_dates`)**
    -   条件: `start_date` カラムの値は `end_date` カラムの値以前であり、かつ `goal_submission_deadline` カラムの値は `evaluation_deadline` カラムの値以前であること
    -   目的: 評価期間に関する各日付が論理的に正しい順序であることを保証

---

## 3. 一意性制約 (Uniqueness Constraints)

---

## 4. 外部キー制約 (Foreign Key Constraints)
