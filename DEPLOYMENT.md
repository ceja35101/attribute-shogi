# 配布・デプロイ手順

公開URL: [https://ceja35101.github.io/attribute-shogi/](https://ceja35101.github.io/attribute-shogi/)

## リリース前確認

1. `VERSION`、画面フッター、`CHANGELOG.md`のバージョンを一致させる。
2. `http://localhost:8000/tests/regression.html`ですべて成功することを確認する。
3. `tests/self-play.html`でCPU自己対戦を実行する。
4. PC・スマートフォン・タブレット相当の画面幅で確認する。
5. Edge、Chrome、Firefox、Safariで手動スモークテストを行う。
6. Service Workerのキャッシュ名を更新する。

## 静的ホスティング

本作はサーバー処理を必要としないため、リポジトリの内容をHTTPS対応の静的ホスティングへ配置します。GitHub Pagesを利用する場合は、リポジトリ設定の Pages で公開元を `main` ブランチのルートに指定します。

## ロールバック

不具合発生時は直前のGitタグへ戻して再公開します。itch.io無料公開ベータ候補には`v0.1.0-rc.2`、正式リリースには`v0.1.0`のような注釈付きタグを付けます。

## itch.io

`.\tools\build-itch.ps1`で生成した`dist/attribute-shogi-0.1.0-rc.2-itch.zip`をHTMLプロジェクトとしてアップロードします。ZIP直下の`index.html`、必須アセットの存在、外部実行時依存がないことは生成スクリプトと公開前テストで確認します。詳細は [ITCH_RELEASE_CHECKLIST.md](ITCH_RELEASE_CHECKLIST.md) を参照してください。

## 不具合報告

GitHubリポジトリのIssuesを報告窓口として使用し、ブラウザー、OS、再現手順、スクリーンショット、発生した手数の記載を依頼します。
