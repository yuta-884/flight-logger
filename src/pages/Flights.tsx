import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadMasters } from '../lib/masters';
import type { Flight } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { AppHeader } from '../components/AppHeader';
import { AddFlight } from '../components/AddFlight';
import { ImportFlighty } from '../components/ImportFlighty';
import { FlightList } from '../components/FlightList';

export function Flights() {
  const { t } = useI18n();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [mastersReady, setMastersReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // RLSにより自分の行だけが返る（明示のフィルタは不要だが可読性のため付けない）
    const { data, error } = await supabase
      .from('flights')
      .select('*')
      .order('flight_date', { ascending: false });
    if (error) setError(error.message);
    else setFlights((data as Flight[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMasters().then(() => setMastersReady(true)).catch((e) => setError(String(e)));
    load();
  }, [load]);

  return (
    <div className="container">
      <AppHeader />

      {mastersReady ? (
        <>
          <AddFlight onAdded={load} />
          <ImportFlighty onImported={load} />
        </>
      ) : (
        <p className="muted">{t('loadingMasters')}</p>
      )}

      {error && <p className="error">{error}</p>}
      {loading ? <p className="muted">{t('loading')}</p> : <FlightList flights={flights} onChanged={load} />}
    </div>
  );
}
