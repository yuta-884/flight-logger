# flight-logger 要件・仕様書（v1.0）

flight-log（シングルユーザー版: github.com/yuta-884/flight-log）のマルチユーザー版。友人数名〜数十ユーザー規模を想定し、**固定費$0**で運用する。統計・乗り継ぎ判定の定義はflight-log仕様書（v0.16）と同一。

**MVP（Phase 1〜5）は実装済みで、本番稼働中**（2026-07-18デプロイ、§8・§9）。本書は実装済みの現行仕様を記述する。

- 本番URL: https://flight-logger.yuta-884.workers.dev
- リポジトリ: https://github.com/yuta-884/flight-logger（public。mainへのpushで自動デプロイ）

## 1. コンセプト

- 「ログ＋統計＋地球儀」に特化した個人フライトログを、**複数ユーザーがそれぞれ自分のアカウントで**使えるようにする
- あらゆるデバイスから同一アカウントで閲覧・登録できる（サーバー側にユーザーごとの永続データを持つ。ブラウザキャッシュにデータは保持しない）
- 統計の定義・地球儀・カードデザインはflight-logの成果物を流用する

## 2. 設計判断

| 論点 | 決定 |
|---|---|
| バックエンド | **Supabaseミニマム構成**: Auth + Postgres（RLS）+ Edge Functions。自前サーバーなし |
| ホスティング | **Cloudflare Workers（静的アセット）**。Workers BuildsのGit連携でmainへのpush時に自動ビルド・デプロイ。※当初はCloudflare Pagesを予定したが、現行ダッシュボードの標準であるWorkers方式を採用（無料枠・機能は同等、URLは workers.dev） |
| 認証プロバイダ | **Google OAuthのみ** |
| フロントエンド | **Vite + React + TypeScript**（SPA、SSRなし）。統計・地球儀・カードのロジックはフレームワーク非依存の純粋なTSモジュールとして移植し、クライアント側で計算 |
| 新規登録 | **オープン登録**。ただしAPI解決に回数制限（§6 クォータ設計）を設ける |
| 公開範囲 | **デフォルト非公開（本人のみ）＋任意公開**。公開ONで `/u/{slug}` と埋め込みカード `/embed/{slug}` が誰でも閲覧可 |
| データ提供元 | **AeroDataBox（RapidAPI BASIC）を登録時の解決にのみ使用**。レスポンスは保存せず、事実フィールド＋ローカル計算値のみ永続化（§11） |
| 統計・乗り継ぎ判定の定義 | flight-log v0.16と同一（出発地ローカル出発日が正準、未来便除外、滞在ベースの国カウント、同一空港・同一ローカル日付の空港タッチ集約、ゲート間ブロックタイム等）。飛行時間は公表スケジュールからの**予定ブロックタイム** |
| マスタデータ | airports.json / airlines.json（OpenFlights＋手動オーバーライド）を静的アセットとして同梱。flight-logの生成スクリプトを流用 |
| 用語（UI表記） | URL識別子 `slug` は、UI上ではすべて**「ユーザーID」**と表記する（§10）。`slug` はコード・DB内部の名称としてのみ使う |
| ランニングコスト | AeroDataBoxのみ従量。他はすべて無料枠内に収める（§7） |

## 3. アーキテクチャ

```
ブラウザ（静的サイト）
├── 認証: Supabase Auth（Google OAuth）
├── 読み書き: supabase-js → Postgres（RLSで行単位の権限強制）
├── 統計・地球儀・カード: クライアント側で計算・描画（flights取得後にstats.tsで集計）
└── フライト解決: Edge Function `resolve-flight` 経由（APIキー秘匿＋クォータ執行）
                     └→ AeroDataBox（RapidAPI）

Cloudflare Workers（静的アセット配信。SPA直リンクはwrangler.jsoncのnot_found_handlingで対応）
Supabase 1プロジェクト（Auth / Postgres / Edge Functions）
```

