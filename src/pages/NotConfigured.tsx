// Supabaseの環境変数が未設定のときに表示。外部セットアップの案内を兼ねる
export function NotConfigured() {
  return (
    <div className="container">
      <h1 className="brand">✈ FLIGHT LOGGER</h1>
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2>Supabase が未設定です</h2>
        <p className="muted">
          プロジェクトルートに <code>.env</code> を作成し、Supabaseプロジェクトの値を設定してください:
        </p>
        <pre style={{ background: '#0f1220', padding: '1rem', borderRadius: '0.5rem', overflowX: 'auto' }}>
          {`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY`}
        </pre>
        <p className="muted">設定後、開発サーバーを再起動してください。</p>
      </div>
    </div>
  );
}
