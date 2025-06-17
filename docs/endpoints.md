# API Endpoints

## 1. Auth：認証・許可

### 1.1 サインイン (Clerk連携)

ユーザーがフロントエンドでClerkの認証に成功した後、Clerkが発行したJWTをこのエンドポイントに送信して、アプリケーションのセッションを確立します。バックエンドはJWTを検証し、対応するユーザーをデータベースで検索または作成（初回ログイン時）し、アプリケーション固有のアクセストークンを返します。

- **Path:** `POST /auth/signin`
- **Request Body:**
    ```json
    {
      "clerkToken": "string"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "id": "uuid",
          "employeeCode": "EMP001",
          "name": "山田 花子",
          "email": "hanako.yamada@shintairiku.jp",
          "employmentType": "employee",
          "department": {
            "id": "uuid",
            "name": "営業部"
          },
          "stage": {
            "id": "uuid",
            "name": "S2",
            "description": "中堅社員"
          },
          "roles": [
            {
              "id": 1,
              "name": "employee",
              "description": "一般従業員"
            },
            {
              "id": 2,
              "name": "manager",
              "description": "管理者"
            }
          ]
        },
        "accessToken": "string",
        "refreshToken": "string"
      }
    }
    ```

### 1.2 ユーザー情報取得

現在認証されているユーザーの詳細情報を取得します。

- **Path:** `GET /auth/me`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "id": "uuid",
          "employeeCode": "EMP001",
          "name": "山田 花子",
          "email": "yamada@shintairiku.jp",
          "employmentType": "employee",
          "status": "active",
          "department": {
            "id": "uuid",
            "name": "営業部",
            "description": "営業部門"
          },
          "stage": {
            "id": "uuid",
            "name": "S2",
            "description": "中堅社員"
          },
          "roles": [
            {
              "id": 1,
              "name": "employee",
              "description": "一般従業員"
            }
          ],
          "permissions": ["create_goal", "submit_evaluation"],
          "supervisor": {
            "id": "uuid",
            "name": "田中 部長"
          }
        }
      }
    }
    ```

### 1.3 ログアウト

- **Path:** `POST /auth/logout`
- **説明:** ユーザーセッションを終了します。バックエンドは、関連するアクセストークンまたはリフレッシュトークンを無効化します。

## 2. Clerk Webhooks

### 2.1 Clerkイベントハンドラ

ClerkからのWebhookを受け取り、ユーザーデータをデータベースと同期するための単一のエンドポイントです。このエンドポイントはClerkからの署名を検証して、リクエストの正当性を保証する必要があります。

- **Path:** `POST /webhooks/clerk`
- **処理するイベント:**
    - `user.created`: ユーザーがClerkに初めてサインアップしたときにトリガーされます（Google Workspace経由を含む）。ハンドラは、受け取った`clerk_user_id`とユーザー情報を使用して、アプリケーションの`users`テーブルに新しいレコードを作成します。
    - `user.updated`: Clerk上でユーザー情報（メールアドレスなど）が更新されたときにトリガーされます。ハンドラは、`users`テーブルの対応するレコードを更新します。
    - `user.deleted`: Clerkからユーザーが削除されたときにトリガーされます。ハンドラは、`users`テーブルの対応するユーザーを非アクティブ化、または物理削除します。

## 3. Users：ユーザー管理

### 3.1 ユーザー一覧取得

- **Path:** `GET /users`
- **アクセス可能なロール:** `admin`, `manager`, `viewer`
    - `admin`: 全てのユーザー情報を取得可能。
    - `manager`: 自身の管理下にある部下のユーザー情報を取得可能。クエリパラメータで部下以外を検索しようとした場合は空の結果を返すかエラーとする。
    - `viewer`: 自身に閲覧権限が付与されている部門のユーザー情報、または個別に閲覧権限が付与されているユーザー情報を取得可能。
- **Query Parameters:**
    - `page`: ページ番号（デフォルト: 1）
    - `limit`: 1ページあたりの件数（デフォルト: 20、最大: 100）
    - `search`: 検索キーワード（氏名、メール、社員コード）
    - `departmentId`: 部門IDでフィルタ
    - `employmentType`: 雇用形態でフィルタ（employee, parttime）
    - `roleId`: ロールIDでフィルタ（smallint）
    - `status`: ステータスでフィルタ（active, inactive）
    - `sortBy`: ソート項目（name, employeeCode, createdAt）
    - `sortOrder`: ソート順（asc, desc）
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "users": [
          {
            "id": "uuid",
            "clerkUserId": "user_2hJc6gC1fF9sE5tG8rA3bZ2dY4x",
            "employeeCode": "EMP001",
            "name": "山田 花子",
            "email": "hanako.yamada@shintairiku.jp",
            "employmentType": "employee",
            "status": "active",
            "department": {
              "id": "uuid",
              "name": "営業部"
            },
            "stage": {
              "id": "uuid",
              "name": "S2",
              "description": "中堅社員"
            },
            "roles": [
              {
                "id": 1,
                "name": "employee",
                "description": "一般従業員"
              }
            ],
            "supervisor": {
              "id": "uuid",
              "name": "田中 部長"
            },
            "lastLoginAt": "2024-01-27T10:30:00Z",
            "createdAt": "2024-01-15T09:00:00Z"
          }
        ],
        "statistics": {
          "total": 147,
          "active": 142,
          "inactive": 5,
          "employee": 122,
          "parttime": 25,
          "newThisMonth": 8
        }
      },
      "meta": {
        "page": 1,
        "limit": 20,
        "total": 147,
        "totalPages": 8
      }
    }
    ```

