// flight-log の build_stats.js をクライアント側に忠実移植（仕様§3.2）。
// 同一データで同一の統計値になることが要件。集計ルール:
// - canceled=true と未来便（flight_date > 集計日UTC）は全統計から除外
// - diverted_to_iata があれば距離・国カウントの実効到着地
// - 国は「滞在」モデルでカウント（往復1回=滞在1回）
// - 乗り継ぎ: 同一空港・24h以内の接続。layoverフラグで手動上書き
// - 飛行時間は公表スケジュールからの予定ブロックタイム（tzでUTC換算）
// - 空港タッチは同一空港・同一ローカル日付で1カウントに集約

import type { Airport } from './masters';
import { getAirport as defaultGetAirport } from './masters';
import type { Flight } from './types';

const LAYOVER_THRESHOLD_HOURS = 24;

export interface CountryVisit {
  country_code: string;
  country_name: string | null;
  visits: number;
}
export interface Ranked {
  iata: string;
  count: number;
}
export interface AirlineRanked {
  code: string;
  name: string | null;
  count: number;
}
export interface GlobeRoute {
  from: { iata: string; lat: number; lon: number };
  to: { iata: string; lat: number; lon: number };
  count: number;
}
export interface Stats {
  counted_through: string;
  total_flights: number;
  first_flight_date: string | null;
  flights_by_year: Record<string, { flights: number; distance_km: number }>;
  countries: {
    including_layovers: { count: number; visits: CountryVisit[] };
    excluding_layovers: { count: number; visits: CountryVisit[] };
  };
  total_distance_km: number;
  flight_time: { total_minutes: number; flights_counted: number };
  airports: { count: number; ranking: Ranked[] };
  airlines: { count: number; ranking: AirlineRanked[] };
  globe: { airports: (Ranked & { lat: number; lon: number })[]; routes: GlobeRoute[] };
}

type GetAirport = (iata: string) => Airport | undefined;

