import type { Stats } from './stats';
import { fmt, flagOf } from './cardCanvas';

// 案A「夜の地球」カード。Statsページの地球儀をカードの主役に据えたポスター型。
// パスポート/書類のメタファー（MRZ・発行欄・円形国旗チップ）は一切持たない。
// 大陸はドットで表現し、アプリの地球儀と同じ見え方に揃える。

const C = {
  card: '#151827',
  cardTop: '#1b2138',
  fg: '#eef0fa',
  muted: '#8e93ad',
  row: '#232841',
  accent: '#6f96ff',
  accent2: '#3fe0d0',
  land: '#4a63b8',
  ocean: '#0d1120',
};

const EARTH_CIRCUMFERENCE_KM = 40075;
const FONT = 'system-ui, -apple-system, sans-serif';
const RAD = Math.PI / 180;

// 等長方形の陸地マスクをオフスクリーンに描き、緯度経度→陸地判定を返す
function buildLandMask(geo: any, W = 1024, H = 512): (lat: number, lon: number) => boolean {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      ctx.beginPath();
      for (const ring of poly) {
        ring.forEach(([lon, lat]: [number, number], i: number) => {
          const x = ((lon + 180) / 360) * W;
          const y = ((90 - lat) / 180) * H;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fill('evenodd');
    }
  }
  const data = ctx.getImageData(0, 0, W, H).data;
  return (lat, lon) => {
    const x = Math.floor((((lon + 180) % 360) / 360) * W);
    const y = Math.floor(((90 - lat) / 180) * H);
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    return data[(y * W + x) * 4 + 3] > 0;
  };
}

// 正射図法。裏側の点はnullを返す
function ortho(
  lat: number,
  lon: number,
  lat0: number,
  lon0: number,
  R: number,
  cx: number,
  cy: number
): [number, number] | null {
  const p = lat * RAD;
  const l = (lon - lon0) * RAD;
  const p0 = lat0 * RAD;
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  if (cosc <= 0) return null;
  const x = Math.cos(p) * Math.sin(l);
  const y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l);
  return [cx + R * x, cy - R * y];
}

function greatCirclePoints(a: { lat: number; lon: number }, b: { lat: number; lon: number }, n = 64) {
  const p1 = [Math.cos(a.lat * RAD) * Math.cos(a.lon * RAD), Math.cos(a.lat * RAD) * Math.sin(a.lon * RAD), Math.sin(a.lat * RAD)];
  const p2 = [Math.cos(b.lat * RAD) * Math.cos(b.lon * RAD), Math.cos(b.lat * RAD) * Math.sin(b.lon * RAD), Math.sin(b.lat * RAD)];
  const omega = Math.acos(Math.max(-1, Math.min(1, p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2])));
  const pts: { lat: number; lon: number }[] = [];
  if (omega === 0) return pts;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const s2 = Math.sin(t * omega) / Math.sin(omega);
    const v = [s1 * p1[0] + s2 * p2[0], s1 * p1[1] + s2 * p2[1], s1 * p1[2] + s2 * p2[2]];
    pts.push({ lon: Math.atan2(v[1], v[0]) / RAD, lat: Math.asin(v[2] / Math.hypot(...v)) / RAD });
  }
  return pts;
}

