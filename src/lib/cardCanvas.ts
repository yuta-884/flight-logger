import type { Stats } from './stats';

// 共有カード（飛行日誌）の描画。画面表示もダウンロードも同じ関数で描くため、
// 見た目が食い違うことがない。
// - drawCardOnCanvas: 渡されたcanvasに描く（画面表示用。PNG符号化しないぶん速い）
// - renderCardPng:    オフスクリーンに2倍解像度で描いてPNG化（ダウンロード用）
// DOMキャプチャ系ライブラリはiOS Safariで白画像になる既知問題があるため使わない。

export const fmt = (n: number) => n.toLocaleString('en-US');
export const flagOf = (cc: string) =>
  String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const C = {
  card: '#151827',
  cardTop: '#1b2138',
  fg: '#eef0fa',
  muted: '#8e93ad',
  row: '#232841',
  accent: '#6f96ff',
  accent2: '#3fe0d0',
};

const FONT = 'system-ui, -apple-system, sans-serif';
const EARTH_CIRCUMFERENCE_KM = 40075;
const CARD_W = 640;
const PAD = 34;
const ROW_H = 27;

// ── 世界地図（等長方形図法。南極は切る） ──
const LAT_TOP = 84;
const LAT_BOTTOM = -58;

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
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const s2 = Math.sin(t * omega) / Math.sin(omega);
    const v = [s1 * p1[0] + s2 * p2[0], s1 * p1[1] + s2 * p2[1], s1 * p1[2] + s2 * p2[2]];
    pts.push({ lon: Math.atan2(v[1], v[0]) / rad, lat: Math.asin(v[2] / Math.hypot(...v)) / rad });
  }
  return pts;
}

// (0,0)-(W,H) に大陸・ルート・空港を描く。呼び出し側でtranslate済みであること
export function drawMapScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  geo: any,
  globe: Stats['globe']
): void {
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
  ctx.strokeStyle = C.accent2;
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
    ctx.fillStyle = C.accent;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#0c1122';
    ctx.stroke();
  }
}

// ── カード本体 ──

export interface CardInput {
  stats: Stats;
  displayName: string;
  slug: string;
  geo: any;
}

const flightTime = (min: number) => `${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h`;

// 高さは年の行数で変わるので、描画前にレイアウトを確定させる
function layout(stats: Stats) {
  const IW = CARD_W - PAD * 2;
  const mapH = Math.round(IW * 0.46);
  const years = Object.entries(stats.flights_by_year).sort((a, b) => b[0].localeCompare(a[0]));
  const mapTop = 104;
  const ledgerTop = mapTop + mapH + 26;
  const rowsTop = ledgerTop + 22;
  const totalTop = rowsTop + years.length * ROW_H + 10;
  const subTop = totalTop + 52;
  const footerY = subTop + 40;
  return { IW, mapH, years, mapTop, ledgerTop, rowsTop, totalTop, subTop, footerY, H: Math.round(footerY + 24) };
}

