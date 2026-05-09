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

既存ファイルを見る限り、N Scriptという映画管理ツール。

主なファイル:

- `index.html`
- `styles.css`
- `app.js`
- `server.js`
- `README.md`
- `PROJECT_STATE.md`
- `manifest.webmanifest`
- `service-worker.js`
- `N Script.command`
- `N Script.app`

## Work Style

- 変更前に関連ファイルを読む
- 既存の構成と命名に合わせる
- ユーザーの既存変更を勝手に戻さない
- まず小さく動く変更を優先する
- UI変更後は、可能ならローカル起動して表示確認する
- 作業前に `PROJECT_STATE.md` を読み、現状機能と注意点を把握する

## Codex Usage Rules

Codexの消費効率と復旧しやすさを優先する。

- 作業開始時はまず `git status --short` を確認する
- 最新コミットとの差分を優先して把握し、毎回プロジェクト全体を読み直さない
- 変更範囲が分かっている場合は、そのファイルだけを読む
- 大きな変更の前後では、必要に応じてコミットを提案または作成する
- 「ここまでOK」と判断できる単位でこまめにコミットする
- 復旧は会話履歴よりGitを優先する
- 壊れた場合は `git diff` / `git log` / `git show` を使って原因と戻し先を確認する
- `PROJECT_STATE.md` を最新状態の要約として扱い、仕様変更後は必要に応じて更新する
- デザイン作業では `$design` または `/design` の運用ルールに従い、参考画像との差分を構造・余白・文字・色・カード比率の順に見る
- プロジェクト切り替えは `$project` または `/project` を使う

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
