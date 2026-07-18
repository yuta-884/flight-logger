import { supabase } from './supabase';
import { getCountryName, loadMasters } from './masters';
import { computeStats, type Stats } from './stats';
import type { Flight, Profile } from './types';

// 手動追加の「行った国」を取得。エラー時（テーブル未作成など）は空扱いにして画面を壊さない。
// 呼び出し前に loadMasters() が完了していること（国名解決に使う）。
export async function loadManualCountries(userId: string): Promise<{ code: string; name: string | null }[]> {
  const { data } = await supabase
    .from('manual_countries')
    .select('country_code')
    .eq('user_id', userId)
    .order('created_at');
  return (data ?? []).map((r) => ({ code: r.country_code, name: getCountryName(r.country_code) }));
}

// 公開プロフィール（/u/{slug}・/embed/{slug}）用のデータ取得。
// RLSにより、匿名では is_public=true のプロフィールとそのフライトのみ返る。
// 本人が自分のslugを見る場合は非公開でも取得できる（プレビュー用途）。
export async function loadPublicStats(slug: string): Promise<{ profile: Profile; stats: Stats } | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('slug', slug.toLowerCase())
    .maybeSingle();
  if (!profile) return null; // 存在しない or 非公開

  await loadMasters();
  const [{ data: flights }, extraCountries] = await Promise.all([
    supabase.from('flights').select('*').eq('user_id', profile.id),
    loadManualCountries(profile.id),
  ]);
  const stats = computeStats((flights as Flight[]) ?? [], undefined, extraCountries);
  return { profile: profile as Profile, stats };
}
