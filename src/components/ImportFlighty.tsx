import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { parseFlightyCsv, type ParsedFlight } from '../lib/importFlighty';

// Flighty CSVのインポート（クライアント処理・API非使用）。
// flighty_id と (日付,便名) の両方で既存＆バッチ内の重複を除外し、冪等に取り込む。
export function ImportFlighty({ onImported }: { onImported: () => void }) {
  const { session } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; warnings: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const { flights, warnings } = parseFlightyCsv(text);

      // 既存の重複防止キーを取得（自分の行のみ。RLSで自動的に絞られる）
      const { data: existing, error: exErr } = await supabase
        .from('flights')
        .select('flighty_id, flight_date, flight_number');
      if (exErr) throw exErr;

      const seenFlightyId = new Set<string>();
      const seenDateNum = new Set<string>();
      for (const row of existing ?? []) {
        if (row.flighty_id) seenFlightyId.add(row.flighty_id);
        seenDateNum.add(`${row.flight_date}|${row.flight_number}`);
      }

      const toInsert: ParsedFlight[] = [];
      for (const f of flights) {
        const key = `${f.flight_date}|${f.flight_number}`;
        if (seenFlightyId.has(f.flighty_id) || seenDateNum.has(key)) continue; // 既存 or バッチ内重複
        seenFlightyId.add(f.flighty_id);
        seenDateNum.add(key);
        toInsert.push(f);
      }

      if (toInsert.length > 0) {
        const rows = toInsert.map((f) => ({ ...f, user_id: session!.user.id }));
        const { error: insErr } = await supabase.from('flights').insert(rows);
        if (insErr) throw insErr;
      }

      setResult({ imported: toInsert.length, skipped: flights.length - toInsert.length, warnings });
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = ''; // 同じファイルを再選択できるようにリセット
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ marginTop: 0 }}>Flighty CSV をインポート</h2>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Flightyの Settings → Account Data → Export Your Flights で書き出したCSVを取り込みます。何度実行しても重複しません。
      </p>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} />
      {busy && <p className="muted">取り込み中…</p>}
      {error && <p className="error">{error}</p>}
      {result && (
        <div style={{ marginTop: '0.5rem' }}>
          <p>
            <strong>{result.imported}</strong> 件を取り込みました
            {result.skipped > 0 && <span className="muted">（重複でスキップ {result.skipped} 件）</span>}
          </p>
          {result.warnings.length > 0 && (
            <details>
              <summary className="muted">警告 {result.warnings.length} 件</summary>
              <ul style={{ fontSize: '0.8rem' }}>
                {result.warnings.slice(0, 30).map((w, i) => (
                  <li key={i} className="muted">{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
