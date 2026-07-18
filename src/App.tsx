import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isSupabaseConfigured } from './lib/supabase';
import { useAuth } from './auth/AuthProvider';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Flights } from './pages/Flights';
import { Settings } from './pages/Settings';
import { NotConfigured } from './pages/NotConfigured';

// globe.gl / three.js を含む重いページは遅延ロード（初期ロードを軽くする）
const Stats = lazy(() => import('./pages/Stats').then((m) => ({ default: m.Stats })));
const PublicProfile = lazy(() => import('./pages/PublicProfile').then((m) => ({ default: m.PublicProfile })));
const EmbedCard = lazy(() => import('./pages/EmbedCard').then((m) => ({ default: m.EmbedCard })));

const loadingEl = <div className="container"><p className="muted">Loading…</p></div>;

export function App() {
  if (!isSupabaseConfigured) return <NotConfigured />;

  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  // ログイン必須ページの共通ガード
  const gated = (el: React.ReactNode) =>
    !session ? <Navigate to="/login" replace /> : !profile ? <Navigate to="/onboarding" replace /> : <>{el}</>;

  return (
    <Routes>
      {/* 公開ルート（認証不要。RLSが公開プロフィールのみ許可） */}
      <Route path="/u/:slug" element={<Suspense fallback={loadingEl}><PublicProfile /></Suspense>} />
      <Route path="/embed/:slug" element={<Suspense fallback={loadingEl}><EmbedCard /></Suspense>} />

      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/onboarding"
        element={!session ? <Navigate to="/login" replace /> : profile ? <Navigate to="/" replace /> : <Onboarding />}
      />
      <Route path="/" element={gated(<Flights />)} />
      <Route path="/settings" element={gated(<Settings />)} />
      <Route path="/stats" element={gated(<Suspense fallback={loadingEl}><Stats /></Suspense>)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
