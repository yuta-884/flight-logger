import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { validateSlug } from '../lib/slug';
import { useI18n } from '../lib/i18n';
import { listCountries, loadMasters, type Country } from '../lib/masters';
import { loadManualCountries } from '../lib/publicProfile';
import { AppHeader } from '../components/AppHeader';

// ISO 3166-1 alpha-2 → 絵文字国旗
const flagOf = (cc: string) => String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

// 公開設定: プロフィールの公開ON/OFF、slug変更、公開URL・埋め込みコードの表示。
export function Settings() {
  const { profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [slug, setSlug] = useState(profile?.slug ?? '');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const [countries, setCountries] = useState<Country[]>([]);
  const [manual, setManual] = useState<{ code: string; name: string | null }[]>([]);
  const [selCountry, setSelCountry] = useState('');

  // 手動「行った国」: マスタから国一覧を用意し、登録済みを読み込む
  useEffect(() => {
    if (!profile) return;
    loadMasters()
      .then(() => {
        setCountries(listCountries());
        return loadManualCountries(profile.id);
      })
      .then(setManual)
      .catch(() => {});
  }, [profile?.id]);

  async function addCountry() {
    if (!profile || !selCountry) return;
    setBusy(true);
    const { error } = await supabase
      .from('manual_countries')
      .insert({ user_id: profile.id, country_code: selCountry });
    setBusy(false);
    if (error) {
      alert(t('countryAddFailed', { msg: error.message }));
      return;
    }
    setSelCountry('');
    setManual(await loadManualCountries(profile.id));
  }

  async function removeCountry(code: string) {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase
      .from('manual_countries')
      .delete()
      .eq('user_id', profile.id)
      .eq('country_code', code);
    setBusy(false);
    if (!error) setManual(await loadManualCountries(profile.id));
  }

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
    if (!check.ok) return setSlugError(t(`slugErr_${check.reason}`));
    if (check.slug === profile?.slug) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ slug: check.slug }).eq('id', profile!.id);
    setBusy(false);
    if (error) return setSlugError(error.code === '23505' ? t('userIdTaken') : error.message);
    await refreshProfile();
    setSaved(true);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* クリップボード不可時は無視 */
    }
  }

  if (!profile) return null;

  return (
    <div className="container">
      <AppHeader />

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>{t('publicCard')}</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 600 }}>
              {t('publicToggle')}
              <span
                style={{
                  marginLeft: '0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: profile.is_public ? 'var(--accent2)' : 'var(--muted)',
                }}
              >
                {profile.is_public ? t('statusPublic') : t('statusPrivate')}
              </span>
            </div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              {t('publicDesc')}
            </div>
          </div>
          <button
            className={profile.is_public ? 'ghost' : ''}
            onClick={togglePublic}
            disabled={busy}
            style={{ whiteSpace: 'nowrap' }}
          >
            {profile.is_public ? t('makePrivate') : t('makePublic')}
          </button>
        </div>
      </div>

      <form className="card" onSubmit={saveSlug} style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>{t('userIdCard')}</h2>
        <div className="field">
          <input
            id="slug"
            aria-label={t('userIdCard')}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            autoComplete="off"
          />
        </div>
        {slugError && <p className="error">{slugError}</p>}
        {saved && <p className="muted">{t('userIdSaved')}</p>}
        <p className="muted" style={{ fontSize: '0.8rem' }}>
          {t('userIdWarning', { url: `/u/${profile.slug}` })}
        </p>
        <button type="submit" disabled={busy || slug === profile.slug || slug.length < 3}>
          {t('saveUserId')}
        </button>
      </form>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>{t('countriesCard')}</h2>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          {t('countriesDesc')}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select
            aria-label={t('countriesCard')}
            value={selCountry}
            onChange={(e) => setSelCountry(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          >
            <option value="">{t('selectCountry')}</option>
            {countries
              .filter((c) => !manual.some((m) => m.code === c.code))
              .map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name ?? c.code}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={addCountry}
            disabled={!selCountry || busy}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {t('add')}
          </button>
        </div>
        {manual.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.9rem' }}>
            {manual.map((m) => (
              <span
                key={m.code}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'var(--row)',
                  borderRadius: '999px',
                  padding: '0.3rem 0.4rem 0.3rem 0.75rem',
                  fontSize: '0.85rem',
                }}
              >
                {flagOf(m.code)} {m.name ?? m.code}
                <button
                  className="ghost"
                  type="button"
                  onClick={() => removeCountry(m.code)}
                  disabled={busy}
                  aria-label={t('removeCountryAria', { name: m.name ?? m.code })}
                  style={{ padding: '0.05rem 0.4rem', fontSize: '0.75rem' }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {profile.is_public && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t('shareCard')}</h2>
          <div className="field">
            <label>{t('publicPageLabel')}</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input readOnly value={publicUrl} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 0 }} />
              <button className="ghost" type="button" onClick={() => copy(publicUrl)} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{t('copy')}</button>
            </div>
          </div>
          <div className="field">
            <label>{t('embedLabel')}</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input readOnly value={iframe} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 0 }} />
              <button className="ghost" type="button" onClick={() => copy(iframe)} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{t('copy')}</button>
            </div>
            <p className="muted" style={{ fontSize: '0.8rem' }}>
              {t('iframeHint')}
            </p>
          </div>
        </div>
      )}

      {copied && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--card)',
            border: '1px solid var(--row)',
            borderRadius: '0.6rem',
            padding: '0.55rem 1.1rem',
            fontSize: '0.9rem',
            boxShadow: '0 6px 20px rgba(0,0,0,.45)',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          {t('copied')}
        </div>
      )}
    </div>
  );
}
