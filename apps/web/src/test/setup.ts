import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Explicit cleanup: RTL's auto-cleanup only registers when vitest globals are on.
afterEach(() => cleanup());

// jsdom has no ResizeObserver; cmdk (command palette) requires one at mount.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}
