-- flight-logger 初期スキーマ（仕様 §4）
-- Supabaseの SQL Editor に貼り付けて実行する。
-- 設計原則: RLS（行レベルセキュリティ）で「自分の行しか読み書きできない」をDB側で強制し、
-- 公開ONのユーザーのデータのみ匿名でも読めるようにする。

-- ── profiles: auth.users と 1:1 ───────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  slug text unique not null,
  display_name text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  -- slugは小文字英数字とハイフン、先頭英字、連続/末尾ハイフン不可、3〜30文字（§11）
  constraint slug_format check (slug ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' and char_length(slug) between 3 and 30),
  -- 大小無視の一意性: 常に小文字で格納する
  constraint slug_lowercase check (slug = lower(slug))
);

-- ── flights: 正準データ（事実フィールドのみ。運航データ ops は持たない = §10）──
create table if not exists flights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  flight_number text not null,          -- IATA表記に正規化（例: ZG51）
  flight_date date not null,            -- 出発地ローカルの出発日（正準日付）
  airline_code text,
  airline_name text,
  origin_iata text not null,
  destination_iata text not null,
  diverted_to_iata text,
  canceled boolean not null default false,
  scheduled_departure text,             -- TZなしローカルの公表スケジュール（事実）
  scheduled_arrival text,
  distance_km integer,                  -- 登録時にHaversineで計算
  layover boolean,                      -- null=自動判定 / true / false 手動上書き
  source text not null check (source in ('api', 'manual', 'flighty_import')),
  flighty_id text,                      -- Flightyインポートの重複防止キー
  created_at timestamptz not null default now(),
  unique (user_id, flighty_id),
  unique (user_id, flight_date, flight_number)
);

create index if not exists flights_user_date_idx on flights (user_id, flight_date desc);

-- ── api_lookups: AeroDataBox解決のクォータ執行用（Edge Functionのみ書き込み）──
create table if not exists api_lookups (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  looked_up_at timestamptz not null default now(),
  units int not null default 1
);

create index if not exists api_lookups_user_time_idx on api_lookups (user_id, looked_up_at);

-- ── RLS ───────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table flights enable row level security;
alter table api_lookups enable row level security;

-- profiles: 本人は全操作可、公開プロフィールは誰でも閲覧可
create policy profiles_select on profiles
  for select using (auth.uid() = id or is_public = true);
create policy profiles_insert on profiles
  for insert with check (auth.uid() = id);
create policy profiles_update on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_delete on profiles
  for delete using (auth.uid() = id);

-- flights: 本人は全操作可、公開ユーザーのフライトは誰でも閲覧可
create policy flights_select on flights
  for select using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = flights.user_id and p.is_public)
  );
create policy flights_insert on flights
  for insert with check (auth.uid() = user_id);
create policy flights_update on flights
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy flights_delete on flights
  for delete using (auth.uid() = user_id);

-- api_lookups: 通常ロールにはポリシーを付けない（= 一切アクセス不可）。
-- Edge Function の service role キーは RLS をバイパスするため書き込み・集計できる。
