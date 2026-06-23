import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English seed. No hard-coded UI strings — all copy flows through these keys.
export const resources = {
  en: {
    translation: {
      app: {
        title: 'Samagra Krishi',
        tagline: 'Integrated Farm Manager',
        health: {
          checking: 'Checking API…',
          ok: 'API healthy',
          down: 'API unreachable',
        },
      },
      auth: {
        login: {
          title: 'Sign in',
          email: 'Email',
          password: 'Password',
          submit: 'Sign in',
          submitting: 'Signing in…',
        },
        errors: { invalid: 'Invalid email or password' },
        welcome: 'Welcome, {{name}}',
        logout: 'Sign out',
      },
      farms: {
        title: 'Your farms',
        loading: 'Loading farms…',
        error: 'Could not load your farms',
        empty: 'You are not a member of any farm yet',
      },
      roles: {
        OWNER: 'Owner',
        MANAGER: 'Manager',
        VETERINARIAN: 'Veterinarian',
        ACCOUNTANT: 'Accountant',
        LABOUR: 'Labour',
        BUYER: 'Buyer',
      },
      common: { save: 'Save', saving: 'Saving…', delete: 'Delete' },
      farm: {
        create: {
          prompt: 'Create your first farm to get started.',
          name: 'Farm name',
          state: 'State (optional)',
          submit: 'Create farm',
          error: 'Could not create the farm',
        },
      },
      units: {
        title: 'Units',
        loading: 'Loading units…',
        error: 'Could not load units',
        empty: 'No units yet',
        namePlaceholder: 'Unit name (e.g. Poultry Shed 1)',
        add: 'Add unit',
        addError: 'Could not add the unit',
        duplicate: 'A unit with this name already exists',
      },
      settings: {
        title: 'Farm settings',
        loading: 'Loading settings…',
        error: 'Could not load settings',
        saved: 'Settings saved',
        fssai: 'FSSAI license number',
        tier: 'FSSAI tier',
        tierNone: '— not set —',
        gstin: 'GSTIN',
      },
      unitTypes: {
        POULTRY: 'Poultry',
        CATTLE: 'Cattle',
        GOATERY: 'Goatery',
        RABBITRY: 'Rabbitry',
        MUSHROOM_HOUSE: 'Mushroom house',
        HATCHERY: 'Hatchery',
        FROZEN_STORE: 'Frozen store',
        NURSERY: 'Nursery',
        BIOGAS: 'Biogas',
        OTHER: 'Other',
      },
    },
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
