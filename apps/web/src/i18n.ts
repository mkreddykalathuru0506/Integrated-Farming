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
