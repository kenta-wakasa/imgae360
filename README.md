# Image360 QR Viewer

QRコードに含まれる画像名を読み取り、該当する360度画像をスマホ画面に表示するサンプルWebアプリです。

## 使い方

1. GitHub Pages で公開されたURLをスマホで開きます。
2. カメラ権限を許可し、画像名が入ったQRコードを読み取ります。
3. 例として `01` または `01.jpg` を含むQRコードを読み取ると、同じフォルダの `01.jpg` を360度ビューアで表示します。
4. 360度画面では `ジャイロON` を押すと、スマホ本体の動きで視点を操作できます。
5. 左上のボタンでQR読み取り画面に戻れます。

## GitHub Pages

静的ファイルだけで動作するため、GitHub Pages の `Deploy from a branch` で `main` ブランチの `/root` を公開できます。

GitHub Pages のURL例:

```text
https://kenta-wakasa.github.io/imgae360/
```

## QRコードの内容

QRコードには画像ファイル名を入れてください。

```text
01
```

または

```text
01.jpg
```

