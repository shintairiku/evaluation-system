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
権限(`permissions`)リストは、バックエンド側で管理を行うことを想定。
フロント側に権限リストを見せるために、このエンドポイントにて`permissions`を返す。

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
          "permissions": ["createGoal", "submitEvaluation"],
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
- **アクセス可能なロール:** `admin`, `supervisor`, `viewer`
    - `admin`: 全てのユーザー情報を取得可能。
    - `supervisor`: 自身の管理下にある部下のユーザー情報を取得可能。クエリパラメータで部下以外を検索しようとした場合は空の結果を返すかエラーとする。
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
            "createdAt": "2024-01-15T09:00:00Z",
            "updatedAt": "2024-01-27T10:30:00Z"
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
      "jobTitle": "アルバイト",
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
          "jobTitle": "アルバイト",
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
          "createdAt": "2024-01-28T09:00:00Z",
          "updatedAt": "2024-01-28T09:00:00Z"
        }
      }
    }
    ```

### 3.3 ユーザー情報取得

- **Path:** `GET /users/{userId}`
- **アクセス可能なロール:**
    - `admin`: 指定した `userId` のユーザー情報を取得可能。
    - `supervisor`: 指定した `userId` が自身の管理下の部下である場合、情報を取得可能。
    - `viewer`: 指定した `userId` のユーザーに対して閲覧権限がある場合、情報を取得可能。
    - `employee`: `userId` が自身のIDである場合のみ、情報を取得可能。(このエンドポイントまたは `/auth/me` で対応)
- **拡張性＆UIへの考慮:**
    - ユーザーが登録されていた過去の評価期間のリストを取得。各評価期間のカードをクリックすることで、そのユーザーの評価期間中の目標、上司レビュー、自己評価、上司評価を表示する仕組みも導入可能。
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
          "jobTitle": "主任",
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
      "employeeCode": "EMP001",
      "employmentType": "employee",
      "status": "active",
      "departmentId": "uuid",
      "stageId": "uuid",
      "jobTitle": "主任",
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
          "jobTitle": "主任",
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
      "source": "googleWorkspace"
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
        "source": "googleWorkspace",
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
    - `supervisor`: 自身の所属部門および管理下にある部門の情報を取得可能。
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
    - `supervisor`: 指定した `departmentId` が自身の所属部門または管理下にある部門である場合、情報を取得可能。
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
      "name": "teamLeader",
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
          "name": "teamLeader",
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
      "name": "seniorTeamLeader",
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
          "name": "seniorTeamLeader",
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
    ```json
    {
      "success": true,
      "data": {
        "goals": [
          {
            "id": "uuid",
            "userId": "uuid",
            "periodId": "uuid",
            "goalCategoryId": 1,
            "targetData": {
              "performanceGoalType": "quantitative",
              "specificGoalText": "新規顧客獲得数を前期比150%にする",
              "achievementCriteriaText": "CRMシステム上で確認できる新規契約顧客数が、指定期間内に目標数を達成した場合。",
              "meansMethodsText": "週次のターゲットリスト見直し会議を実施。新しいマーケティングチャネルを試験導入。"
            },
            "weight": 25,
            "status": "draft",
            "approvedBy": null,
            "approvedAt": null,
            "category": {
              "id": 1,
              "name": "業績目標"
            },
            "createdAt": "2024-01-15T09:00:00Z",
            "updatedAt": "2024-01-15T09:00:00Z"
          },
          {
            "id": "uuid",
            "userId": "uuid",
            "periodId": "uuid",
            "goalCategoryId": 2,
            "targetData": {
              "competencyId": "aaaaaaaa-bbbb-cccc-dddd-111111111111",
              "actionPlan": "チームメンバーとの1on1を月2回実施し、個別のキャリア開発支援を行う"
            },
            "weight": 100,
            "status": "pending_approval",
            "approvedBy": null,
            "approvedAt": null,
            "category": {
              "id": 2,
              "name": "コンピテンシー目標"
            },
            "competency": {
              "id": "aaaaaaaa-bbbb-cccc-dddd-111111111111",
              "name": "チームワーク・協調性",
              "description": "チーム内での協調性と連携能力"
            },
            "createdAt": "2024-01-15T10:00:00Z",
            "updatedAt": "2024-01-15T10:00:00Z"
          }
        ]
      }
    }
    ```

### 6.2 目標作成

- **Path:** `POST /goals`
- **説明:** 新しい目標を作成します。ユーザーは業績目標（goalCategoryId: 1）とコンピテンシー目標（goalCategoryId: 2）のみ作成可能。コアバリュー目標（goalCategoryId: 3）はシステムにより自動作成されます。ユーザーのボタン操作により：「下書き保存」→ `status: "draft"`、「最終提出」→ `status: "pending_approval"
`
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
- **Response Body (業績目標の場合):**
    ```json
    {
      "success": true,
      "data": {
        "goal": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "userId": "123e4567-e89b-12d3-a456-426614174000",
          "periodId": "550e8400-e29b-41d4-a716-446655440000",
          "goalCategoryId": 1,
          "targetData": {
            "performanceGoalType": "quantitative",
            "specificGoalText": "第4四半期売上目標達成",
            "achievementCriteriaText": "前年同期比110%の売上達成",
            "meansMethodsText": "新規顧客開拓とアップセル施策の実行"
          },
          "weight": 30.0,
          "status": "draft",
          "approvedBy": null,
          "approvedAt": null,
          "category": {
            "id": 1,
            "name": "業績目標",
            "description": "売上や成果に関する目標"
          },
          "createdAt": "2024-01-15T09:00:00Z",
          "updatedAt": "2024-01-15T09:00:00Z"
        }
      }
    }
    ```
- **Response Body (コンピテンシー目標の場合):**
    ```json
    {
      "success": true,
      "data": {
        "goal": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "userId": "123e4567-e89b-12d3-a456-426614174000",
          "periodId": "550e8400-e29b-41d4-a716-446655440000",
          "goalCategoryId": 2,
          "targetData": {
            "competencyId": "660e8400-e29b-41d4-a716-446655440001",
            "actionPlan": "チームメンバーとの1on1を月2回実施し、個別のキャリア開発支援を行う"
          },
          "weight": 100.0,
          "status": "pending_approval",
          "approvedBy": null,
          "approvedAt": null,
          "category": {
            "id": 2,
            "name": "コンピテンシー目標",
            "description": "能力開発・スキル向上に関する目標"
          },
          "competency": {
            "id": "660e8400-e29b-41d4-a716-446655440001",
            "name": "チームワーク・協調性",
            "description": "チーム内での協調性と連携能力"
          },
          "createdAt": "2024-01-15T10:00:00Z",
          "updatedAt": "2024-01-15T10:00:00Z"
        }
      }
    }
    ```


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
    ```json
    {
      "success": true,
      "data": {
        "goal": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "userId": "123e4567-e89b-12d3-a456-426614174000",
          "periodId": "550e8400-e29b-41d4-a716-446655440000",
          "goalCategoryId": 1,
          "targetData": {
            "performanceGoalType": "qualitative",
            "specificGoalText": "顧客満足度向上プロジェクト完成",
            "achievementCriteriaText": "顧客満足度スコア85%以上達成",
            "meansMethodsText": "顧客フィードバック収集システムの導入と改善提案の実行"
          },
          "weight": 35.0,
          "status": "pending_approval",
          "approvedBy": null,
          "approvedAt": null,
          "category": {
            "id": 1,
            "name": "業績目標",
            "description": "売上や成果に関する目標"
          },
          "createdAt": "2024-01-15T09:00:00Z",
          "updatedAt": "2024-01-16T14:30:00Z"
        }
      }
    }
    ```


### 6.4 目標削除

- **Path:** `DELETE /goals/{goalId}`
- **説明:** 目標を削除する
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "message": "目標が正常に削除されました",
        "deletedGoalId": "550e8400-e29b-41d4-a716-446655440000",
        "deletedAt": "2024-01-16T15:00:00Z"
      }
    }
    ```

