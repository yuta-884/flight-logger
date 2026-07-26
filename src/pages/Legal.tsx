import { Link } from 'react-router-dom';
import { useI18n, type Lang } from '../lib/i18n';

// プライバシーポリシー・利用規約。認証不要の公開ページ。
// 日本語を正文とし、英語は参考訳（UIの言語設定に連動して表示を切り替える）。
// 事業者名・連絡先はここが唯一の定義箇所。

const OPERATOR = 'Yuta Hayashi';
const CONTACT = 'yuuta0711884@gmail.com';
const ENACTED = '2026-07-26';

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="container legal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <Link to="/" className="navlink">
          ← {t('back')}
        </Link>
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
      <h1 className="brand" style={{ fontSize: '1.3rem', width: 'fit-content', marginTop: '1rem' }}>
        ✈ FLIGHT LOGGER
      </h1>
      <div className="card" style={{ marginTop: '1.2rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem', textTransform: 'none', letterSpacing: 'normal', color: 'var(--fg)' }}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

// 英語版に付ける注記（日本語版が正文である旨）
function TranslationNote() {
  return (
    <p className="muted" style={{ fontSize: '0.8rem' }}>
      This is a reference translation. The Japanese version is the authoritative text.
    </p>
  );
}

export function Privacy() {
  const { lang } = useI18n();
  return (
    <LegalLayout title={lang === 'ja' ? 'プライバシーポリシー' : 'Privacy Policy'}>
      {lang === 'ja' ? <PrivacyJa /> : <PrivacyEn />}
    </LegalLayout>
  );
}

export function Terms() {
  const { lang } = useI18n();
  return (
    <LegalLayout title={lang === 'ja' ? '利用規約' : 'Terms of Service'}>
      {lang === 'ja' ? <TermsJa /> : <TermsEn />}
    </LegalLayout>
  );
}

function PrivacyJa() {
  return (
    <>
      <p>
        FLIGHT LOGGER（以下「本サービス」）における個人情報の取扱いについて、以下のとおり定めます。
      </p>

      <h3>1. 事業者</h3>
      <p>
        {OPERATOR}（個人）
        <br />
        連絡先: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>

      <h3>2. 取得する情報</h3>
      <ul>
        <li>Googleアカウント情報: 氏名、メールアドレス（Googleログイン時に取得）</li>
        <li>
          利用者が登録した情報: ユーザーID、表示名、フライトの記録（便名・搭乗日・出発/到着空港・航空会社・公表スケジュール）、手動で追加した訪問国、公開設定
        </li>
        <li>ブラウザに保存される情報: ログインセッション、言語設定</li>
      </ul>
      <p>アクセス解析ツール、広告、トラッキングCookieは使用していません。</p>

      <h3>3. 利用目的</h3>
      <ul>
        <li>本サービスの提供（記録の保存、統計・地球儀の表示、公開プロフィールの表示）</li>
        <li>不正利用の防止および外部API利用量の管理</li>
      </ul>

      <h3>4. 第三者への提供</h3>
      <p>
        取得した個人情報を、本人の同意なく第三者に提供することはありません。ただし、本サービスの運営のため以下の事業者のサービスを利用しています。
      </p>
      <ul>
        <li>Supabase Inc.（データベース・認証基盤。データはAWS東京リージョン（ap-northeast-1）に保存されます）</li>
        <li>Cloudflare, Inc.（Webサイトの配信）</li>
        <li>Google LLC（ログイン認証）</li>
        <li>AeroDataBox（便名の照会。送信するのは便名と搭乗日のみで、個人を識別できる情報は送信しません）</li>
      </ul>

      <h3>5. 公開範囲</h3>
      <p>
        フライトの記録は初期状態では非公開で、本人のみが閲覧できます。設定画面で公開を選択した場合に限り、公開URL（/u/ユーザーID）および埋め込みカードにおいて、表示名・統計・訪問国・空港/航空会社の集計を誰でも閲覧できる状態になります。公開はいつでも解除できます。なお、公開中のページは検索エンジン等に取得される可能性があります。
      </p>

      <h3>6. 開示・訂正・利用停止・削除の請求</h3>
      <p>
        保有個人データの開示、訂正、利用停止、削除をご希望の場合は、上記の連絡先までご連絡ください。ご本人であることを確認のうえ、速やかに対応いたします。アカウントを削除した場合、フライトの記録を含む保存済みのデータはすべて削除されます。
      </p>

      <h3>7. 安全管理措置</h3>
      <p>
        データベースは行単位のアクセス制御（Row Level Security）により、各利用者が自身のデータのみ読み書きできるよう構成しています。通信はすべてHTTPSで暗号化されます。
      </p>

      <h3>8. 本ポリシーの変更</h3>
      <p>本ポリシーは必要に応じて変更することがあります。重要な変更を行う場合は本ページで告知します。</p>

      <p className="muted" style={{ fontSize: '0.8rem' }}>制定日: {ENACTED}</p>
    </>
  );
}

