import { Navigate, Route, Routes } from 'react-router-dom';
import { isSupabaseConfigured } from './lib/supabase';
import { useAuth } from './auth/AuthProvider';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Flights } from './pages/Flights';
import { NotConfigured } from './pages/NotConfigured';

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