function paint(ctx: CanvasRenderingContext2D, { stats, displayName, slug, geo }: CardInput) {
  const L = layout(stats);
  const W = CARD_W;

  // 背景（角丸。外側は透過のまま）
  ctx.beginPath();
  ctx.roundRect(0, 0, W, L.H, 26);
  const bg = ctx.createLinearGradient(0, 0, 0, L.H);
  bg.addColorStop(0, C.cardTop);
  bg.addColorStop(0.55, C.card);
  bg.addColorStop(1, '#101322');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.textBaseline = 'alphabetic';

  const spacing = (v: string) => {
    try {
      (ctx as any).letterSpacing = v;
    } catch {
      /* 未対応ブラウザは無視 */
    }
  };

  // ブランド（グラデーション文字）と LOGBOOK ラベル
  ctx.font = `800 17px ${FONT}`;
  spacing('2px');
  const brand = '✈ FLIGHT LOGGER';
  const brandW = ctx.measureText(brand).width;
  const bGrad = ctx.createLinearGradient(PAD, 0, PAD + brandW, 0);
  bGrad.addColorStop(0, C.accent);
  bGrad.addColorStop(1, C.accent2);
  ctx.fillStyle = bGrad;
  ctx.textAlign = 'left';
  ctx.fillText(brand, PAD, PAD + 14);
  ctx.textAlign = 'right';
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText('LOGBOOK', W - PAD, PAD + 14);
  spacing('0px');

  // 氏名（左）とユーザーID（右）
  ctx.textAlign = 'left';
  ctx.font = `700 23px ${FONT}`;
  ctx.fillStyle = C.fg;
  ctx.fillText(displayName, PAD, PAD + 52);
  ctx.textAlign = 'right';
  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(slug, W - PAD, PAD + 52);

  // 航路図。背景は塗らずカード地をそのまま見せる
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD, L.mapTop, L.IW, L.mapH);
  ctx.clip();
  ctx.translate(PAD, L.mapTop);
  drawMapScene(ctx, L.IW, L.mapH, geo, stats.globe);
  ctx.restore();

  // 台帳の見出し
  const colYear = PAD;
  const colFlights = PAD + L.IW * 0.52;
  const colKm = W - PAD;
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = C.muted;
  spacing('1.4px');
  ctx.textAlign = 'left';
  ctx.fillText('YEAR', colYear, L.ledgerTop);
  ctx.textAlign = 'right';
  ctx.fillText('FLIGHTS', colFlights, L.ledgerTop);
  ctx.fillText('DISTANCE (KM)', colKm, L.ledgerTop);
  spacing('0px');
  ctx.fillStyle = C.row;
  ctx.fillRect(PAD, L.ledgerTop + 8, L.IW, 1);

  // 年ごとの行
  L.years.forEach(([y, v], i) => {
    const baseline = L.rowsTop + i * ROW_H + 14;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillStyle = C.fg;
    ctx.textAlign = 'left';
    ctx.fillText(y, colYear, baseline);
    ctx.textAlign = 'right';
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(String(v.flights), colFlights, baseline);
    ctx.fillText(fmt(v.distance_km), colKm, baseline);
    ctx.fillStyle = 'rgba(35,40,65,0.75)';
    ctx.fillRect(PAD, L.rowsTop + i * ROW_H + ROW_H - 4, L.IW, 1);
  });

  // 合計欄。2つの数値は同じ配色にする（各数字の幅いっぱいにグラデーション）
  ctx.fillStyle = C.row;
  ctx.fillRect(PAD, L.totalTop - 6, L.IW, 1);
  ctx.textAlign = 'left';
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = C.muted;
  spacing('1.4px');
  ctx.fillText('TOTAL TO DATE', colYear, L.totalTop + 14);
  spacing('0px');
  ctx.textAlign = 'right';
  ctx.font = `800 20px ${FONT}`;
  const gradNumber = (text: string, right: number) => {
    const w = ctx.measureText(text).width;
    const g = ctx.createLinearGradient(right - w, 0, right, 0);
    g.addColorStop(0, C.accent);
    g.addColorStop(1, C.accent2);
    ctx.fillStyle = g;
    ctx.fillText(text, right, L.totalTop + 18);
  };
  gradNumber(String(stats.total_flights), colFlights);
  gradNumber(fmt(stats.total_distance_km), colKm);

  // 補助情報＋国旗
  ctx.textAlign = 'left';
  ctx.font = `500 12.5px ${FONT}`;
  ctx.fillStyle = C.muted;
  const laps = (stats.total_distance_km / EARTH_CIRCUMFERENCE_KM).toFixed(1);
  ctx.fillText(
    `${flightTime(stats.flight_time.total_minutes)} in the air   ·   ${laps}× around the Earth   ·   ${stats.airports.count} airports   ·   ${stats.airlines.count} airlines`,
    PAD,
    L.subTop
  );

  ctx.font = `17px ${FONT}`;
  ctx.fillStyle = C.fg;
  let fx = PAD;
  for (const v of stats.countries.including_layovers.visits) {
    const g = flagOf(v.country_code);
    const w = ctx.measureText(g).width;
    if (fx + w > W - PAD) break;
    ctx.fillText(g, fx, L.subTop + 24);
    fx += w + 5;
  }

  ctx.font = `500 11.5px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'right';
  ctx.fillText(`as of ${new Date().toISOString().slice(0, 10)}`, W - PAD, L.footerY);

  ctx.restore();
}

// 画面表示用。ビットマップ寸法だけ設定し、CSSサイズは呼び出し側に任せる
export function drawCardOnCanvas(canvas: HTMLCanvasElement, input: CardInput, scale = 2): void {
  const { H } = layout(input.stats);
  canvas.width = CARD_W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  paint(ctx, input);
}

// ダウンロード用。2倍解像度のPNG（角丸の外側は透過）
export async function renderCardPng(input: CardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  drawCardOnCanvas(canvas, input, 2);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}