export function computeStats(
  allFlights: Flight[],
  getAirport: GetAirport = defaultGetAirport,
  // 手動追加の「行った国」（船・陸路などフライト以外の入国）。滞在扱いで国カウントにマージする
  extraCountries: { code: string; name: string | null }[] = []
): Stats {
  const today = new Date().toISOString().slice(0, 10);
  const flights = allFlights
    .filter((f) => !f.canceled && f.flight_date <= today)
    .sort(
      (a, b) =>
        a.flight_date.localeCompare(b.flight_date) ||
        String(a.scheduled_departure ?? '').localeCompare(String(b.scheduled_departure ?? ''))
    );

  const effDest = (f: Flight) => f.diverted_to_iata || f.destination_iata;

  const countryOf = (iata: string): { code: string; name: string | null } | null => {
    const a = getAirport(iata);
    if (!a?.country_code) return null;
    return { code: a.country_code, name: a.country_name };
  };

  const parseNaive = (s: string | null | undefined) => (s ? Date.parse(`${s}:00Z`) : null);

  const isConnection = (f: Flight, next: Flight | null): boolean => {
    if (!next || next.origin_iata !== effDest(f)) return false;
    const arr = parseNaive(f.scheduled_arrival);
    const dep = parseNaive(next.scheduled_departure);
    if (arr !== null && dep !== null) {
      const hours = (dep - arr) / 3600000;
      return hours >= 0 && hours <= LAYOVER_THRESHOLD_HOURS;
    }
    const dayDiff = (Date.parse(next.flight_date) - Date.parse(f.flight_date)) / 86400000;
    return dayDiff <= 1;
  };

  const isLayoverStay = (f: Flight, next: Flight | null): boolean => {
    if (f.layover !== null) return f.layover;
    return isConnection(f, next);
  };

  // 滞在リスト
  const stays: { country: { code: string; name: string | null } | null; layover: boolean }[] = [];
  if (flights.length > 0) {
    stays.push({ country: countryOf(flights[0].origin_iata), layover: false });
  }
  for (let i = 0; i < flights.length; i++) {
    const f = flights[i];
    const next = flights[i + 1] ?? null;
    if (i > 0 && f.origin_iata !== effDest(flights[i - 1])) {
      stays.push({ country: countryOf(f.origin_iata), layover: false });
    }
    stays.push({ country: countryOf(effDest(f)), layover: isLayoverStay(f, next) });
  }

  // 飛行時間（予定ブロックタイム、tzでUTC換算）
  const tzCache = new Map<string, Intl.DateTimeFormat>();
  const localToUtcMs = (naive: string, tz: string): number => {
    let dtf = tzCache.get(tz);
    if (!dtf) {
      dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
      tzCache.set(tz, dtf);
    }
    const guess = Date.parse(`${naive}:00Z`);
    const p = Object.fromEntries(dtf.formatToParts(new Date(guess)).map((x) => [x.type, x.value])) as Record<string, string>;
    const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - guess;
    return guess - offset;
  };
  const flightMinutes = (f: Flight): number | null => {
    const oTz = getAirport(f.origin_iata)?.tz;
    const dTz = getAirport(effDest(f))?.tz;
    if (!oTz || !dTz) return null;
    const dep = f.scheduled_departure, arr = f.scheduled_arrival;
    if (dep && arr) {
      const min = Math.round((localToUtcMs(arr, dTz) - localToUtcMs(dep, oTz)) / 60000);
      if (min > 0 && min < 20 * 60) return min;
    }
    return null;
  };

  let totalFlightMinutes = 0;
  let flightTimeCounted = 0;
  for (const f of flights) {
    const min = flightMinutes(f);
    if (min !== null) {
      totalFlightMinutes += min;
      flightTimeCounted++;
    }
  }

  // 空港タッチ（同一空港・同一ローカル日付で集約）/ 航空会社便数
  const airportDays = new Map<string, Set<string>>();
  const airlineCounts = new Map<string, AirlineRanked>();
  for (const f of flights) {
    const touches: [string, string][] = [
      [f.origin_iata, f.flight_date],
      [effDest(f), (f.scheduled_arrival ?? f.flight_date).slice(0, 10)],
    ];
    for (const [iata, date] of touches) {
      if (!airportDays.has(iata)) airportDays.set(iata, new Set());
      airportDays.get(iata)!.add(date);
    }
    if (f.airline_code) {
      const cur = airlineCounts.get(f.airline_code) ?? { code: f.airline_code, name: f.airline_name, count: 0 };
      cur.count++;
      airlineCounts.set(f.airline_code, cur);
    }
  }
  const airportRanking = [...airportDays.entries()]
    .map(([iata, days]) => ({ iata, count: days.size }))
    .sort((a, b) => b.count - a.count || a.iata.localeCompare(b.iata));
  const airlineRanking = [...airlineCounts.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  // 国別滞在回数（含む／除く）
  const countryVisits = (includeLayovers: boolean): CountryVisit[] => {
    const visits = new Map<string, CountryVisit>();
    for (const s of stays) {
      if (!s.country || (!includeLayovers && s.layover)) continue;
      const cur = visits.get(s.country.code) ?? { country_code: s.country.code, country_name: s.country.name, visits: 0 };
      cur.visits++;
      visits.set(s.country.code, cur);
    }
    return [...visits.values()].sort((a, b) => b.visits - a.visits || a.country_code.localeCompare(b.country_code));
  };
  const visitsIncl = countryVisits(true);
  const visitsExcl = countryVisits(false);

  // 手動追加の国をマージ。フライト由来で既にある場合は何もしない
  // （乗継のみの国に手動追加すると「滞在した国」へ昇格する）
  const byVisits = (a: CountryVisit, b: CountryVisit) =>
    b.visits - a.visits || a.country_code.localeCompare(b.country_code);
  for (const c of extraCountries) {
    for (const list of [visitsIncl, visitsExcl]) {
      if (!list.some((v) => v.country_code === c.code)) {
        list.push({ country_code: c.code, country_name: c.name, visits: 1 });
      }
    }
  }
  visitsIncl.sort(byVisits);
  visitsExcl.sort(byVisits);

  // 地球儀ルート（無向で集約、座標を焼き込み）
  const routeMap = new Map<string, GlobeRoute>();
  for (const f of flights) {
    const [a, b] = [f.origin_iata, effDest(f)].sort();
    const key = `${a}-${b}`;
    const cur = routeMap.get(key);
    if (cur) {
      cur.count++;
      continue;
    }
    const o = getAirport(f.origin_iata);
    const d = getAirport(effDest(f));
    if (!o || !d || o.lat == null || o.lon == null || d.lat == null || d.lon == null) continue;
    routeMap.set(key, {
      from: { iata: f.origin_iata, lat: o.lat, lon: o.lon },
      to: { iata: effDest(f), lat: d.lat, lon: d.lon },
      count: 1,
    });
  }
  const globeAirports = airportRanking
    .map(({ iata, count }) => {
      const a = getAirport(iata);
      return a?.lat != null && a.lon != null ? { iata, lat: a.lat, lon: a.lon, count } : null;
    })
    .filter((x): x is Ranked & { lat: number; lon: number } => x !== null);

  // 年別内訳
  const byYear: Record<string, { flights: number; distance_km: number }> = {};
  for (const f of flights) {
    const y = f.flight_date.slice(0, 4);
    byYear[y] ??= { flights: 0, distance_km: 0 };
    byYear[y].flights++;
    byYear[y].distance_km += f.distance_km ?? 0;
  }
  const totalDistance = Object.values(byYear).reduce((s, y) => s + y.distance_km, 0);

  return {
    counted_through: today,
    total_flights: flights.length,
    first_flight_date: flights[0]?.flight_date ?? null,
    flights_by_year: byYear,
    countries: {
      including_layovers: { count: visitsIncl.length, visits: visitsIncl },
      excluding_layovers: { count: visitsExcl.length, visits: visitsExcl },
    },
    total_distance_km: totalDistance,
    flight_time: { total_minutes: totalFlightMinutes, flights_counted: flightTimeCounted },
    airports: { count: airportRanking.length, ranking: airportRanking },
    airlines: { count: airlineRanking.length, ranking: airlineRanking },
    globe: { airports: globeAirports, routes: [...routeMap.values()] },
  };
}
