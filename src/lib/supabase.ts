import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 未設定でもアプリ起動時にクラッシュさせず、設定不足を画面で案内できるようにする
export const isSupabaseConfigured = Boolean(url && anonKey);

// 未設定時はダミーURLで生成（実呼び出し前にisSupabaseConfiguredで弾く）
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'public-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
