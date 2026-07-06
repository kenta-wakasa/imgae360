# Image360 QR Viewer

QRコードに含まれる画像名または動画名を読み取り、該当する360度メディアをスマホ画面に表示するサンプルWebアプリです。

## 使い方

1. GitHub Pages で公開されたURLをスマホで開きます。
2. カメラ権限を許可し、画像名が入ったQRコードを読み取ります。
3. 例として `01` / `01.jpg` / `sample.mp4` を含むQRコードを読み取ると、同じフォルダの360度メディアをビューアで表示します。
4. 360度画面では `ジャイロON` を押すと、スマホ本体の動きで視点を操作できます。
5. 左上のボタンでQR読み取り画面に戻れます。

## 直接360度メディアを表示するURL

URLにファイル名を指定すると、QR読み取り画面を経由せずに360度メディアを表示できます。

```text
https://kenta-wakasa.github.io/imgae360/?image=01
```

または

```text
https://kenta-wakasa.github.io/imgae360/?image=01.jpg
```

動画の場合:

```text
https://kenta-wakasa.github.io/imgae360/?video=sample
```

または

```text
https://kenta-wakasa.github.io/imgae360/?media=sample.mp4
```

## GitHub Pages

静的ファイルだけで動作します。

初回だけ GitHub の `Settings > Pages` で `Build and deployment` の Source を `GitHub Actions` に設定してください。
未設定の状態でワークフローを実行すると、`Get Pages site failed` のエラーになります。

GitHub Pages のURL例:

```text
https://kenta-wakasa.github.io/imgae360/
```

## QRコードの内容

QRコードには画像ファイル名または動画ファイル名を入れてください。

```text
01
```

または

```text
01.jpg
```

動画の場合:

```text
sample.mp4
```
