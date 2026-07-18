import type { Stats } from '../lib/stats';

const fmt = (n: number) => n.toLocaleString('en-US');
// ISO 3166-1 alpha-2 → 絵文字国旗
const flagOf = (cc: string) => String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

// flight-log の統計ページ構成を移植:
// 1段目 距離・飛行時間 / 2段目 Flights(年別)・Airports・Airlines / 最下部 行った国
// 距離の換算基準: 地球一周（赤道円周）/ 月までの平均距離 / 太陽一周（太陽の円周）
const EARTH_CIRCUMFERENCE_KM = 40075;
const MOON_DISTANCE_KM = 384400;
const SUN_CIRCUMFERENCE_KM = 4379000;

export function StatCards({ stats }: { stats: Stats }) {
  const min = stats.flight_time.total_minutes;
  const days = min / 1440;
  const km = stats.total_distance_km;
  const visitedExcl = new Set(stats.countries.excluding_layovers.visits.map((v) => v.country_code));
  const years = Object.entries(stats.flights_by_year).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <div className="cards two">
        <div className="card">
          <h2>Distance</h2>
          <div className="big">{fmt(stats.total_distance_km)}<span className="unit"> km</span></div>
          <div className="conversions">
            <span>{(km / EARTH_CIRCUMFERENCE_KM).toFixed(1)}x Around Earth</span>
            <span>{(km / MOON_DISTANCE_KM).toFixed(1)}x To the Moon</span>
            <span>{(km / SUN_CIRCUMFERENCE_KM).toFixed(2)}x Around the Sun</span>
          </div>
        </div>
        <div className="card">
          <h2>Flight Time</h2>
          <div className="big">{fmt(Math.floor(min / 60))}<span className="unit">h</span> {min % 60}<span className="unit">m</span></div>
          <div className="conversions">
            <span>{days.toFixed(1)} Days</span>
            <span>{(days / 7).toFixed(1)} Weeks</span>
            <span>{(days / 30.44).toFixed(1)} Months</span>
            <span>{(days / 365.25).toFixed(2)} Years</span>
          </div>
        </div>
      </div>

      <div className="cards three">
        <div className="card">
          <h2>Flights</h2>
          <div className="big">{fmt(stats.total_flights)}</div>
          <table>
            <thead><tr><th>Year</th><th>Flights</th><th>Distance (km)</th></tr></thead>
            <tbody>
              {years.map(([y, v]) => (
                <tr key={y}><td>{y}</td><td>{v.flights}</td><td>{fmt(v.distance_km)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Airports</h2>
          <div className="big">{stats.airports.count}</div>
          <table>
            <thead><tr><th>Airport</th><th>Visits</th></tr></thead>
            <tbody>
              {stats.airports.ranking.slice(0, 5).map((a) => (
                <tr key={a.iata}><td><strong>{a.iata}</strong></td><td>{a.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Airlines</h2>
          <div className="big">{stats.airlines.count}</div>
          <table>
            <thead><tr><th>Airline</th><th>Flights</th></tr></thead>
            <tbody>
              {stats.airlines.ranking.slice(0, 5).map((a) => (
                <tr key={a.code}><td><strong>{a.code}</strong> {a.name ?? ''}</td><td>{a.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.1rem' }}>
        <h2>Countries &amp; Territories</h2>
        <div className="pair">
          <div><div className="big">{stats.countries.excluding_layovers.count}</div><div className="label">Excl. layovers</div></div>
          <div><div className="big">{stats.countries.including_layovers.count}</div><div className="label">Incl. layovers</div></div>
        </div>
        <div className="flags">
          {stats.countries.including_layovers.visits.map((v) => (
            <span
              key={v.country_code}
              className={visitedExcl.has(v.country_code) ? '' : 'transit'}
              data-name={v.country_name ?? v.country_code}
              aria-label={v.country_name ?? v.country_code}
            >
              {flagOf(v.country_code)}
            </span>
          ))}
        </div>
        <div className="legend">Dimmed flags are layover-only</div>
      </div>
    </>
  );
}