### 3.2 ユーザー作成・招待

管理者が手動でユーザーを作成します。特に、会社のGoogle Workspaceアカウントを持たないパートタイム従業員などに使用します。この処理はClerkに招待状付きのユーザーを作成し、成功後に内部データベースにもユーザー情報を保存します。

- **Path:** `POST /users`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "employeeCode": "EMP002",
      "name": "鈴木 一郎",
      "email": "ichiro.suzuki@example.com",
      "employmentType": "parttime",
      "status": "active",
      "departmentId": "uuid",
      "stageId": "uuid",
      "job_title": "アルバイト",
      "roleIds": [3],
      "supervisorId": "uuid"
    }
    ```
- **処理フロー:**
    1. Clerk Backend APIを呼び出して、指定されたメールアドレスでユーザーを作成（招待）します。
    2. Clerkから返された`user.id` (`clerk_user_id`) を取得します。
    3. 受け取った`clerk_user_id`とリクエストのデータを使用して、`users`テーブルにレコードを作成します。
    4. Clerk APIを再度呼び出し、ユーザーの`publicMetadata`にロール（例: `{ "roles": [3] }`）を設定します。
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "clerkUserId": "user_1yKc6gC1fA9sE5tG8rA3bZ2dY4z",
          "employeeCode": "EMP002",
          "name": "鈴木 一郎",
          "email": "ichiro.suzuki@example.com",
          "employmentType": "parttime",
          "status": "active",
          "job_title": "アルバイト",
          "department": {
            "id": "uuid",
            "name": "開発部"
          },
          "stage": {
            "id": "uuid",
            "name": "P1",
            "description": "パートタイム"
          },
          "roles": [
            {
              "id": 3,
              "name": "parttime",
              "description": "パートタイム従業員"
            }
          ],
          "supervisor": {
            "id": "uuid",
            "name": "佐藤 部長"
          },
          "createdAt": "2024-01-28T09:00:00Z"
        }
      }
    }
    ```

### 3.3 ユーザー情報取得

- **Path:** `GET /users/{userId}`
- **アクセス可能なロール:**
    - `admin`: 指定した `userId` のユーザー情報を取得可能。
    - `manager`: 指定した `userId` が自身の管理下の部下である場合、情報を取得可能。
    - `viewer`: 指定した `userId` のユーザーに対して閲覧権限がある場合、情報を取得可能。
    - `employee`: `userId` が自身のIDである場合のみ、情報を取得可能。(このエンドポイントまたは `/auth/me` で対応)
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "clerkUserId": "user_2hJc6gC1fF9sE5tG8rA3bZ2dY4x",
          "employeeCode": "EMP001",
          "name": "山田 花子",
          "email": "hanako.yamada@shintairiku.jp",
          "employmentType": "employee",
          "status": "active",
          "job_title": "主任",
          "department": {
            "id": "uuid",
            "name": "営業部",
            "description": "営業部門"
          },
          "stage": {
            "id": "uuid",
            "name": "S2",
            "description": "中堅社員"
          },
          "roles": [
            {
              "id": 1,
              "name": "employee",
              "description": "一般従業員"
            }
          ],
          "supervisor": {
            "id": "uuid",
            "name": "田中 部長",
            "email": "tanaka@shintairiku.jp"
          },
          "lastLoginAt": "2024-01-27T10:30:00Z",
          "createdAt": "2024-01-15T09:00:00Z",
          "updatedAt": "2024-01-27T10:30:00Z"
        }
      }
    }
    ```

### 3.4 ユーザー情報更新

管理者がユーザー情報を更新します。Google Workspaceからの自動同期が完全でない場合や、アプリケーション固有の情報を更新するために使用します。

- **Path:** `PUT /users/{userId}`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "name": "山田 花子",
      "email": "yamada.hanako@shintairiku.jp",
      "employmentType": "employee",
      "status": "active",
      "departmentId": "uuid",
      "stageId": "uuid",
      "job_title": "主任",
      "roleIds": [1, 2],
      "supervisorId": "uuid"
    }
    ```
