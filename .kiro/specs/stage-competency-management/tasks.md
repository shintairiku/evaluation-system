# Implementation Plan

- [ ] 1. バックエンドAPI拡張 - ユーザーステージ更新エンドポイント
  - 新しい UserStageUpdate スキーマを backend/app/schemas/user.py に追加
  - 管理者専用の PATCH /api/v1/users/{user_id}/stage エンドポイントを実装
  - 既存の UserUpdate スキーマから stage_id フィールドを削除してRBAC安全性を確保
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 2. バックエンドサービス層の実装
  - UserService に update_user_stage メソッドを追加
  - 管理者権限チェックとバリデーション機能を実装
  - エラーハンドリング（NotFoundError, PermissionDeniedError, ValidationError）を追加
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 3. ステージ管理ページのServer Component実装（管理者専用）
  - app/(admin)/stage-management/page.tsx を作成
  - サーバーサイドで管理者権限チェックを実装（非管理者は403エラー）
  - 既存の GET /api/v1/stages/admin エンドポイントからステージデータを取得
  - 各ステージのユーザーリストを GET /api/v1/users で取得
  - _Requirements: 1.1, 1.2, 1.7, 6.1, 6.2_

- [ ] 4. ドラッグ&ドロップ機能のクライアントコンポーネント実装
  - UserCard コンポーネント（ドラッグ可能）を作成
  - StageColumn コンポーネント（ドロップ可能）を作成
  - ドラッグ&ドロップ時の編集モード有効化機能を実装
  - 複数ユーザー移動対応の状態管理を実装
  - _Requirements: 1.3, 1.4, 1.7_

- [ ] 5. ステージ管理のServer Actions実装
  - updateUserStages Server Action を作成
  - 新しい PATCH /api/v1/users/{user_id}/stage エンドポイントを呼び出し
  - 保存ボタンクリック時のバッチ更新処理を実装
  - revalidatePath でページデータを更新
  - _Requirements: 1.5, 1.6, 2.4_

- [ ] 6. コンピテンシー管理ページのServer Component実装（役割ベースアクセス）
  - app/(admin)/competency-management/page.tsx を作成
  - サーバーサイドで役割ベース権限チェックを実装（管理者・ビューワーのみアクセス可能）
  - GET /api/v1/stages でステージ情報を取得
  - GET /api/v1/competencies でコンピテンシーデータを取得
  - ステージ別コンピテンシーグリッド表示を実装
  - _Requirements: 3.1, 3.2, 3.8, 5.1, 5.2_

- [ ] 7. コンピテンシー編集モーダルコンポーネント実装（管理者専用）
  - CompetencyModal クライアントコンポーネントを作成
  - 管理者のみコンピテンシーボックスクリック時のモーダル表示機能を実装
  - ビューワーはクリック無効化（編集モーダルアクセス不可）
  - 名前、説明、作成日時、更新日時の表示を実装
  - 保存・キャンセル・削除ボタンの実装
  - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 8. コンピテンシー更新のServer Actions実装
  - updateCompetency Server Action を作成
  - 既存の PUT /api/v1/competencies/{competency_id} エンドポイントを呼び出し
  - モーダル内での保存処理を実装
  - revalidatePath でページデータを更新
  - _Requirements: 3.5, 5.4_

- [ ] 9. コンピテンシー削除機能の実装
  - deleteCompetency Server Action を作成
  - 削除確認ダイアログコンポーネントを実装
  - 既存の DELETE /api/v1/competencies/{competency_id} エンドポイントを呼び出し
  - 削除後のUI更新処理を実装
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 10. エラーハンドリングとローディング状態の実装
  - ステージ管理ページのエラー境界とローディング状態を実装
  - コンピテンシー管理ページのエラー境界とローディング状態を実装
  - Server Actions でのエラーハンドリングを実装
  - ユーザーフレンドリーなエラーメッセージ表示を実装
  - _Requirements: 5.3, 6.3, 6.4_

- [ ] 11. 厳格な権限管理とセキュリティの実装
  - ステージ管理ページの管理者専用アクセス制御を実装（非管理者は403エラー）
  - コンピテンシー管理ページの役割ベースアクセス制御を実装
  - ビューワー向けの読み取り専用モード（編集モーダル無効化）を実装
  - サーバーサイドでの厳格な権限確認機能を実装
  - 不正アクセス時の適切なエラーメッセージ表示を実装
  - セッション無効時のリダイレクト処理を実装
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ] 12. バックエンドAPIのユニットテスト作成
  - tests/api/test_user_stage_update.py を作成
  - 管理者によるユーザーステージ更新成功テストを実装
  - 非管理者によるアクセス拒否テストを実装
  - 無効なステージIDでの更新エラーテストを実装
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 13. フロントエンドコンポーネントのユニットテスト作成
  - __tests__/stage-management.test.tsx を作成
  - ステージとユーザー表示の正常性テストを実装
  - ドラッグ&ドロップによる編集モード有効化テストを実装
  - 保存ボタンクリック時の変更保存テストを実装
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ] 14. コンピテンシー管理のユニットテスト作成
  - __tests__/competency-management.test.tsx を作成
  - コンピテンシークリック時のモーダル表示テストを実装
  - コンピテンシー更新機能のテストを実装
  - 削除確認ダイアログのテストを実装
  - _Requirements: 3.3, 3.5, 4.1, 4.2_

- [ ] 15. 統合テストとE2Eテストの実装
  - e2e/stage-management.spec.ts を作成
  - 管理者によるユーザーのドラッグ&ドロップE2Eテストを実装
  - 非管理者のステージ管理ページアクセス拒否（403エラー）E2Eテストを実装
  - ビューワーのコンピテンシー管理ページ読み取り専用アクセスE2Eテストを実装
  - 非管理者・非ビューワーのコンピテンシー管理ページアクセス拒否E2Eテストを実装
  - _Requirements: 1.3, 1.7, 3.4, 3.8, 6.1, 6.3, 6.4_