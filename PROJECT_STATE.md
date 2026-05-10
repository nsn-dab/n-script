# N Script Project State

## ツール名称

- 現在のプロダクト名称は `N Script`

## 現在の目的

N Scriptは、見たい映画の探索、脚本の構造分析、創作支援、批評シミュレーションを統合した脚本家向けWebアプリ。

## 開発背景

- 東北新社ライターズルームのような、合評と詰問が厳しい実戦環境に耐えるための事前防衛が必要
- 孤独になりやすい執筆工程で、批評整理と改善を支える常時伴走の支援が必要
- Save the Cat（15ビート）理論を、感覚だけでなく数値（Ratio）で扱い客観性を高めたい

## 作成目的

- IT Script（本ツール）でMovie Script（創作物）を多角的に支援する
- 実戦対応力の強化（徹底分析 + シミュレーション）
- 創作の伴走（全工程での支援）
- 作品強度の向上（構造理論に基づく客観指標の活用）

## 補足
彼女が本来大好きな、映画や脚本を書くことを現在は仕事のプレッシャーからか純粋に楽しめなくなっている。
そこを助けるツールだという観点も忘れてはならない。
追い込むためだけのツールではない。

## 全メニュー構成（設計方針）

1. Discover（探索）
   - 参考作品の検索・ストック
2. Analyze（構造分析）
   - 15ビート比率（Ratio）分析
3. Create（創作・肉付け）
   - アイディアガチャ、キャラクター生成、言語化サポート
4. Mentor（試練・修行場）
   - 批評レポート + シミュレーション対話
5. 常設チャット（伴走・避難所）
   - 全画面共通の右下チャット導線、ユーザー主導でいつでも相談可能

## 起動

```bash
node server.js
```

URL:

```text
http://localhost:5173/index.html
```

Macでは `N Script.app` または `N Script.command` からも起動できる。

## 現在の主な機能