## 7. Goal Categories (目標カテゴリ管理)

### 7.1 目標カテゴリ一覧取得

- **Path:** `GET /goal-categories`
- **アクセス可能なロール:** `admin`, `supervisor`, `viewer`, `employee`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "categories": [
          {
            "id": 1,
            "name": "業績目標",
            "description": "売上や成果に関する目標",
            "displayOrder": 1,
            "isActive": true,
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
          },
          {
            "id": 2,
            "name": "能力開発目標",
            "description": "スキルアップや研修に関する目標",
            "displayOrder": 2,
            "isActive": true,
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
          }
        ]
      }
    }
    ```

### 7.2 目標カテゴリ作成

- **Path:** `POST /goal-categories`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "name": "チームワーク目標",
      "description": "協調性やチームへの貢献に関する目標",
      "displayOrder": 3,
      "isActive": true
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "category": {
          "id": 3,
          "name": "チームワーク目標",
          "description": "協調性やチームへの貢献に関する目標",
          "displayOrder": 3,
          "isActive": true,
          "createdAt": "2024-06-16T09:00:00Z",
          "updatedAt": "2024-06-16T09:00:00Z"
        }
      }
    }
    ```

### 7.3 目標カテゴリ更新

- **Path:** `PUT /goal-categories/{categoryId}`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "name": "チームワーク・協調性目標",
      "description": "協調性やチームへの貢献、リーダーシップに関する目標",
      "displayOrder": 3,
      "isActive": true
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "category": {
          "id": 3,
          "name": "チームワーク・協調性目標",
          "description": "協調性やチームへの貢献、リーダーシップに関する目標",
          "displayOrder": 3,
          "isActive": true,
          "createdAt": "2024-06-16T09:00:00Z",
          "updatedAt": "2024-06-16T14:30:00Z"
        }
      }
    }
    ```

### 7.4 目標カテゴリ削除

- **Path:** `DELETE /goal-categories/{categoryId}`
- **アクセス可能なロール:** `admin`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "message": "目標カテゴリが正常に削除されました",
        "deletedCategoryId": 3,
        "deletedAt": "2024-06-16T15:00:00Z"
      }
    }
    ```

## 8. Supervisor (Goal) Reviews (上司による目標レビュー)

### 8.1 目標レビュー一覧取得

- **Path:** `GET /supervisor-reviews`
- **アクセス可能なロール:**
    - `admin`: 全ての目標レビューを取得可能
    - `supervisor`: 自身が上司として行ったレビュー、または自身の部下に関するレビューを取得可能
    - `employee`: 自身の目標に対するレビューのみ取得可能
