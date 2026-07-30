import { useI18n } from '../lib/i18n';
import { LegalLayout } from './Legal';

// 使い方ガイド。認証不要の公開ページ（登録前の人が読める）。
// Flighty等の前提知識がない人向けに、登録〜共有までの流れを説明する。

export function Guide() {
  const { lang } = useI18n();
  return (
    <LegalLayout title={lang === 'ja' ? '使い方ガイド' : 'How to use'}>
      {lang === 'ja' ? <GuideJa /> : <GuideEn />}
    </LegalLayout>
  );
}

function GuideJa() {
  return (
    <>
      <p>
        FLIGHT LOGGERは、自分が乗った飛行機を記録して、統計・回る地球儀・パスポート風カードとして眺められる無料のサービスです。
      </p>

      <h3>1. はじめる</h3>
      <ul>
        <li>トップページの「Googleでログイン」からGoogleアカウントでログインします</li>
        <li>
          初回ログイン時に<strong>ユーザーID</strong>（小文字英数字とハイフン、例: <code>taro-yamada</code>）を決めます。これはあなたの公開ページのURLになります。あとから変更できます
        </li>
      </ul>

      <h3>2. フライトを登録する（3つの方法）</h3>
      <p>
        <strong>① 便名で検索（いちばん簡単）</strong>
        <br />
        Logページで便名（例: <code>GK205</code>。搭乗券や予約メールに書いてあります）と搭乗日を入れて検索すると、区間や時刻が自動で入ります。過去1年までさかのぼれます。検索回数には上限（1日10回・月50回）がありますが、ふつうに使う分には困りません。
      </p>
      <p>
        <strong>② 手入力</strong>
        <br />
        便名・搭乗日と、出発・到着空港の3文字コード（例: 成田=<code>NRT</code>、羽田=<code>HND</code>、関空=<code>KIX</code>）を入れて登録します。空港コードは「空港名 IATA」で検索すると分かります。1年より前の古いフライトや、検索で見つからない便はこちらで登録してください。
      </p>
      <p>
        <strong>③ Flightyからまとめて取り込む</strong>
        <br />
        Flighty（フライティ）はiPhone向けの有名なフライト記録アプリです。すでにFlightyに搭乗履歴をためている人は、CSVを書き出して一括で取り込めます:
      </p>
      <ul>
        <li>Flightyアプリで Settings → Account Data → <strong>Export Your Flights</strong> を選び、CSVファイルを保存</li>
        <li>本サービスのLogページ「Flighty CSV をインポート」でそのファイルを選択</li>
        <li>何度実行しても同じ便は二重登録されないので安心です</li>
      </ul>
      <p className="muted">Flightyを使ったことがなければ、この方法は飛ばして①②だけでまったく問題ありません。</p>

      <h3>3. 乗り継ぎと「滞在」チェック</h3>
      <p>
        24時間以内に同じ空港から次の便に乗っている場合、その空港の国は「乗り継ぎのみ」として数えられます（国旗が薄く表示されます）。乗り継ぎ時間が長くて実際に入国した場合は、Logページの一覧でその便の<strong>「滞在」にチェック</strong>を入れると「行った国」に昇格します。
      </p>

      <h3>4. 飛行機以外で行った国</h3>
      <p>
        船や陸路で入国した国（例: 香港からフェリーでマカオ）は、Settingsページの「行った国の追加」から加えられます。統計と国旗に反映されます。
      </p>

      <h3>5. 統計と地球儀を見る</h3>
      <p>
        Statsページに、総距離（地球何周分か）・総飛行時間・年別回数・空港/航空会社ランキング・行った国が表示され、飛行ルートが回る地球儀に描かれます。登録した瞬間に反映されます。
      </p>

      <h3>6. 共有する（任意）</h3>
      <ul>
        <li>記録は<strong>最初は非公開</strong>で、あなたにしか見えません</li>
        <li>Settingsで「公開する」にすると、公開ページ（<code>/u/あなたのID</code>）を誰にでも共有できます</li>
        <li>ブログやNotionに貼れるパスポート風カード（iframe）もSettingsからコピーできます</li>
        <li>公開はいつでも解除できます</li>
      </ul>

      <h3>7. 言語</h3>
      <p>画面右上のセレクタで日本語と英語を切り替えられます。</p>

      <h3>困ったときは</h3>
      <p>
        <a href="mailto:nayutalabs@gmail.com">nayutalabs@gmail.com</a> までお気軽にどうぞ。
      </p>
    </>
  );
}

