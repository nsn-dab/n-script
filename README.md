# Video Converter

WMVなどの動画ファイルを選択またはドラッグして、MP4など別の拡張子へ変換するローカルツールです。

## 必要なもの

- Node.js
- ffmpeg

macOSでHomebrewを使う場合:

```bash
brew install ffmpeg
```

## 起動

```bash
node server.js
```

ブラウザで開く:

```text
http://localhost:4321
```

## 使い方

1. 動画ファイルを選択、またはドラッグします。
2. 変換したい拡張子を選びます。
3. `変換` を押します。
4. 完了後に `保存` でダウンロードします。
