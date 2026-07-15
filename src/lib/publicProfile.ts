import { supabase } from './supabase';
import { loadMasters } from './masters';
import { computeStats, type Stats } from './stats';
import type { Flight, Profile } from './types';

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
  const { data: flights } = await supabase.from('flights').select('*').eq('user_id', profile.id);
  const stats = computeStats((flights as Flight[]) ?? []);
  return { profile: profile as Profile, stats };
}
