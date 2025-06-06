# API Endpoints

(Note: このドキュメントは、従業員の目標設定・自己評価に関するエンドポイントを中心に記載しています。)

## 1. Goals (目標管理)

### 1.1 **自分の目標一覧取得**

- **Path:** `GET /goals/me`
- **説明:** ログイン中のユーザーが指定した評価期間に紐づく自身の目標一覧を取得します。
- **Query Parameters:**
    - `periodId` (string, required): 評価期間のID。
- **Response Body:**
    - 指定された評価期間に紐づく目標オブジェクトの配列を返す。

### 1.2 **目標作成**

- **Path:** `POST /goals`
- **説明:** 新しい目標を作成します。下書きか提出かによって、ステータスはサーバー側で自動的に`draft`か`pending_approval`に設定されます。
- **Request Body:**
    ```json
    {
      "periodId": "string",
      "goalCategoryId": "number",
      "title": "string",
      "description": "string",
      "weight": "number"
      // ... その他目標データ
    }
    ```
- **Response Body:**
    - 作成された目標オブジェクト

### 1.3 **目標更新**

- **Path:** `PUT /goals/{goalId}`
- **説明:** 目標の内容を更新
- **Request Body:**
    ```json
    {
      "title": "string",
      "description": "string",
      "weight": "number"
      // ... 更新したいフィールドのみ
    }
    ```
- **Response Body:**
    - 更新後の目標オブジェクトを返します。

### 1.4 **目標削除**

- **Path:** `DELETE /goals/{goalId}`
- **説明:** 目標を削除する
- **Response Body:**
    - 削除成功のメッセージを返します。

---

## 2. Self Assessments (自己評価)

### 2.1 **自己評価の作成（初回保存）**

- **Path:** `POST /self-assessments`
- **説明:** 特定の目標に対する自己評価を作成
- **Request Body:**
    ```json
    {
      "goalId": "string",
      "selfRating": "number",
      "selfComment": "string"
    }
    ```
- **Response Body:**
    - 保存成功のメッセージを返します。

### 2.2 **自己評価の更新**

- **Path:** `PUT /self-assessments/{assessmentId}`
- **説明:** 自己評価の内容を更新します。**下書き保存**と**提出**にも使用
  - **下書き保存:** `status` `draft`を指定
  - **提出:** `status` に `submitted` を指定
- **Request Body:**
    ```json
    {
      "selfRating": "number",
      "selfComment": "string",
      "status": "draft" 
    }
    ```
- **Response Body:**
    - 更新後の自己評価オブジェクトを返します。