function drawGlobe(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  lat0: number,
  lon0: number,
  isLand: (lat: number, lon: number) => boolean,
  globe: Stats['globe']
) {
  // 大気のグロー
  const glow = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.35);
  glow.addColorStop(0, 'rgba(111,150,255,0.30)');
  glow.addColorStop(0.5, 'rgba(111,150,255,0.09)');
  glow.addColorStop(1, 'rgba(111,150,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2);
  ctx.fill();

  // 球体（左上から光が当たる想定の陰影）
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  const sphere = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
  sphere.addColorStop(0, '#151d38');
  sphere.addColorStop(0.6, '#0e1428');
  sphere.addColorStop(1, C.ocean);
  ctx.fillStyle = sphere;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  // 大陸のドット（画面グリッドを逆投影して陸地判定）。
  // 1点ずつ fill すると1万回超のパス生成で数秒かかるため、
  // 明度を数段階に量子化してバケットごとに1回のfillへまとめる
  const step = R / 52;
  const p0 = lat0 * RAD;
  const dotR = step * 0.34;
  const BUCKETS = 5;
  const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);
  for (let sy = cy - R; sy <= cy + R; sy += step) {
    for (let sx = cx - R; sx <= cx + R; sx += step) {
      const dx = (sx - cx) / R;
      const dy = (cy - sy) / R;
      const rho = Math.hypot(dx, dy);
      if (rho > 0.995) continue;
      const cc = Math.asin(Math.min(1, rho));
      const sinc = Math.sin(cc);
      const cosc = Math.cos(cc);
      const lat = Math.asin(cosc * Math.sin(p0) + (rho === 0 ? 0 : (dy * sinc * Math.cos(p0)) / rho)) / RAD;
      let lon = lon0 + Math.atan2(dx * sinc, rho * cosc * Math.cos(p0) - dy * sinc * Math.sin(p0)) / RAD;
      lon = ((lon + 540) % 360) - 180;
      if (!isLand(lat, lon)) continue;
      // 縁に近いほど暗く（球面感）
      const shade = 0.35 + 0.65 * Math.cos(rho * 1.35);
      const b = Math.max(0, Math.min(BUCKETS - 1, Math.floor(((shade - 0.35) / 0.65) * BUCKETS)));
      buckets[b].push(sx, sy);
    }
  }
  for (let b = 0; b < BUCKETS; b++) {
    const coords = buckets[b];
    if (!coords.length) continue;
    const shade = 0.35 + (0.65 * (b + 0.5)) / BUCKETS;
    ctx.fillStyle = `rgba(74,99,184,${(0.85 * shade).toFixed(3)})`;
    ctx.beginPath();
    for (let i = 0; i < coords.length; i += 2) {
      ctx.moveTo(coords[i] + dotR, coords[i + 1]);
      ctx.arc(coords[i], coords[i + 1], dotR, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // ルート（見えている側だけ線を繋ぐ）
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C.accent2;
  ctx.shadowColor = 'rgba(63,224,208,0.9)';
  ctx.shadowBlur = 5;
  ctx.globalAlpha = 0.75;
  for (const r of globe.routes) {
    const pts = greatCirclePoints(r.from, r.to);
    ctx.beginPath();
    let drawing = false;
    for (const p of pts) {
      const xy = ortho(p.lat, p.lon, lat0, lon0, R, cx, cy);
      if (!xy) {
        drawing = false;
        continue;
      }
      if (!drawing) {
        ctx.moveTo(xy[0], xy[1]);
        drawing = true;
      } else {
        ctx.lineTo(xy[0], xy[1]);
      }
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // 空港
  for (const a of globe.airports) {
    const xy = ortho(a.lat, a.lon, lat0, lon0, R, cx, cy);
    if (!xy) continue;
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#bcd2ff';
    ctx.shadowColor = 'rgba(111,150,255,0.9)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // 縁のリム光
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(140,180,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export interface GlobeCardInput {
  stats: Stats;
  displayName: string;
  slug: string;
  geo: any;
}

export async function renderGlobeCardPng({ stats, displayName, slug, geo }: GlobeCardInput): Promise<Blob> {
  const SCALE = 2;
  const W = 640;
  const PAD = 34;

  const flags = stats.countries.including_layovers.visits.map((v) => v.country_code);

  // 先に高さを見積もる（国旗の行数で変動）
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `21px ${FONT}`;
  const flagW = flags.map((f) => probe.measureText(flagOf(f)).width);
  const GAP = 7;
  const maxRowW = W - PAD * 2;
  const rows: number[][] = [];
  let cur: number[] = [];
  let curW = 0;
  flags.forEach((_, i) => {
    const w = flagW[i] + GAP;
    if (curW + w > maxRowW && cur.length) {
      rows.push(cur);
      cur = [];
      curW = 0;
    }
    cur.push(i);
    curW += w;
  });
  if (cur.length) rows.push(cur);

  // 国旗は増えると行が増えるので、地球儀を抑えめにして総高を元のカード程度に保つ
  const R = 150;
  const ROW_H = 26;
  const globeTop = 74;
  const globeBottom = globeTop + R * 2;
  const nameY = globeBottom + 40;
  const flagsY = nameY + 22;
  const flagsH = rows.length * ROW_H;
  const heroY = flagsY + flagsH + 44;
  const statsY = heroY + 62;
  const footerY = statsY + 60;
  const H = Math.round(footerY + 30);

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // 背景（角丸・上が明るいグラデーション）
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 26);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, C.cardTop);
  bg.addColorStop(0.55, C.card);
  bg.addColorStop(1, '#101322');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // ブランド
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 17px ${FONT}`;
  try { (ctx as any).letterSpacing = '2px'; } catch { /* 未対応ブラウザは無視 */ }
  const brand = '✈ FLIGHT LOGGER';
  const brandW = ctx.measureText(brand).width;
  const bg2 = ctx.createLinearGradient(PAD, 0, PAD + brandW, 0);
  bg2.addColorStop(0, C.accent);
  bg2.addColorStop(1, C.accent2);
  ctx.fillStyle = bg2;
  ctx.fillText(brand, PAD, PAD + 14);
  try { (ctx as any).letterSpacing = '0px'; } catch { /* noop */ }

  // 地球儀（自国＝最頻出空港を正面に）
  const home = stats.globe.airports[0];
  const isLand = buildLandMask(geo);
  drawGlobe(ctx, W / 2, globeTop + R, R, home?.lat ?? 35, home?.lon ?? 135, isLand, stats.globe);

  ctx.textAlign = 'center';

  // 表示名
  ctx.font = `700 25px ${FONT}`;
  ctx.fillStyle = C.fg;
  ctx.fillText(displayName, W / 2, nameY);

  // 国旗（円チップなし・重なりなしのフラットな行）
  ctx.font = `21px ${FONT}`;
  ctx.textAlign = 'left';
  rows.forEach((row, ri) => {
    const rowW = row.reduce((s, i) => s + flagW[i] + GAP, 0) - GAP;
    let x = (W - rowW) / 2;
    for (const i of row) {
      ctx.fillText(flagOf(flags[i]), x, flagsY + ri * ROW_H + 18);
      x += flagW[i] + GAP;
    }
  });

  ctx.textAlign = 'center';

  // ヒーロー: 総距離＋地球何周
  const kmText = fmt(stats.total_distance_km);
  ctx.font = `800 58px ${FONT}`;
  const kmW = ctx.measureText(kmText).width;
  ctx.font = `500 22px ${FONT}`;
  const unitW = ctx.measureText(' km').width;
  const startX = W / 2 - (kmW + unitW) / 2;
  ctx.textAlign = 'left';
  ctx.font = `800 58px ${FONT}`;
  const kmGrad = ctx.createLinearGradient(startX, 0, startX + kmW, 0);
  kmGrad.addColorStop(0, C.accent);
  kmGrad.addColorStop(1, C.accent2);
  ctx.fillStyle = kmGrad;
  ctx.fillText(kmText, startX, heroY);
  ctx.font = `500 22px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(' km', startX + kmW, heroY);

  ctx.textAlign = 'center';
  ctx.font = `500 14px ${FONT}`;
  ctx.fillStyle = C.muted;
  const laps = stats.total_distance_km / EARTH_CIRCUMFERENCE_KM;
  ctx.fillText(`${laps.toFixed(1)}× around the Earth`, W / 2, heroY + 24);

  // 区切り
  const div = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  div.addColorStop(0, 'rgba(111,150,255,0)');
  div.addColorStop(0.5, 'rgba(111,150,255,0.4)');
  div.addColorStop(1, 'rgba(111,150,255,0)');
  ctx.fillStyle = div;
  ctx.fillRect(PAD, statsY - 22, W - PAD * 2, 1);

  // 副次統計（Flightyと同じ4項目の並びを避け、Countriesを入れる）
  const cells: [string, string][] = [
    ['FLIGHTS', fmt(stats.total_flights)],
    ['COUNTRIES', String(stats.countries.including_layovers.count)],
    ['AIRPORTS', String(stats.airports.count)],
    ['AIRLINES', String(stats.airlines.count)],
  ];
  const colW = (W - PAD * 2) / cells.length;
  cells.forEach(([k, v], i) => {
    const x = PAD + colW * i + colW / 2;
    ctx.font = `800 26px ${FONT}`;
    ctx.fillStyle = C.fg;
    ctx.fillText(v, x, statsY + 16);
    ctx.font = `700 10px ${FONT}`;
    ctx.fillStyle = C.muted;
    try { (ctx as any).letterSpacing = '1.4px'; } catch { /* noop */ }
    ctx.fillText(k, x, statsY + 34);
    try { (ctx as any).letterSpacing = '0px'; } catch { /* noop */ }
  });

  // フッター（ユーザーID＋データ基準日）
  ctx.font = `500 11.5px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(`${slug}   ·   as of ${new Date().toISOString().slice(0, 10)}`, W / 2, footerY);

  ctx.restore();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}
