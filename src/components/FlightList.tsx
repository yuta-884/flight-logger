import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Flight } from '../lib/types';

// 自分のフライト一覧。行ごとにlayover上書き・削除ができる（シングルユーザー版のJSON直編集に代わるUI）
export function FlightList({ flights, onChanged }: { flights: Flight[]; onChanged: () => void }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 到着地での滞在の扱い: null=自動判定（同一空港・24h以内の接続は乗継）/ false=滞在 / true=乗継
  async function setLayover(id: string, raw: string) {
    const layover = raw === 'auto' ? null : raw === 'true';
    const { error } = await supabase.from('flights').update({ layover }).eq('id', id);
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
            <th>到着地の滞在</th>
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
              <td>
                <select
                  aria-label="到着地の滞在の扱い"
                  title="国カウントで到着地を「滞在した国」に含めるかの手動指定。自動=24時間以内の乗り継ぎは滞在に数えない"
                  value={f.layover === null ? 'auto' : String(f.layover)}
                  onChange={(e) => setLayover(f.id, e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '0.25rem 0.4rem' }}
                >
                  <option value="auto">自動</option>
                  <option value="false">滞在</option>
                  <option value="true">乗継</option>
                </select>
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