- **Query Parameters:**
    - `goalId`: 特定の目標に対するレビューを取得
    - `periodId`: 特定の評価期間のレビューを取得
    - `userId`: 特定のユーザーに対するレビューを取得（管理者・上司のみ）
    - `action`: アクションでフィルタ（APPROVED, REJECTED, PENDING）
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "reviews": [
          {
            "id": "uuid",
            "goalId": "uuid",
            "periodId": "uuid",
            "action": "APPROVED",
            "status": "submitted",
            "goal": {
              "id": "uuid",
              "goalCategoryId": 1,
              "targetData": {
                "performanceGoalType": "quantitative",
                "specificGoalText": "新規顧客獲得数を前期比150%にする",
                "achievementCriteriaText": "CRMシステム上で確認できる新規契約顧客数が、指定期間内に目標数を達成した場合。",
                "meansMethodsText": "週次のターゲットリスト見直し会議を実施。新しいマーケティングチャネルを試験導入。"
              },
              "weight": 25,
              "category": {
                "id": 1,
                "name": "業績目標"
              }
            },
            "supervisor": {
              "id": "uuid",
              "name": "田中 部長"
            },
            "employee": {
              "id": "uuid",
              "name": "山田 花子"
            },
            "reviewedAt": "2024-06-15T14:30:00Z",
            "updatedAt": "2024-06-15T14:30:00Z"
          }
        ]
      }
    }
    ```

### 8.2 目標レビュー詳細取得

- **Path:** `GET /supervisor-reviews/{reviewId}`
- **アクセス可能なロール:**
    - `admin`: 全てのレビュー詳細を取得可能
    - `supervisor`: 自身が作成したレビュー、または自身の部下に関するレビュー詳細を取得可能
    - `employee`: 自身の目標に対するレビュー詳細のみ取得可能
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "review": {
          "id": "990e8400-e29b-41d4-a716-446655440000",
          "goalId": "uuid",
          "periodId": "uuid",
          "supervisorId": "uuid",
          "action": "APPROVED",
          "comment": "目標設定が適切で、達成に向けた具体的な計画も明確に示されている。承認します。",
          "status": "submitted",
          "goal": {
            "id": "uuid",
            "goalCategoryId": 1,
            "targetData": {
              "performanceGoalType": "quantitative",
              "specificGoalText": "新規顧客獲得数を前期比150%にする",
              "achievementCriteriaText": "CRMシステム上で確認できる新規契約顧客数が、指定期間内に目標数を達成した場合。見込み客リストからの転換率も参考指標とする。",
              "meansMethodsText": "週次のターゲットリスト見直し会議を実施。新しいマーケティングチャネル（例: SNS広告）を試験導入。既存顧客への紹介キャンペーンを展開。"
            },
            "weight": 25,
            "status": "approved",
            "category": {
              "id": 1,
              "name": "業績目標",
              "description": "売上や成果に関する目標"
            },
            "createdAt": "2024-04-01T09:00:00Z",
            "updatedAt": "2024-06-15T14:30:00Z"
          },
          "period": {
            "id": "uuid",
            "name": "2024年度 第1四半期評価",
            "startDate": "2024-04-01",
            "endDate": "2024-06-30"
          },
          "supervisor": {
            "id": "uuid",
            "name": "田中 部長",
            "employeeCode": "MGR001",
            "email": "tanaka@shintairiku.jp",
            "department": {
              "id": "uuid",
              "name": "営業部"
            }
          },
          "employee": {
            "id": "uuid",
            "name": "山田 花子",
            "employeeCode": "EMP001",
            "email": "hanako.yamada@shintairiku.jp",
            "department": {
              "id": "uuid",
              "name": "営業部"
            },
            "stage": {
              "id": "uuid",
              "name": "S2",
              "description": "中堅社員"
            }
          },
          "createdAt": "2024-06-15T09:00:00Z",
          "updatedAt": "2024-06-15T14:30:00Z",
          "reviewedAt": "2024-06-15T14:30:00Z"
        }
      }
    }
    ```

### 8.3 目標レビュー作成

- **Path:** `POST /supervisor-reviews`
- **アクセス可能なロール:** `admin`, `supervisor`
- **Request Body:**
    ```json
    {
      "goalId": "uuid",
      "periodId": "uuid",
      "action": "APPROVED",
      "comment": "目標設定が適切で、達成に向けた具体的な計画も明確に示されている。承認します。",
      "status": "draft"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "review": {
          "id": "990e8400-e29b-41d4-a716-446655440000",
          "goalId": "uuid",
          "periodId": "uuid",
          "supervisorId": "uuid",
          "action": "APPROVED",
          "comment": "目標設定が適切で、達成に向けた具体的な計画も明確に示されている。承認します。",
          "status": "draft",
          "createdAt": "2024-06-16T09:00:00Z",
          "updatedAt": "2024-06-16T09:00:00Z"
        }
      }
    }
    ```

### 8.4 目標レビュー更新

- **Path:** `PUT /supervisor-reviews/{reviewId}`
- **アクセス可能なロール:**
    - `admin`: 全てのレビューを更新可能
    - `supervisor`: 自身が作成したレビューのみ更新可能
- **Request Body:**
    ```json
    {
      "action": "REJECTED",
      "comment": "目標設定が曖昧で測定可能性に欠けます。より具体的な数値目標と達成基準を設定してください。",
      "status": "submitted"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "review": {
          "id": "990e8400-e29b-41d4-a716-446655440000",
          "goalId": "uuid",
          "periodId": "uuid",
          "supervisorId": "uuid",
          "action": "REJECTED",
          "comment": "目標設定が曖昧で測定可能性に欠けます。より具体的な数値目標と達成基準を設定してください。",
          "status": "submitted",
          "createdAt": "2024-06-16T09:00:00Z",
          "updatedAt": "2024-06-16T14:30:00Z",
          "reviewedAt": "2024-06-16T14:30:00Z"
        }
      }
    }
    ```

