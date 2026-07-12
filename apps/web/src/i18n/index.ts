import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';

export const SUPPORTED_LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हि' },
] as const;

// Namespaces fully translated into every supported language (enforced by i18n.parity.test).
export const CORE_NS = [
  'app',
  'common',
  'table',
  'auth',
  'account',
  'errors',
  'farms',
  'farm',
  'units',
  'settings',
  'roles',
  'nav',
  'palette',
  'shortcuts',
  'bell',
  'unitTypes',
  'weather',
  'market',
  'dashboard',
  'reports',
  'risk',
  'health',
  'vax',
  'breeding',
  'hatchery',
  'feed',
  'expenses',
  'emi',
  'invoices',
  'assets',
  'byproducts',
  'circularity',
  'orders',
  'cold',
  'processing',
  'dispatch',
  'species',
  'batches',
  'animals',
  'events',
  'workers',
  'tasks',
  'logs',
  'team',
  'activity',
  'landing',
] as const;

/**
 * Only the default-active locale (en) is bundled in the entry chunk. Other locales
 * are code-split and pulled on demand (slice 11.8a bundle trim). The parity test
 * imports en/hi directly from their modules — not from here — so it still compares
 * both without dragging hi into the production entry.
 */
const LANG_LOADERS: Record<string, () => Promise<Record<string, unknown>>> = {
  hi: () => import('./hi').then((m) => m.hi.translation),
};
const loadedLangs = new Set<string>(['en']);

/** Load a locale's (code-split) resource bundle into i18next once. */
export async function loadLanguage(lng: string): Promise<void> {
  if (loadedLangs.has(lng)) return;
  const loader = LANG_LOADERS[lng];
  if (!loader) return;
  const bundle = await loader();
  i18n.addResourceBundle(lng, 'translation', bundle, true, true);
  loadedLangs.add(lng);
}

/** Switch language, fetching its resource bundle first (the public entry point). */
export async function changeLanguage(lng: string): Promise<void> {
  await loadLanguage(lng);
  await i18n.changeLanguage(lng);
}

const LANG_KEY = 'ifm.lang';

/** Read the persisted language, ignoring unknown/legacy values and storage failures. */
function readStoredLang(): string | undefined {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    return stored && SUPPORTED_LANGS.some((l) => l.code === stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

function persistLang(lng: string) {
  try {
    localStorage.setItem(LANG_KEY, lng);
  } catch {
    /* ignore storage failures (private mode) */
  }
}

// A11y: keep <html lang> in sync with the active language for screen readers.
function syncHtmlLang(lng: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
}

const initialLang = readStoredLang() ?? 'en';

void i18n.use(initReactI18next).init({
  resources: { en }, // only en is bundled eagerly; others load on demand
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Booting straight into a non-en locale: pull its bundle in the background
// (falls back to en for the first paint until it lands — precached for PWA).
if (initialLang !== 'en') void loadLanguage(initialLang).then(() => i18n.changeLanguage(initialLang));

syncHtmlLang(i18n.resolvedLanguage ?? 'en');
i18n.on('languageChanged', (lng) => {
  syncHtmlLang(lng);
  persistLang(lng);
});

export default i18n;
