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
モバイルブラウザではYouTube埋め込みプレイヤーの全画面やジャイロ操作が制限される場合があります。
その場合は画面下部の `YouTubeで開く` からYouTubeアプリまたはYouTubeページで再生してください。

## 管理ページ(アップロード / 一覧 / QR生成 / 編集 / 削除)

`admin.html` は Firebase Storage 上の360度メディアを管理する画面です。URLを知っている人だけがアクセスする想定の非公開ページです(検索避けの `noindex` を付けています)。

```text
https://kenta-wakasa.github.io/imgae360/admin.html
```

できること:

- 360度画像 / 動画にタイトルを付けてアップロード(完了すると自動で詳細画面に遷移)
- アップロード済みメディアの一覧表示(新しい順)
- 詳細画面でのプレビュー、ビューアURL(QRコードの内容)の確認とコピー
- QRコードの生成とPNGダウンロード
- タイトル(メタ情報)の編集
- メディアの削除

メタ情報(タイトル)は Firestore を使わず、Storage オブジェクトのカスタムメタデータ `title` に保存します。ファイルは `image360/` フォルダ配下に保存されます。

### Firebase の準備

1. **Storage セキュリティルール** — 管理ページから `image360/` への読み書き・削除を許可します。公開ページでの再生はダウンロードURL経由なので、`read` は誰でも、`write` / `delete` は認証や社内利用の範囲に絞るなど運用に合わせて調整してください。最小の例:

   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /image360/{file} {
         allow read: if true;
         allow write, delete: if true; // 運用に応じて絞ってください
       }
     }
   }
   ```

2. **CORS 設定** — 360度動画は WebGL テクスチャとして読み込むため、バケットに CORS 設定が必要です(画像も同様)。`gsutil` で一度だけ設定します:

   ```bash
   cat > cors.json <<'EOF'
   [
     {
       "origin": ["https://kenta-wakasa.github.io", "http://localhost:8360"],
       "method": ["GET", "HEAD"],
       "responseHeader": ["Content-Type", "Range"],
       "maxAgeSeconds": 3600
     }
   ]
   EOF
   gsutil cors set cors.json gs://animal-onomatope.appspot.com
   ```

Firebase の Web アプリ設定(APIキー等)は `admin.js` の先頭に記載しています。別プロジェクトを使う場合はここを差し替えてください。

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