function PrivacyEn() {
  return (
    <>
      <TranslationNote />
      <p>This policy describes how FLIGHT LOGGER (the "Service") handles personal information.</p>

      <h3>1. Operator</h3>
      <p>
        {OPERATOR} (individual)
        <br />
        Contact: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>

      <h3>2. Information we collect</h3>
      <ul>
        <li>Google account information: your name and email address, obtained when you sign in with Google.</li>
        <li>
          Information you enter: user ID, display name, flight records (flight number, date, origin/destination airports, airline, published schedule), manually added visited countries, and your visibility setting.
        </li>
        <li>Stored in your browser: your login session and language preference.</li>
      </ul>
      <p>We use no analytics tools, no advertising, and no tracking cookies.</p>

      <h3>3. Purpose of use</h3>
      <ul>
        <li>To provide the Service (storing your records, showing stats and the globe, serving your public profile).</li>
        <li>To prevent abuse and to manage third-party API usage.</li>
      </ul>

      <h3>4. Disclosure to third parties</h3>
      <p>We do not provide your personal information to third parties without your consent. We use the following providers to operate the Service:</p>
      <ul>
        <li>Supabase Inc. (database and authentication; data is stored in the AWS Tokyo region, ap-northeast-1)</li>
        <li>Cloudflare, Inc. (website delivery)</li>
        <li>Google LLC (sign-in)</li>
        <li>AeroDataBox (flight lookup; only the flight number and date are sent — never information that identifies you)</li>
      </ul>

      <h3>5. Visibility</h3>
      <p>
        Your flight records are private by default and visible only to you. Only if you turn on public visibility in Settings do your display name, statistics, visited countries and airport/airline rankings become viewable by anyone at your public URL (/u/your-id) and embed card. You can turn this off at any time. While public, the page may be indexed by search engines.
      </p>

      <h3>6. Requests for disclosure, correction, suspension or deletion</h3>
      <p>
        To request disclosure, correction, suspension of use, or deletion of your data, contact us at the address above. We will verify your identity and respond promptly. Deleting your account removes all stored data, including your flight records.
      </p>

      <h3>7. Security</h3>
      <p>
        The database enforces row-level security so that each user can read and write only their own data. All traffic is encrypted over HTTPS.
      </p>

      <h3>8. Changes to this policy</h3>
      <p>We may revise this policy as needed. Material changes will be announced on this page.</p>

      <p className="muted" style={{ fontSize: '0.8rem' }}>Effective date: {ENACTED}</p>
    </>
  );
}

