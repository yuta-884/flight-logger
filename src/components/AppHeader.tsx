import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n, type Lang } from '../lib/i18n';

// 共通ヘッダー。ナビ＋slug表示＋言語切替＋ログアウト。
// ナビ・Log outは全言語で英語のまま（統計・公開ページの表記と統一）。
// showBack: 法務・ガイドページ用。2段目の左端に「← 戻る」を出す。
// 未ログインでも使える（slug・Log outは自動的に非表示、ナビはログイン画面へ誘導される）。
export function AppHeader({ showBack = false }: { showBack?: boolean }) {
  const { session, profile, signOut } = useAuth();
  const { lang, setLang, t } = useI18n();
  return (
    <header className="app-header">
      {/* 1段目: ロゴ（左）＋ナビ（右）。狭幅でもこの2つは必ず同じ行に収める */}
      <div className="app-header-top">
        <h1 className="brand">✈ FLIGHT LOGGER</h1>
        <nav className="app-nav">
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
      {/* 2段目: （戻る）＋ユーザーID・言語・ログアウト（右寄せ） */}
      <div className="app-header-user muted">
        {showBack && (
          <Link to="/" className="navlink" style={{ marginRight: 'auto' }}>
            ← {t('back')}
          </Link>
        )}
        {profile && <span>{profile.slug}</span>}
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          aria-label="Language"
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
        {session && (
          <button className="ghost" onClick={signOut}>
            Log out
          </button>
        )}
      </div>
    </header>
  );
}