### 8.5 目標レビュー削除

- **Path:** `DELETE /supervisor-reviews/{reviewId}`
- **アクセス可能なロール:**
    - `admin`: 全てのレビューを削除可能
    - `supervisor`: 自身が作成したレビューのみ削除可能
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "message": "目標レビューが正常に削除されました",
        "deletedReviewId": "990e8400-e29b-41d4-a716-446655440000",
        "deletedAt": "2024-06-16T15:00:00Z"
      }
    }
    ```

## 9. Self Assessments (自己評価)

### 9.1 自己評価一覧取得

- **Path:** `GET /self-assessments`
- **アクセス可能なロール:**
    - `admin`: 全ての自己評価を取得可能
    - `supervisor`: 自身の部下の自己評価を取得可能
    - `employee`: 自身の自己評価のみ取得可能
- **Query Parameters:**
    - `goalId`: 特定の目標に対する自己評価を取得
    - `periodId`: 特定の評価期間の自己評価を取得
    - `userId`: 特定のユーザーの自己評価を取得（管理者・上司のみ）
    - `status`: ステータスでフィルタ（draft, submitted）
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "assessments": [
          {
            "id": "uuid",
            "goalId": "uuid",
            "selfRating": 4,
            "status": "submitted",
            "goal": {
              "id": "uuid",
              "title": "第1四半期売上目標達成"
            },
            "employee": {
              "id": "uuid",
              "name": "山田 花子"
            },
            "submittedAt": "2024-06-14T09:00:00Z",
            "updatedAt": "2024-06-14T09:00:00Z"
          }
        ]
      }
    }
    ```

### 9.2 自己評価詳細取得

- **Path:** `GET /self-assessments/{assessmentId}`
- **アクセス可能なロール:**
    - `admin`: 全ての自己評価詳細を取得可能
    - `supervisor`: 自身の部下の自己評価詳細を取得可能
    - `employee`: 自身の自己評価詳細のみ取得可能
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "assessment": {
          "id": "990e8400-e29b-41d4-a716-446655440000",
          "goalId": "uuid",
          "employeeId": "uuid",
          "selfRating": 4,
          "selfComment": "新規顧客開拓で目標の85%を達成。残り期間で100%達成を目指している。具体的には、A社との契約締結により大幅な売上増を実現。今後はB社、C社との商談を進める予定。",
          "status": "submitted",
          "goal": {
            "id": "uuid",
            "goalCategoryId": 1,
            "targetData": {
              "performanceGoalType": "quantitative",
              "specificGoalText": "新規顧客獲得数を前期比150%にする",
              "achievementCriteriaText": "CRMシステム上で確認できる新規契約顧客数が、指定期間内に目標数を達成した場合。見込み客リストからの転換率も参考指標とする。",
              "meansMethodsText": "週次のターゲットリスト見直し会議を実施。新しいマーケティングチャネル（例: SNS広告）を試験導入。既存顧客への紹介キャンペーンを展開。"
            },
            "weight": 25,
            "status": "approved",
            "category": {
              "id": 1,
              "name": "業績目標",
              "description": "売上や成果に関する目標"
            },
            "period": {
              "id": "uuid",
              "name": "2024年度 第1四半期評価",
              "startDate": "2024-04-01",
              "endDate": "2024-06-30"
            }
          },
          "employee": {
            "id": "uuid",
            "name": "山田 花子",
            "employeeCode": "EMP001",
            "email": "hanako.yamada@shintairiku.jp",
            "department": {
              "id": "uuid",
              "name": "営業部"
            },
            "stage": {
              "id": "uuid",
              "name": "S2",
              "description": "中堅社員"
            }
          },
          "supervisorFeedback": {
            "id": "uuid",
            "rating": 4,
            "comment": "目標達成に向けて順調に進捗している。",
            "status": "submitted",
            "submittedAt": "2024-06-15T14:30:00Z"
          },
          "createdAt": "2024-06-10T09:00:00Z",
          "updatedAt": "2024-06-14T09:00:00Z",
          "submittedAt": "2024-06-14T09:00:00Z"
        }
      }
    }
    ```

### 9.3 自己評価作成

- **Path:** `POST /self-assessments`
- **アクセス可能なロール:** `admin`, `supervisor`, `employee`

- **説明:** 特定の目標に対する自己評価を作成
- **Request Body:**
    ```json
    {
      "goalId": "string",
      "periodId": "string",
      "selfRating": "number",
      "selfComment": "string",
      "status": "draft"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "assessment": {
          "id": "990e8400-e29b-41d4-a716-446655440000",
          "goalId": "uuid",
          "periodId": "uuid",
          "employeeId": "uuid",
          "selfRating": 4,
          "selfComment": "新規顧客開拓で目標の85%を達成。残り期間で100%達成を目指している。",
          "status": "draft",
          "createdAt": "2024-06-14T09:00:00Z",
          "updatedAt": "2024-06-14T09:00:00Z"
        }
      }
    }
    ```

### 9.4 自己評価更新

- **Path:** `PUT /self-assessments/{assessmentId}`
- **アクセス可能なロール:**
    - `admin`: 全ての自己評価を更新可能
    - `employee`: 自身の自己評価のみ更新可能
- **説明:** 自己評価の内容を更新します。**下書き保存**と**提出**にも使用
  - **下書き保存:** `status` に `draft` を指定

  - **提出:** `status` に `submitted` を指定
- **Request Body:**
    ```json
    {
      "selfRating": "number",
      "selfComment": "string",
      "status": "submitted"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "assessment": {
          "id": "990e8400-e29b-41d4-a716-446655440000",
          "goalId": "uuid",
          "periodId": "uuid",
          "employeeId": "uuid",
          "selfRating": 4,
          "selfComment": "新規顧客開拓で目標の85%を達成。残り期間で100%達成を目指している。",
          "status": "submitted",
          "createdAt": "2024-06-14T09:00:00Z",
          "updatedAt": "2024-06-14T15:00:00Z",
          "submittedAt": "2024-06-14T15:00:00Z"
        }
      }
    }
    ```

### 9.5 自己評価削除

- **Path:** `DELETE /self-assessments/{assessmentId}`
- **アクセス可能なロール:**
    - `admin`: 全ての自己評価を削除可能
    - `employee`: 自身の下書き状態の自己評価のみ削除可能（提出済みは削除不可）
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "message": "自己評価が正常に削除されました",
        "deletedAssessmentId": "990e8400-e29b-41d4-a716-446655440000",
        "deletedAt": "2024-06-16T15:00:00Z"
      }
    }
    ```

