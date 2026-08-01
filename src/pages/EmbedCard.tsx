import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { loadPublicStats } from '../lib/publicProfile';
import { drawCardOnCanvas, renderCardPng, type CardInput } from '../lib/cardCanvas';
import type { Stats } from '../lib/stats';

// 埋め込みカード /embed/{slug}。iframeで外部サイトに貼る想定。
// 表示もダウンロードも cardCanvas の同じ描画関数を使う（見た目が食い違わない）。
// 直接開いた場合（iframe外）のみ画像ダウンロードボタンを表示。?download=1 で自動ダウンロード。

export function EmbedCard() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState<Stats | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<CardInput | null>(null);
  const autoDownloaded = useRef(false);
  // iframe内ではダウンロードボタンを出さない（埋め込み先の見た目を汚さない）
  const isTopWindow = window.self === window.top;

  async function download() {
    if (!inputRef.current || downloading) return;
    setDownloading(true);
    try {
      const blob = await renderCardPng(inputRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flight-logger-${slug}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } finally {
      setDownloading(false);
    }
  }

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

  // 地図データが揃った時点でカードを描画する
  useEffect(() => {
    if (!stats || stats.total_flights === 0) return;
    let cancelled = false;
    fetch('/data/countries.geojson')
      .then((r) => r.json())
      .then((geo) => {
        if (cancelled || !canvasRef.current) return;
        const input: CardInput = { stats, displayName: displayName ?? slug, slug, geo };
        inputRef.current = input;
        drawCardOnCanvas(canvasRef.current, input);
        setDrawn(true);
        // Settingsの「カード画像をダウンロード」からの遷移（?download=1）で自動実行
        if (searchParams.get('download') === '1' && !autoDownloaded.current) {
          autoDownloaded.current = true;
          void download();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [stats, displayName]);

  const css = `
    .embed-root { display: flex; flex-direction: column; align-items: center; padding: 4px; }
    .embed-root canvas { width: 100%; max-width: 640px; height: auto; display: block; }
    .embed-root .dl-btn { margin-top: 0.9rem; }
  `;

  if (notFound) {
    return <div className="container"><p className="muted">This card doesn't exist or is private.</p></div>;
  }

  return (
    <div className="embed-root">
      <style>{css}</style>
      {stats && stats.total_flights === 0 && <p className="muted">No flights yet.</p>}
      <canvas ref={canvasRef} role="img" aria-label={`${displayName ?? slug}'s flight log`} />
      {!drawn && <p className="muted">Loading…</p>}
      {drawn && isTopWindow && (
        <button className="ghost dl-btn" onClick={download} disabled={downloading}>
          {downloading ? 'Generating…' : 'Download image'}
        </button>
      )}
    </div>
  );
}