- **書き込み経路（API解決）**: 便名＋出発日 → Edge Function `resolve-flight` がクォータを検査し、AeroDataBoxを照会して**事実フィールドのみの候補リスト**（`Candidate[]`）を返す。複数区間が返る場合はUIで候補を選択。選択した候補は**クライアントがRLS経由で `flights` にINSERT**する（距離はクライアントが同梱マスタからHaversineで計算）
- **書き込み経路（手入力・CSV）**: クライアントから直接INSERT。API消費ゼロ
- **読み取り経路**: 自分の（公開ページでは対象ユーザーの）flightsをSELECT → クライアントで集計・描画。事前集計（stats.json相当）は行わない（〜数百件の計算は一瞬のため）
- **表示はAPI非依存**の原則: AeroDataBoxを呼ぶのは登録時のみ。統計・地球儀・カード・公開ページはDBとローカル計算だけで成立する

### 実装マップ

| モジュール | 役割 |
|---|---|
| `src/lib/stats.ts` | 統計集計（flight-log `build_stats.js` を移植。同一入力で同一出力になることを検証済み） |
| `src/lib/resolve.ts` / `src/components/ResolveForm.tsx` | API解決の呼び出しと候補選択UI |
| `src/lib/flights.ts` / `src/components/FlightForm.tsx` | 手入力登録・編集・削除 |
| `src/lib/importFlighty.ts` / `src/components/ImportFlighty.tsx` | Flighty CSVのパースと一括取込（`import_flighty.js` 移植） |
| `src/lib/slug.ts` | ユーザーIDのクライアント側検証（§10） |
| `src/lib/publicProfile.ts` | 公開プロフィール・埋め込みカードのデータ取得 |
| `src/components/Globe.tsx` / `StatCards.tsx` | 地球儀・統計カード（flight-logから移植） |
| `src/pages/` | Login / Onboarding / Flights / Stats / Settings / PublicProfile (`/u/{slug}`) / EmbedCard (`/embed/{slug}`) |
| `supabase/migrations/0001_init.sql` | スキーマ＋RLS（§4） |
| `supabase/functions/resolve-flight/` | API解決＋クォータ執行（§6） |

## 4. データモデル（Postgres）

正準は `supabase/migrations/0001_init.sql`。要約:

```sql
-- プロフィール（auth.usersと1:1、on delete cascade）
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  slug text unique not null,          -- 公開URL用ユーザーID（例: /u/yuta）
  display_name text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
  -- CHECK制約: 形式 ^[a-z][a-z0-9]*(-[a-z0-9]+)*$、3〜30文字、常に小文字（§10）
);

-- フライト（事実フィールドのみ。運航データ ops は持たない = §11）
create table flights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  flight_number text not null,        -- IATA表記に正規化（例: ZG51）
  flight_date date not null,          -- 出発地ローカルの出発日（正準日付）
  airline_code text, airline_name text,
  origin_iata text not null, destination_iata text not null,
  diverted_to_iata text,
  canceled boolean not null default false,
  scheduled_departure text, scheduled_arrival text,  -- TZなしローカルの公表スケジュール（事実）。飛行時間算出に使用
  distance_km integer,                -- 登録時にHaversineで計算
  layover boolean,                    -- null=自動判定 / true / false 手動上書き
  source text not null,               -- 'api' | 'manual' | 'flighty_import'（CHECK制約）
  flighty_id text,                    -- Flightyインポートの重複防止キー
  created_at timestamptz not null default now(),
  unique (user_id, flighty_id),
  unique (user_id, flight_date, flight_number)
);
-- index: (user_id, flight_date desc)

-- 手動追加の「行った国」（船・陸路などフライト以外の入国。0002_manual_countries.sql）
create table manual_countries (
  user_id uuid not null references profiles(id) on delete cascade,
  country_code text not null,         -- ISO 3166-1 alpha-2
  created_at timestamptz not null default now(),
  primary key (user_id, country_code)
);

-- API解決の利用ログ（クォータ執行用）
create table api_lookups (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  looked_up_at timestamptz not null default now(),
  units int not null default 1
);
-- index: (user_id, looked_up_at)
```

