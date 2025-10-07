# 実装戦略書の運用ガイド

## 基本的な流れ

### 1. フォルダ作成
- `docs/implementation-strategy/`の中にフォルダを作成
- 命名規則: `日付時間-機能名` (例: `070914-setup`, `070915-user-registration`)

### 2. 戦略書作成
該当フォルダの中に戦略書を作成し、エンジニアが間違わずに実装できるように詳細に記述する。

## 戦略書のナンバリング

### 01: 初期実装戦略書
- ファイル名: `01-[機能名]-strategy.md`
- 用途: 新機能・新要素の初回実装
- 内容: 手順書、注意事項、完成のためのフェーズ別やることリスト

### 02-08: 追加戦略書
- ファイル名: `02-[機能名]-[対応内容]-strategy.md`
- 用途: 入力者のフィードバックに応じて必要な場合に作成
- 対応内容例:
  - バグ修正 (`02-user-registration-bugfix-strategy.md`)
  - 機能追加 (`03-user-registration-update-strategy.md`)
  - 要件変更 (`04-user-registration-requirement-change-strategy.md`)
  - 大幅修正 (`05-user-registration-major-fix-strategy.md`)
- 内容: 問題の特定、解決策、実装手順、影響範囲

## 完了レポートの書き方

### 09: 完了レポート
- ファイル名: `09-[機能名]-report.md`
- 用途: 実装完了後の成果物まとめ
- 内容: 実行結果、作成ファイル、解決した問題、次のアクション

## 実装サイクル例

### 理想的なケース（一回で完璧）
```
070915-user-registration/
├── 01-user-registration-strategy.md     # 初期実装戦略
└── 09-user-registration-report.md       # 完了レポート
```

### 修正が必要なケース
```
070915-user-registration/
├── 01-user-registration-strategy.md          # 初期実装戦略
├── 02-user-registration-bugfix-strategy.md   # バグ修正戦略
├── 03-user-registration-update-strategy.md   # 機能追加戦略
├── 04-user-registration-major-fix-strategy.md # 大幅修正戦略
└── 09-user-registration-report.md            # 完了レポート
```

## 運用のポイント

### 戦略書作成時
- エンジニアが迷わないよう具体的な手順を記載
- 前提条件、環境設定、依存関係を明記
- 完成基準を明確に定義
- トラブルシューティング情報を含める

### 入力者との連携
- 成果物確認後のフィードバックに応じて次の番号で戦略書を作成
- 内容に応じてファイル名の[対応内容]部分を決定
- 例：
  - バグ報告 → `02-[機能名]-bugfix-strategy.md`
  - 機能不足指摘 → `03-[機能名]-update-strategy.md`
  - 要件変更 → `04-[機能名]-requirement-change-strategy.md`
  - 大幅修正 → `05-[機能名]-major-fix-strategy.md`

### 品質管理
- 各戦略書実行後は必ず09-reportで結果を記録
- 問題と解決策を体系的に蓄積
- 次回類似実装時の参考資料として活用

この運用ガイドに従って、体系的かつ効率的な機能実装を進める。