import { useEffect, useRef } from 'react';
import Globe from 'globe.gl';
import type { Stats } from '../lib/stats';

// flight-log の地球儀（globe.gl）を移植。全ルートを大圏アークで描画、空港ドットは
// 発着数でサイズ可変・ホバーでIATA表示、ホバー中は自動回転を停止。陸地は六角形ポリゴン。
export function GlobeView({ globe: data }: { globe: Stats['globe'] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof Globe !== 'function') return;
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim();
    const accent2 = css.getPropertyValue('--accent2').trim();

    const globe = new Globe(el)
      .width(el.clientWidth)
      .height(el.clientHeight)
      .backgroundColor('rgba(0,0,0,0)')
      .showGlobe(true)
      .showAtmosphere(true)
      .atmosphereColor(accent)
      .atmosphereAltitude(0.18)
      .arcsData(data.routes)
      .arcStartLat((r: any) => r.from.lat)
      .arcStartLng((r: any) => r.from.lon)
      .arcEndLat((r: any) => r.to.lat)
      .arcEndLng((r: any) => r.to.lon)
      .arcColor(() => [accent, accent2])
      .arcStroke((r: any) => 0.25 + Math.min(r.count, 8) * 0.06)
      .arcAltitudeAutoScale(0.35)
      .arcsTransitionDuration(0)
      .pointsData(data.airports)
      .pointLat((a: any) => a.lat)
      .pointLng((a: any) => a.lon)
      .pointColor(() => accent2)
      .pointAltitude(0.005)
      .pointRadius((a: any) => 0.35 + Math.min(a.count, 40) * 0.015)
      .pointLabel((a: any) => a.iata)
      .onPointHover((p: unknown) => {
        globe.controls().autoRotate = !p; // ホバー中は自動回転を止める
      });

    globe.globeMaterial().color.set('#0c1122');
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.6;
    globe.pointOfView({ lat: 25, lng: 120, altitude: 1.9 });

    // 陸地（六角形ポリゴン、同梱GeoJSON）
    fetch('/data/countries.geojson')
      .then((r) => r.json())
      .then((geo) => {
        globe
          .hexPolygonsData(geo.features)
          .hexPolygonResolution(3)
          .hexPolygonMargin(0.6)
          .hexPolygonColor(() => 'rgba(111, 150, 255, 0.32)');
      })
      .catch(() => {}); // 陸地なしでもアークは描ける

    const onResize = () => globe.width(el.clientWidth).height(el.clientHeight);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      globe._destructor?.();
      el.replaceChildren();
    };
  }, [data]);

  return (
    <div className="card" id="globe-card">
      <div id="globe" ref={ref} />
    </div>
  );
}
