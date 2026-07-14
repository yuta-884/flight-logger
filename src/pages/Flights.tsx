import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { loadMasters } from '../lib/masters';
import type { Flight } from '../lib/types';
import { FlightForm } from '../components/FlightForm';
import { FlightList } from '../components/FlightList';

export function Flights() {
  const { profile, signOut } = useAuth();
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5rem' }}>
        <h1 className="brand">✈ FLIGHT LOGGER</h1>
        <div className="muted" style={{ fontSize: '0.85rem' }}>
          {profile?.slug} · <button className="ghost" style={{ padding: '0.3rem 0.6rem' }} onClick={signOut}>ログアウト</button>
        </div>
      </header>

      {mastersReady ? (
        <FlightForm onAdded={load} />
      ) : (
        <p className="muted">マスタ読み込み中…</p>
      )}

      {error && <p className="error">{error}</p>}
      {loading ? <p className="muted">読み込み中…</p> : <FlightList flights={flights} onChanged={load} />}
    </div>
  );
}
