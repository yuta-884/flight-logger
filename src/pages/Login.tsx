import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
    // 成功時はGoogleへリダイレクトされる
  }

  return (
    <div className="container">
      <h1 className="brand">✈ FLIGHT LOGGER</h1>
      <div className="card" style={{ marginTop: '1.5rem', maxWidth: '26rem' }}>
        <h2>Sign in</h2>
        <p className="muted">Googleアカウントでログインして、自分のフライトを記録します。</p>
        <button onClick={signInWithGoogle} disabled={busy} style={{ marginTop: '0.5rem' }}>
          {busy ? 'リダイレクト中…' : 'Googleでログイン'}
        </button>
        {error && <p className="error" style={{ marginTop: '0.8rem' }}>{error}</p>}
      </div>
    </div>
  );
}
