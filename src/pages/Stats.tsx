import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadMasters } from '../lib/masters';
import { computeStats } from '../lib/stats';
import { loadManualCountries } from '../lib/publicProfile';
import { useAuth } from '../auth/AuthProvider';
import type { Flight } from '../lib/types';
import { AppHeader } from '../components/AppHeader';
import { StatCards } from '../components/StatCards';
import { GlobeView } from '../components/Globe';

// 統計ページ。自分のフライトをDBから取得し、クライアントで集計（flight-logのbuild_stats移植）。
export function Stats() {
  const { profile } = useAuth();
  const [flights, setFlights] = useState<Flight[] | null>(null);
  const [extraCountries, setExtraCountries] = useState<{ code: string; name: string | null }[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    loadMasters()
      .then(() =>
        Promise.all([
          supabase.from('flights').select('*').then(({ data, error }) => {
            if (error) throw error;
            return (data as Flight[]) ?? [];
          }),
          loadManualCountries(profile.id),
        ])
      )
      .then(([f, extra]) => {
        setFlights(f);
        setExtraCountries(extra);
        setReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [profile]);

  const stats = useMemo(
    () => (ready && flights ? computeStats(flights, undefined, extraCountries) : null),
    [ready, flights, extraCountries]
  );

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
