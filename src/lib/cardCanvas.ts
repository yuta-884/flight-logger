import type { Stats } from './stats';

// パスポート風カードのcanvas描画。
// - drawMapScene: 2D世界地図＋ルート＋空港ドット（EmbedCardの画面表示と共用）
// - renderCardPng: カード全体を単一canvasに描いてPNG Blob化（画像ダウンロード用）。
//   DOMキャプチャ系ライブラリはiOS Safariで白画像になる既知問題があるため、全要素を自前で描く。

export const fmt = (n: number) => n.toLocaleString('en-US');
export const flagOf = (cc: string) =>
  String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
export const shortDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  return `${String(d.getDate()).padStart(2, '0')} ${mon} ${String(d.getFullYear()).slice(2)}`;
};

// index.css :root と同じ配色（canvasからCSS変数は引けないため定数化）
const C = {
  card: '#151827',
  cardMix: '#202741', // color-mix(card 88%, accent)
  fg: '#eef0fa',
  muted: '#8e93ad',
  row: '#232841',
  accent: '#6f96ff',
  accent2: '#3fe0d0',
};

// 等長方形図法（南極は切る）
const LAT_TOP = 84;
const LAT_BOTTOM = -58;

export function project(lon: number, lat: number, W: number, H: number): [number, number] {
  return [((lon + 180) / 360) * W, ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H];
}

export function greatCircle(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  n = 48
) {
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

// (0,0)-(W,H) に地図・ルート・空港を描く。呼び出し側でtranslate/scale済みであること
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

const FONT = 'system-ui, -apple-system, sans-serif';
const MONO = "'Courier New', ui-monospace, monospace";

function gradientFill(ctx: CanvasRenderingContext2D, x: number, w: number, y: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, C.accent);
  g.addColorStop(1, C.accent2);
  return g;
}

export interface CardPngInput {
  stats: Stats;
  displayName: string;
  slug: string;
  geo: any; // countries.geojson
}

