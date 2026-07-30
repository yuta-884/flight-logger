import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

// プライバシーポリシー・利用規約への導線。各画面の最下部に置く。
// 埋め込みカード（/embed）には置かない（iframeで外部サイトに貼られるため）。
export function LegalFooter() {
  const { t } = useI18n();
  return (
    <p className="muted" style={{ marginTop: '2.5rem', fontSize: '0.8rem' }}>
      <Link to="/guide">{t('guide')}</Link>
      {' · '}
      <Link to="/privacy">{t('privacyPolicy')}</Link>
      {' · '}
      <Link to="/terms">{t('termsOfService')}</Link>
    </p>
  );
}

// オンボーディング用の同意文言。入力中のフォームを失わないよう別タブで開く。
export function ConsentNote() {
  const { t } = useI18n();
  return (
    <p className="muted" style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
      {t('consentPrefix')}
      <a href="/privacy" target="_blank" rel="noopener noreferrer">
        {t('privacyPolicy')}
      </a>
      {t('consentMiddle')}
      <a href="/terms" target="_blank" rel="noopener noreferrer">
        {t('termsOfService')}
      </a>
      {t('consentSuffix')}
    </p>
  );
}
