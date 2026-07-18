-- 手動追加の「行った国」。フライト以外の入国（船・陸路など）を国カウントに反映するため。
-- 例: 香港→マカオのフェリー入国
create table manual_countries (
  user_id uuid not null references profiles(id) on delete cascade,
  country_code text not null,  -- ISO 3166-1 alpha-2（大文字）
  created_at timestamptz not null default now(),
  primary key (user_id, country_code),
  constraint country_code_format check (country_code ~ '^[A-Z]{2}$')
);

alter table manual_countries enable row level security;

-- flightsと同じ方針: 本人は追加・削除可、公開ユーザーの行は誰でも閲覧可
create policy manual_countries_select on manual_countries
  for select using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = manual_countries.user_id and p.is_public)
  );
create policy manual_countries_insert on manual_countries
  for insert with check (auth.uid() = user_id);
create policy manual_countries_delete on manual_countries
  for delete using (auth.uid() = user_id);
