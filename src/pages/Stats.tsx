import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadMasters } from '../lib/masters';
import { computeStats } from '../lib/stats';
import type { Flight } from '../lib/types';
import { AppHeader } from '../components/AppHeader';
import { StatCards } from '../components/StatCards';
import { GlobeView } from '../components/Globe';

// 統計ページ。自分のフライトをDBから取得し、クライアントで集計（flight-logのbuild_stats移植）。
export function Stats() {
  const [flights, setFlights] = useState<Flight[] | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadMasters(),
      supabase.from('flights').select('*').then(({ data, error }) => {
        if (error) throw error;
        return (data as Flight[]) ?? [];
      }),
    ])
      .then(([, f]) => {
        setFlights(f);
        setReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const stats = useMemo(() => (ready && flights ? computeStats(flights) : null), [ready, flights]);

  return (
    <div className="container">
      <AppHeader />
      {error && <p className="error">{error}</p>}
      {!stats ? (
        <p className="muted">Loading…</p>
      ) : stats.total_flights === 0 ? (
        <p className="muted">No flights yet. Add flights from the Log page to see your stats.</p>
      ) : (
        <>
          <GlobeView globe={stats.globe} />
          <StatCards stats={stats} />
        </>
      )}
    </div>
  );
}
