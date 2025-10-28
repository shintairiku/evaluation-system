# Vercel アプリへのカスタムサブドメイン設定ガイド（Squarespace + Google Workspace 利用者向け）

## 1. このガイドの目的

Vercel で開発したアプリケーション（例: 人事評価システム）に、社用の独自ドメインを使った分かりやすいURL（例: https://hr.shintairiku.jp）を設定します。

**Before (変更前):** https://evaluation-system-one.vercel.app  
**After (変更後):** https://hr.shintairiku.jp

### 重要なポイント:
- ドメインを新しく購入する必要はありません。
- Google Workspace で使用中のメール（...@shintairiku.jp）が停止することはありません。

## 2. 作業の全体像

作業は大きく分けて3つのステップで行います。2つのサービス（Vercel と Squarespace）の管理画面を行き来します。

### 【Vercel】で設定値を「もらう」
Vercel に「hr.shintairiku.jp を使いたいです」と申請し、設定に必要な「接続先の情報（CNAME値）」を教えてもらいます。

### 【Squarespace】で設定値を「追加する」
ドメインを管理している Squarespace にログインし、Vercel から教えてもらった「接続先の情報（CNAME値）」を新しいレコードとして追加します。

### 【Vercel】で接続を「確認する」
Vercel に戻り、「設定が完了しました」と報告（Refresh）し、接続が有効になったことを確認します。

## 3. ステップ・バイ・ステップ手順

### ステップ1： Vercel で設定値（CNAME）を確認する

1. Vercel のプロジェクトにアクセスし、Settings タブ -> Domains メニューに進みます。
2. 右上の Add Domain ボタンをクリックします。
3. Add Domain のポップアップが表示されます。
4. 入力欄に、使用したい サブドメイン名 を正確に入力します。（例: hr.shintairiku.jp や app.shintairiku.jp）
5. Redirect ... to www... のチェックボックスは、チェックを外してください。
6. Connect to an environment は Production を選択します。
7. Save ボタンをクリックします。
8. Domains の一覧画面に戻ります。
9. 今追加した hr.shintairiku.jp が、**「Invalid Configuration（無効な設定）」**という赤字のエラーと共に表示されますが、これが正常な状態です。
10. hr.shintairiku.jp の項目に、設定に必要な情報が表示されています。
11. CNAME レコード の値をコピーしてください。
    - Type: CNAME
    - Value: cname.vercel-dns.com （または cname-china.vercel-dns.com など、表示された固有の値をコピーします）

これで Vercel 側の準備は完了です。cname.vercel-dns.com の値をコピーしたまま、次のステップに進みます。

### ステップ2： Squarespace で CNAME レコードを追加する

> **!! 最も重要な注意点 !!**  
> この作業では、既存のレコード（特に MX と書かれたメール用レコード）を絶対に削除・変更しないでください。私たちは**「新しいレコードを1行追加する」**だけです。

1. Squarespace のドメイン管理ダッシュボードにアクセスします。
   - https://account.squarespace.com/domains
2. Google Workspace（旧 Google Domains）で使用していた Google アカウントでログインします。
3. ドメイン一覧から、親ドメイン（例: shintairiku.jp）をクリックします。
4. DNS 設定パネル（または DNS Settings）を開きます。
5. Custom Records（カスタムレコード）というセクションを探します。
6. Add Record（レコードを追加） ボタンをクリックします。
7. 新しいレコードの入力欄に、Vercel から指示された情報を入力します。
   - Host (ホスト): hr
     - （注意: hr.shintairiku.jp 全体ではなく、shintairiku.jp より前の部分だけを入力します）
   - Type (タイプ): CNAME
     - （プルダウンメニューから選択します）
   - Data (データ): cname.vercel-dns.com
     - （ステップ1で Vercel からコピーした値を貼り付けます）
   - TTL (時間): 1 hour （またはデフォルトのままで構いません）
8. Save（保存） をクリックして、新しいレコードを保存します。

これで Squarespace 側の設定は完了です。

### ステップ3： Vercel で設定の反映を確認する

1. DNS 設定がインターネット全体に反映されるまで、少し時間がかかります。（通常は数分～1時間程度ですが、最大48時間かかる場合もあります）
2. Vercel のプロジェクト設定（Settings -> Domains）に戻ります。
3. hr.shintairiku.jp の項目の右側にある Refresh ボタンをクリックします。
4. 「Invalid Configuration（無効な設定）」の赤字が消え、**「Valid Configuration（有効な設定）」**の緑色のチェックマークに変われば、すべての設定は成功です！
5. hr.shintairiku.jp が Production ブランチに正しく割り当てられていることを確認します。

## 4. 最終確認

1. ブラウザのアドレスバーに https://hr.shintairiku.jp を入力し、Vercel でデプロイしたアプリが正しく表示されることを確認します。
2. 念のため、Google Workspace（Gmailなど）でメールの送受信が引き続き問題なく行えることを確認します。