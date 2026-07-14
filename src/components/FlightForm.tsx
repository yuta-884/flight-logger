import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { getAirport, getAirlineByIata, haversineKm, parseFlightNumber } from '../lib/masters';

// 手入力でのフライト登録（API非使用）。便名・出発日・出発/到着空港を入力。
// 航空会社名はマスタから解決、距離はHaversineで計算して保存する
export function FlightForm({ onAdded }: { onAdded: () => void }) {
  const { session } = useAuth();
  const [flightNumber, setFlightNumber] = useState('');
  const [flightDate, setFlightDate] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseFlightNumber(flightNumber);
    if (!parsed) return setError('便名の形式が正しくありません（例: ZG51）');

    const originIata = origin.trim().toUpperCase();
    const destIata = destination.trim().toUpperCase();
    const o = getAirport(originIata);
    const d = getAirport(destIata);
    if (!o) return setError(`出発空港 ${originIata} がマスタに見つかりません（IATA 3レター）`);
    if (!d) return setError(`到着空港 ${destIata} がマスタに見つかりません（IATA 3レター）`);
    if (!flightDate) return setError('出発日を入力してください');

    const airline = getAirlineByIata(parsed.code);

    setBusy(true);
    const { error } = await supabase.from('flights').insert({
      user_id: session!.user.id,
      flight_number: parsed.normalized,
      flight_date: flightDate,
      airline_code: parsed.code,
      airline_name: airline?.name ?? null,
      origin_iata: originIata,
      destination_iata: destIata,
      distance_km: haversineKm(o, d),
      source: 'manual',
    });
    setBusy(false);
    if (error) return setError(error.message);

    setFlightNumber('');
    setFlightDate('');
    setOrigin('');
    setDestination('');
    onAdded();
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ marginTop: 0 }}>フライトを追加</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="field">
          <label htmlFor="fn">便名</label>
          <input id="fn" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} placeholder="ZG51" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="fd">出発日</label>
          <input id="fd" type="date" value={flightDate} onChange={(e) => setFlightDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="orig">出発空港</label>
          <input id="orig" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="NRT" autoComplete="off" maxLength={3} />
        </div>
        <div className="field">
          <label htmlFor="dest">到着空港</label>
          <input id="dest" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="BKK" autoComplete="off" maxLength={3} />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? '追加中…' : '追加'}
      </button>
    </form>
  );
}
