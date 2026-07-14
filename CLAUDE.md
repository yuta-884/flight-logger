# flight-logger — プロジェクト文脈

[flight-log](https://github.com/yuta-884/flight-log)（シングルユーザー版）のマルチユーザー版。友人数十名規模、固定費$0。正準仕様は `docs/flight-logger-spec.md`。

## 設計原則

- **表示・集計はAPI非依存**: AeroDataBoxは登録時の検証・補完にのみ使い、レスポンスは保存しない（利用規約対応、仕様§10）
- **事実のみ保存**: DBに持つのは事実フィールド（便名・日付・区間・航空会社・公表スケジュール）＋OpenFlightsローカル計算値（距離・国・座標）のみ。運航データ（実時刻・機体番号・ゲート/ターミナル）は保存しない。飛行時間は予定ブロックタイムで算出
- **RLSで権限強制**: 「自分の行しか読み書きできない」をDB側（Postgres RLS）で担保。公開ONのユーザーのデータのみ匿名閲覧可

## 技術構成

- フロント: Vite + React + TypeScript（SPA、SSRなし）
- バックエンド: Supabase（Auth + Postgres + RLS + Edge Functions）
- 認証: Google OAuthのみ
- ホスティング: Cloudflare Pages
- マスタ: `public/data/{airports,airlines}.json`（OpenFlights由来、`scripts/generate_masters.js` で再生成）

## 開発

- `npm run dev` — 開発サーバー（要 `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`）
- `npm run typecheck` — 型チェック
- `npm run build` — 本番ビルド
- DBスキーマ: `supabase/migrations/0001_init.sql` を Supabase SQL Editor で実行

## フェーズ（仕様§8）

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | Supabase＋Google認証＋プロフィール（slug）＋flights＋RLS＋手入力CRUD | 実装中 |
| 2 | Edge Function `resolve-flight`（AeroDataBox解決＋クォータ） | 未着手 |
| 3 | Flighty CSVインポート（クライアント処理） | 未着手 |
| 4 | 統計＋地球儀（flight-logから移植） | 未着手 |
| 5 | 公開プロフィール `/u/{slug}` ＋埋め込みカード | 未着手 |

## クォータ（§6、Phase 2で実装）

API解決のみ制限: ユーザー10回/日・50回/月、全体月500ユニット。閲覧・手入力・CSVインポートは無制限。