## 10. Evaluation Periods (評価期間管理)

### 10.1 評価期間一覧取得

- **Path:** `GET /evaluation-periods`
- **アクセス可能なロール:** `admin`, `supervisor`, `viewer`, `employee`
- **Query Parameters:**
    - `page`: ページ番号（デフォルト: 1）
    - `limit`: 1ページあたりの件数（デフォルト: 20、最大: 100）
    - `status`: ステータスでフィルタ（active, upcoming, completed）
    - `sortBy`: ソート項目（startDate, endDate, createdAt）
    - `sortOrder`: ソート順（asc, desc）
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "periods": [
          {
            "id": "uuid",
            "name": "2024年度 第1四半期評価",
            "periodType": "quarterly",
            "description": "2024年度第1四半期の人事評価期間",
            "startDate": "2024-04-01",
            "endDate": "2024-06-30",
            "goalSubmissionDeadline": "2024-04-07",
            "evaluationDeadline": "2024-06-30",
            "status": "active",
            "createdAt": "2024-03-15T09:00:00Z",
            "updatedAt": "2024-04-01T09:00:00Z"
          }
        ]
      },
      "meta": {
        "page": 1,
        "limit": 20,
        "total": 4,
        "totalPages": 1
      }
    }
    ```

### 10.2 評価期間作成

- **Path:** `POST /evaluation-periods`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "name": "2024年度 第2四半期評価",
      "periodType": "quarterly",
      "description": "2024年度第2四半期の人事評価期間",
      "startDate": "2024-07-01",
      "endDate": "2024-09-30",
      "goalSubmissionDeadline": "2024-07-07",
      "evaluationDeadline": "2024-09-30"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "period": {
          "id": "770e8400-e29b-41d4-a716-446655440000",
          "name": "2024年度 第2四半期評価",
          "periodType": "quarterly",
          "description": "2024年度第2四半期の人事評価期間",
          "startDate": "2024-07-01",
          "endDate": "2024-09-30",
          "goalSubmissionDeadline": "2024-07-07",
          "evaluationDeadline": "2024-09-30",
          "status": "upcoming",
          "createdAt": "2024-06-15T09:00:00Z",
          "updatedAt": "2024-06-15T09:00:00Z"
        }
      }
    }
    ```

### 10.3 評価期間詳細取得

- **Path:** `GET /evaluation-periods/{periodId}`
- **アクセス可能なロール:** `admin`, `supervisor`, `viewer`, `employee`
- **補足:**他のテーブルとの連携を追う場合には、`period`の`id`を使用して、`GET /goals?periodId={periodId}`などで他のテーブルを取得可能。例えば、`Get goals?periodId={periodId},...`で目標のドラフト数、提出数、承認待ち数、承認数、差し戻し数なども取得可能。
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "period": {
          "id": "770e8400-e29b-41d4-a716-446655440000",
          "name": "2024年度 第1四半期評価",
          "periodType": "quarterly",
          "description": "2024年度第1四半期の人事評価期間",
          "startDate": "2024-04-01",
          "endDate": "2024-06-30",
          "goalSubmissionDeadline": "2024-04-07",
          "evaluationDeadline": "2024-06-30",
          "status": "active",
          "createdAt": "2024-03-15T09:00:00Z",
          "updatedAt": "2024-04-01T09:00:00Z"
        }
      }
    }
    ```

### 10.4 評価期間更新

- **Path:** `PUT /evaluation-periods/{periodId}`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "name": "2024年度 第1四半期評価（更新）",
      "description": "2024年度第1四半期の人事評価期間（更新版）",
      "startDate": "2024-04-01",
      "endDate": "2024-06-30",
      "status": "active"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "period": {
          "id": "770e8400-e29b-41d4-a716-446655440000",
          "name": "2024年度 第1四半期評価（更新）",
          "periodType": "quarterly",
          "description": "2024年度第1四半期の人事評価期間（更新版）",
          "startDate": "2024-04-01",
          "endDate": "2024-06-30",
          "goalSubmissionDeadline": "2024-04-07",
          "evaluationDeadline": "2024-06-30",
          "status": "active",
          "createdAt": "2024-03-15T09:00:00Z",
          "updatedAt": "2024-06-16T14:30:00Z"
        }
      }
    }
    ```

### 10.5 評価期間削除

