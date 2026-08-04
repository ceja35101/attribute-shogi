# 招待制オンライン対戦の設定

## Supabase側

1. SupabaseでFreeプランのプロジェクトを作成します。
2. Authentication → Providers → Anonymous Sign-Insを有効にします。
3. SQL Editorで [`supabase/schema.sql`](supabase/schema.sql) 全体を実行します。
4. Project Settings → APIからProject URLとPublishable keyを取得します。
5. [`supabase-config.js`](supabase-config.js) の`url`と`publishableKey`へ設定します。

`service_role` keyは管理者権限を持つ秘密情報です。ブラウザ用ファイルやGitへ追加しないでください。
Publishable key（旧anon key）はRLSと組み合わせて公開クライアントで使用するためのキーです。

## 動作確認

1. HTTPSで公開したゲームを通常ウィンドウとプライベートウィンドウで開きます。
2. 両方で「設定 → 対戦モード → 招待コードでオンライン対戦」を選択します。
3. 一方で「部屋を作成」し、表示された6文字コードをもう一方へ入力します。
4. 先手・後手を1手ずつ動かし、盤面、持ち駒、ログ、勝敗が同期することを確認します。
5. 片方を再読み込みし、同じ部屋へ自動再接続することを確認します。

部屋は最終着手から24時間で期限切れになります。期限切れ行は、次に部屋が作成された際にも削除されます。

## 現在のセキュリティ境界

- 部屋の読み取りは匿名認証済みの参加者2名だけにRLSで限定します。
- 更新RPCは参加者、手番、リビジョン、手数増加、状態サイズを検査します。
- 完全な合法手判定は現在ブラウザ側です。改造クライアントへの完全な不正対策には、将来サーバー側のルールエンジンが必要です。
