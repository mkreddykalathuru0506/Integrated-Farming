import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English is the source of truth. Hindi is a partial seed; missing keys fall back to English.
// No hard-coded UI strings — every visible string lives here.
const en = {
  translation: {
    app: { title: 'Samagra Krishi', tagline: 'Integrated Farm Manager' },
    common: { save: 'Save', saving: 'Saving…', delete: 'Delete' },
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
    roles: {
      OWNER: 'Owner',
      MANAGER: 'Manager',
      VETERINARIAN: 'Veterinarian',
      ACCOUNTANT: 'Accountant',
      LABOUR: 'Labour',
      BUYER: 'Buyer',
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
    species: {
      title: 'Species',
      loading: 'Loading species…',
      error: 'Could not load species',
      empty: 'No species yet',
      stages: 'Lifecycle stages',
      breeds: 'Breeds',
      terminal: 'terminal',
      tracking: { INDIVIDUAL: 'Individual', BATCH: 'Batch' },
    },
    batches: {
      title: 'Batches',
      loading: 'Loading batches…',
      error: 'Could not load batches',
      empty: 'No batches yet',
      add: 'Add batch',
      addError: 'Could not add the batch',
      duplicate: 'A batch with this code already exists',
      code: 'Batch code (e.g. BR-2026-01)',
      count: 'Initial count',
      advance: 'Advance',
      close: 'Close',
      stage: 'Stage',
      status: { ACTIVE: 'Active', CLOSED: 'Closed' },
    },
    animals: {
      title: 'Animals',
      loading: 'Loading animals…',
      error: 'Could not load animals',
      empty: 'No animals yet',
      add: 'Add animal',
      addError: 'Could not add the animal',
      duplicate: 'An animal with this tag already exists',
      tag: 'Ear-tag number',
      sex: { MALE: 'Male', FEMALE: 'Female', UNKNOWN: 'Unknown' },
      status: { ACTIVE: 'Active', SOLD: 'Sold', DEAD: 'Dead', CULLED: 'Culled' },
    },
    events: {
      lossCount: 'Count',
      mortality: 'Mortality',
      cull: 'Cull',
      dead: 'Dead',
      moveTo: 'Move to…',
      move: 'Move',
    },
    workers: {
      title: 'Workers & attendance',
      loading: 'Loading workers…',
      error: 'Could not load workers',
      empty: 'No workers yet',
      add: 'Add worker',
      addError: 'Could not add the worker',
      name: 'Worker name',
      designation: 'Designation (optional)',
      wage: 'Daily wage (₹)',
      present: 'Present',
      absent: 'Absent',
      wageType: { DAILY: 'Daily', PIECE_RATE: 'Piece-rate', MONTHLY: 'Monthly' },
    },
  },
};

// Hindi seed (partial — proves the bilingual structure; rest falls back to English).
const hi = {
  translation: {
    app: { title: 'समग्र कृषि', tagline: 'एकीकृत फार्म प्रबंधक' },
    common: { save: 'सहेजें', saving: 'सहेजा जा रहा है…', delete: 'हटाएँ' },
    auth: {
      login: {
        title: 'साइन इन करें',
        email: 'ईमेल',
        password: 'पासवर्ड',
        submit: 'साइन इन करें',
        submitting: 'साइन इन हो रहा है…',
      },
      errors: { invalid: 'अमान्य ईमेल या पासवर्ड' },
      welcome: 'स्वागत है, {{name}}',
      logout: 'साइन आउट',
    },
    farms: { title: 'आपके फार्म', loading: 'फार्म लोड हो रहे हैं…' },
    units: { title: 'इकाइयाँ', add: 'इकाई जोड़ें', empty: 'अभी कोई इकाई नहीं' },
    settings: { title: 'फार्म सेटिंग्स' },
    roles: { OWNER: 'मालिक', MANAGER: 'प्रबंधक', LABOUR: 'श्रमिक' },
  },
};

export const SUPPORTED_LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हि' },
] as const;

void i18n.use(initReactI18next).init({
  resources: { en, hi },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
