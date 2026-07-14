// resolve-flight — 便名＋出発日をAeroDataBoxで解決し、事実フィールドのみを返す。
// 設計原則（仕様§10）:
//   - APIキーはこのEdge Function内のシークレットにだけ置く（クライアントに露出しない）
//   - レスポンスの運航データ（実時刻・機体番号・ゲート/ターミナル）は返さない・保存させない。
//     返すのは事実（区間・航空会社・公表スケジュール）のみ
//   - クォータをサーバー側で執行（api_lookups をservice roleで集計・記録）
//
// 環境変数（Supabaseのシークレット）:
//   AERODATABOX_API_KEY  — RapidAPIのX-RapidAPI-Key
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — Supabaseが自動注入
//
// デプロイ: supabase functions deploy resolve-flight
//   （＋ supabase secrets set AERODATABOX_API_KEY=... ）

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── クォータ設定（仕様§6）──────────────────────────────
const PER_USER_DAILY = 10; // 直近24h
const PER_USER_MONTHLY = 50; // 直近30日
const GLOBAL_MONTHLY = 500; // 全体・直近30日（AeroDataBox BASIC 600ユニットの安全弁）

const RAPIDAPI_HOST = 'aerodatabox.p.rapidapi.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// TZオフセット付きローカル時刻を、オフセットを捨てたナイーブ文字列 "YYYY-MM-DDTHH:MM" にする
function normalizeLocalTime(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : null;
}

interface Candidate {
  flight_number: string;
  flight_date: string;
  airline_code: string | null;
  airline_name: string | null;
  origin_iata: string;
  destination_iata: string;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  canceled: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('AERODATABOX_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !supabaseUrl || !serviceKey) return json({ error: 'server_misconfigured' }, 500);

  // ── 認証: クライアントが送るJWTからユーザーを特定 ──
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  // ── 入力 ──
  let payload: { flight_number?: string; flight_date?: string; from?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const flightNumber = (payload.flight_number ?? '').toUpperCase().replace(/\s+/g, '');
  const flightDate = payload.flight_date ?? '';
  if (!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(flightNumber)) return json({ error: 'invalid_flight_number' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(flightDate)) return json({ error: 'invalid_flight_date' }, 400);

  // ── クォータ執行（service roleでRLSをバイパスして集計）──
  const admin = createClient(supabaseUrl, serviceKey);
  const now = Date.now();
  const since24h = new Date(now - 24 * 3600 * 1000).toISOString();
  const since30d = new Date(now - 30 * 24 * 3600 * 1000).toISOString();

  const [dailyRes, monthlyRes, globalRes] = await Promise.all([
    admin.from('api_lookups').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('looked_up_at', since24h),
    admin.from('api_lookups').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('looked_up_at', since30d),
    admin.from('api_lookups').select('id', { count: 'exact', head: true }).gte('looked_up_at', since30d),
  ]);
  if ((dailyRes.count ?? 0) >= PER_USER_DAILY) return json({ error: 'quota_daily', limit: PER_USER_DAILY }, 429);
  if ((monthlyRes.count ?? 0) >= PER_USER_MONTHLY) return json({ error: 'quota_monthly', limit: PER_USER_MONTHLY }, 429);
  if ((globalRes.count ?? 0) >= GLOBAL_MONTHLY) return json({ error: 'quota_global' }, 429);

  // ── AeroDataBox呼び出し。失敗リトライ連打もユニットを消費するため、成否に関わらず記録する ──
  await admin.from('api_lookups').insert({ user_id: user.id, units: 1 });

  const url = `https://${RAPIDAPI_HOST}/flights/number/${encodeURIComponent(flightNumber)}/${flightDate}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': RAPIDAPI_HOST } });
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }
  if (res.status === 404) return json({ error: 'not_found' }, 404);
  if (!res.ok) return json({ error: 'upstream_error', status: res.status }, 502);

  let legs: any = await res.json();
  if (!Array.isArray(legs)) legs = [legs];
  legs = legs.filter((l: any) => l?.departure?.airport?.iata && l?.arrival?.airport?.iata);

  // 出発ローカル日付が一致する区間に絞る（深夜便で前日発が混ざる問題への対処）
  const sameDay = legs.filter((l: any) =>
    normalizeLocalTime(l.departure.scheduledTime?.local)?.startsWith(flightDate)
  );
  if (sameDay.length > 0) legs = sameDay;

  // 出発地指定（複数区間の絞り込み）
  if (payload.from) {
    const from = payload.from.toUpperCase();
    legs = legs.filter((l: any) => l.departure.airport.iata === from);
  }

  if (legs.length === 0) return json({ error: 'not_found' }, 404);

  // ── 事実フィールドのみ抽出（運航データは含めない）──
  const candidates: Candidate[] = legs.map((leg: any) => ({
    flight_number: flightNumber,
    flight_date: flightDate,
    airline_code: leg.airline?.iata ?? flightNumber.slice(0, 2),
    airline_name: leg.airline?.name ?? null,
    origin_iata: leg.departure.airport.iata,
    destination_iata: leg.arrival.airport.iata,
    scheduled_departure: normalizeLocalTime(leg.departure.scheduledTime?.local),
    scheduled_arrival: normalizeLocalTime(leg.arrival.scheduledTime?.local),
    canceled: leg.status === 'Canceled',
  }));

  return json({ candidates });
});
