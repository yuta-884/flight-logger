import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Flight } from '../lib/types';

// 自分のフライト一覧。行ごとにlayover上書き・削除ができる（シングルユーザー版のJSON直編集に代わるUI）
export function FlightList({ flights, onChanged }: { flights: Flight[]; onChanged: () => void }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // チェック=到着地に滞在した（layover=falseで上書き）/ 未チェック=自動判定（null。24h以内の同一空港接続は乗継扱い）
  // layover=true（強制乗継）はUIからは設定しない（自動判定で乗継になるため実用上不要）
  async function setStay(id: string, stay: boolean) {
    const { error } = await supabase.from('flights').update({ layover: stay ? false : null }).eq('id', id);
    if (error) {
      alert(`更新に失敗しました: ${error.message}`);
      return;
    }
    onChanged();
  }

  async function remove(id: string) {
    if (!confirm('このフライトを削除しますか？')) return;
    setDeletingId(id);
    const { error } = await supabase.from('flights').delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      alert(`削除に失敗しました: ${error.message}`);
      return;
    }
    onChanged();
  }

  if (flights.length === 0) {
    return <p className="muted">まだフライトがありません。上のフォームから追加してください。</p>;
  }

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Flight</th>
            <th>Route</th>
            <th>km</th>
            <th title="チェックすると到着地を「滞在した国」として数えます（乗り継ぎ時間が長く入国した場合など）。未チェックは自動判定">滞在</th>
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
                  aria-label="到着地に滞在した（国カウントに含める）"
                  title="チェックすると到着地を「滞在した国」として数えます。未チェックは自動判定（24時間以内の乗り継ぎは滞在に数えない）"
                  checked={f.layover === false}
                  onChange={(e) => setStay(f.id, e.target.checked)}
                />
              </td>
              <td style={{ textAlign: 'right' }}>
                <button className="danger" onClick={() => remove(f.id)} disabled={deletingId === f.id}>
                  {deletingId === f.id ? '…' : '削除'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
