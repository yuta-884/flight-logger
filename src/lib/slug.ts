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

export function validateSlug(raw: string): { ok: true; slug: string } | { ok: false; reason: string } {
  const slug = raw.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 30) return { ok: false, reason: '3〜30文字にしてください' };
  if (!FORMAT.test(slug)) {
    return { ok: false, reason: '小文字英数字とハイフンのみ。先頭は英字、連続・末尾のハイフンは不可' };
  }
  if (RESERVED.has(slug)) return { ok: false, reason: 'この語は予約されています' };
  return { ok: true, slug };
}