- **処理フロー:**
    1. データベース (`users`テーブル) の情報を更新します。
    2. もし `email` や `name` など、Clerkと同期すべき情報が変更された場合、Clerk Backend APIを呼び出してClerk上のユーザー情報も更新します。
    3. もし `roleIds` が変更された場合、Clerk APIを呼び出してユーザーの`publicMetadata`を更新します。
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "clerkUserId": "user_2hJc6gC1fF9sE5tG8rA3bZ2dY4x",
          "employeeCode": "EMP001",
          "name": "山田 花子",
          "email": "yamada.hanako@shintairiku.jp",
          "employmentType": "employee",
          "status": "active",
          "job_title": "主任",
          "department": {
            "id": "uuid",
            "name": "営業部"
          },
          "stage": {
            "id": "uuid",
            "name": "S2",
            "description": "中堅社員"
          },
          "roles": [
            {
              "id": 1,
              "name": "employee",
              "description": "一般従業員"
            },
            {
              "id": 2,
              "name": "manager",
              "description": "管理者"
            }
          ],
          "supervisor": {
            "id": "uuid",
            "name": "田中 部長"
          },
          "updatedAt": "2024-01-28T14:30:00Z"
        }
      }
    }
    ```

### 3.5 ユーザー情報削除

管理者がユーザーを削除します。

- **Path:** `DELETE /users/{userId}`
- **アクセス可能なロール:** `admin`
- **処理フロー:**
    1. Clerk Backend APIを呼び出して、Clerkからユーザーを削除します。
    2. 内部データベースからユーザーレコードを削除、または非アクティブ化します。（Clerkの`user.deleted` Webhookに任せることも可能ですが、即時性を求めるならAPI側で直接処理する方が確実です）
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "message": "ユーザーが正常に削除されました",
        "deletedUserId": "550e8400-e29b-41d4-a716-446655440000",
        "deletedAt": "2024-01-28T15:00:00Z"
      }
    }
    ```

### 3.6 ユーザーの同期 (管理者用)

- **Path:** `POST /admin/users/sync-source`
- **説明:** 信頼できる情報源（Google Workspaceなど）からユーザー情報を取得し、アプリケーションのデータベースと同期します。主に、Clerkの自動同期から漏れたユーザーや、システム導入時に既存の全ユーザーを一度に同期するために管理者が使用します。
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "source": "google_workspace"
    }
    ```
- **処理フロー:**
    1.  指定された`source`（Google Workspace）のAPIを呼び出し、ユーザーリストを取得します。
    2.  取得した各ユーザーについて、メールアドレスをキーにしてアプリケーションの`users`テーブルに存在するか確認します。
    3.  存在しないユーザーがいた場合、ClerkのBackend API (`clerk.users.create`) を使用してClerkにユーザーを作成します。
    4.  Clerkでのユーザー作成が成功すると、`user.created` Webhookがトリガーされ、アプリケーションのデータベースにも自動的にユーザーが追加されます。
    5.  処理結果（同期したユーザー数、失敗したユーザー数など）をレスポンスとして返します。
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "source": "google_workspace",
        "status": "completed",
        "newlyCreatedCount": 5,
        "syncedCount": 150,
        "failedCount": 0,
        "details": "Synchronization completed successfully."
      }
    }
    ```

## 4. Departments: 部門管理

### 4.1 部門一覧取得

- **Path:** `GET /departments`
- **アクセス可能なロール:**
    - `admin`: 全ての部門情報を取得可能。
    - `manager`: 自身の所属部門および管理下にある部門の情報を取得可能。
    - `viewer`: 自身に閲覧権限が付与されている部門の情報を取得可能。
    - `employee`: 自身の所属部門の情報を取得可能。
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "departments": [
          {
            "id": "uuid",
            "name": "営業部",
            "description": "営業部門",
            "memberCount": 45,
            "managerCount": 2,
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
          }
        ]
      }
    }
    ```

### 4.2 部門作成

- **Path:** `POST /departments`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "name": "営業部",
      "description": "営業部門",
      "roleIds": [3, 5]
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "department": {
          "id": "660e8400-e29b-41d4-a716-446655440000",
          "name": "営業部",
          "description": "営業部門",
          "roles": [
            {
              "id": 3,
              "name": "employee", 
              "description": "正社員"
            },
            {
              "id": 5,
              "name": "viewer",
              "description": "閲覧者"
            }
          ],
          "memberCount": 0,
          "createdAt": "2024-01-28T09:00:00Z",
          "updatedAt": "2024-01-28T09:00:00Z"
        }
      }
    }
    ```

