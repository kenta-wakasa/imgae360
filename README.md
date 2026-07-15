# Image360 Viewer

URLで指定した360度画像・動画をスマホ画面に表示するサンプルWebアプリです。QRコードはスマホ標準のカメラアプリなどで読み取り、開いたURLをそのままビューアで表示します。

## 使い方

1. スマホ標準のカメラアプリ等でQRコードを読み取り、表示されたURLを開きます(URLを直接開いても構いません)。
2. 360度メディアがビューアで表示されます。画面をドラッグすると視点を動かせます。
3. 画面下部の `ジャイロON` を押すと、スマホ本体の動きで視点を操作できます。

QRコードの生成は管理ページ(`admin.html`)から行えます。

## 直接360度メディアを表示するURL

URLにファイル名やメディアURLを指定すると、360度メディアを表示できます。

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
モバイルブラウザではYouTube埋め込みプレイヤーの全画面やジャイロ操作が制限される場合があります。
その場合は画面下部の `YouTubeで開く` からYouTubeアプリまたはYouTubeページで再生してください。

## GitHub Pages

静的ファイルだけで動作します。

初回だけ GitHub の `Settings > Pages` で `Build and deployment` の Source を `GitHub Actions` に設定してください。
未設定の状態でワークフローを実行すると、`Get Pages site failed` のエラーになります。

GitHub Pages のURL例:

```text
https://kenta-wakasa.github.io/imgae360/
```

## QRコードの内容

QRコードには、ビューアを開くフルURLを入れてください(スマホのカメラアプリがそのURLを開きます)。管理ページ(`admin.html`)ではアップロードしたメディアのビューアURLとQRコードを自動生成できます。

```text
https://kenta-wakasa.github.io/imgae360/?media=<メディアURL>&type=video
```

外部ストレージURLの場合、拡張子から動画/画像を判定できないときは `type=video` または `type=image` を付けてください。
YouTube動画の場合は、YouTube共有URLまたは `https://kenta-wakasa.github.io/imgae360/?youtube=VIDEO_ID` をQRコード化してください。
