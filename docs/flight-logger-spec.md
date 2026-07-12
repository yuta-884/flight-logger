# flight-logger 要件・仕様書（v0.4 ドラフト）

v0.3からの変更: AeroDataBox利用規約の本文を確認（§10）。**取得データの永続保存（DB化）と公開表示が規約で禁止**されており、現行の「API解決結果をDBに保存し公開プロフィールで表示する」設計と正面から衝突する。データ提供元と保存モデルの再設計が必要（§10.2に選択肢）。

v0.2からの変更: フロント構成を**Vite + React + TypeScript**に確定（SPA、SSRなし）。

v0.1からの変更: ホスティング先を**Cloudflare Pages**、認証プロバイダを**Googleのみ**に確定。

flight-log（シングルユーザー版: github.com/yuta-884/flight-log）のマルチユーザー版。友人数名〜数十ユーザー規模を想定し、**固定費$0**で運用する。本書はflight-log仕様書（v0.16）を基礎とし、マルチユーザー化に伴う差分を中心に定義する。

## 1. コンセプト

- 「ログ＋統計＋地球儀」に特化した個人フライトログを、**複数ユーザーがそれぞれ自分のアカウントで**使えるようにする
- あらゆるデバイスから同一アカウントで閲覧・登録できる（サーバー側にユーザーごとの永続データを持つ。ブラウザキャッシュにデータは保持しない）
- 統計の定義・地球儀・カードデザインはflight-logの成果物を流用する

## 2. 確定した設計判断

| 論点 | 決定 |
|---|---|
| バックエンド | **Supabaseミニマム構成**: Auth + Postgres（RLS）+ Edge Functions。自前サーバーなし |
| ホスティング | **Cloudflare Pages**（無料。プレビューデプロイ・帯域無制限を評価して決定） |
| 認証プロバイダ | **Google OAuthのみ**（health-webと同方針） |
| フロントエンド | **Vite + React + TypeScript**（SPA、SSRなし）。統計・地球儀・カードのロジックはフレームワーク非依存の純粋なTS/JSモジュールとして移植し、クライアント側で計算 |
| 新規登録 | **オープン登録**。ただしAPI解決に登録回数制限（§6 クォータ設計）を設ける |
| 公開範囲 | **デフォルト非公開（本人のみ）＋任意公開**。公開ONで `/u/{slug}` と埋め込みカードが誰でも閲覧可 |
| 統計・乗り継ぎ判定の定義 | flight-log v0.16と同一（出発地ローカル出発日が正準、未来便除外、滞在ベースの国カウント、同一空港・同一ローカル日付の空港タッチ集約、ゲート間ブロックタイム等） |
| マスタデータ | airports.json / airlines.json（OpenFlights＋手動オーバーライド）を静的アセットとして同梱。flight-logの生成スクリプトを流用 |
| ランニングコスト | AeroDataBoxのみ従量。他はすべて無料枠内に収める（§7） |

## 3. アーキテクチャ

```
ブラウザ（静的サイト）
├── 認証: Supabase Auth（OAuth）
├── 読み書き: supabase-js → Postgres（RLSで行単位の権限強制）
├── 統計・地球儀・カード: クライアント側で計算・描画（flights取得後にbuild_stats相当を実行）
└── フライト解決: Edge Function `resolve-flight` 経由（APIキー秘匿＋クォータ執行）
                     └→ AeroDataBox（RapidAPI）

静的ホスティング（Cloudflare Pages想定）
Supabase 1プロジェクト（Auth / Postgres / Edge Functions）
```

- **書き込み経路**: Webフォーム（便名＋出発日）→ `resolve-flight` がAeroDataBox解決→正規化して `flights` にINSERT。手入力フォールバックあり（API消費ゼロ、クライアントから直接INSERT）
- **読み取り経路**: 自分のflightsをSELECT→クライアントで集計・描画。事前集計（stats.json）は行わない（〜数百件の計算は一瞬のため）
- **表示はAPI非依存**の原則を維持: AeroDataBoxを呼ぶのは登録時のみ

## 4. データモデル（Postgres）

```sql
-- プロフィール（auth.usersと1:1）
create table profiles (
  id uuid primary key references auth.users,
  slug text unique not null,          -- 公開URL用（例: /u/yuta）
  display_name text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

-- フライト（flight-logのレコード構造をそのまま列に展開）
create table flights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  flight_number text not null,        -- IATA表記に正規化（例: ZG51）
  flight_date date not null,          -- 出発地ローカルの出発日（正準日付）
  airline_code text, airline_name text,
  origin_iata text not null, destination_iata text not null,
  diverted_to_iata text,
  canceled boolean not null default false,
  scheduled_departure text, scheduled_arrival text,  -- TZなしローカル（flight-logと同じ扱い）
  distance_km integer,                -- 登録時にHaversineで計算
  layover boolean,                    -- null=自動判定 / true / false 手動上書き
  source text not null,               -- 'api' | 'manual' | 'flighty_import'
  flighty_id text,                    -- Flightyインポートの重複防止キー
  ops jsonb,                          -- 運航データ（ターミナル・ゲート・機材・実時刻）
  created_at timestamptz not null default now(),
  unique (user_id, flighty_id),
  unique (user_id, flight_date, flight_number)
);

-- API解決の利用ログ（クォータ執行用）
create table api_lookups (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  looked_up_at timestamptz not null default now(),
  units int not null default 1
);
```

