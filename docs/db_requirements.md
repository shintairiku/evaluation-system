# データベース制約仕様 (Database Constraint Specifications)

---

## 1. ENUM型定義 (ENUM Type Definitions)

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

-   **ClerkユーザーIDフォーマットチェック (`check_clerk_user_id`)**
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

### 3.1 `users` テーブル
-   **ClerkユーザーIDの一意性 (`unique_clerk_user_id`)**: `clerk_user_id`
-   **社員コードの一意性 (`unique_employee_code`)**: `employee_code` 
-   **メールアドレスの一意性 (`unique_email`)**: `email` 

### 3.2 `departments` テーブル
-   **部門名の一意性 (`unique_department_name`)**: `name`

### 3.3 `stages` テーブル
-   **ステージ名の一意性 (`unique_stage_name`)**: `name`

### 3.4 `competencies` テーブル
-   **コンピテンシー名の一意性 (`unique_competency_name`)**: `name`

### 3.5 `users_supervisors` テーブル
-   **有効期間内の上司-部下関係の一意性 (`unique_active_supervisor_relationship`)**: `user_id` と `supervisor_id` の組み合わせで、`valid_to` がNULLまたは未来日のレコードは一意

### 3.6 `roles` テーブル
-   **役割名の一意性 (`unique_role_name`)**: `name`

### 3.7 `user_roles` テーブル
-   **ユーザーとロールの組み合わせの一意性 (`unique_user_role`)**: `user_id` と `role_id` の組み合わせがテーブル内で一意

### 3.8 `evaluation_periods` テーブル
-   **評価期間名の一意性 (`unique_evaluation_period_name`)**: `name`

### 3.9 `goal_categories` テーブル
-   **目標カテゴリ名の一意性 (`unique_goal_category_name`)**: `name`

### 3.10 `goals` テーブル
-   **ユーザー・期間・目標カテゴリごとの目標順序の一意性 (`unique_goal_order_per_user_period_category`)**: 同一ユーザー、同一期間、同一目標カテゴリ内での目標の順序や識別子が重複しないよう制御（実装方法はビジネス要件による）

### 3.11 `self_assessments` テーブル
-   **目標ごとの自己評価の一意性 (`unique_self_assessment_per_goal`)**: `goal_id` カラムの値はテーブル内で一意、一つの目標に対して複数の自己評価の作成を防ぐ

### 3.12 `supervisor_feedback` テーブル
-   **自己評価ごとの上司フィードバックの一意性 (`unique_supervisor_feedback_per_assessment`)**: `self_assessment_id` カラムの値はテーブル内で一意、一つの自己評価に対して複数の上司フィードバックが作成されることを防ぐ

### 3.13 `supervisor_reviews` テーブル
-   **目標・期間・上司ごとのレビューの一意性 (`unique_supervisor_review_per_goal_period`)**: `goal_id`、`period_id`、`supervisor_id` の組み合わせがテーブル内で一意

### 3.14 `audit_logs` テーブル
-   **監査ログの重複防止 (`unique_audit_log_entry`)**: `table_name`、`record_id`、`action`、`changed_by`、`changed_at` の組み合わせで、同一の変更操作が重複記録されることを防ぐ

---

## 4. 外部キー制約 (Foreign Key Constraints)


### 4.1 `users` テーブル
-   `department_id` は `departments` テーブルの `id` カラムを参照
-   `stage_id` は `stages` テーブルの `id` カラムを参照

### 4.2 `competencies` テーブル
-   `stage_id` は `stages` テーブルの `id` カラムを参照

### 4.3 `users_supervisors` テーブル (上司-部下関係)
-   `user_id` (部下) は `users` テーブルの `id` カラムを参照
-   `supervisor_id` (上司) は `users` テーブルの `id` カラムを参照

### 4.4 `user_roles` テーブル
-   `user_id` は `users` テーブルの `id` カラムを参照
-   `role_id` は `roles` テーブルの `id` カラムを参照

### 4.5 `goals` テーブル
-   `user_id` は `users` テーブルの `id` カラムを参照
-   `period_id` は `evaluation_periods` テーブルの `id` カラムを参照
-   `goal_category_id` は `goal_categories` テーブルの `id` カラムを参照
-   `approved_by` (承認者) は `users` テーブルの `id` カラムを参照

### 4.6 `supervisor_reviews` テーブル
-   `goal_id` は `goals` テーブルの `id` カラムを参照
-   `period_id` は `evaluation_periods` テーブルの `id` カラムを参照
-   `supervisor_id` は `users` テーブルの `id` カラムを参照

### 4.7 `self_assessments` テーブル
-   `goal_id` は `goals` テーブルの `id` カラムを参照
-   `period_id` は `evaluation_periods` テーブルの `id` カラムを参照

### 4.8 `supervisor_feedback` テーブル
-   `self_assessment_id` は `self_assessments` テーブルの `id` カラムを参照
-   `period_id` は `evaluation_periods` テーブルの `id` カラムを参照
-   `supervisor_id` は `users` テーブルの `id` カラムを参照

### 4.9 `audit_logs` テーブル
-   `changed_by` (変更者) は `users` テーブルの `id` カラムを参照

---

## 5. ビジネスルール整合性（データベース関数・トリガーによる実装）

データベースの標準的な制約機能だけでは表現しきれない、複雑なビジネスルールやデータ整合性に関する制約

### 5.1 重み合計チェック

-   **目的**: 特定のユーザー、評価期間、目標カテゴリにおける目標の総重量が、定められたルール（例：業績目標の場合は合計100%）に従うこと。
-   **実装方針**: アプリケーションロジックまたはデータベース関数を使用して検証します。実装すべき関数は、関連する目標の `weight` を合計し、特に業績目標カテゴリ（`goal_category_id = 1`）の場合に合計が100であるかを判定。他のカテゴリについては、この関数は常にTRUEを返します（重み固定の可能性があるため）。
-   **補足**: リアルタイムでの集計と状態確認のために、UIが定義されているはず。このビューにて 重みの合計と、その合計が100%に対して有効か（'valid'）、不足しているか（'under'）、超過しているか（'over'）を示す必要あり。

### 5.2 自動レコード作成

-   **目的**: データ入力の効率化と整合性維持のため、特定の操作に応じて関連レコードを自動的に生成。

    -   **目標作成時の自己評価レコード自動生成**: `goals` テーブルに新しいレコードが挿入された際、関連する `self_assessments` レコードを自動的に作成するトリガーを設定。
        -   **詳細**: 新規作成される `self_assessments` レコードの `goal_id` と `period_id` は、作成された `goals` レコードから引き継ぐ。`self_rating` は、目標カテゴリがコアバリュー（`goal_category_id = 3`）の場合はNULL、それ以外の場合も初期値としてNULLを設定。`self_comment` は空文字列、`status` は 'draft' で初期化。

    -   **目標提出時の上司レビューレコード自動生成**: `goals` テーブルのレコードが更新され、目標ステータス (`status`) が 'pending_approval' に変更された際に、関連する `supervisor_reviews` レコードを自動的に作成するトリガーを設定
        -   **詳細**: 新規作成される `supervisor_reviews` レコードの `goal_id`、`period_id` は更新された `goals` レコードから引き継ぎ、`supervisor_id` には該当ユーザーの上司（`users_supervisors` テーブルから取得）を設定。`action` は 'pending'、`comment` は空文字列、`status` は 'draft' で初期化

---
