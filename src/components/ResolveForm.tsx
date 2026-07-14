import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { insertFlight } from '../lib/flights';
import { resolveFlight, resolveErrorMessage, ResolveFailure, type Candidate } from '../lib/resolve';

// 便名＋出発日をAeroDataBox（Edge Function経由）で解決して登録する。
// 複数区間が返った場合は候補から選ばせる。上限到達・失敗時は手入力を案内する。
export function ResolveForm({ onAdded, onFallback }: { onAdded: () => void; onFallback: () => void }) {
  const { session } = useAuth();
  const [flightNumber, setFlightNumber] = useState('');
  const [flightDate, setFlightDate] = useState('');
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offerManual, setOfferManual] = useState(false);
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOfferManual(false);
    setCandidates(null);
    setBusy(true);
    try {
      const found = await resolveFlight(flightNumber, flightDate);
      setCandidates(found);
    } catch (err) {
      const code = err instanceof ResolveFailure ? err.code : 'unknown';
      setError(resolveErrorMessage(code));
      setOfferManual(true); // どのエラーでも手入力への導線を出す
    } finally {
      setBusy(false);
    }
  }

  async function add(c: Candidate) {
    setBusy(true);
    setError(null);
    const { error } = await insertFlight(session!.user.id, {
      flight_number: c.flight_number,
      flight_date: c.flight_date,
      airline_code: c.airline_code,
      airline_name: c.airline_name,
      origin_iata: c.origin_iata,
      destination_iata: c.destination_iata,
      scheduled_departure: c.scheduled_departure,
      scheduled_arrival: c.scheduled_arrival,
      canceled: c.canceled,
      source: 'api',
    });
    setBusy(false);
    if (error) return setError(error.message);
    setFlightNumber('');
    setFlightDate('');
    setCandidates(null);
    onAdded();
  }

  return (
    <div>
      <form onSubmit={search}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="field">
            <label htmlFor="r-fn">便名</label>
            <input id="r-fn" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} placeholder="ZG51" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="r-fd">出発日</label>
            <input id="r-fd" type="date" value={flightDate} onChange={(e) => setFlightDate(e.target.value)} />
          </div>
        </div>
        <button type="submit" disabled={busy || !flightNumber || !flightDate}>
          {busy ? '検索中…' : '検索'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '1rem' }}>
          <p className="error">{error}</p>
          {offerManual && (
            <button className="ghost" onClick={onFallback}>
              手入力で登録する
            </button>
          )}
        </div>
      )}

      {candidates && candidates.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <p className="muted">
            {candidates.length > 1 ? '複数の区間が見つかりました。登録する便を選んでください:' : '見つかりました:'}
          </p>
          {candidates.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.6rem 0',
                borderTop: '1px solid var(--row)',
              }}
            >
              <span>
                <strong>{c.flight_number}</strong> {c.origin_iata} → {c.destination_iata}
                {c.airline_name && <span className="muted"> · {c.airline_name}</span>}
                {c.canceled && <span className="muted"> (canceled)</span>}
              </span>
              <button onClick={() => add(c)} disabled={busy}>
                追加
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
