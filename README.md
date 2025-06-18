# 人事評価システム (HR Evaluation System)

## 技術スタック

- **フロントエンド**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **バックエンド**: FastAPI, Python 3.12
- **データベース**: PostgreSQL
- **認証**: Clerk
- **コンテナ化**: Docker

## 開発環境のセットアップ

### 前提条件

- [Docker](https://www.docker.com/products/docker-desktop/) がシステムにインストールされ、実行中であること。
- [Node.js](https://nodejs.org/) (npm含む) がインストールされていること。

### Claude Code のセットアップ

開発効率を向上させるため、Claude Code をインストールすることを推奨します ([Docs](https://docs.anthropic.com/en/docs/claude-code/getting-started))。

```bash
npm install -g @anthropic-ai/claude-code
```

### 1. リポジトリをクローンする

```bash
git clone https://github.com/shintairiku/evaluation-system.git
```

### 2. 環境変数ファイルを作成する

プロジェクトのルートディレクトリに、サンプルをコピーして `.env` ファイルを作成。

```bash
cp .env.sample .env
```

### 3. アプリケーションをビルドして実行する

Docker Composeを使用して、イメージをビルドし、バックグラウンドでサービスを起動

```bash
docker-compose up --build -d
```

### 5. サービスへのアクセス

コンテナが起動したら、各サービスにアクセス可能

- **フロントエンド**: [http://localhost:3000](http://localhost:3000)
- **バックエンド**: [http://localhost:8000](http://localhost:8000)
- **データベース**: ローカルマシンのポート `5433` で接続

### 6. サービスを停止する

サービスを停止するには、以下のコマンドを実行
```bash
docker-compose down
```
