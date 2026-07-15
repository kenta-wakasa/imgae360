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

YouTube動画はMP4として直接読み込まず、YouTube IFrame Player API の埋め込みプレイヤーで表示します。
QRコードには上記URL、YouTubeの共有URL、または11文字のYouTube動画IDを入れられます。
360度動画では、画面のドラッグで視点移動、ピンチ(またはマウスホイール)でズーム、タップで再生/一時停止ができます。
埋め込みプレイヤーが360度表示に対応していない環境(一部のモバイルブラウザなど)では通常表示になります。
その場合は右上の `YouTubeで開く` からYouTubeアプリまたはYouTubeページで再生してください。

## 管理ページ(アップロード / 一覧 / QR生成 / 編集 / 削除)

`admin.html` は Firebase Storage 上の360度メディアを管理する画面です。管理者アカウントでのログインが必要で、アップロード・編集・削除はログイン済みのときのみ行えます(検索避けの `noindex` も付けています)。

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

1. **Email/Password 認証の有効化** — Firebase コンソールの `Authentication > Sign-in method` で「メール/パスワード」を有効にし、`Users` タブから管理者アカウント(メールアドレスとパスワード)を作成してください。管理ページはこのアカウントでログインします。サインアップ画面は用意していないため、アカウント作成はコンソールから行います。

2. **Storage セキュリティルール** — 公開ページでの再生はダウンロードURL経由なので `read` は誰でも許可、書き込み・削除は**ログイン済みのときだけ**許可します。クライアント側の画面制御だけでは API を直接呼ばれると回避できるため、このルールでサーバー側でも認証を必須にすることが重要です。`image360/` パスの推奨ルール:

   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /image360/{file} {
         allow read: if true;
         allow write, delete: if request.auth != null;
       }
     }
   }
   ```

   このバケットは他のアプリと共有されているため、既存のルールを消さずに `image360/` の `match` ブロックだけを追加してください。特定のアカウントのみに絞りたい場合は `request.auth != null` を `request.auth.token.email == "admin@example.com"` などに置き換えます。

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

QRコードには、ビューアを開くフルURLを入れてください(スマホのカメラアプリがそのURLを開きます)。管理ページ(`admin.html`)ではアップロードしたメディアのビューアURLとQRコードを自動生成できます。

```text
https://kenta-wakasa.github.io/imgae360/?media=<メディアURL>&type=video
```

外部ストレージURLの場合、拡張子から動画/画像を判定できないときは `type=video` または `type=image` を付けてください。
YouTube動画の場合は、YouTube共有URLまたは `https://kenta-wakasa.github.io/imgae360/?youtube=VIDEO_ID` をQRコード化してください。
