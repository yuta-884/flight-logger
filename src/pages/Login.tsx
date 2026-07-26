import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n, type Lang } from '../lib/i18n';
import { LegalFooter } from '../components/LegalFooter';

export function Login() {
  const { t, lang, setLang } = useI18n();
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
      {/* 未ログインでも言語を選べるようにする（初期値はブラウザ言語） */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          aria-label="Language"
          style={{ width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </div>
      <h1 className="brand" style={{ width: 'fit-content' }}>✈ FLIGHT LOGGER</h1>
      <p className="muted" style={{ marginTop: '0.4rem' }}>{t('appTagline')}</p>
      <div className="card" style={{ marginTop: '1.5rem', maxWidth: '26rem' }}>
        <h2>{t('signInTitle')}</h2>
        <p className="muted">{t('signInDesc')}</p>
        <button onClick={signInWithGoogle} disabled={busy} style={{ marginTop: '0.5rem' }}>
          {busy ? t('redirecting') : t('signInWithGoogle')}
        </button>
        {error && <p className="error" style={{ marginTop: '0.8rem' }}>{error}</p>}
      </div>
      <LegalFooter />
    </div>
  );
}