**RLSポリシー（実装済み）**:
- `profiles` / `flights` / `manual_countries`: 所有者（`auth.uid()`）はCRUD可
- `is_public = true` のユーザーの `profiles` / `flights` / `manual_countries` は誰でもSELECT可（匿名含む）
- `api_lookups`: ポリシーを一切付けない＝通常ロールはアクセス不可。Edge Functionのservice roleのみ読み書き（RLSバイパス）

## 5. 機能要件（すべて実装済み）

| 機能 | 内容 |
|---|---|
| 認証 | Supabase AuthのGoogle OAuthログイン。初回ログイン時にオンボーディングでユーザーIDを設定（完了までアプリ本体に進めない） |
| フライト登録（API） | 便名＋出発日を入力 → `resolve-flight` がAeroDataBoxで解決し**事実フィールドのみ**の候補を返す → 複数区間は候補から選択 → クライアントがINSERT。正規化ロジックはflight-log `add_flight.js` を移植。クォータ超過・not_found時は手入力へ誘導 |
| フライト登録（手入力） | 便名・出発/到着空港・日付を直接入力。API消費ゼロ。空港コード・便名の形式のみ検証（実在確認はAPI解決の役割） |
| Flighty CSVインポート | クライアント側でパース → 一括INSERT。API消費ゼロ。`flighty_id` で冪等（再取込しても重複しない） |
| 一覧・編集・削除 | 自分のフライトの一覧表示、`layover` 上書き・削除 |
| 統計・地球儀 | flight-logの統計ページを移植（定義同一）。データ取得先がstats.json→DBに変わるのみ |
| 公開プロフィール | 公開ONのユーザーのみ `/u/{slug}` で統計＋地球儀を匿名閲覧可。非公開・不存在は同一の「存在しないか非公開」表示 |
| 埋め込みカード | `/embed/{slug}`。公開ONのユーザーのみ。flight-logのパスポート風カード（canvas 2D世界地図・国旗・MRZ）を移植。iframeで外部サイトに埋め込む想定 |
| 設定画面 | 公開ON/OFFトグル、ユーザーID変更（旧URL失効の注意表示つき）、公開URL・埋め込みiframeコードのコピー、行った国の手動追加 |
| 行った国の手動追加 | 船・陸路などフライト以外で入国した国を設定画面から追加（国一覧は空港マスタから導出）。統計の国カウントに滞在としてマージされ、乗継のみの国に追加すると「滞在した国」へ昇格。公開ページ・埋め込みカードにも反映 |
| 多言語（日英） | ヘッダーの切替ボタンで日本語⇔英語（localStorage保存、初期値はブラウザ言語）。対象はログ画面・設定画面・オンボーディングのエラー文言。統計・公開ページ・埋め込みカード・ヘッダーのラベルは常に英語（`src/lib/i18n.tsx`） |

画面タイトルは全画面「✈ FLIGHT LOGGER」（グラデーション文字）で統一。公開ページのサブタイトルは `{表示名} · {slug}`、埋め込みカードのタグラインは `{表示名}'s Flight Stats`。

## 6. クォータ設計（オープン登録のコスト保護）

コストが発生するのは**API解決だけ**なので、制限はAPI解決のみに掛け、閲覧・手入力・CSVインポートは無制限とする。

| レイヤー | 制限（実装値） | ねらい |
|---|---|---|
| ユーザーごと | **直近24時間で10回** | 乗り継ぎの多い旅行日（4〜5便）でも困らない上限。ループ・いたずら対策 |
| ユーザーごと | **直近30日で50回** | ヘビーユーザーでも通常超えない。1ユーザーがプラン枠を食い潰すのを防ぐ |
| 全体 | **直近30日で500回**（BASIC無料=600ユニットの安全弁） | 財布の最終防衛線。超過時はAPI解決のみ停止し、手入力・CSV・閲覧は継続 |

