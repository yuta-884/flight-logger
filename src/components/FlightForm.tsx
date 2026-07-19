import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../lib/i18n';
import { getAirport, getAirlineByIata, parseFlightNumber } from '../lib/masters';
import { insertFlight } from '../lib/flights';

// 手入力でのフライト登録（API非使用）。便名・出発日・出発/到着空港を入力。
// 航空会社名はマスタから解決、距離はHaversineで計算して保存する
export function FlightForm({ onAdded }: { onAdded: () => void }) {
  const { session } = useAuth();
  const { t } = useI18n();
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
    if (!parsed) return setError(t('errInvalidFlightNo'));

    const originIata = origin.trim().toUpperCase();
    const destIata = destination.trim().toUpperCase();
    if (!getAirport(originIata)) return setError(t('errOriginNotFound', { iata: originIata }));
    if (!getAirport(destIata)) return setError(t('errDestNotFound', { iata: destIata }));
    if (!flightDate) return setError(t('errDateRequired'));

    const airline = getAirlineByIata(parsed.code);

    setBusy(true);
    const { error } = await insertFlight(session!.user.id, {
      flight_number: parsed.normalized,
      flight_date: flightDate,
      airline_code: parsed.code,
      airline_name: airline?.name ?? null,
      origin_iata: originIata,
      destination_iata: destIata,
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
    <form onSubmit={submit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="field">
          <label htmlFor="fn">{t('flightNumber')}</label>
          <input id="fn" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} placeholder="ZG51" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="fd">{t('departureDate')}</label>
          <input id="fd" type="date" value={flightDate} onChange={(e) => setFlightDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="orig">{t('originAirport')}</label>
          <input id="orig" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="NRT" autoComplete="off" maxLength={3} />
        </div>
        <div className="field">
          <label htmlFor="dest">{t('destAirport')}</label>
          <input id="dest" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="BKK" autoComplete="off" maxLength={3} />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? t('adding') : t('add')}
      </button>
    </form>
  );
}
