import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { validateSlug } from '../lib/slug';

// 初回ログイン後、公開URL用のslugを本人が入力して profiles を作成する
export function Onboarding() {
  const { session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestedName = session?.user.user_metadata?.name ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateSlug(slug);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('profiles').insert({
      id: session!.user.id,
      slug: check.slug,
      display_name: suggestedName,
    });
    if (error) {
      // 一意制約違反（slug重複）を分かりやすく案内
      setError(error.code === '23505' ? 'このユーザーIDは既に使われています' : error.message);
      setBusy(false);
      return;
    }
    await refreshProfile();
    navigate('/', { replace: true });
  }

  return (
    <div className="container">
      <h1 className="brand">✈ FLIGHT LOGGER</h1>
      <form className="card" onSubmit={submit} style={{ marginTop: '1.5rem', maxWidth: '30rem' }}>
        <h2>ユーザーIDを決める</h2>
        <p className="muted">
          あなたの公開プロフィールのURL（<code>/u/ユーザーID</code>）に使われます。あとから変更できます。
        </p>
        <div className="field">
          <label htmlFor="slug">ユーザーID</label>
          <input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="yuta"
            autoFocus
            autoComplete="off"
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy || slug.length < 3}>
          {busy ? '作成中…' : '決定'}
        </button>
      </form>
    </div>
  );
}