- **Path:** `DELETE /evaluation-periods/{periodId}`
- **アクセス可能なロール:** `admin`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "message": "評価期間が正常に削除されました",
        "deletedPeriodId": "770e8400-e29b-41d4-a716-446655440000",
        "deletedAt": "2024-06-16T15:00:00Z"
      }
    }
    ```

## 11. Supervisor Feedback for Employee's Assessment (上司フィードバック)

### 11.1 上司フィードバック一覧取得

- **Path:** `GET /supervisor-feedback`
- **アクセス可能なロール:**
    - `admin`: 全ての上司フィードバックを取得可能
    - `supervisor`: 自身が上司として与えたフィードバック、または自身の部下に関するフィードバックを取得可能
    - `employee`: 自身の自己評価に対するフィードバックのみ取得可能
- **Query Parameters:**
    - `selfAssessmentId`: 特定の自己評価に対するフィードバックを取得
    - `periodId`: 特定の評価期間のフィードバックを取得
    - `userId`: 特定のユーザーに対するフィードバックを取得（管理者・上司のみ）
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "feedback": [
          {
            "id": "uuid",
            "selfAssessmentId": "uuid",
            "periodId": "uuid",
            "rating": 4,
            "status": "submitted",
            "selfAssessment": {
              "id": "uuid",
              "goal": {
                "id": "uuid",
                "goalCategoryId": 1,
                "targetData": {
                  "performanceGoalType": "quantitative",
                  "specificGoalText": "新規顧客獲得数を前期比150%にする",
                  "achievementCriteriaText": "CRMシステム上で確認できる新規契約顧客数が、指定期間内に目標数を達成した場合。見込み客リストからの転換率も参考指標とする。",
                  "meansMethodsText": "週次のターゲットリスト見直し会議を実施。新しいマーケティングチャネル（例: SNS広告）を試験導入。既存顧客への紹介キャンペーンを展開。"
                },
                "weight": 25,
                "status": "approved",
                "category": {
                  "id": 1,
                  "name": "業績目標"
                }
              }
            },
            "supervisor": {
              "id": "uuid",
              "name": "田中 部長"
            },
            "employee": {
              "id": "uuid",
              "name": "山田 花子"
            },
            "updatedAt": "2024-06-15T14:30:00Z"
          }
        ]
      }
    }
    ```

### 11.2 上司フィードバック詳細取得

- **Path:** `GET /supervisor-feedback/{feedbackId}`
- **アクセス可能なロール:**
    - `admin`: 全てのフィードバック詳細を取得可能
    - `supervisor`: 自身が作成したフィードバック、または自身の部下に関するフィードバック詳細を取得可能
    - `employee`: 自身の自己評価に対するフィードバック詳細のみ取得可能
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "feedback": {
          "id": "880e8400-e29b-41d4-a716-446655440000",
          "selfAssessmentId": "uuid",
          "periodId": "uuid",
          "supervisorId": "uuid",
          "rating": 4,
          "comment": "目標達成に向けて順調に進捗している。特に営業活動の質が向上しており、クライアントからの評価も高い。次四半期に向けては、新規開拓にも力を入れてほしい。",
          "status": "submitted",
          "selfAssessment": {
            "id": "uuid",
            "selfRating": 4,
            "selfComment": "新規顧客開拓で目標の85%を達成。残り期間で100%達成を目指している。",
            "status": "submitted",
            "submittedAt": "2024-06-14T09:00:00Z",
            "goal": {
              "id": "uuid",
              "goalCategoryId": 1,
              "targetData": {
                "performanceGoalType": "quantitative",
                "specificGoalText": "新規顧客獲得数を前期比150%にする",
                "achievementCriteriaText": "CRMシステム上で確認できる新規契約顧客数が、指定期間内に目標数を達成した場合。見込み客リストからの転換率も参考指標とする。",
                "meansMethodsText": "週次のターゲットリスト見直し会議を実施。新しいマーケティングチャネル（例: SNS広告）を試験導入。既存顧客への紹介キャンペーンを展開。"
              },
              "weight": 25,
              "status": "approved",
              "category": {
                "id": 1,
                "name": "業績目標",
                "description": "売上や成果に関する目標"
              }
            }
          },
          "period": {
            "id": "uuid",
            "name": "2024年度 第1四半期評価",
            "startDate": "2024-04-01",
            "endDate": "2024-06-30"
          },
          "supervisor": {
            "id": "uuid",
            "name": "田中 部長",
            "employeeCode": "MGR001",
            "email": "tanaka@shintairiku.jp",
            "department": {
              "id": "uuid",
              "name": "営業部"
            }
          },
          "employee": {
            "id": "uuid",
            "name": "山田 花子",
            "employeeCode": "EMP001",
            "email": "hanako.yamada@shintairiku.jp",
            "department": {
              "id": "uuid",
              "name": "営業部"
            },
            "stage": {
              "id": "uuid",
              "name": "S2",
              "description": "中堅社員"
            }
          },
          "createdAt": "2024-06-15T09:00:00Z",
          "updatedAt": "2024-06-15T14:30:00Z",
          "submittedAt": "2024-06-15T14:30:00Z"
        }
      }
    }
    ```

### 11.3 上司フィードバック作成

- **Path:** `POST /supervisor-feedback`
- **アクセス可能なロール:** `admin`, `supervisor`
- **Request Body:**
    ```json
    {
      "selfAssessmentId": "uuid",
      "periodId": "uuid",
      "rating": 4,
      "comment": "目標達成に向けて順調に進捗している。特に営業活動の質が向上している。",
      "status": "draft"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "feedback": {
          "id": "880e8400-e29b-41d4-a716-446655440000",
          "selfAssessmentId": "uuid",
          "periodId": "uuid",
          "supervisorId": "uuid",
          "rating": 4,
          "comment": "目標達成に向けて順調に進捗している。特に営業活動の質が向上している。",
          "status": "draft",
          "createdAt": "2024-06-16T09:00:00Z",
          "updatedAt": "2024-06-16T09:00:00Z"
        }
      }
    }
    ```

### 11.4 上司フィードバック更新

- **Path:** `PUT /supervisor-feedback/{feedbackId}`
- **アクセス可能なロール:**
    - `admin`: 全てのフィードバックを更新可能
    - `supervisor`: 自身が作成したフィードバックのみ更新可能
- **Request Body:**
    ```json
    {
      "rating": 5,
      "comment": "目標を上回る成果を達成。今後もこの調子で頑張ってほしい。",
      "status": "submitted"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "feedback": {
          "id": "880e8400-e29b-41d4-a716-446655440000",
          "selfAssessmentId": "uuid",
          "periodId": "uuid",
          "supervisorId": "uuid",
          "rating": 5,
          "comment": "目標を上回る成果を達成。今後もこの調子で頑張ってほしい。",
          "status": "submitted",
          "createdAt": "2024-06-16T09:00:00Z",
          "updatedAt": "2024-06-16T14:30:00Z"
        }
      }
    }
    ```

### 11.5 上司フィードバック削除

- **Path:** `DELETE /supervisor-feedback/{feedbackId}`
- **アクセス可能なロール:**
    - `admin`: 全てのフィードバックを削除可能
    - `supervisor`: 自身が作成したフィードバックのみ削除可能
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "message": "上司フィードバックが正常に削除されました",
        "deletedFeedbackId": "880e8400-e29b-41d4-a716-446655440000",
        "deletedAt": "2024-06-16T15:00:00Z"
      }
    }
    ```

