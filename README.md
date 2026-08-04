# 属性将棋

公開版: [https://ceja35101.github.io/attribute-shogi/](https://ceja35101.github.io/attribute-shogi/)

itch.io: [https://ceja35101.itch.io/attribute-shogi](https://ceja35101.itch.io/attribute-shogi)

現在は無料公開ベータです。参加方法と確認項目は [BETA_TEST_GUIDE.md](BETA_TEST_GUIDE.md)、募集方法は [BETA_RECRUITMENT.md](BETA_RECRUITMENT.md)、正式版への移行基準は [PUBLIC_BETA_OPERATIONS.md](PUBLIC_BETA_OPERATIONS.md) を参照してください。

English: [Rules](RULES_EN.md) · [Privacy](PRIVACY_EN.md) · [Beta Test Guide](BETA_TEST_GUIDE_EN.md) · [itch.io Page](ITCH_PAGE_EN.md)

通常将棋の駒の動き・成り・持ち駒に、火・水・風の三すくみを組み合わせたブラウザゲームです。

王は耐久4を持ちます。弱属性攻撃は1手番の短期膠着後に耐久1、同属性膠着の自然解消は耐久2を減らします。膠着を即解消できる援軍は、衝突属性に勝つ強属性だけです。

## 起動方法

このリポジトリのルートでHTTPサーバーを起動します。

```powershell
.\.conda\python.exe -m http.server 8000
```

Python環境を別途用意している場合は、次でも起動できます。

```powershell
python -m http.server 8000
```

ブラウザで `http://localhost:8000` を開いてください。

## 回帰テスト

サーバー起動後、`http://localhost:8000/tests/regression.html` を開きます。

CPU自己対戦は `http://localhost:8000/tests/self-play.html` を開くと100局を自動実行します。
URLへ `?games=500&maxPlies=600` を付けると、正式リリース向けの500局試験を実行できます。

初期化500回とCPU自己対戦50局の耐久テストは `http://localhost:8000/tests/durability.html` で実行できます。

## itch.io配布物

PowerShellで次を実行すると、`index.html`を直下に含むHTML5ゲーム用ZIPを`dist`へ生成します。

```powershell
.\tools\build-itch.ps1
```

公開設定と確認手順は [ITCH_RELEASE_CHECKLIST.md](ITCH_RELEASE_CHECKLIST.md)、掲載本文は [日本語](ITCH_PAGE.md)／[English](ITCH_PAGE_EN.md) を参照してください。

公開物のバージョン、キャッシュ、画像、ZIP構造は次で検証できます。

```powershell
.\.conda\python.exe tools\validate-release.py --archive
```

## ルール

現在の実装に対応する全文は [RULES.md](RULES.md) を参照してください。

## 盤面表示と棋譜再生

- 直前手の移動元は青紫の点線、移動先は青紫の実線で次の着手まで表示します。
- 移動直後は矢印と短い駒アニメーションを表示します。
- 持ち駒の配置には「打」、援軍勝利には「援」を表示します。
- 直近5手のログ、前の手・次の手ボタンから過去局面を確認できます。
- 「現在局面へ戻る」で対局画面へ復帰します。

## ゲーム設定

- CPU難易度は「やさしい」「ふつう」「むずかしい」の3段階です。
- 対戦モードは「CPU対戦」「同じ端末で2人対戦」「招待コードでオンライン対戦」から選択できます。
- オンライン対戦のSupabase初期設定は [ONLINE_SETUP.md](ONLINE_SETUP.md) を参照してください。
- 効果音は画面上部からミュートできます。
- 初回起動時にチュートリアルを表示し、「遊び方・ルール」からいつでも再表示できます。
- 難易度、ミュート、チュートリアル表示済みの設定はブラウザーに保存します。
- 対局は着手ごとに自動保存され、再読み込み後に続きから再開できます。
- 「棋譜を出力」で全手の棋譜をテキスト保存できます。
- 「待った」で直前の自分の着手前まで戻し、別の手を選び直せます。
- 「投了」から対局を終了できます。

## リリース候補版の機能

- 成りはゲーム内ダイアログで選択します。
- 盤面はTab・矢印キー・Enter/Spaceでも操作できます。
- 戦闘候補は色に加えて「有利」「不利」「同」「援」の文字を表示します。
- HTTPSまたはlocalhostで一度起動すると、対応ブラウザーではオフラインキャッシュを利用できます。
- PWA用アイコンを備え、対応端末ではホーム画面へインストールできます。
- GitHub ActionsでChrome回帰テスト、耐久テスト、500局のCPU自己対局を自動実行します。
- 直前形式（Version 2）の保存対局は最新ルールへ移行します。対応外または破損した保存データは退避し、新しい対局を安全に開始します。

バージョンと運用情報:

- [CHANGELOG.md](CHANGELOG.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [PRIVACY.md](PRIVACY.md)
- [LICENSES.md](LICENSES.md)

## ライセンス

本プロジェクトには公開ライセンスを付与していません。すべての権利を留保しており、許可のない複製、改変、再配布、商用利用などを禁止します。詳細は [LICENSE](LICENSE) を参照してください。

## 開発状況

正式リリースまでの不足項目と優先順位は [RELEASE_READINESS.md](RELEASE_READINESS.md) を参照してください。
