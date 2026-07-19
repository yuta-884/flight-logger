import { createContext, useContext, useState } from 'react';

// 軽量i18n。対象はログ画面とSettings画面（統計・公開ページ・カード・ヘッダーのラベルは常に英語）。
// 言語はlocalStorageに保存し、初期値はブラウザ言語から推定する。

export type Lang = 'ja' | 'en';

const ja = {
  // ログ画面
  loadingMasters: 'マスタ読み込み中…',
  loading: '読み込み中…',
  tabSearchByFlight: '便名で検索',
  tabManual: '手入力',
  flightNumber: '便名',
  departureDate: '出発日',
  search: '検索',
  searching: '検索中…',
  manualFallback: '手入力で登録する',
  foundOne: '見つかりました:',
  foundMany: '複数の区間が見つかりました。登録する便を選んでください:',
  add: '追加',
  adding: '追加中…',
  originAirport: '出発空港',
  destAirport: '到着空港',
  errInvalidFlightNo: '便名の形式が正しくありません（例: ZG51）',
  errOriginNotFound: '出発空港 {iata} がマスタに見つかりません（IATA 3レター）',
  errDestNotFound: '到着空港 {iata} がマスタに見つかりません（IATA 3レター）',
  errDateRequired: '出発日を入力してください',
  resolveErr_quota_daily: '本日のAPI検索の上限（10回）に達しました。手入力なら登録できます。',
  resolveErr_quota_monthly: '今月のAPI検索の上限（50回）に達しました。手入力なら登録できます。',
  resolveErr_quota_global: '全体のAPI利用枠が一時的に上限です。時間をおくか、手入力で登録してください。',
  resolveErr_not_found: 'フライトが見つかりませんでした。日付を確認するか、手入力で登録してください。',
  resolveErr_invalid_flight_number: '便名の形式が正しくありません（例: ZG51）。',
  resolveErr_invalid_flight_date: '日付の形式が正しくありません。',
  resolveErr_unauthorized: 'ログインが必要です。',
  resolveErr_upstream_error: 'フライト情報サービスが応答しませんでした。時間をおいて再試行してください。',
  resolveErr_unknown: '解決に失敗しました。手入力で登録してください。',
  importTitle: 'Flighty CSV をインポート',
  importDesc:
    'Flightyの Settings → Account Data → Export Your Flights で書き出したCSVを取り込みます。何度実行しても重複しません。',
  importing: '取り込み中…',
  importedSuffix: '件を取り込みました',
  importedSkipped: '（重複でスキップ {n} 件）',
  warningsCount: '警告 {n} 件',
  confirmDeleteFlight: 'このフライトを削除しますか？',
  deleteFailed: '削除に失敗しました: {msg}',
  updateFailed: '更新に失敗しました: {msg}',
  noFlightsYet: 'まだフライトがありません。上のフォームから追加してください。',
  stay: '滞在',
  stayHelp:
    '通常は自動判定です（24時間以内の乗り継ぎは滞在に数えない）。乗り継ぎ時間が長く入国した場合など、到着地を「滞在した国」として数えたいフライトにチェックを入れてください。',
  stayAria: '到着地に滞在した（国カウントに含める）',
  del: '削除',

  // Settings画面
  publicCard: '公開設定',
  publicToggle: 'プロフィールを公開する',
  statusPublic: '● 公開中',
  statusPrivate: '○ 非公開',
  publicDesc: '公開にすると、誰でも下記URLであなたの統計・地球儀を閲覧できます。',
  makePublic: '公開する',
  makePrivate: '非公開にする',
  userIdCard: 'ユーザーID（公開URL）',
  userIdSaved: '保存しました。',
  userIdWarning: '変更すると旧URL（{url}）は無効になり、共有リンクが切れます。',
  saveUserId: 'ユーザーIDを保存',
  userIdTaken: 'このユーザーIDは既に使われています',
  slugErr_length: '3〜30文字にしてください',
  slugErr_format: '小文字英数字とハイフンのみ。先頭は英字、連続・末尾のハイフンは不可',
  slugErr_reserved: 'この語は予約されています',
  countriesCard: '行った国の追加',
  countriesDesc:
    '船や陸路などフライト以外で入国した国を「行った国」に追加できます。統計・公開ページの国数と国旗に反映されます。',
  selectCountry: '国を選択…',
  countryAddFailed: '追加に失敗しました: {msg}',
  removeCountryAria: '{name}を削除',
  shareCard: '共有',
  publicPageLabel: '公開ページ',
  embedLabel: '埋め込みカード（iframe）',
  copy: 'コピー',
  copied: '✓ コピーしました',
  iframeHint: 'Notion・ブログなどにこのiframeを貼り付けるとカードが表示されます。',
} as const;