function GuideEn() {
  return (
    <>
      <p>
        FLIGHT LOGGER is a free service for recording the flights you've taken and viewing them as statistics, a
        spinning globe and a passport-style card.
      </p>

      <h3>1. Getting started</h3>
      <ul>
        <li>Sign in with your Google account from the top page.</li>
        <li>
          On first sign-in you choose a <strong>user ID</strong> (lowercase letters, digits and hyphens, e.g.{' '}
          <code>taro-yamada</code>). It becomes your public page URL and can be changed later.
        </li>
      </ul>

      <h3>2. Adding flights (three ways)</h3>
      <p>
        <strong>① Search by flight number (easiest)</strong>
        <br />
        On the Log page, enter the flight number (e.g. <code>GK205</code> — it's on your boarding pass or booking
        email) and the date. The route and times are filled in automatically. Searches go back one year and are
        rate-limited (10/day, 50/month) — plenty for normal use.
      </p>
      <p>
        <strong>② Manual entry</strong>
        <br />
        Enter the flight number, date and the 3-letter airport codes (e.g. Tokyo Narita = <code>NRT</code>, Haneda ={' '}
        <code>HND</code>). Search the web for “airport name IATA” if unsure. Use this for flights older than one year
        or ones the search can't find.
      </p>
      <p>
        <strong>③ Import from Flighty</strong>
        <br />
        Flighty is a popular flight-tracking app for iPhone. If you already keep your history there, you can import it
        all at once:
      </p>
      <ul>
        <li>
          In Flighty: Settings → Account Data → <strong>Export Your Flights</strong>, and save the CSV file.
        </li>
        <li>On the Log page, choose that file under “Import Flighty CSV”.</li>
        <li>Running it again is safe — the same flight is never imported twice.</li>
      </ul>
      <p className="muted">Never used Flighty? Skip this — methods ① and ② are all you need.</p>

      <h3>3. Layovers and the “Stay” checkbox</h3>
      <p>
        If your next flight leaves from the same airport within 24 hours, that country counts as “layover only” (its
        flag appears dimmed). If a long layover meant you actually entered the country, tick <strong>Stay</strong> on
        that flight in the Log list to promote it to a visited country.
      </p>

      <h3>4. Countries visited without flying</h3>
      <p>
        Countries you entered by ferry or overland (e.g. Hong Kong → Macau by ferry) can be added under “Add visited
        countries” on the Settings page. They count toward your stats and flags.
      </p>

      <h3>5. Stats and the globe</h3>
      <p>
        The Stats page shows total distance (in laps around Earth), flight time, per-year counts, airport and airline
        rankings and visited countries, with your routes drawn on a spinning globe — updated the moment you add a
        flight.
      </p>

      <h3>6. Sharing (optional)</h3>
      <ul>
        <li>
          Your records are <strong>private by default</strong> — only you can see them.
        </li>
        <li>
          Turn on “Make public” in Settings to share your public page (<code>/u/your-id</code>) with anyone.
        </li>
        <li>A passport-style embed card (iframe) for blogs or Notion can also be copied from Settings.</li>
        <li>You can turn sharing off at any time.</li>
      </ul>

      <h3>7. Language</h3>
      <p>Switch between Japanese and English with the selector at the top right.</p>

      <h3>Need help?</h3>
      <p>
        Email <a href="mailto:nayutalabs@gmail.com">nayutalabs@gmail.com</a> any time.
      </p>
    </>
  );
}