## 12. Stages (ステージ管理)

### 12.1 ステージ一覧取得

- **Path:** `GET /stages`
- **アクセス可能なロール:** `admin`, `supervisor`, `viewer`, `employee`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "stages": [
          {
            "id": "11111111-2222-3333-4444-555555555555",
            "name": "新入社員",
            "description": "入社1-2年目の社員",
            "userCount": 15,
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
          },
          {
            "id": "22222222-3333-4444-5555-666666666666",
            "name": "中堅社員",
            "description": "入社3-7年目の中核となる社員",
            "userCount": 45,
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
          },
          {
            "id": "33333333-4444-5555-6666-777777777777",
            "name": "管理職",
            "description": "チームをマネジメントする管理職",
            "userCount": 12,
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
          }
        ]
      }
    }
    ```

### 12.2 ステージ作成

- **Path:** `POST /stages`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "name": "シニア社員",
      "description": "入社8年目以上のベテラン社員"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "stage": {
          "id": "44444444-5555-6666-7777-888888888888",
          "name": "シニア社員",
          "description": "入社8年目以上のベテラン社員",
          "userCount": 0,
          "createdAt": "2024-06-16T09:00:00Z",
          "updatedAt": "2024-06-16T09:00:00Z"
        }
      }
    }
    ```

### 12.3 ステージ詳細取得

- **Path:** `GET /stages/{stageId}`
- **アクセス可能なロール:** `admin`, `supervisor`, `viewer`, `employee`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "stage": {
          "id": "22222222-3333-4444-5555-666666666666",
          "name": "中堅社員",
          "description": "入社3-7年目の中核となる社員",
          "userCount": 45,
          "competencies": [
            {
              "id": "aaaaaaaa-bbbb-cccc-dddd-111111111111",
              "name": "チームワーク・協調性",
              "description": "チーム内での協調性と連携能力"
            },
            {
              "id": "dddddddd-eeee-ffff-1111-444444444444",
              "name": "コミュニケーション能力",
              "description": "効果的な意思疎通と情報共有"
            }
          ],
          "users": [
            {
              "id": "123e4567-e89b-12d3-a456-426614174000",
              "name": "山田 太郎",
              "employeeCode": "EMP001",
              "department": {
                "id": "dept-001-sales",
                "name": "営業部"
              }
            }
          ],
          "createdAt": "2024-01-01T00:00:00Z",
          "updatedAt": "2024-01-01T00:00:00Z"
        }
      }
    }
    ```

### 12.4 ステージ更新

- **Path:** `PUT /stages/{stageId}`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "name": "中堅社員（リーダー候補）",
      "description": "入社3-7年目の中核社員で、将来のリーダー候補"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "stage": {
          "id": "22222222-3333-4444-5555-666666666666",
          "name": "中堅社員（リーダー候補）",
          "description": "入社3-7年目の中核社員で、将来のリーダー候補",
          "userCount": 45,
          "updatedAt": "2024-06-16T14:30:00Z"
        }
      }
    }
    ```

### 12.5 ステージ削除