export type MsgKey = keyof typeof ja;

const en: Record<MsgKey, string> = {
  loadingMasters: 'Loading masters…',
  loading: 'Loading…',
  tabSearchByFlight: 'Search by flight no.',
  tabManual: 'Manual entry',
  flightNumber: 'Flight number',
  departureDate: 'Departure date',
  search: 'Search',
  searching: 'Searching…',
  manualFallback: 'Add manually instead',
  foundOne: 'Found:',
  foundMany: 'Multiple legs found. Choose the one to add:',
  add: 'Add',
  adding: 'Adding…',
  originAirport: 'Origin airport',
  destAirport: 'Destination airport',
  errInvalidFlightNo: 'Invalid flight number format (e.g. ZG51)',
  errOriginNotFound: 'Origin airport {iata} not found (IATA 3-letter code)',
  errDestNotFound: 'Destination airport {iata} not found (IATA 3-letter code)',
  errDateRequired: 'Please enter the departure date',
  resolveErr_quota_daily: "You've hit today's search limit (10). You can still add flights manually.",
  resolveErr_quota_monthly: "You've hit this month's search limit (50). You can still add flights manually.",
  resolveErr_quota_global: 'The shared API quota is temporarily exhausted. Try again later or add manually.',
  resolveErr_not_found: 'Flight not found. Check the date or add it manually.',
  resolveErr_invalid_flight_number: 'Invalid flight number format (e.g. ZG51).',
  resolveErr_invalid_flight_date: 'Invalid date format.',
  resolveErr_unauthorized: 'Please sign in.',
  resolveErr_upstream_error: 'The flight data service did not respond. Please try again later.',
  resolveErr_unknown: 'Lookup failed. Please add the flight manually.',
  importTitle: 'Import Flighty CSV',
  importDesc:
    'Import the CSV exported from Flighty (Settings → Account Data → Export Your Flights). Safe to run repeatedly — no duplicates.',
  importing: 'Importing…',
  importedSuffix: 'flights imported',
  importedSkipped: '({n} skipped as duplicates)',
  warningsCount: '{n} warnings',
  confirmDeleteFlight: 'Delete this flight?',
  deleteFailed: 'Delete failed: {msg}',
  updateFailed: 'Update failed: {msg}',
  noFlightsYet: 'No flights yet. Add one with the form above.',
  stay: 'Stay',
  stayHelp:
    "Detected automatically by default (connections within 24 hours don't count as stays). Check a flight to count its destination as a stayed country — e.g. a long layover where you entered the country.",
  stayAria: 'Stayed at destination (count the country)',
  del: 'Delete',

  publicCard: 'Visibility',
  publicToggle: 'Make profile public',
  statusPublic: '● Public',
  statusPrivate: '○ Private',
  publicDesc: 'When public, anyone can view your stats and globe at the URL below.',
  makePublic: 'Make public',
  makePrivate: 'Make private',
  userIdCard: 'User ID (public URL)',
  userIdSaved: 'Saved.',
  userIdWarning: 'Changing it invalidates the old URL ({url}); shared links will break.',
  saveUserId: 'Save user ID',
  userIdTaken: 'This user ID is already taken',
  slugErr_length: 'Must be 3–30 characters',
  slugErr_format: 'Lowercase letters, digits and hyphens only; must start with a letter; no trailing or consecutive hyphens',
  slugErr_reserved: 'This word is reserved',
  countriesCard: 'Add visited countries',
  countriesDesc:
    'Add countries you entered without flying (ferry, overland, …). They count toward your stats and appear in the flag list.',
  selectCountry: 'Select a country…',
  countryAddFailed: 'Failed to add: {msg}',
  removeCountryAria: 'Remove {name}',
  shareCard: 'Share',
  publicPageLabel: 'Public page',
  embedLabel: 'Embed card (iframe)',
  copy: 'Copy',
  copied: '✓ Copied',
  iframeHint: 'Paste this iframe into Notion, a blog, etc. to show the card.',
};

const dicts: Record<Lang, Record<MsgKey, string>> = { ja, en };

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MsgKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'ja' || saved === 'en') return saved;
  } catch {
    /* localStorage不可時はブラウザ言語のみ */
  }
  return navigator.language?.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem('lang', next);
    } catch {
      /* 保存不可でもセッション内は切り替わる */
    }
  };

  const t = (key: MsgKey, vars?: Record<string, string | number>): string => {
    let s: string = dicts[lang][key] ?? ja[key];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
