import { supabase } from './supabase';
import { getAirport, haversineKm } from './masters';

// フライト登録の共通処理。手入力・API解決の両方が使う。
// 距離は登録時にHaversineでローカル計算して保存（API非依存の原則）。
export interface FlightInput {
  flight_number: string;
  flight_date: string;
  airline_code: string | null;
  airline_name: string | null;
  origin_iata: string;
  destination_iata: string;
  scheduled_departure?: string | null;
  scheduled_arrival?: string | null;
  canceled?: boolean;
  source: 'api' | 'manual' | 'flighty_import';
}

export async function insertFlight(userId: string, f: FlightInput) {
  const o = getAirport(f.origin_iata);
  const d = getAirport(f.destination_iata);
  return supabase.from('flights').insert({
    user_id: userId,
    flight_number: f.flight_number,
    flight_date: f.flight_date,
    airline_code: f.airline_code,
    airline_name: f.airline_name,
    origin_iata: f.origin_iata,
    destination_iata: f.destination_iata,
    scheduled_departure: f.scheduled_departure ?? null,
    scheduled_arrival: f.scheduled_arrival ?? null,
    distance_km: o && d ? haversineKm(o, d) : null,
    canceled: f.canceled ?? false,
    source: f.source,
  });
}
