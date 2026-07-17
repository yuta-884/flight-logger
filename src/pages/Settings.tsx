import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { validateSlug } from '../lib/slug';
import { AppHeader } from '../components/AppHeader';

// 公開設定: プロフィールの公開ON/OFF、slug変更、公開URL・埋め込みコードの表示。
export function Settings() {
  const { profile, refreshProfile } = useAuth();
  const [slug, setSlug] = useState(profile?.slug ?? '');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const origin = window.location.origin;
  const publicUrl = `${origin}/u/${profile?.slug}`;
  const embedUrl = `${origin}/embed/${profile?.slug}`;
  const iframe = `<iframe src="${embedUrl}" width="100%" height="620" style="border:none;max-width:660px" loading="lazy"></iframe>`;

  async function togglePublic() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ is_public: !profile.is_public }).eq('id', profile.id);
    setBusy(false);
    if (!error) await refreshProfile();
  }

  async function saveSlug(e: React.FormEvent) {
    e.preventDefault();
    setSlugError(null);
    setSaved(false);
    const check = validateSlug(slug);
    if (!check.ok) return setSlugError(check.reason);
    if (check.slug === profile?.slug) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ slug: check.slug }).eq('id', profile!.id);
    setBusy(false);
    if (error) return setSlugError(error.code === '23505' ? 'このslugは既に使われています' : error.message);
    await refreshProfile();
    setSaved(true);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* クリップボード不可時は無視 */
    }
  }

  if (!profile) return null;

  return (
    <div className="container">
      <AppHeader />

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>公開設定</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 600 }}>
              プロフィールを公開する
              <span
                style={{
                  marginLeft: '0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: profile.is_public ? 'var(--accent2)' : 'var(--muted)',
                }}
              >
                {profile.is_public ? '● 公開中' : '○ 非公開'}
              </span>
            </div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              公開にすると、誰でも下記URLであなたの統計・地球儀を閲覧できます。
            </div>
          </div>
          <button
            className={profile.is_public ? 'ghost' : ''}
            onClick={togglePublic}
            disabled={busy}
            style={{ whiteSpace: 'nowrap' }}
          >
            {profile.is_public ? '非公開にする' : '公開する'}
          </button>
        </div>
      </div>

      <form className="card" onSubmit={saveSlug} style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>公開URL（slug）</h2>
        <div className="field">
          <label htmlFor="slug">slug</label>
          <input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} autoComplete="off" />
        </div>
        {slugError && <p className="error">{slugError}</p>}
        {saved && <p className="muted">保存しました。</p>}
        <p className="muted" style={{ fontSize: '0.8rem' }}>
          変更すると旧URL（<code>/u/{profile.slug}</code>）は無効になり、共有リンクが切れます。
        </p>
        <button type="submit" disabled={busy || slug === profile.slug || slug.length < 3}>
          slugを保存
        </button>
      </form>

      {profile.is_public && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>共有</h2>
          <div className="field">
            <label>公開ページ</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} />
              <button className="ghost" type="button" onClick={() => copy(publicUrl)}>コピー</button>
            </div>
          </div>
          <div className="field">
            <label>埋め込みカード（iframe）</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input readOnly value={iframe} onFocus={(e) => e.currentTarget.select()} />
              <button className="ghost" type="button" onClick={() => copy(iframe)}>コピー</button>
            </div>
            <p className="muted" style={{ fontSize: '0.8rem' }}>
              Notion・ブログなどにこのiframeを貼り付けるとカードが表示されます。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
