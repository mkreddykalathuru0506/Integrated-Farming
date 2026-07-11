import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Explicit cleanup: RTL's auto-cleanup only registers when vitest globals are on.
afterEach(() => cleanup());