- 執行はEdge Function内で `api_lookups` を集計してチェック（クライアント側の制限は信用しない）。ウィンドウは暦日・暦月ではなく**ローリング**（直近24h／直近30日）
- カウントは**AeroDataBox照会の前**に記録する＝解決失敗もカウントされる（失敗リトライの連打もユニットを消費するため）
- 上限到達時はエラーコード（`quota_daily` / `quota_monthly` / `quota_global`）を返し、UIで「手入力なら登録できます」と案内する

## 7. ランニングコスト

| 項目 | プラン | 月額 |
|---|---|---|
| Supabase | Free（DB 500MB / Auth 50k MAU / Edge Functions 500k回） | $0 |
| 静的ホスティング | Cloudflare Workers Free（リクエスト10万/日、ビルド3,000分/月） | $0 |
| AeroDataBox | RapidAPI BASIC（600ユニット/月） | $0 |
| **合計（数十ユーザー規模）** | | **$0** |

- 数十ユーザー×月数便＝月100〜300ユニット程度の想定でBASIC枠内
- 超えたらAPI.Market PRO（$5/月〜）等へ移行。閲覧増はコストに影響しない
- Supabase Freeプロジェクトは**7日間非アクティブで一時停止される**点に注意（定期pingのGitHub Actionsで回避可能）

## 8. 実装状況

| フェーズ | 内容 | 状況 |
|---|---|---|
| Phase 1 | Supabaseセットアップ、Auth＋プロフィール、flightsテーブル＋RLS、手入力登録・一覧・削除 | **完了**（2アカウントでデータ分離、複数デバイスで同一データを確認） |
| Phase 2 | Edge Function `resolve-flight`（AeroDataBox解決＋クォータ執行） | **完了**（実便名で登録、複数区間の候補選択、not_found時の手入力誘導を確認） |
| Phase 3 | Flighty CSVインポート | **完了**（実CSV 97便を取込、再取込0件＝冪等を確認） |
| Phase 4 | 統計＋地球儀（flight-logから移植） | **完了**（同一データでflight-logの統計出力とバイト一致を確認） |
| Phase 5 | 公開プロフィール `/u/{slug}` ＋埋め込みカード `/embed/{slug}` ＋設定画面 | **完了**（公開OFFは匿名アクセス不可、ONで匿名閲覧可を確認） |

## 9. デプロイ・運用

- **フロント**: GitHub `main` へpush → Cloudflare Workers Buildsが自動で `npm run build` → `npx wrangler deploy`。設定は `wrangler.jsonc`（`dist/` を静的アセットとして配信、`not_found_handling: "single-page-application"` で `/u/{slug}` 等の直リンクに対応）。ビルド変数 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` はCloudflare側に設定（どちらもブラウザに渡る公開値）
- **Edge Function**: `npx supabase functions deploy resolve-flight`。AeroDataBoxのAPIキーは `npx supabase secrets set` で登録（リポジトリ・クライアントには置かない）
- **DBスキーマ**: `supabase/migrations/` のSQLをSupabase SQL Editorで実行
- **認証設定**: Supabase Auth URL Configuration — Site URLは本番URL、Redirect URLsに本番URLと `http://localhost:5173`（開発用）を登録。Google OAuth側はコールバック先がSupabaseドメインのため本番URL追加時の変更不要

### 残論点

1. **既存flight-log（個人版）との関係**: 判断を保留中。本番稼働したので、使用感を確認してから併存か・個人データをflight-loggerに移行して一本化するかを決める
2. **Supabase Freeの7日非アクティブ停止対策**: 利用が疎らな期間はプロジェクトが一時停止されうる。定期ping（GitHub Actions等）の導入を検討（§7）

## 10. ユーザーID（slug）仕様

公開プロフィール `/u/{slug}` と埋め込みカード `/embed/{slug}` のURLに使う識別子。**UI上の表記は「ユーザーID」**（一般ユーザーにslugは馴染みがないため）。コード・DB・URLパス上の内部名称は `slug`。

