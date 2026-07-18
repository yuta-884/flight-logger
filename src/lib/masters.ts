// 空港・航空会社マスタ（OpenFlights由来、public/data に同梱）をブラウザで読み込み、
// 手入力登録の検証・距離計算・航空会社名解決に使う。API非依存・オフライン動作

export interface Airport {
  iata: string;
  name: string;
  city: string | null;
  country_code: string | null;
  country_name: string | null;
  lat: number | null;
  lon: number | null;
  tz: string | null;
}

export interface Airline {
  icao: string;
  iata: string | null;
  name: string;
  active: boolean;
}

let airportsByIata: Map<string, Airport> | null = null;
let airlinesByIata: Map<string, Airline> | null = null;
let airlinesByIcao: Map<string, Airline> | null = null;

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

// 初回アクセス時に一度だけ読み込み、以降はメモリキャッシュを返す
export async function loadMasters(): Promise<void> {
  if (airportsByIata && airlinesByIata) return;
  const [airports, airlines] = await Promise.all([
    loadJson<Airport[]>('/data/airports.json'),
    loadJson<Airline[]>('/data/airlines.json'),
  ]);
  airportsByIata = new Map(airports.map((a) => [a.iata, a]));
  airlinesByIata = new Map();
  airlinesByIcao = new Map();
  for (const a of airlines) {
    if (a.iata && !airlinesByIata.has(a.iata)) airlinesByIata.set(a.iata, a);
    if (a.icao && !airlinesByIcao.has(a.icao)) airlinesByIcao.set(a.icao, a);
  }
}

export function getAirport(iata: string): Airport | undefined {
  return airportsByIata?.get(iata.toUpperCase());
}

export function getAirlineByIata(iata: string): Airline | undefined {
  return airlinesByIata?.get(iata.toUpperCase());
}

// Flightyインポートは航空会社をICAOコードで持つため、ICAO→IATA・名称の解決に使う
export function getAirlineByIcao(icao: string): Airline | undefined {
  return airlinesByIcao?.get(icao.toUpperCase());
}

// 空港マスタから導出した国一覧（手動「行った国」のドロップダウン・国名解決用）
export interface Country {
  code: string;
  name: string | null;
}

let countryList: Country[] | null = null;
let countryNames: Map<string, string | null> | null = null;

function buildCountries(): void {
  if (countryNames) return;
  countryNames = new Map();
  for (const a of airportsByIata?.values() ?? []) {
    if (a.country_code && !countryNames.has(a.country_code)) countryNames.set(a.country_code, a.country_name);
  }
  countryList = [...countryNames.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((x, y) => (x.name ?? x.code).localeCompare(y.name ?? y.code));
}

export function listCountries(): Country[] {
  buildCountries();
  return countryList!;
}

export function getCountryName(code: string): string | null {
  buildCountries();
  return countryNames!.get(code.toUpperCase()) ?? null;
}

const EARTH_RADIUS_KM = 6371;

// 2空港間の大圏距離（Haversine）。登録時に計算して distance_km に保存する
export function haversineKm(a: Airport, b: Airport): number | null {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)));
}

// 便名（例: "ZG51", "GK 205"）をIATA航空会社コードと便番号に分解
export function parseFlightNumber(raw: string): { code: string; number: string; normalized: string } | null {
  const cleaned = raw.toUpperCase().replace(/\s+/g, '');
  const m = cleaned.match(/^([A-Z0-9]{2})\s?(\d{1,4}[A-Z]?)$/);
  if (!m) return null;
  return { code: m[1], number: m[2], normalized: `${m[1]}${m[2]}` };
}
