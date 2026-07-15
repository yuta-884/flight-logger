import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

// 共通ヘッダー。ログ画面と統計画面のナビ＋slug表示＋ログアウト。
export function AppHeader() {
  const { profile, signOut } = useAuth();
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.2rem' }}>
        <h1 className="brand" style={{ fontSize: '1.3rem' }}>✈ FLIGHT LOGGER</h1>
        <nav style={{ display: 'flex', gap: '0.8rem', fontSize: '0.9rem' }}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>
            Log
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>
            Stats
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>
            Settings
          </NavLink>
        </nav>
      </div>
      <div className="muted" style={{ fontSize: '0.85rem' }}>
        {profile?.slug} · <button className="ghost" style={{ padding: '0.3rem 0.6rem' }} onClick={signOut}>ログアウト</button>
      </div>
    </header>
  );
}
