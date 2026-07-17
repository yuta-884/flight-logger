import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { loadPublicStats } from '../lib/publicProfile';
import type { Stats } from '../lib/stats';

// 埋め込みカード /embed/{slug}。flight-logのパスポート風カードを移植（canvasの2D世界地図）。
// iframeで外部サイトに貼る想定。全スタイルは .embed-root 配下にスコープして本体CSSと衝突させない。

const fmt = (n: number) => n.toLocaleString('en-US');
const flagOf = (cc: string) => String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
const shortDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  return `${String(d.getDate()).padStart(2, '0')} ${mon} ${String(d.getFullYear()).slice(2)}`;
};
const FILL = '<'.repeat(400);

// 等長方形図法（南極は切る）
const LAT_TOP = 84, LAT_BOTTOM = -58;
function project(lon: number, lat: number, W: number, H: number): [number, number] {
  return [((lon + 180) / 360) * W, ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H];
}
function greatCircle(a: { lat: number; lon: number }, b: { lat: number; lon: number }, n = 48) {
  const rad = Math.PI / 180;
  const p1 = [Math.cos(a.lat * rad) * Math.cos(a.lon * rad), Math.cos(a.lat * rad) * Math.sin(a.lon * rad), Math.sin(a.lat * rad)];
  const p2 = [Math.cos(b.lat * rad) * Math.cos(b.lon * rad), Math.cos(b.lat * rad) * Math.sin(b.lon * rad), Math.sin(b.lat * rad)];
  const omega = Math.acos(Math.min(1, p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]));
  const pts: { lon: number; lat: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega), s2 = Math.sin(t * omega) / Math.sin(omega);
    const v = [s1 * p1[0] + s2 * p2[0], s1 * p1[1] + s2 * p2[1], s1 * p1[2] + s2 * p2[2]];
    pts.push({ lon: Math.atan2(v[1], v[0]) / rad, lat: Math.asin(v[2] / Math.hypot(...v)) / rad });
  }
  return pts;
}

