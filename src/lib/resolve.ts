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

// ユーザー向けの日本語メッセージ
export function resolveErrorMessage(code: ResolveError): string {
  switch (code) {
    case 'quota_daily':
      return '本日のAPI検索の上限（10回）に達しました。手入力なら登録できます。';
    case 'quota_monthly':
      return '今月のAPI検索の上限（50回）に達しました。手入力なら登録できます。';
    case 'quota_global':
      return '全体のAPI利用枠が一時的に上限です。時間をおくか、手入力で登録してください。';
    case 'not_found':
      return 'フライトが見つかりませんでした。日付を確認するか、手入力で登録してください。';
    case 'invalid_flight_number':
      return '便名の形式が正しくありません（例: ZG51）。';
    case 'invalid_flight_date':
      return '日付の形式が正しくありません。';
    case 'unauthorized':
      return 'ログインが必要です。';
    case 'upstream_error':
      return 'フライト情報サービスが応答しませんでした。時間をおいて再試行してください。';
    default:
      return '解決に失敗しました。手入力で登録してください。';
  }
}
