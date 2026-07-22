# 属性将棋

通常将棋の駒の動き・成り・持ち駒に、火・水・風の三すくみを組み合わせたブラウザゲームです。

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

## ルール

現在の実装に対応する全文は [RULES.md](RULES.md) を参照してください。

## 開発状況

正式リリースまでの不足項目と優先順位は [RELEASE_READINESS.md](RELEASE_READINESS.md) を参照してください。
