import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { hi } from './hi';

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
] as const;

export const resources = { en, hi };

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

void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLang() ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

syncHtmlLang(i18n.resolvedLanguage ?? 'en');
i18n.on('languageChanged', (lng) => {
  syncHtmlLang(lng);
  persistLang(lng);
});

export default i18n;
