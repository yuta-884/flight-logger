import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import type { Flight } from '../lib/types';

// 自分のフライト一覧。行ごとにlayover上書き・削除ができる（シングルユーザー版のJSON直編集に代わるUI）
export function FlightList({ flights, onChanged }: { flights: Flight[]; onChanged: () => void }) {
  const { t } = useI18n();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // チェック=到着地に滞在した（layover=falseで上書き）/ 未チェック=自動判定（null。24h以内の同一空港接続は乗継扱い）
  // layover=true（強制乗継）はUIからは設定しない（自動判定で乗継になるため実用上不要）
  async function setStay(id: string, stay: boolean) {
    const { error } = await supabase.from('flights').update({ layover: stay ? false : null }).eq('id', id);
    if (error) {
      alert(t('updateFailed', { msg: error.message }));
      return;
    }
    onChanged();
  }

  async function remove(id: string) {
    if (!confirm(t('confirmDeleteFlight'))) return;
    setDeletingId(id);
    const { error } = await supabase.from('flights').delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      alert(t('deleteFailed', { msg: error.message }));
      return;
    }
    onChanged();
  }

  if (flights.length === 0) {
    return <p className="muted">{t('noFlightsYet')}</p>;
  }

  return (
    // 狭幅では表が入りきらないため、ページ全体ではなくカード内で横スクロールさせる
    <div className="card table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Flight</th>
            <th>Route</th>
            <th>km</th>
            <th>
              {t('stay')}
              <span className="help" data-tip={t('stayHelp')} aria-label={t('stayHelp')}>
                ?
              </span>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => (
            <tr key={f.id}>
              <td>{f.flight_date}</td>
              <td>
                <strong>{f.flight_number}</strong>
              </td>
              <td>
                {f.origin_iata} → {f.diverted_to_iata ?? f.destination_iata}
                {f.canceled && <span className="muted"> (canceled)</span>}
              </td>
              <td>{f.distance_km?.toLocaleString('en-US') ?? '—'}</td>
              <td style={{ textAlign: 'center' }}>
                <input
                  type="checkbox"
                  aria-label={t('stayAria')}
                  title={t('stayHelp')}
                  checked={f.layover === false}
                  onChange={(e) => setStay(f.id, e.target.checked)}
                />
              </td>
              <td style={{ textAlign: 'right' }}>
                {/* 狭幅ではラベルを隠して✕アイコン表示にする（CSS）。読み上げはaria-labelが担う */}
                <button
                  className="danger"
                  onClick={() => remove(f.id)}
                  disabled={deletingId === f.id}
                  aria-label={t('del')}
                >
                  {deletingId === f.id ? '…' : <span className="btn-label">{t('del')}</span>}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
