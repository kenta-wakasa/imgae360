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

外部ストレージのURLを指定する場合:

```text
https://kenta-wakasa.github.io/imgae360/?media=https%3A%2F%2Fexample.com%2Fsample.mp4&type=video
```

画像の場合:

```text
https://kenta-wakasa.github.io/imgae360/?media=https%3A%2F%2Fexample.com%2Fpanorama.jpg&type=image
```

外部URLは `https://` で配信され、ブラウザから読み込めるCORS設定が必要です。
動画URLの末尾に `.mp4` / `.webm` / `.mov` が付いている場合は自動で動画判定します。
署名付きURLなどで拡張子がURLパスに出ない場合は `type=video` を付けてください。

YouTubeにアップロードした360度動画を表示する場合:

```text
https://kenta-wakasa.github.io/imgae360/?youtube=VIDEO_ID
```

YouTube動画はMP4として直接読み込まず、YouTubeの埋め込みプレイヤーで表示します。
QRコードには上記URL、YouTubeの共有URL、または11文字のYouTube動画IDを入れられます。

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

外部ストレージURLをQRコードに直接入れることもできます。
拡張子から動画/画像を判定できないURLの場合は、このアプリのURL形式で `type=video` または `type=image` を付けてQRコード化してください。
YouTube動画の場合は、YouTube共有URLまたは `https://kenta-wakasa.github.io/imgae360/?youtube=VIDEO_ID` をQRコード化してください。