| 論点 | 決定 |
|---|---|
| 文字種・形式 | 小文字英数字とハイフン（`[a-z0-9-]`）、先頭は英字、連続ハイフン・末尾ハイフン不可、3〜30文字。入力は小文字に正規化 |
| 一意性 | 大小無視で一意（常に小文字で格納し `unique`。DBのCHECK制約で形式・小文字を強制） |
| 予約語 | システムルートと衝突する語をブロック: `admin, api, embed, u, login, logout, settings, about, help, static, assets, public, new, edit, me, profile, flights, app, www, root, null, undefined` 等 |
| 初期設定 | **初回ログイン時にユーザーが自分で入力**（オンボーディングで必須）。設定完了までアプリ本体に進めない |
| 変更可否 | **いつでも変更可**。旧IDは即時解放され再利用可能（他人が取得しうる）。旧公開URLはリダイレクトを持たず失効する |

- 変更可のため、公開URLは「安定リンク」ではない。設定画面に「変更すると旧URLの共有が切れる」旨を注意表示
- 検証はクライアント（`src/lib/slug.ts`）で即時実施しつつ、DB制約（CHECK＋unique）で最終担保する

## 11. AeroDataBoxデータ利用ポリシー（事実のみ保存モデル）

出典: [AeroDataBox Terms of Use](https://aerodatabox.com/terms/)（2026-07-13確認）。**法的助言ではなく、条文の読み取りに基づく設計上のリスク評価**。

### 11.1 規約の要点

- **ライセンス付与（Art. 3.1）**: 許諾されるのはServicesへの「アクセスと利用」のみ。データの保存・再配布を許す文言はない
- **永続コピーの禁止（Art. 5.2.g）**: Contentsの永続的なコピー（データベース構築等）を禁止。キャッシュ・一時保存の例外条項なし
- **再配布・公開表示の禁止（Art. 5.2.i）**: Contentsの複製・再販・配布・**公開表示（publicly display）**・サブライセンスを禁止
- **帰属表示（Art. 5.2.k）**: 著作権・商標表示の削除/改変を禁止

### 11.2 設計上の保存境界

「API解決結果の永続保存」と「公開ページでの第三者表示」が上記条項と衝突しうるため、**保存するデータの境界**を次のとおり定める:

- **保存する**: フライトの**事実フィールド**（便名・日付・区間・航空会社・公表スケジュール時刻）＋**同梱OpenFlightsマスタからローカル計算した値**（距離・国・座標）。これらは公開情報の事実であり、AeroDataBox独自の作業成果ではない
- **保存しない・表示しない**: AeroDataBox独自の運航データ（実離着陸/実ゲート時刻・機体番号・ゲート/ターミナル）。APIレスポンス自体も永続化しない
- 帰属表示: API解決を使う画面でAeroDataBoxのクレジットを維持する

表示への影響は飛行時間のみ: 実測ゲート間タイムの代わりに**公表スケジュールからの予定ブロックタイム**を使う（flight-logの実データで差は約2.5%）。統計・地球儀・カードの他の全要素は事実フィールド＋ローカル計算で成立する。

### 11.3 データ提供元の選定理由

「便名＋日付→過去便の解決」「LCC網羅」「$0」を要件に主要APIを比較した結果:

| プロバイダ | 保存・公開表示の規約 | LCC網羅 | 履歴照会 | 無料枠 |
|---|---|---|---|---|
| **AeroDataBox**（採用） | ❌ 保存・公開表示禁止 → 事実のみ保存で回避 | ✅ 良好（実証済み） | ✅ 365日遡及(BASIC) | ✅ $0（600ユニット/月） |
| FlightAware AeroAPI | ✅ 保存・第三者提供可 | ✅ 良好 | ❌ 履歴はStandard($100/月〜)限定 | ❌ 履歴照会は$0不可 |
| AviationStack | △ | △ | ❌ 履歴は有料のみ | △ リアルタイムのみ |
| Amadeus Self-Service | △ | ❌ LCC非対応 | △ | テスト枠のみ |

**無料枠に365日の履歴照会が含まれるのはAeroDataBoxのみ**。規約制約は§11.2の事実のみ保存モデルで回避する。FlightAwareは規約が理想的だが履歴照会に$100/月かかり「固定費$0」と両立しない。
