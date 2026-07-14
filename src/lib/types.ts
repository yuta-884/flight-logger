// DBスキーマ（supabase/migrations/0001_init.sql）に対応する型

export interface Profile {
  id: string;
  slug: string;
  display_name: string | null;
  is_public: boolean;
  created_at: string;
}

export interface Flight {
  id: string;
  user_id: string;
  flight_number: string;
  flight_date: string; // YYYY-MM-DD
  airline_code: string | null;
  airline_name: string | null;
  origin_iata: string;
  destination_iata: string;
  diverted_to_iata: string | null;
  canceled: boolean;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  distance_km: number | null;
  layover: boolean | null;
  source: 'api' | 'manual' | 'flighty_import';
  flighty_id: string | null;
  created_at: string;
}

// 新規登録時にクライアントが組み立てる入力（idやcreated_atはDB側で採番）
export type NewFlight = Omit<Flight, 'id' | 'user_id' | 'created_at'>;