function drawMap(canvas: HTMLCanvasElement, headWidth: number, geo: any, globe: Stats['globe']) {
  const W = headWidth;
  const H = Math.round(W * 0.46);
  const dpr = devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = 'rgba(111, 150, 255, .26)';
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      ctx.beginPath();
      for (const ring of poly) {
        ring.forEach(([lon, lat]: [number, number], i: number) => {
          const [x, y] = project(lon, lat, W, H);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fill('evenodd');
    }
  }
  ctx.strokeStyle = '#3fe0d0';
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.2;
  for (const r of globe.routes) {
    const pts = greatCircle(r.from, r.to);
    ctx.beginPath();
    let prev: { lon: number } | null = null;
    for (const p of pts) {
      const [x, y] = project(p.lon, p.lat, W, H);
      if (prev && Math.abs(p.lon - prev.lon) > 180) ctx.moveTo(x, y);
      else if (prev) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      prev = p;
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const a of globe.airports) {
    const [x, y] = project(a.lon, a.lat, W, H);
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#6f96ff';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#0c1122';
    ctx.stroke();
  }
}

export function EmbedCard() {
  const { slug = '' } = useParams();
  const [stats, setStats] = useState<Stats | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLDivElement>(null);

  // iframe埋め込み用にページ背景を透過にする
  useEffect(() => {
    document.body.classList.add('embed-body');
    return () => document.body.classList.remove('embed-body');
  }, []);

  useEffect(() => {
    loadPublicStats(slug)
      .then((res) => {
        if (!res) setNotFound(true);
        else {
          setStats(res.stats);
          setDisplayName(res.profile.display_name);
        }
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  // データ取得後にcanvasの地図を描画（リサイズ対応）
  useEffect(() => {
    if (!stats || stats.total_flights === 0) return;
    let geo: any = null;
    const render = () => {
      if (geo && canvasRef.current && headRef.current) {
        drawMap(canvasRef.current, headRef.current.clientWidth, geo, stats.globe);
      }
    };
    fetch('/data/countries.geojson')
      .then((r) => r.json())
      .then((g) => {
        geo = g;
        render();
      })
      .catch(() => {});
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [stats]);

  const css = `
    .embed-root { display: flex; justify-content: center; padding: 4px; }
    .embed-root .ecard { width: 100%; max-width: 640px; position: relative; border-radius: 1.1rem; overflow: hidden;
      background: linear-gradient(155deg, color-mix(in srgb, var(--card) 88%, var(--accent)) 0%, var(--card) 45%);
      box-shadow: 0 20px 50px rgba(30,60,180,.22), 0 2px 12px rgba(0,0,0,.45); padding: 1.2rem 1.4rem 1rem; }
    .embed-root .ecard::before { content:''; position:absolute; inset:0 0 auto 0; height:1px;
      background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent2) 55%, transparent), transparent); }
    .embed-root .ehead { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:.6rem; }
    .embed-root h1 { font-size:1.35rem; font-weight:800; letter-spacing:.1em; margin:0;
      background: linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip:text; background-clip:text; color:transparent; }
    .embed-root .tagline { font-size:.66rem; font-weight:700; letter-spacing:.18em; color:var(--muted); text-transform:uppercase; }
    .embed-root canvas { display:block; width:100%; border-radius:.6rem; }
    .embed-root .eflags { text-align:center; padding:.7rem 0 .9rem; line-height:1.6; }
    .embed-root .eflags span { display:inline-block; width:1.6rem; height:1.6rem; border-radius:50%; background:var(--row);
      box-shadow:0 1px 4px rgba(0,0,0,.4); font-size:1.15rem; line-height:1.6rem; text-align:center; overflow:hidden; margin:0 -0.18rem; }
    .embed-root .edivider { height:1px; border:none; margin:0 0 1rem; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 45%, transparent), transparent); }
    .embed-root .idrow { display:flex; gap:1.6rem; align-items:flex-start; }
    .embed-root .bignum { line-height:1; }
    .embed-root .bignum .n { font-size:3.2rem; font-weight:800; letter-spacing:-.01em;
      background: linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip:text; background-clip:text; color:transparent; }
    .embed-root .bignum .u { display:block; font-size:1.5rem; color:var(--muted); font-weight:500; margin-top:.25rem; }
    .embed-root .fields { flex:1; display:grid; gap:.45rem; font-size:.9rem; padding-top:.25rem; }
    .embed-root .fields .k { color:var(--muted); font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.14em; display:block; }
    .embed-root .estats { display:flex; gap:1rem; justify-content:space-between; margin:1.2rem 0 1rem; flex-wrap:wrap; }
    .embed-root .estat .k { color:var(--muted); font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.14em; }
    .embed-root .estat .v { font-size:1.5rem; font-weight:800; }
    .embed-root .estat .v small { font-weight:500; color:var(--muted); font-size:.95rem; }
    .embed-root .mrz { border-top:1px solid var(--row); padding-top:.5rem; font-family:'Courier New', ui-monospace, monospace;
      font-weight:700; font-size:clamp(.58rem,2.3vw,.8rem); letter-spacing:.05em; color:var(--muted); }
    .embed-root .mrz .line { display:flex; white-space:nowrap; }
    .embed-root .mrz .fill { flex:1; overflow:hidden; }
    @media (max-width: 480px) {
      .embed-root .idrow { gap:1rem; } .embed-root .bignum .n { font-size:2.5rem; }
      .embed-root .bignum .u { font-size:1.2rem; } .embed-root h1 { font-size:1.05rem; } .embed-root .tagline { display:none; }
    }
  `;

  if (notFound) {
    return <div className="container"><p className="muted">このカードは存在しないか、非公開です。</p></div>;
  }
  if (!stats) return <div className="embed-root"><style>{css}</style><p className="muted">Loading…</p></div>;

  const min = stats.flight_time.total_minutes;
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const home = stats.airports.ranking[0]?.iata ?? '';
  const since = shortDate(stats.first_flight_date).replace(/ /g, '');
  const issued = shortDate(new Date().toISOString()).replace(/ /g, '');

  return (
    <div className="embed-root">
      <style>{css}</style>
      <div className="ecard">
        <div className="ehead" ref={headRef}>
          <h1>FLIGHT LOGGER</h1>
          <div className="tagline">{displayName ?? slug}'s Flight Stats</div>
        </div>
        <canvas ref={canvasRef} />
        <div className="eflags">
          {stats.countries.including_layovers.visits.map((v) => (
            <span key={v.country_code} title={v.country_name ?? v.country_code}>{flagOf(v.country_code)}</span>
          ))}
        </div>
        <hr className="edivider" />
        <div className="idrow">
          <div className="bignum"><span className="n">{fmt(stats.total_flights)}</span><span className="u">flights</span></div>
          <div className="fields">
            <div><span className="k">Home base</span> {home}</div>
            <div><span className="k">First flight</span> {shortDate(stats.first_flight_date)}</div>
            <div><span className="k">Issued</span> {shortDate(new Date().toISOString())}</div>
          </div>
        </div>
        <div className="estats">
          <div className="estat"><div className="k">Distance</div><div className="v">{fmt(stats.total_distance_km)} <small>km</small></div></div>
          <div className="estat"><div className="k">Flight Time</div><div className="v">{d}<small>d</small> {h}<small>h</small></div></div>
          <div className="estat"><div className="k">Airports</div><div className="v">{stats.airports.count}</div></div>
          <div className="estat"><div className="k">Airlines</div><div className="v">{stats.airlines.count}</div></div>
        </div>
        <div className="mrz">
          <div className="line"><span>{`ALLTIME<<<<SINCE${since}<<${stats.total_flights}FLIGHTS`}</span><span className="fill">{FILL}</span><span>{slug.toUpperCase()}</span></div>
          <div className="line"><span>{`ISSUED${issued}${home}`}</span><span className="fill">{FILL}</span><span>FLIGHT-LOG</span></div>
        </div>
      </div>
    </div>
  );
}