### 4.3 各部門情報取得

- **Path:** `GET /departments/{departmentId}`
- **アクセス可能なロール:**
    - `admin`: 指定した `departmentId` の部門情報を取得可能。
    - `manager`: 指定した `departmentId` が自身の所属部門または管理下にある部門である場合、情報を取得可能。
    - `viewer`: 指定した `departmentId` の部門に対して閲覧権限がある場合、情報を取得可能。
    - `employee`: 指定した `departmentId` が自身の所属部門である場合、情報を取得可能。
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "department": {
          "id": "660e8400-e29b-41d4-a716-446655440000",
          "name": "営業部",
          "description": "営業部門",
          "roles": [
            {
              "id": 3,
              "name": "employee",
              "description": "正社員"
            },
            {
              "id": 5,
              "name": "viewer",
              "description": "閲覧者"
            }
          ],
          "memberCount": 45,
          "managerCount": 2,
          "managers": [
            {
              "id": "uuid",
              "name": "田中 部長",
              "employeeCode": "MGR001",
              "email": "tanaka@shintairiku.jp"
            },
            {
              "id": "uuid",
              "name": "佐藤 副部長",
              "employeeCode": "MGR002", 
              "email": "sato@shintairiku.jp"
            }
          ],
          "members": [
            {
              "id": "uuid",
              "name": "山田 花子",
              "employeeCode": "EMP001",
              "employmentType": "employee"
            },
            {
              "id": "uuid",
              "name": "佐藤 太郎",
              "employeeCode": "EMP002",
              "employmentType": "employee"
            }
          ],
          "createdAt": "2024-01-01T00:00:00Z",
          "updatedAt": "2024-01-15T10:00:00Z"
        }
      }
    }
    ```

### 4.4 部門情報更新

- **Path:** `PUT /departments/{departmentId}`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "name": "営業企画部",
      "description": "営業企画・戦略立案部門",
      "roleIds": [5]
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "department": {
          "id": "660e8400-e29b-41d4-a716-446655440000",
          "name": "営業企画部",
          "description": "営業企画・戦略立案部門",
          "roles": [
            {
              "id": 5,
              "name": "viewer",
              "description": "閲覧者"
            }
          ],
          "memberCount": 45,
          "updatedAt": "2024-01-28T14:30:00Z"
        }
      },
      "meta": {
        "operation": "updated",
        "affectedRows": 1,
        "departmentRoleChanges": {
          "previousRoleIds": [3],
          "newRoleIds": [3, 5],
          "addedRoleIds": [5],
          "removedRoleIds": [],
          "affectedUsers": 45,
          "message": "部門の全メンバーに正社員、閲覧者ロールが適用されました"
        }
      }
    }
    ```

### 4.5 部門削除

- **Path:** `DELETE /departments/{departmentId}`
- **アクセス可能なロール:** `admin`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "message": "部門が正常に削除されました",
        "deletedDepartmentId": "660e8400-e29b-41d4-a716-446655440000",
        "deletedAt": "2024-01-28T15:00:00Z",
        "transferredMembers": 45,
        "transferredManagers": 2
      }
    }
    ```

## 5. Role: 役割

### 5.1 役割一覧取得

- **Path:** `GET /admin/roles`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "roles": [
          {
            "id": 1,
            "name": "admin",
            "description": "管理者"
          }
        ]
      }
    }
    ```

### 5.2 役割の作成

- **Path:** `POST /admin/roles`
- **Request Body:**
    ```json
    {
      "name": "team_leader",
      "description": "チームリーダー"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "role": {
          "id": 5,
          "name": "team_leader",
          "description": "チームリーダー",
          "userCount": 0,
          "createdAt": "2024-01-28T09:00:00Z"
        }
      }
    }
    ```

### 5.3 特定の役割情報の取得

