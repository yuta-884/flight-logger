import type { Stats } from './stats';
import { drawMapScene, fmt, flagOf } from './cardCanvas';

// 検討用の代替カードデザイン。
// - renderLogbookCardPng: 案B 飛行日誌（年ごとの台帳＋合計欄）
// - renderMinimalCardPng: 案C ミニマル（巨大タイポグラフィ主導）
// いずれもパスポート的な意匠（MRZ・発行欄・円形国旗チップ）は持たない。

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

export interface CardInput {
  stats: Stats;
  displayName: string;
  slug: string;
  geo: any;
}

function cardBase(ctx: CanvasRenderingContext2D, W: number, H: number, radius = 26) {
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, radius);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, C.cardTop);
  bg.addColorStop(0.55, C.card);
  bg.addColorStop(1, '#101322');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
}

function brandText(ctx: CanvasRenderingContext2D, x: number, baseline: number, size = 17) {
  ctx.font = `800 ${size}px ${FONT}`;
  try { (ctx as any).letterSpacing = '2px'; } catch { /* 未対応ブラウザは無視 */ }
  const label = '✈ FLIGHT LOGGER';
  const w = ctx.measureText(label).width;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, C.accent);
  g.addColorStop(1, C.accent2);
  ctx.fillStyle = g;
  ctx.textAlign = 'left';
  ctx.fillText(label, x, baseline);
  try { (ctx as any).letterSpacing = '0px'; } catch { /* noop */ }
  return w;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

const flightTime = (min: number) => `${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h`;

