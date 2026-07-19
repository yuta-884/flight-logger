import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { FlightForm } from './FlightForm';
import { ResolveForm } from './ResolveForm';

// フライト追加カード。「便名で検索」（API解決）と「手入力」を切り替える。
// 検索が上限到達・失敗したときは手入力へ誘導する。
export function AddFlight({ onAdded }: { onAdded: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'api' | 'manual'>('api');

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button className={mode === 'api' ? '' : 'ghost'} onClick={() => setMode('api')}>
          {t('tabSearchByFlight')}
        </button>
        <button className={mode === 'manual' ? '' : 'ghost'} onClick={() => setMode('manual')}>
          {t('tabManual')}
        </button>
      </div>
      {mode === 'api' ? (
        <ResolveForm onAdded={onAdded} onFallback={() => setMode('manual')} />
      ) : (
        <FlightForm onAdded={onAdded} />
      )}
    </div>
  );
}
