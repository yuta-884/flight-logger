import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

// プライバシーポリシー・利用規約への導線。ログイン画面と設定画面の最下部に置く。
export function LegalFooter() {
  const { t } = useI18n();
  return (
    <p className="muted" style={{ marginTop: '2.5rem', fontSize: '0.8rem' }}>
      <Link to="/privacy">{t('privacyPolicy')}</Link>
      {' · '}
      <Link to="/terms">{t('termsOfService')}</Link>
    </p>
  );
}