// ── 案B: 飛行日誌 ─────────────────────────────────────────────
export async function renderLogbookCardPng({ stats, displayName, slug, geo }: CardInput): Promise<Blob> {
  const SCALE = 2;
  const W = 640;
  const PAD = 34;
  const IW = W - PAD * 2;
  const mapH = Math.round(IW * 0.46);

  const years = Object.entries(stats.flights_by_year).sort((a, b) => b[0].localeCompare(a[0]));
  const ROW_H = 27;

  const mapTop = 104;
  const ledgerTop = mapTop + mapH + 26;
  const rowsTop = ledgerTop + 22;
  const totalTop = rowsTop + years.length * ROW_H + 10;
  const subTop = totalTop + 52;
  const footerY = subTop + 40;
  const H = Math.round(footerY + 24);

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  cardBase(ctx, W, H);
  ctx.textBaseline = 'alphabetic';

  brandText(ctx, PAD, PAD + 14);
  ctx.textAlign = 'right';
  ctx.font = `700 10px ${FONT}`;
  try { (ctx as any).letterSpacing = '2px'; } catch { /* noop */ }
  ctx.fillStyle = C.muted;
  ctx.fillText('LOGBOOK', W - PAD, PAD + 14);
  try { (ctx as any).letterSpacing = '0px'; } catch { /* noop */ }

  // 氏名（左）とユーザーID（右）
  ctx.textAlign = 'left';
  ctx.font = `700 23px ${FONT}`;
  ctx.fillStyle = C.fg;
  ctx.fillText(displayName, PAD, PAD + 52);
  ctx.textAlign = 'right';
  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(slug, W - PAD, PAD + 52);

  // 航路の帯（台帳の添付図というつもり）。
  // 背景は塗らずカード地をそのまま見せ、区切りのない一続きの面にする
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD, mapTop, IW, mapH);
  ctx.clip();
  ctx.translate(PAD, mapTop);
  drawMapScene(ctx, IW, mapH, geo, stats.globe);
  ctx.restore();

  // 台帳の見出し
  const colYear = PAD;
  const colFlights = PAD + IW * 0.52;
  const colKm = W - PAD;
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = C.muted;
  try { (ctx as any).letterSpacing = '1.4px'; } catch { /* noop */ }
  ctx.textAlign = 'left';
  ctx.fillText('YEAR', colYear, ledgerTop);
  ctx.textAlign = 'right';
  ctx.fillText('FLIGHTS', colFlights, ledgerTop);
  ctx.fillText('DISTANCE (KM)', colKm, ledgerTop);
  try { (ctx as any).letterSpacing = '0px'; } catch { /* noop */ }
  ctx.fillStyle = C.row;
  ctx.fillRect(PAD, ledgerTop + 8, IW, 1);

  // 年ごとの行
  years.forEach(([y, v], i) => {
    const baseline = rowsTop + i * ROW_H + 14;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillStyle = C.fg;
    ctx.textAlign = 'left';
    ctx.fillText(y, colYear, baseline);
    ctx.textAlign = 'right';
    ctx.font = `500 15px ${FONT}`;
    ctx.fillStyle = C.fg;
    ctx.fillText(String(v.flights), colFlights, baseline);
    ctx.fillText(fmt(v.distance_km), colKm, baseline);
    ctx.fillStyle = 'rgba(35,40,65,0.75)';
    ctx.fillRect(PAD, rowsTop + i * ROW_H + ROW_H - 4, IW, 1);
  });

  // 合計欄
  ctx.fillStyle = C.row;
  ctx.fillRect(PAD, totalTop - 6, IW, 1);
  ctx.textAlign = 'left';
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = C.muted;
  try { (ctx as any).letterSpacing = '1.4px'; } catch { /* noop */ }
  ctx.fillText('TOTAL TO DATE', colYear, totalTop + 14);
  try { (ctx as any).letterSpacing = '0px'; } catch { /* noop */ }
  ctx.textAlign = 'right';
  ctx.font = `800 20px ${FONT}`;
  ctx.fillStyle = C.fg;
  ctx.fillText(String(stats.total_flights), colFlights, totalTop + 18);
  const kmText = fmt(stats.total_distance_km);
  const kmW = ctx.measureText(kmText).width;
  const kmGrad = ctx.createLinearGradient(colKm - kmW, 0, colKm, 0);
  kmGrad.addColorStop(0, C.accent);
  kmGrad.addColorStop(1, C.accent2);
  ctx.fillStyle = kmGrad;
  ctx.fillText(kmText, colKm, totalTop + 18);

  // 補助情報＋国旗
  ctx.textAlign = 'left';
  ctx.font = `500 12.5px ${FONT}`;
  ctx.fillStyle = C.muted;
  const laps = (stats.total_distance_km / EARTH_CIRCUMFERENCE_KM).toFixed(1);
  ctx.fillText(
    `${flightTime(stats.flight_time.total_minutes)} in the air   ·   ${laps}× around the Earth   ·   ${stats.airports.count} airports   ·   ${stats.airlines.count} airlines`,
    PAD,
    subTop
  );

  ctx.font = `17px ${FONT}`;
  const codes = stats.countries.including_layovers.visits.map((v) => v.country_code);
  let fx = PAD;
  for (const cc of codes) {
    const g = flagOf(cc);
    const w = ctx.measureText(g).width;
    if (fx + w > W - PAD) break;
    ctx.fillText(g, fx, subTop + 24);
    fx += w + 5;
  }

  ctx.font = `500 11.5px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'right';
  ctx.fillText(`as of ${new Date().toISOString().slice(0, 10)}`, W - PAD, footerY);

  ctx.restore();
  return toBlob(canvas);
}

// ── 案C: ミニマル ─────────────────────────────────────────────
export async function renderMinimalCardPng({ stats, displayName, slug, geo }: CardInput): Promise<Blob> {
  const SCALE = 2;
  const W = 640;
  const PAD = 42;
  const IW = W - PAD * 2;
  const H = 470;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  cardBase(ctx, W, H, 24);
  ctx.textBaseline = 'alphabetic';

  // 背景に航路図をごく薄く敷く（装飾はこれだけ）
  ctx.save();
  ctx.globalAlpha = 0.13;
  const mapH = Math.round(W * 0.46);
  ctx.translate(0, 96);
  drawMapScene(ctx, W, mapH, geo, stats.globe);
  ctx.restore();

  // 氏名とユーザーID
  ctx.textAlign = 'left';
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = C.fg;
  ctx.fillText(displayName, PAD, PAD + 12);
  ctx.textAlign = 'right';
  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(slug, W - PAD, PAD + 12);

  // ヒーロー: 総距離
  ctx.textAlign = 'left';
  const kmText = fmt(stats.total_distance_km);
  ctx.font = `800 82px ${FONT}`;
  const kmW = ctx.measureText(kmText).width;
  const g = ctx.createLinearGradient(PAD, 0, PAD + kmW, 0);
  g.addColorStop(0, C.accent);
  g.addColorStop(1, C.accent2);
  ctx.fillStyle = g;
  ctx.fillText(kmText, PAD, 190);
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = C.muted;
  try { (ctx as any).letterSpacing = '3px'; } catch { /* noop */ }
  ctx.fillText('KILOMETRES FLOWN', PAD, 214);
  const laps = (stats.total_distance_km / EARTH_CIRCUMFERENCE_KM).toFixed(1);
  ctx.fillText(`${laps}× AROUND THE EARTH`, PAD, 234);
  try { (ctx as any).letterSpacing = '0px'; } catch { /* noop */ }

  // 細い罫と統計
  ctx.fillStyle = 'rgba(142,147,173,0.25)';
  ctx.fillRect(PAD, 268, IW, 1);

  const cells: [string, string][] = [
    ['FLIGHTS', fmt(stats.total_flights)],
    ['IN THE AIR', flightTime(stats.flight_time.total_minutes)],
    ['COUNTRIES', String(stats.countries.including_layovers.count)],
    ['AIRPORTS', String(stats.airports.count)],
  ];
  const colW = IW / cells.length;
  cells.forEach(([k, v], i) => {
    const x = PAD + colW * i;
    ctx.textAlign = 'left';
    ctx.font = `800 24px ${FONT}`;
    ctx.fillStyle = C.fg;
    ctx.fillText(v, x, 308);
    ctx.font = `700 9.5px ${FONT}`;
    ctx.fillStyle = C.muted;
    try { (ctx as any).letterSpacing = '1.4px'; } catch { /* noop */ }
    ctx.fillText(k, x, 326);
    try { (ctx as any).letterSpacing = '0px'; } catch { /* noop */ }
  });

  // 国旗（1行に収まる分だけ）
  ctx.font = `17px ${FONT}`;
  const codes = stats.countries.including_layovers.visits.map((v) => v.country_code);
  let fx = PAD;
  for (const cc of codes) {
    const gl = flagOf(cc);
    const w = ctx.measureText(gl).width;
    if (fx + w > W - PAD) break;
    ctx.fillText(gl, fx, 378);
    fx += w + 5;
  }

  brandText(ctx, PAD, H - PAD + 6, 14);
  ctx.textAlign = 'right';
  ctx.font = `500 11px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(`as of ${new Date().toISOString().slice(0, 10)}`, W - PAD, H - PAD + 6);

  ctx.restore();
  return toBlob(canvas);
}
