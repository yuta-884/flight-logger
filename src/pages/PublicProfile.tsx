import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { loadPublicStats } from '../lib/publicProfile';
import type { Stats } from '../lib/stats';
import { StatCards } from '../components/StatCards';
import { GlobeView } from '../components/Globe';

// 公開プロフィール /u/{slug}。匿名でも閲覧可（RLSが公開ユーザーのみ許可）。読み取り専用。
export function PublicProfile() {
  const { slug = '' } = useParams();
  const [state, setState] = useState<'loading' | 'notfound' | 'ready'>('loading');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    loadPublicStats(slug)
      .then((res) => {
        if (!res) return setState('notfound');
        setDisplayName(res.profile.display_name);
        setStats(res.stats);
        setState('ready');
      })
      .catch(() => setState('notfound'));
  }, [slug]);

  return (
    <div className="container">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 className="brand" style={{ fontSize: '1.3rem' }}>✈ FLIGHT LOGGER</h1>
        <div className="muted" style={{ fontSize: '0.8rem' }}>{displayName ?? slug} · {slug}</div>
      </header>

      {state === 'loading' && <p className="muted">読み込み中…</p>}
      {state === 'notfound' && (
        <div className="card">
          <p>このプロフィールは存在しないか、非公開です。</p>
        </div>
      )}
      {state === 'ready' && stats && (
        stats.total_flights === 0 ? (
          <p className="muted">まだフライトがありません。</p>
        ) : (
          <>
            <GlobeView globe={stats.globe} />
            <StatCards stats={stats} />
          </>
        )
      )}
    </div>
  );
}
