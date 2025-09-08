# 要件定義書: Frontend User Server Action Standardization

## 1. 概要

現在、フロントエンドのserver actionレイヤーにおいて、users関連の実装とgoals関連の実装に一貫性がありません。users server actionは`endpoints/users.ts`からimportして処理を委譲している一方で、goals server actionは直接HTTP clientを使用して実装されており、APIアーキテクチャの標準化が必要です。

この統一により、コードの一貫性向上、保守性の向上、バグ発生リスクの軽減を図ります。

## 2. 要件一覧

### 要件1: Server Actionの実装パターン統一

**ユーザーストーリー:**
> 開発者として、一貫性のあるserver actionの実装パターンに従いたい。なぜなら、コードの可読性と保守性を向上させたいからだ。

**受入基準:**

```gherkin
WHEN users server actionを参照する場合
THEN goals server actionと同じパターン（getHttpClient()直接使用）で実装されていること

WHEN 新しいserver actionを作成する場合  
THEN 統一されたパターンに従って実装できること

WHEN APIエンドポイントを呼び出す場合
THEN API_ENDPOINTSから直接取得した値を使用していること
```

### 要件2: Import構造の統一

**ユーザーストーリー:**
> 開発者として、server actionでの依存関係を明確にしたい。なぜなら、重複したimportや複雑な依存関係を避けたいからだ。

**受入基準:**

```gherkin
WHEN users server actionのimport文を確認する場合
THEN endpoints/users.tsからのimportが削除されていること

WHEN HTTP clientとAPI constantsをimportする場合
THEN getHttpClient()とAPI_ENDPOINTSを直接importしていること

WHEN TypeScript型をimportする場合
THEN ../types/からのimportのみを使用していること
```

### 要件3: API呼び出しパターンの統一

**ユーザーストーリー:**
> 開発者として、統一されたAPI呼び出しパターンに従いたい。なぜなら、コードの複雑性を軽減し、エラーハンドリングを統一したいからだ。

**受入基準:**

```gherkin
WHEN HTTP GETリクエストを送信する場合
THEN http.get<ResponseType>(endpoint)のパターンで実装されていること

WHEN HTTP POST/PUT/DELETEリクエストを送信する場合
THEN http.method<ResponseType>(endpoint, data)のパターンで実装されていること

WHEN エラーハンドリングを行う場合
THEN try-catch文を使用し、統一されたエラーレスポンス形式を返すこと
```

### 要件4: クエリパラメータ処理の統一

**ユーザーストーリー:**
> 開発者として、クエリパラメータの処理方法を統一したい。なぜなら、同じ処理ロジックを複数の場所で書きたくないからだ。

**受入基準:**

```gherkin
WHEN クエリパラメータを構築する場合
THEN URLSearchParams()を使用して構築すること

WHEN オプショナルパラメータを処理する場合
THEN 条件分岐でパラメータの存在チェックを行ってから追加すること

WHEN 最終的なendpointを構築する場合
THEN クエリストリングの有無で分岐して適切なURLを生成すること
```

### 要件5: コードの削減と重複排除

**ユーザーストーリー:**
> プロジェクトメンバーとして、不要なコードを削減したい。なぜなら、保守コストを下げ、バンドルサイズを最適化したいからだ。

**受入基準:**

```gherkin
WHEN endpoints/users.tsファイルが存在する場合
THEN そのファイルが削除されていること（または適切にリファクタリングされていること）

WHEN server actionのコード行数を確認する場合
THEN 重複処理が排除され、必要最小限のコードになっていること

WHEN 型定義をimportする場合
THEN 統一された場所（../types/）からimportされていること
```

### 要件6: 非機能要件 - パフォーマンス

**要求事項:**
リファクタリング後も同等以上のパフォーマンスを維持し、バンドルサイズの増加を避ける必要があります。

**受入基準:**

```gherkin
GIVEN リファクタリング前後のコード状態で
WHEN server actionを呼び出す場合
THEN レスポンス時間が同等以上であること

GIVEN リファクタリング後のコード状態で
WHEN フロントエンドのバンドルサイズを確認する場合
THEN バンドルサイズが増加していないこと
```