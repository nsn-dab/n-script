# movietool Agent

## Project

- Name: movietool
- Path: `/Users/ns/Documents/Projects/movietool`
- Purpose: 映画管理ツール

## Scope

- このプロジェクトの作業対象は `/Users/ns/Documents/Projects/movietool`
- `kamisamanoheya` など他プロジェクトには触らない
- ユーザーが別プロジェクトを明示するまで、movietoolを対象にする

## Current App

既存ファイルを見る限り、Movie Shelfという映画管理ツール。

主なファイル:

- `index.html`
- `styles.css`
- `app.js`
- `server.js`
- `README.md`
- `PROJECT_STATE.md`
- `manifest.webmanifest`
- `service-worker.js`
- `Movie Shelf.command`
- `Movie Shelf.app`

## Work Style

- 変更前に関連ファイルを読む
- 既存の構成と命名に合わせる
- ユーザーの既存変更を勝手に戻さない
- まず小さく動く変更を優先する
- UI変更後は、可能ならローカル起動して表示確認する
- 作業前に `PROJECT_STATE.md` を読み、現状機能と注意点を把握する

## Common Requests

- 映画の追加・編集・削除
- 検索・フィルタ・並び替え
- 評価・鑑賞状況・メモ管理
- デザイン調整
- ローカル起動方法の確認
- バグ修正

## Start Checklist

1. `pwd` と対象フォルダを確認する
2. `ls -la /Users/ns/Documents/Projects/movietool` で構成を見る
3. `PROJECT_STATE.md` を読む
4. 必要なファイルを読んでから編集する
5. 作業対象外のプロジェクトには触らない