- **Path:** `DELETE /stages/{stageId}`
- **アクセス可能なロール:** `admin`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "message": "ステージが正常に削除されました",
        "deletedStageId": "44444444-5555-6666-7777-888888888888",
        "deletedAt": "2024-06-16T15:00:00Z",
        "affectedUsers": 0,
        "affectedCompetencies": 0
      }
    }
    ```

## 13. Competencies (コンピテンシー管理)

### 13.1 コンピテンシー一覧取得

- **Path:** `GET /competencies`
- **アクセス可能なロール:** `admin`, `supervisor`, `viewer`, `employee`
- **Query Parameters:**
    - `stageId`: 特定のステージのコンピテンシーを取得
    - `page`: ページ番号（デフォルト: 1）
    - `limit`: 1ページあたりの件数（デフォルト: 20、最大: 100）
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "competencies": [
          {
            "id": "aaaaaaaa-bbbb-cccc-dddd-111111111111",
            "name": "チームワーク・協調性",
            "description": "チーム内での協調性と連携能力",
            "stage": {
              "id": "22222222-3333-4444-5555-666666666666",
              "name": "中堅社員",
              "description": "入社3-7年目の中核となる社員"
            },
            "goalCount": 8,
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
          },
          {
            "id": "bbbbbbbb-cccc-dddd-eeee-222222222222",
            "name": "リーダーシップ",
            "description": "チームを牽引し成果を出すリーダーシップ",
            "stage": {
              "id": "33333333-4444-5555-6666-777777777777",
              "name": "管理職",
              "description": "チームをマネジメントする管理職"
            },
            "goalCount": 5,
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
          }
        ]
      },
      "meta": {
        "page": 1,
        "limit": 20,
        "total": 6,
        "totalPages": 1
      }
    }
    ```

### 13.2 コンピテンシー作成

- **Path:** `POST /competencies`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "name": "イノベーション・創造性",
      "description": "新しいアイデアを創出し、革新的な解決策を生み出す能力",
      "stageId": "22222222-3333-4444-5555-666666666666"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "competency": {
          "id": "gggggggg-hhhh-iiii-jjjj-777777777777",
          "name": "イノベーション・創造性",
          "description": "新しいアイデアを創出し、革新的な解決策を生み出す能力",
          "stage": {
            "id": "22222222-3333-4444-5555-666666666666",
            "name": "中堅社員",
            "description": "入社3-7年目の中核となる社員"
          },
          "goalCount": 0,
          "createdAt": "2024-06-16T09:00:00Z",
          "updatedAt": "2024-06-16T09:00:00Z"
        }
      }
    }
    ```

### 13.3 コンピテンシー詳細取得

- **Path:** `GET /competencies/{competencyId}`
- **アクセス可能なロール:** `admin`, `supervisor`, `viewer`, `employee`
- **説明:** `usersWithGoals`は、`goal_category_id = 2`かつ`target_data.competency_id`が指定されたコンピテンシーIDと一致するgoalsから、`user_id`と`period_id`を抽出して取得
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "competency": {
          "id": "aaaaaaaa-bbbb-cccc-dddd-111111111111",
          "name": "チームワーク・協調性",
          "description": "チーム内での協調性と連携能力",
          "stage": {
            "id": "22222222-3333-4444-5555-666666666666",
            "name": "中堅社員",
            "description": "入社3-7年目の中核となる社員"
          },
          "goalCount": 8,
          "usersWithGoals": [
            {
              "user": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "山田 太郎",
                "employeeCode": "EMP001",
                "department": {
                  "id": "dept-001-sales",
                  "name": "営業部"
                }
              },
              "period": {
                "id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
                "name": "2024年度 第1四半期評価",
                "startDate": "2024-04-01",
                "endDate": "2024-06-30"
              }
            },
            {
              "user": {
                "id": "456e7890-e89b-12d3-a456-426614174001",
                "name": "佐藤 次郎",
                "employeeCode": "EMP004",
                "department": {
                  "id": "dept-001-sales",
                  "name": "営業部"
                }
              },
              "period": {
                "id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
                "name": "2024年度 第1四半期評価",
                "startDate": "2024-04-01",
                "endDate": "2024-06-30"
              }
            },
            {
              "user": {
                "id": "789e0123-e89b-12d3-a456-426614174002",
                "name": "鈴木 三郎",
                "employeeCode": "EMP005",
                "department": {
                  "id": "dept-002-engineering",
                  "name": "エンジニアリング部"
                }
              },
              "period": {
                "id": "b2c3d4e5-f6g7-8901-2345-6789abcdef01",
                "name": "2024年度 第2四半期評価",
                "startDate": "2024-07-01",
                "endDate": "2024-09-30"
              }
            }
          ],
          "createdAt": "2024-01-01T00:00:00Z",
          "updatedAt": "2024-01-01T00:00:00Z"
        }
      }
    }
    ```

### 13.4 コンピテンシー更新

- **Path:** `PUT /competencies/{competencyId}`
- **アクセス可能なロール:** `admin`
- **Request Body:**
    ```json
    {
      "name": "チームワーク・協調性・リーダーシップ",
      "description": "チーム内での協調性と連携能力、およびチームを牽引するリーダーシップ",
      "stageId": "22222222-3333-4444-5555-666666666666"
    }
    ```
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "competency": {
          "id": "aaaaaaaa-bbbb-cccc-dddd-111111111111",
          "name": "チームワーク・協調性・リーダーシップ",
          "description": "チーム内での協調性と連携能力、およびチームを牽引するリーダーシップ",
          "stage": {
            "id": "22222222-3333-4444-5555-666666666666",
            "name": "中堅社員",
            "description": "入社3-7年目の中核となる社員"
          },
          "goalCount": 8,
          "updatedAt": "2024-06-16T14:30:00Z"
        }
      }
    }
    ```

### 13.5 コンピテンシー削除

- **Path:** `DELETE /competencies/{competencyId}`
- **アクセス可能なロール:** `admin`
- **Response Body:**
    ```json
    {
      "success": true,
      "data": {
        "message": "コンピテンシーが正常に削除されました",
        "deletedCompetencyId": "gggggggg-hhhh-iiii-jjjj-777777777777",
        "deletedAt": "2024-06-16T15:00:00Z",
        "affectedGoals": 0
      }
    }
    ```