- 映画の追加、編集、削除
- 公開日、公開終了日、監督、キャスト、ジャンル、メモの管理
- TMDb APIを主軸に、作品ページURLまたはタイトル検索からメタ情報を取得
- TMDbで取得できる場合は日本語概要、ポスター、上映時間、公開日、日本国内の定額配信サービスを保存
- TMDb公開日は `release_dates` のJP劇場公開日を優先し、なければ代表公開日にフォールバックする
- TMDbの `release_dates` が返す `YYYY-MM-DDT...` 形式も日付として正規化する
- 追加/編集フォームでは上映時間、配信、TMDb IDも表示・編集できる
- TMDbでヒットしない場合のみ、映画.com抽出をバックアップとして使う
- タイトル検索でTMDb候補が複数ある場合は候補一覧を表示し、選択したTMDb IDで詳細取得する
- 候補一覧は概要がない作品でも、原題、公開日、言語、TMDb IDを表示して判別できるようにする
- TMDbタイトル検索は日本語/英語と言語設定、表記ゆれ正規化クエリを試し、バックアップ検索失敗時も全体を落とさない
- Discover画面で映画検索、追加、ステータス絞り込み、並び替え
- 新規追加、編集、詳細画面で未視聴/視聴済みを管理
- 映画カードはポスター、タイトル、視聴済みチェックのみ表示。状態は未視聴または視聴済み
- カード右上のチェックは即時トグル操作。カード右上の `…` メニューは視聴済み、未視聴、削除の確定操作
- 詳細画面の視聴状態は二択ボタンではなく、単一チェック＋状態ラベルで切り替える
- 映画追加/編集フォームは閉じるボタンに一本化し、編集キャンセル専用ボタンは表示しない
- カードクリック後の詳細画面で全登録情報、編集、削除を扱う
- ロゴは現在 `logo.svg` をPC/SPビューに使い、faviconは `favicon.svg` を使う
- ブックマークレットから作品ページを追加
- JSONバックアップの書き出し、読み込み
- Analyze画面の初期状態はManual / Scriptの2ルートボタンと保存済みAnalyzeカードのみ
- Manual / Script開始ボタンはDiscoverのAdd Movieと同じ上部アクション位置に配置する
- Analyze一覧はDiscoverと同じく、すべて/Script/Manualフィルター、検索、並び順を上部に配置する
- Discover/Analyzeのデフォルト表示と上部ヘッダーは静的HTMLとして保持し、タブ切り替えでは該当パネルの表示だけを切り替える
- 機能タブ切り替え時は、表示されるヘッダーとパネルに軽いフェード/スライドの入場アニメーションを付ける
- 映画カード、Analyzeカード、Manualビート入力、Analyze詳細ビートはHTML templateを使い、データ部分だけJSで描画する
- Manualはモーダルで映画タイトル、runtime、15ビート入力欄、ログラインを登録し、理論値付きのAnalyzeカードとして保存する
- Manualの各ビートは実測タイム入力、理論タイム、実測-理論の差分を表示する。タイム表示は `00:00:00` 形式
- Analyze詳細の15ビート行にも実測、理論、差分を表示する
- Manualの15ビートメモからGeminiで100文字前後のログラインを生成する `/api/analyze/logline` を用意済み
- 保存済みAnalyzeカードはカード全体クリックでDiscover詳細と同じ全画面詳細を表示。詳細下部に編集と削除を配置し、編集は通常モーダルで行う
- Scriptは映画タイトルによる外部脚本DB取得、または脚本ファイルの選択/ドラッグ&ドロップアップロードからGemini解析する構成。脚本DB取得は実装完了済み
- ScriptモードではManual用のruntime、ログライン入力、AIログライン生成ボタンは表示しない。タイトル欄は脚本DB検索用として使い、ファイル解析時はファイル名からタイトルを補完できる
- Script DBモードではタイトル検索からTMDb候補を出し、選択した作品の原題・年も使って脚本DB検索を行う
- Script DB取得は `/api/analyze/script-db/fetch` で実行し、取得した脚本本文は一時セッションIDで保持する。ユーザー確認後に `/api/analyze/start` へ渡してGemini抽出する
- Script DBの外部取得は ScriptSlug / IMSDb / DailyScript の順に候補URLを試し、HTML/TXT/PDFから本文抽出する
- Script DB取得に失敗した場合は、脚本ファイルアップロードへ誘導する
- Script Uploadモードではファイルを `/api/analyze/upload` に送信し、抽出されたテキストをGemini解析へ渡す
- Scriptアップロードは `.txt/.md/.fountain/.fdx/.rtf/.pdf/.docx/.pptx` を対象に、テキスト抽出後にAnalyzeへ渡す（スキャンPDF/OCRは対象外）
- Videoルートは現行UIから一旦外している。yt-dlp、Gemini動画解析は次段階
- Mentorは履歴リスト、GO/REWRITE/PASSフィルター、検索、並び順、新規査定モーダル、詳細フルスクリーン表示、削除を実装済み
- Mentorはテキスト入力またはファイルアップロードから `/api/mentor/analyze` でGemini査定し、履歴をSupabase共有データに保存する
- Mentor実装自体は完了済み。現在はレポートの分析観点、文章の出し方、外観、構成を調整中
- Mentor詳細は判定、理由、重大課題、最初に直す一点、想定詰問、5軸スコア、ハイコンセプト分析、ホラー/グローバル適性、興行シミュレーション、コアポテンシャル、書き直し優先順位を表示する
- Gemini API連携基盤。Analyze抽出は `/api/analyze/extract` / `/api/analyze/start`、Analyzeログライン生成は `/api/analyze/logline`、Mentor査定は `/api/mentor/analyze` のPOSTエンドポイント
- `/api/analyze/extract` は脚本テキストまたは動画解析データから15ビートを抽出し、各ビートに `theory`（上映時間から算出した理論タイム）と `actual`（Geminiが抽出した実測タイム・要約）を並べて返す
- Gemini利用回数は `/api/gemini-usage` で取得し、Analyze / Mentor 別に本日使用回数と上限をUI表示する
- PWA用manifestとservice worker

## データ保存

端末間で同じデータを表示するため、アプリ本体データはSupabase Postgresに保存する。
現時点ではユーザー分離なしで、利用者2名が同じ共有データを見る前提。

