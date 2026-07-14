import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isSupabaseConfigured } from './lib/supabase';
import { useAuth } from './auth/AuthProvider';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Flights } from './pages/Flights';
import { NotConfigured } from './pages/NotConfigured';

// 統計ページは globe.gl / three.js を含み重いので遅延ロード（初期ロードを軽くする）
const Stats = lazy(() => import('./pages/Stats').then((m) => ({ default: m.Stats })));

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

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/onboarding"
        element={!session ? <Navigate to="/login" replace /> : profile ? <Navigate to="/" replace /> : <Onboarding />}
      />
      <Route
        path="/"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : !profile ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <Flights />
          )
        }
      />
      <Route
        path="/stats"
        element={
          !session ? (
            <Navigate to="/login" replace />
          ) : !profile ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <Suspense fallback={<div className="container"><p className="muted">読み込み中…</p></div>}>
              <Stats />
            </Suspense>
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