// カードをPNG化する。幅640px相当を2倍解像度で描画
export async function renderCardPng({ stats, displayName, slug, geo }: CardPngInput): Promise<Blob> {
  const SCALE = 2;
  const W = 640;
  const PAD_X = 22.4;
  const PAD_TOP = 19.2;
  const PAD_BOTTOM = 16;
  const IW = W - PAD_X * 2;
  const mapH = Math.round(IW * 0.46);

  // 国旗の折り返し行数（DOMと同じく重なり配置）
  const flags = stats.countries.including_layovers.visits.map((v) => v.country_code);
  const FLAG_D = 25.6; // 円の直径
  const FLAG_STEP = 19.84; // 重なりぶんを引いた進み幅
  const perRow = Math.max(1, Math.floor((IW - (FLAG_D - FLAG_STEP)) / FLAG_STEP));
  const flagRows = Math.ceil(flags.length / perRow);

  const headerH = 30;
  const flagsBlockH = 11.2 + flagRows * (FLAG_D + 4) + 14.4;
  const idRowH = 100;
  const statsRowH = 19.2 + 11 + 26 + 16;
  const mrzH = 1 + 8 + 2 * 19 + 4;
  const H = Math.round(
    PAD_TOP + headerH + 9.6 + mapH + flagsBlockH + 1 + 16 + idRowH + statsRowH + mrzH + PAD_BOTTOM
  );

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // カード背景（角丸＋グラデーション。外側は透過）
  const R = 17.6;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, R);
  const bg = ctx.createLinearGradient(0, 0, W * 0.42, H);
  bg.addColorStop(0, C.cardMix);
  bg.addColorStop(0.45, C.card);
  bg.addColorStop(1, C.card);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip(); // 以降の描画をカード内に限定

  // 上端のアクセントライン
  const topLine = ctx.createLinearGradient(0, 0, W, 0);
  topLine.addColorStop(0, 'rgba(63,224,208,0)');
  topLine.addColorStop(0.5, 'rgba(63,224,208,0.55)');
  topLine.addColorStop(1, 'rgba(63,224,208,0)');
  ctx.fillStyle = topLine;
  ctx.fillRect(0, 0, W, 1);

  let y = PAD_TOP;

  // ヘッダー: タイトル（グラデーション文字）＋右にタグライン
  ctx.textBaseline = 'alphabetic';
  const title = '✈ FLIGHT LOGGER';
  ctx.font = `800 21.6px ${FONT}`;
  try { (ctx as any).letterSpacing = '2px'; } catch { /* 未対応ブラウザは無視 */ }
  const titleW = ctx.measureText(title).width;
  ctx.fillStyle = gradientFill(ctx, PAD_X, titleW, y);
  ctx.fillText(title, PAD_X, y + 20);

  const tagline = `${displayName}'S FLIGHT STATS`.toUpperCase();
  ctx.font = `700 10.6px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'right';
  ctx.fillText(tagline, W - PAD_X, y + 18);
  ctx.textAlign = 'left';
  try { (ctx as any).letterSpacing = '0px'; } catch { /* noop */ }
  y += headerH + 9.6;

  // 地図
  ctx.save();
  ctx.translate(PAD_X, y);
  ctx.beginPath();
  ctx.roundRect(0, 0, IW, mapH, 9.6);
  ctx.clip();
  drawMapScene(ctx, IW, mapH, geo, stats.globe);
  ctx.restore();
  y += mapH + 11.2;

  // 国旗の列（中央寄せ・行ごと）
  for (let row = 0; row < flagRows; row++) {
    const rowFlags = flags.slice(row * perRow, (row + 1) * perRow);
    const rowW = (rowFlags.length - 1) * FLAG_STEP + FLAG_D;
    let fx = (W - rowW) / 2;
    const cy = y + FLAG_D / 2;
    for (const cc of rowFlags) {
      ctx.beginPath();
      ctx.arc(fx + FLAG_D / 2, cy, FLAG_D / 2, 0, Math.PI * 2);
      ctx.fillStyle = C.row;
      ctx.fill();
      ctx.font = `18.4px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.fg;
      ctx.fillText(flagOf(cc), fx + FLAG_D / 2, cy + 1);
      fx += FLAG_STEP;
    }
    y += FLAG_D + 4;
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  y += 14.4;

  // 区切り線
  const div = ctx.createLinearGradient(PAD_X, 0, W - PAD_X, 0);
  div.addColorStop(0, 'rgba(111,150,255,0)');
  div.addColorStop(0.5, 'rgba(111,150,255,0.45)');
  div.addColorStop(1, 'rgba(111,150,255,0)');
  ctx.fillStyle = div;
  ctx.fillRect(PAD_X, y, IW, 1);
  y += 1 + 16;

  // IDブロック: 便数（左）＋ HOME BASE / FIRST FLIGHT / ISSUED（右）
  const nText = fmt(stats.total_flights);
  ctx.font = `800 51.2px ${FONT}`;
  const nW = ctx.measureText(nText).width;
  ctx.fillStyle = gradientFill(ctx, PAD_X, nW, y);
  ctx.fillText(nText, PAD_X, y + 46);
  ctx.font = `500 24px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText('flights', PAD_X, y + 78);

  const fieldsX = PAD_X + Math.max(nW, 100) + 25.6;
  const home = stats.airports.ranking[0]?.iata ?? '';
  const fields: [string, string][] = [
    ['HOME BASE', home],
    ['FIRST FLIGHT', shortDate(stats.first_flight_date)],
    ['ISSUED', shortDate(new Date().toISOString())],
  ];
  let fy = y + 12;
  for (const [k, v] of fields) {
    ctx.font = `700 10.9px ${FONT}`;
    ctx.fillStyle = C.muted;
    try { (ctx as any).letterSpacing = '1.5px'; } catch { /* noop */ }
    ctx.fillText(k, fieldsX, fy);
    try { (ctx as any).letterSpacing = '0px'; } catch { /* noop */ }
    ctx.font = `400 14.4px ${FONT}`;
    ctx.fillStyle = C.fg;
    ctx.fillText(v, fieldsX, fy + 16);
    fy += 30;
  }
  y += idRowH;

  // 下段の統計4項目
  const min = stats.flight_time.total_minutes;
  const dd = Math.floor(min / 1440);
  const hh = Math.floor((min % 1440) / 60);
  const cells: { k: string; v: string; unit?: string }[] = [
    { k: 'DISTANCE', v: fmt(stats.total_distance_km), unit: ' km' },
    { k: 'FLIGHT TIME', v: `${dd}d ${hh}h` },
    { k: 'AIRPORTS', v: String(stats.airports.count) },
    { k: 'AIRLINES', v: String(stats.airlines.count) },
  ];
  y += 19.2;
  // 両端揃え: 最初は左端、最後は右端、中間は等間隔
  const cellXs: number[] = [];
  ctx.font = `800 24px ${FONT}`;
  const widths = cells.map((c) => {
    ctx.font = `800 24px ${FONT}`;
    let w = ctx.measureText(c.v).width;
    if (c.unit) {
      ctx.font = `500 15.2px ${FONT}`;
      w += ctx.measureText(c.unit).width;
    }
    ctx.font = `700 10.9px ${FONT}`;
    return Math.max(w, ctx.measureText(c.k).width);
  });
  const totalW = widths.reduce((s, w) => s + w, 0);
  const gap = (IW - totalW) / (cells.length - 1);
  let cx = PAD_X;
  for (const w of widths) {
    cellXs.push(cx);
    cx += w + gap;
  }
  cells.forEach((c, i) => {
    const x = cellXs[i];
    ctx.font = `700 10.9px ${FONT}`;
    ctx.fillStyle = C.muted;
    try { (ctx as any).letterSpacing = '1.5px'; } catch { /* noop */ }
    ctx.fillText(c.k, x, y + 10);
    try { (ctx as any).letterSpacing = '0px'; } catch { /* noop */ }
    ctx.font = `800 24px ${FONT}`;
    ctx.fillStyle = C.fg;
    ctx.fillText(c.v, x, y + 34);
    if (c.unit) {
      const vw = ctx.measureText(c.v).width;
      ctx.font = `500 15.2px ${FONT}`;
      ctx.fillStyle = C.muted;
      ctx.fillText(c.unit, x + vw, y + 34);
    }
  });
  y += 11 + 26 + 16;

  // MRZ（パスポート下部の機械読取風の2行）
  ctx.fillStyle = C.row;
  ctx.fillRect(PAD_X, y, IW, 1);
  y += 8;
  ctx.font = `700 12.8px ${MONO}`;
  ctx.fillStyle = C.muted;
  const since = shortDate(stats.first_flight_date).replace(/ /g, '');
  const issued = shortDate(new Date().toISOString()).replace(/ /g, '');
  const chevW = ctx.measureText('<').width;
  const mrzLine = (left: string, right: string) => {
    const n = Math.max(0, Math.floor((IW - ctx.measureText(left).width - ctx.measureText(right).width) / chevW));
    return left + '<'.repeat(n) + right;
  };
  ctx.fillText(mrzLine(`ALLTIME<<<<SINCE${since}<<${stats.total_flights}FLIGHTS`, slug.toUpperCase()), PAD_X, y + 14);
  ctx.fillText(mrzLine(`ISSUED${issued}${home}`, 'FLIGHT-LOG'), PAD_X, y + 33);

  ctx.restore();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}
