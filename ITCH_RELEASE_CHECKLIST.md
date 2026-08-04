# itch.io公開チェックリスト

対象バージョン: `0.1.0-rc.2`

公開URL: [https://ceja35101.itch.io/attribute-shogi](https://ceja35101.itch.io/attribute-shogi)

## アップロード前

- [x] `index.html`がZIP直下にある
- [x] 外部CDN、外部画像、外部音声への実行時依存がない
- [x] 日本語・英語をブラウザー言語から自動選択できる
- [x] マウス、タッチ、キーボードで操作できる
- [x] セーブ、設定、棋譜はブラウザー内だけに保存する
- [x] ライセンス、素材権利、プライバシー文書がある
- [x] 73件の回帰テスト、耐久テスト、500局自己対戦を通過させる
- [x] itch.io用630×500カバー画像を用意する
- [x] 実ゲーム画面のスクリーンショット4枚を用意する
- [ ] Android Chrome実機で確認する（端末確保後の外部確認）

## ZIP生成

PowerShellでリポジトリのルートから実行します。

```powershell
.\tools\build-itch.ps1
```

生成物:

```text
dist/attribute-shogi-0.1.0-rc.2-itch.zip
```

## itch.io管理画面

1. `Create new project`を選ぶ。
2. Titleを`Elemental Shogi / 属性将棋`にする。
3. Project URLを`attribute-shogi`にする。
4. Classificationを`Games`、Kind of projectを`HTML`にする。
5. Release statusを`In development`、Pricingを`No payments`にする。
6. ZIPをアップロードし、`This file will be played in the browser`を有効にする。
7. Embed optionsは`Embed in page`、Viewportは`1280 × 900`、`Mobile friendly`を有効にする。
8. Cover imageへ`itch-cover-630x500-v2.jpg`を設定する。
9. `itch-screenshots/`の4画像を番号順にアップロードする。
10. 英語本文は`ITCH_PAGE_EN.md`、日本語本文は`ITCH_PAGE.md`を基に記載する。
11. Commentsを有効にし、AI Disclosureで画像へのAI支援利用を申告する。
12. Draft状態でPCとiPhoneから起動・新規対局・保存復元・チュートリアルを確認する。
13. 問題がなければVisibilityを`Public`へ変更し、`Unlisted in search & browse`は無効にする。

## 公開後

- itch.ioの公開URLをREADMEとゲーム内テスト案内へ追加する。
- 最初の10～30人へテストを案内する。
- Android Chrome実機テスターを最低1人含める。
- 重大な不具合はVisibilityをDraftへ戻し、前バージョンのZIPへ差し替える。
