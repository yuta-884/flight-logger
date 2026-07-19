import { supabase } from './supabase';

// Edge Function resolve-flight が返す事実フィールドの候補（運航データは含まない）
export interface Candidate {
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

export type ResolveError =
  | 'quota_daily'
  | 'quota_monthly'
  | 'quota_global'
  | 'not_found'
  | 'invalid_flight_number'
  | 'invalid_flight_date'
  | 'unauthorized'
  | 'upstream_error'
  | 'unknown';

export class ResolveFailure extends Error {
  constructor(public code: ResolveError) {
    super(code);
  }
}

// 便名＋出発日をEdge Function経由で解決。認証ヘッダーはinvokeが自動付与する。
// from を渡すと複数区間を出発空港で絞り込む。
export async function resolveFlight(flightNumber: string, flightDate: string, from?: string): Promise<Candidate[]> {
  const { data, error } = await supabase.functions.invoke('resolve-flight', {
    body: { flight_number: flightNumber, flight_date: flightDate, ...(from ? { from } : {}) },
  });

  // Edge Functionはアプリレベルの結果を 200 + { error } で返すので、まず data.error を見る。
  // error（非200: 認証失敗・サーバー異常など）はネットワーク/認証エラーとして扱う。
  if (error) throw new ResolveFailure('unknown');
  if (data?.error) throw new ResolveFailure(data.error as ResolveError);
  return (data?.candidates as Candidate[]) ?? [];
}

// ユーザー向けメッセージはi18n辞書（resolveErr_{code}）で解決する