- **Path:** `GET /admin/roles/{roleId}`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "role": {
          "id": 1,
          "name": "admin",
          "description": "管理者",
          "userCount": 5,
          "createdAt": "2024-01-01T00:00:00Z",
          "updatedAt": "2024-01-15T10:00:00Z"
        }
      }
    }
    ```

### 5.4 役割の更新

- **Path:** `PUT /admin/roles/{roleId}`
- **Request Body:**
    ```json
    {
      "name": "senior_team_leader",
      "description": "シニアチームリーダー"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "role": {
          "id": 5,
          "name": "senior_team_leader",
          "description": "シニアチームリーダー",
          "userCount": 0,
          "updatedAt": "2024-01-28T14:30:00Z"
        }
      }
    }
    ```

### 5.5 役割の削除

- **Path:** `DELETE /admin/roles/{roleId}`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "message": "ロールが正常に削除されました",
        "deletedRoleId": 5,
        "deletedAt": "2024-01-28T15:00:00Z",
        "affectedUsers": 0
      }
    }
    ```

## 6. Goals (目標管理)

### 6.1 自分の目標一覧取得

- **Path:** `GET /goals/me`
- **説明:** ログイン中のユーザーが指定した評価期間に紐づく自身の目標一覧を取得します。
- **Query Parameters:**
    - `periodId` (string, required): 評価期間のID。
- **Response Body:**
    - 指定された評価期間に紐づく目標オブジェクトの配列を返す。

### 6.2 目標作成

- **Path:** `POST /goals`
- **説明:** 新しい目標を作成します。ユーザーは業績目標（goalCategoryId: 1）とコンピテンシー目標（goalCategoryId: 2）のみ作成可能。コアバリュー目標（goalCategoryId: 3）はシステムにより自動作成されます。ユーザーのボタン操作により：「下書き保存」→ `status: "draft"`、「最終提出」→ `status: "pending_approval"`
- **Request Body (業績目標の場合 - goalCategoryId: 1):**
    ```json
    {
      "periodId": "550e8400-e29b-41d4-a716-446655440000",
      "goalCategoryId": 1,
      "weight": 30.0, // 同一ユーザー・期間・目標カテゴリ(goalCategoryId==1)内の合計が100%になる必要がある
      "status": "draft",  // "draft" (下書き保存) または "pending_approval" (最終提出)
      "performanceGoalType": "quantitative",
      "specificGoalText": "第4四半期売上目標達成",
      "achievementCriteriaText": "前年同期比110%の売上達成",
      "meansMethodsText": "新規顧客開拓とアップセル施策の実行"
    }
    ```
- **Request Body (コンピテンシー目標の場合 - goalCategoryId: 2):**
    ```json
    {
      "periodId": "550e8400-e29b-41d4-a716-446655440000",
      "goalCategoryId": 2,
      "weight": 100.0,  // 自動で100%を設定
      "status": "pending_approval",  // "draft" (下書き保存) または "pending_approval" (最終提出)
      "competencyId": "660e8400-e29b-41d4-a716-446655440001",
      "actionPlan": "チームメンバーとの1on1を月2回実施し、個別のキャリア開発支援を行う"
    }
    ```
- **Response Body:**
    - 作成された目標オブジェクト

### 6.3 目標更新

- **Path:** `PUT /goals/{goalId}`
- **説明:** 目標の内容を更新。ユーザーのボタン操作により：「下書き保存」→ `status: "draft"`、「最終提出」→ `status: "pending_approval"`
- **Request Body (業績目標の場合):**
    ```json
    {
      "weight": 35.0,
      "status": "pending_approval",  // "draft" (下書き保存) または "pending_approval" (最終提出)
      "performanceGoalType": "qualitative", 
      "specificGoalText": "顧客満足度向上プロジェクト完成",
      "achievementCriteriaText": "顧客満足度スコア85%以上達成",
      "meansMethodsText": "顧客フィードバック収集システムの導入と改善提案の実行"
    }
    ```
- **Request Body (コンピテンシー目標の場合):**
    ```json
    {
      "weight": 20.0,
      "status": "draft",  // "draft" (下書き保存) または "pending_approval" (最終提出)
      "competencyId": "660e8400-e29b-41d4-a716-446655440002",
      "actionPlan": "プロジェクトマネジメント研修受講とチーム内での実践"
    }
    ```
- **Response Body:**
    - 更新後の目標オブジェクトを返します。

### 6.4 目標削除

- **Path:** `DELETE /goals/{goalId}`
- **説明:** 目標を削除する
- **Response Body:**
    - 削除成功のメッセージを返します。

## 7. Self Assessments (自己評価)

### 7.1 自己評価の作成（初回保存）

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

### 7.2 自己評価の更新

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

