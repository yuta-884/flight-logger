// slug検証（仕様§11）。クライアント即時バリデーション用。
// サーバー側でもDB制約/一意性で最終担保する（クライアントの検証は信用しない）

// システムルートや将来のパスと衝突する予約語
const RESERVED = new Set([
  'admin', 'api', 'embed', 'u', 'login', 'logout', 'signin', 'signout', 'auth',
  'settings', 'about', 'help', 'static', 'assets', 'public', 'new', 'edit',
  'me', 'profile', 'flights', 'app', 'www', 'root', 'null', 'undefined',
]);

// [a-z0-9-]、先頭は英字、末尾はハイフン不可、連続ハイフン不可、3〜30文字
const FORMAT = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// 表示メッセージはi18n辞書（slugErr_*）で解決するため、理由はコードで返す
export type SlugErrorCode = 'length' | 'format' | 'reserved';

export function validateSlug(raw: string): { ok: true; slug: string } | { ok: false; reason: SlugErrorCode } {
  const slug = raw.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 30) return { ok: false, reason: 'length' };
  if (!FORMAT.test(slug)) return { ok: false, reason: 'format' };
  if (RESERVED.has(slug)) return { ok: false, reason: 'reserved' };
  return { ok: true, slug };
}