**RLSポリシー**:
- `flights` / `profiles`: 所有者はCRUD可
- `is_public = true` のユーザーの `flights` と `profiles` は誰でもSELECT可（匿名含む）
- `api_lookups`: Edge Function（service role）のみ書き込み

## 5. 機能要件

| 機能 | 内容 |
|---|---|
| 認証 | Supabase AuthのOAuthログイン。プロバイダは未確定（§9）。初回ログイン時にslugを設定 |
| フライト登録（API） | 便名＋出発日を入力 → Edge Functionが解決してINSERT。複数区間が返る場合は候補を提示して選択（flight-logの `--from` 相当をUI化）。出発ローカル日付フィルタ等の正規化ロジックはflight-log `add_flight.js` を移植 |
| フライト登録（手入力） | 便名・出発/到着空港・日付を直接入力。API消費ゼロ |
| Flighty CSVインポート | クライアント側でパース（`import_flighty.js` 移植）→ 一括INSERT。API消費ゼロ。`flighty_id` で冪等 |
| 一覧・編集・削除 | 自分のフライトの一覧表示、`layover` 上書き・削除。シングルユーザー版の「JSON直編集」に代わるUIとして必須 |
| 統計・地球儀 | flight-logの統計ページを移植（定義同一）。データ取得先がstats.json→DBに変わるのみ |
| 公開プロフィール | 公開ONのユーザーのみ `/u/{slug}` で統計＋地球儀を匿名閲覧可 |
| 埋め込みカード | `/embed/{slug}`。公開ONのユーザーのみ。デザインはflight-logのMY FLIGHT LOGカード流用 |

## 6. クォータ設計（オープン登録のコスト保護）

コストが発生するのは**API解決だけ**なので、制限はAPI解決のみに掛け、閲覧・手入力・CSVインポートは無制限とする。

| レイヤー | 制限 | ねらい |
|---|---|---|
| ユーザーごと（日次） | **10回/日** | 乗り継ぎの多い旅行日（4〜5便）でも困らない上限。ループ・いたずら対策 |
| ユーザーごと（月次） | **50回/月** | ヘビーユーザーでも通常超えない。1ユーザーがプラン枠を食い潰すのを防ぐ |
| 全体（月次） | **プラン残量ベース**（BASIC無料=600ユニットなら月500で停止） | 財布の最終防衛線。超過時はAPI解決のみ停止し、手入力・CSV・閲覧は継続 |

- 執行はEdge Function内で `api_lookups` を集計してチェック（クライアント側の制限は信用しない）
- 解決失敗もカウントする（失敗リトライの連打もユニットを消費するため）
- 上限到達時はUIで「手入力なら登録できます」と案内する

## 7. ランニングコスト

| 項目 | プラン | 月額 |
|---|---|---|
| Supabase | Free（DB 500MB / Auth 50k MAU / Edge Functions 500k回） | $0 |
| 静的ホスティング | Cloudflare Pages等の無料枠 | $0 |
| AeroDataBox | RapidAPI BASIC（600ユニット/月） | $0 |
| **合計（数十ユーザー規模）** | | **$0** |

- 数十ユーザー×月数便＝月100〜300ユニット程度の想定でBASIC枠内
- 超えたらAPI.Market PRO（$5/月〜）等へ移行。閲覧増はコストに影響しない
- Supabase Freeプロジェクトは**7日間非アクティブで一時停止される**点に注意（定期pingのGitHub Actionsで回避可能）

## 8. フェーズ分け

| フェーズ | 内容 | 完了条件 |
|---|---|---|
| Phase 1 | Supabaseセットアップ、Auth＋プロフィール、flightsテーブル＋RLS、手入力登録・一覧・削除 | 2つのアカウントで互いのデータが見えないこと、複数デバイスで同一データが見えること |
| Phase 2 | Edge Function `resolve-flight`（AeroDataBox解決＋クォータ執行） | 実便名で登録でき、上限到達時に手入力へ誘導されること |
| Phase 3 | Flighty CSVインポート（クライアント処理） | 実CSVを冪等に取り込めること |
| Phase 4 | 統計＋地球儀（flight-logから移植） | flight-logと同一データで同一の統計値になること |
| Phase 5 | 公開プロフィール `/u/{slug}` ＋埋め込みカード `/embed/{slug}` | 公開OFFでは匿名アクセス不可、ONでは閲覧できること |