- Render無料公開URL運用では Persistent Disk は使わず、Supabase無料枠のPostgresを使う
- Render環境変数に `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を設定する
- Supabase側には `app_state (key text primary key, json jsonb, updated_at timestamptz)` テーブルを用意する
- Supabase未設定のローカル開発時のみ `nscript-data.local.json`（Git管理しない）へフォールバック保存する
- Render公開URLでSupabase共有保存は動作確認済み。PCとスマホで同じデータを表示できることを確認済み
- 共有保存API: `GET /api/shared-data` / `PUT /api/shared-data`
- 共有保存データ: `movies`, `analyzeItems`, `mentorHistory`
- 旧localStorageキー `movie-shelf-items`, `reverse-beats`, `mentor-history` は初回移行元として読む
- 最後に開いていたタブ: `current-tab`（端末ごとの表示状態なのでlocalStorage）
- Gemini日次利用回数: `.gemini-usage.json`（ローカルファイル。Git管理しない）

書き出しファイルは `movie-shelf-backup-YYYYMMDD.json`（互換維持のため旧接頭辞）。
現在は映画リストと15ビート逆箱の両方を含む。

## 注意点

- Git管理済み。現在のメインラインは `main`
- 逆箱の動画ファイルは実体を保存せず、ファイル名だけ保存する
- `server.js` の映画情報取得はTMDb APIを優先し、失敗または未ヒット時だけHTMLメタデータ/JSON-LDの簡易抽出へフォールバックする
- タイトル検索はTMDb `search/movie` を優先し、未ヒット時だけ映画.comの検索結果から作品ページ候補を見つける
- TMDb APIキーは `TMDB_API_KEY` 環境変数を優先し、未設定時はアプリ内のデフォルトキーを使う
- Gemini は **Analyze** と **Mentor** で API キーを分離（`.env` の `GEMINI_ANALYZE_API_KEY` / `GEMINI_MENTOR_API_KEY`、フォールバックなし）。無料枠の1キー20回制限を避けるため、Analyzeの脚本分析リクエストとMentorの分析リクエストは別キーで運用する
- Geminiの日次ローカルカウント上限も用途別（既定各 20、`GEMINI_ANALYZE_DAILY_LIMIT` / `GEMINI_MENTOR_DAILY_LIMIT`）。`.env.example` を参照
- `.env` はローカル秘密情報として扱い、APIキー値はドキュメントやGitに記載しない
- GeminiクライアントはAnalyze/Mentor用途別に初期化し、将来モデルを使い分けられる
- Analyze用Gemini System Instructionは人格・感想・助言を排除したデータ抽出専用。出力はJSONのみで、後続のドラムロールピッカーが理論値と実測値のズレを扱える構造にする
- 15ビート理論タイムは `server.js` の `ANALYZE_BEAT_TEMPLATE` の `ratio` を正として計算する。オープニングは0.01、第一ターニングポイントは0.25、ミッドポイントは0.5、フィナーレは0.95
- TMDb URLは `themoviedb.org/movie/{id}` から映画IDを抽出する。TMDb IDが同じ映画は追加時に上書き保存する
- TMDbのポスターは `https://image.tmdb.org/t/p/w500/` を付けたフルURLで保存する
- ジャンルは取得できる場合はメタ情報から取得し、空の場合は概要文から簡易推定する
- キャストは取得できる場合、主演寄りに先頭5名まで保存する
- 公開日は取得できる場合 `YYYY-MM-DD` で保存する。公開終了日はページ内に終了表記がある場合だけ取得し、通常は手入力前提
- 作品ページURL入力は追加フォーム最上部。取得できないサイトではURLを保存し、タイトルなどは手入力する
- 映画リスト上部の集計カードは通常UIから削除済み
- 書き出し、読み込み、ブックマークレットコピーは機能コードのみ残し、通常UIからは外している
- 左ナビはDiscover / Analyze / Mentor。Settingsと左下ユーザー表示は通常UIから削除済み
- Discover上部の映画検索と追加ボタンはAnalyze画面では表示しない
- 削除確認はブラウザ標準confirmではなく、アプリ内モーダルで表示する
- service workerのキャッシュ名は `n-script-v5`。ロゴ変更など静的資産更新時はキャッシュ名も更新する

## 検証

構文確認:

```bash
node --check app.js
node --check server.js
```

表示確認:

```bash
node server.js
```

ブラウザで `http://localhost:5173/index.html` を開く。

## 次に改善しやすい箇所

- 逆箱の検索・絞り込み
- バックアップ読み込み時の確認ダイアログ
- クラウド同期
- モバイルUIの細部調整
- Createタブ（アイディアガチャ/キャラクター生成/言語化サポート）の実装
- Global Chat（常設）とMentor Contextual Chat（限定）の二層チャット実装

## 公開化ロードマップ（Webアプリ前提）

### Phase 1: Beta安定化（ローカル + 限定共有）

- Scriptの2ルート（脚本DB / Upload）は実装済み。今後は安定運用し、PDF/DOCX/PPTX抽出の失敗ケースを潰す
- MentorはMVP実装済み。今後はレポートの分析方法、外観、情報構成をチューニングする
- Global Chat（常設）とMentor内Contextual Chat（限定）を分離実装する
- 共有Supabase保存の運用確認と、複数端末同時編集時の上書きリスクを確認する
- 失敗時メッセージ、ロード状態、再試行導線などUXの最低品質を揃える

### Phase 2: 公開基盤化（認証・永続化・セキュリティ）

- ユーザー認証を導入し、映画/Analyze/Mentor/チャット履歴をユーザー単位で完全分離する
- 共有Supabase保存からユーザー認証つきサーバーDBへ拡張する（必要最小限のみクライアントキャッシュ）
- APIキー管理を本番構成に移行する（サーバー側秘密情報、環境差分管理、ローテーション）
- Upload APIにサイズ制限、形式検証、レート制限を導入する
- 本番監視（アプリログ、APIエラー率、遅延、モデル利用量）を整備する

### Phase 3: Public Betaリリース

- Mentor評価レポート（5軸 + 興行シミュレーション + GO/REWRITE/PASS）の品質を実データでチューニング
- チャットモデルの役割分離（伴走型 / 厳しめ査定）をUI・プロンプト両面で固定する
- 利用規約・プライバシーポリシー・著作物アップロード時の注意表示を整備する
- コスト管理（トークン使用量、上限、フォールバックモデル）を導入する
- ローンチ後の改善サイクル（ユーザーフィードバック→優先度付け→短期リリース）を運用開始する