function TermsJa() {
  return (
    <>
      <h3>第1条（適用）</h3>
      <p>
        本規約は、FLIGHT LOGGER（以下「本サービス」）の利用条件を定めるものです。利用者は本規約に同意のうえ本サービスを利用するものとします。
      </p>

      <h3>第2条（サービス内容）</h3>
      <p>
        本サービスは、利用者が搭乗したフライトを記録し、統計・地球儀・カードとして表示する個人向けの無償サービスです。
      </p>

      <h3>第3条（アカウント）</h3>
      <p>
        本サービスの利用にはGoogleアカウントが必要です。利用者は自己の責任においてアカウントを管理するものとします。
      </p>

      <h3>第4条（禁止事項）</h3>
      <ul>
        <li>法令または公序良俗に違反する行為</li>
        <li>他人になりすます行為、他人の情報を無断で登録する行為</li>
        <li>本サービスのサーバー・ネットワークに過度な負荷をかける行為、自動化された手段による大量アクセス</li>
        <li>本サービスの運営を妨害する行為</li>
      </ul>

      <h3>第5条（公開プロフィール）</h3>
      <p>
        利用者は自らの判断で記録を公開できます。公開した情報は不特定多数が閲覧できる状態となり、第三者による保存・転載を完全に防ぐことはできません。公開の可否は利用者の責任において判断してください。
      </p>

      <h3>第6条（フライト情報の正確性）</h3>
      <p>
        本サービスが表示する距離・飛行時間・空港および航空会社の情報は、公開データおよび公表スケジュールに基づく参考値です。実際の運航実績と一致することを保証しません。
      </p>

      <h3>第7条（免責）</h3>
      <p>
        本サービスは無償で現状有姿にて提供され、その完全性・正確性・可用性について保証しません。運営者は、本サービスの利用または利用不能により生じた損害について、故意または重過失がある場合を除き責任を負いません。データの消失に備え、重要な記録は利用者ご自身でも保管することを推奨します。
      </p>

      <h3>第8条（サービスの変更・終了）</h3>
      <p>
        運営者は、利用者への事前の通知なく本サービスの内容を変更し、または提供を終了することがあります。終了する場合は、可能な限り事前に本サービス上で告知します。
      </p>

      <h3>第9条（規約の変更）</h3>
      <p>
        運営者は必要と判断した場合、本規約を変更することがあります。変更後の規約は本ページに掲示した時点から効力を生じます。
      </p>

      <h3>第10条（準拠法・管轄）</h3>
      <p>
        本規約は日本法に準拠します。本サービスに関して紛争が生じた場合、運営者の住所地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
      </p>

      <p className="muted" style={{ fontSize: '0.8rem' }}>制定日: {ENACTED}</p>
    </>
  );
}

function TermsEn() {
  return (
    <>
      <TranslationNote />

      <h3>1. Scope</h3>
      <p>These terms govern your use of FLIGHT LOGGER (the "Service"). By using the Service you agree to them.</p>

      <h3>2. The Service</h3>
      <p>
        The Service is a free, personal tool for recording the flights you have taken and displaying them as statistics, a globe and a card.
      </p>

      <h3>3. Accounts</h3>
      <p>A Google account is required. You are responsible for managing your own account.</p>

      <h3>4. Prohibited conduct</h3>
      <ul>
        <li>Violating any law or public order and morals.</li>
        <li>Impersonating others, or registering another person's information without permission.</li>
        <li>Placing an excessive load on the Service's servers or network, including automated bulk access.</li>
        <li>Interfering with the operation of the Service.</li>
      </ul>

      <h3>5. Public profiles</h3>
      <p>
        You may choose to make your records public. Public information can be viewed by anyone, and we cannot fully prevent third parties from saving or republishing it. The decision to publish is yours.
      </p>

      <h3>6. Accuracy of flight data</h3>
      <p>
        Distances, flight times and airport/airline information shown by the Service are reference values derived from public data and published schedules. We do not guarantee that they match actual operations.
      </p>

      <h3>7. Disclaimer</h3>
      <p>
        The Service is provided free of charge on an "as is" basis, without warranty of completeness, accuracy or availability. Except in cases of willful misconduct or gross negligence, the operator is not liable for damages arising from use of, or inability to use, the Service. We recommend keeping your own copy of important records.
      </p>

      <h3>8. Changes to and termination of the Service</h3>
      <p>
        The operator may change or discontinue the Service without prior notice. If the Service is discontinued, we will announce it in advance where reasonably possible.
      </p>

      <h3>9. Changes to these terms</h3>
      <p>The operator may revise these terms. Revised terms take effect when posted on this page.</p>

      <h3>10. Governing law and jurisdiction</h3>
      <p>
        These terms are governed by the laws of Japan. Any dispute relating to the Service shall be subject to the exclusive jurisdiction of the court having jurisdiction over the operator's address as the court of first instance.
      </p>

      <p className="muted" style={{ fontSize: '0.8rem' }}>Effective date: {ENACTED}</p>
    </>
  );
}