## 9. 未確定事項（実装前に決める）

1. **データ提供元と保存モデル**（§10の結論を受けて最優先で決定）: 現行のAeroDataBox+DB保存設計は規約違反の懸念が強い。§10.2の選択肢から決める
2. **slugの仕様**: 文字種・変更可否・予約語（admin等）
3. **既存flight-log（個人版）との関係**: 併存か、自分のデータをflight-loggerに移行して一本化するか

## 10. AeroDataBox利用規約の確認結果（2026-07-13）

出典: [AeroDataBox Terms of Use](https://aerodatabox.com/terms/)（本文をWebFetchで確認）。**法的助言ではなく、条文の読み取りに基づく設計上のリスク評価**。

### 10.1 判明した条項

- **ライセンス付与（Art. 3.1）**: 「非独占・譲渡不可・サブライセンス不可・限定的・取消可能なライセンスで、Servicesへ**アクセスし利用する**ことを許諾する」。付与されるのは「アクセスと利用」のみで、データの保存・再配布を許す文言はない
- **永続コピーの禁止（Art. 5.2.g）**: 「本サービスを通じて提供されるContentsの**永続的なコピーを作成すること（例: スクレイピング・データマイニング・ロボット等の手段でデータベースを構築すること）**」を禁止。**キャッシュや一時保存を許す例外条項は存在しない**
- **再配布・公開表示の禁止（Art. 5.2.i）**: Contentsを「複製・翻訳・改変・二次的著作物の作成・**再販・貸与・配布・公開表示（publicly display）**・サブライセンス」することを禁止
- **第三者利用のためのサブライセンス禁止（Art. 5.2.b）**: Servicesまたは提供Contentsを「**第三者による利用のために**サブライセンスすること」を禁止。同種APIの構築も禁止
- **帰属表示（Art. 5.2.k）**: 著作権・商標表示の削除/改変を禁止（＝クレジット表示の維持義務）

### 10.2 現行設計との衝突と選択肢

**衝突点**: flight-loggerの根幹である「①API解決結果をPostgresに永続保存」「②公開プロフィール `/u/{slug}` と埋め込みカードで第三者に表示」は、①がArt. 5.2.g、②がArt. 5.2.i/5.2.b に抵触する懸念が強い。※現行のflight-log（個人版）も flights.json への永続保存という点で①に触れうるが、非公開の個人利用のため実害・露出は小さい。マルチユーザー＋公開表示で問題が顕在化する。

**論点**: 「フライトの事実（＝私が2022-07-15にZG51でNRT→BKKに搭乗した）」は事実であり著作権の対象外。規約が制限しうるのはAeroDataBoxが提供する**Contents（編集された運航データ）そのもの**。この区別が回避策の核心になる。

**選択肢**:

- **A. 事実のみ保存モデル（第一候補）**: AeroDataBoxは登録時の**検証・入力補助にのみ使い、レスポンスは保存しない**。DBに保存するのはユーザーが主張する事実（便名・出発日・出発/到着空港）と、**同梱OpenFlightsマスタからローカル計算した値**（距離・国・座標）のみ。運航データ（`ops`: ターミナル/ゲート/機材/実時刻＝Contentsそのもの）は保存も表示もしない。→ 統計・地球儀・カードはすべて成立（それらは元々ローカル計算とOpenFlights座標に依存）。総飛行時間だけは実時刻由来なので「予定所要時間のユーザー入力 or 提供しない」に降格
- **B. データ提供元の変更**: 保存・表示を許諾するライセンスのAPI/データセットに乗り換える。OpenFlightsはスケジュール便データを持たないため、便名→区間の解決には別ソースが要る（要調査・別コスト）
- **C. 書面許諾の取得**: AeroDataBoxに小規模非商用アプリとしての保存・表示許諾を問い合わせる（Art.内に「書面による事前許可」への言及あり）。可否・期間不確実
- **D. API解決を諦め、手入力＋Flighty CSVのみ**: 便名解決のAPIを使わない。OpenFlightsマスタで空港・航空会社名は解決可能。ユーザー体験は落ちるが規約問題は消滅し、コストも完全$0

**現時点の推奨**: **A**。統計系の価値（フライト数・距離・国・地球儀・カード）はローカル計算とOpenFlights座標だけで再現でき、AeroDataBoxのContentsを永続保存・公開表示しなくても成立するため、規約リスクを回避しつつ体験をほぼ維持できる。失う要素は運航データ（ops）と実測ベースの総飛行時間のみ。要ユーザー判断。
