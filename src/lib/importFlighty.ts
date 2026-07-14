import Papa from 'papaparse';
import { getAirport, getAirlineByIcao, haversineKm } from './masters';

// Flighty CSV → 事実フィールドのみのフライトレコードに変換（仕様§10: 運航データは取り込まない）。
// FlightyのAirlineはICAOコード（例: TZP）なのでマスタでIATA・名称に解決する。

export interface ParsedFlight {
  flight_number: string;
  flight_date: string;
  airline_code: string | null;
  airline_name: string | null;
  origin_iata: string;
  destination_iata: string;
  diverted_to_iata: string | null;
  canceled: boolean;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  distance_km: number | null;
  source: 'flighty_import';
  flighty_id: string;
}

export interface ParseResult {
  flights: ParsedFlight[];
  warnings: string[];
  total: number;
}

// TZオフセットを捨てたナイーブ文字列 "YYYY-MM-DDTHH:MM" にする
function normalizeLocalTime(s: string | undefined): string | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : null;
}

const empty = (v: string | undefined): string | null => (v && v.trim() !== '' ? v.trim() : null);

export function parseFlightyCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const flights: ParsedFlight[] = [];
  const warnings: string[] = [];

  for (const row of parsed.data) {
    const flightyId = empty(row['Flight Flighty ID']);
    const date = empty(row['Date']);
    const from = empty(row['From'])?.toUpperCase();
    const to = empty(row['To'])?.toUpperCase();
    // 必須の事実（一意ID・日付・区間）が欠けた行はスキップ
    if (!flightyId || !date || !from || !to) {
      warnings.push(`必須項目が欠けた行をスキップしました（${empty(row['Flight']) ?? '?'} ${date ?? ''}）`);
      continue;
    }

    const icao = empty(row['Airline']);
    const airline = icao ? getAirlineByIcao(icao) : undefined;
    const iataCode = airline?.iata ?? null;
    const flightNum = empty(row['Flight']) ?? '';
    // 便名はIATA表記に正規化（解決できない場合はICAOのまま）
    const flight_number = `${iataCode ?? icao ?? ''}${flightNum}`.toUpperCase();

    const diverted = empty(row['Diverted To'])?.toUpperCase() ?? null;
    const origin = getAirport(from);
    const effDest = getAirport(diverted ?? to); // ダイバート時は実効到着地で距離計算
    if (!origin) warnings.push(`空港 ${from} がマスタに見つかりません（${flight_number}）`);
    if (!effDest) warnings.push(`空港 ${diverted ?? to} がマスタに見つかりません（${flight_number}）`);

    flights.push({
      flight_number,
      flight_date: date,
      airline_code: iataCode,
      airline_name: airline?.name ?? null,
      origin_iata: from,
      destination_iata: to,
      diverted_to_iata: diverted,
      canceled: String(row['Canceled']).toLowerCase() === 'true',
      scheduled_departure: normalizeLocalTime(row['Gate Departure (Scheduled)']),
      scheduled_arrival: normalizeLocalTime(row['Gate Arrival (Scheduled)']),
      distance_km: origin && effDest ? haversineKm(origin, effDest) : null,
      source: 'flighty_import',
      flighty_id: flightyId,
    });
  }

  return { flights, warnings, total: parsed.data.length };
}
