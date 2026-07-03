import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal History-API router (no dependency). The app's navigation is a flat list of
 * section keys (see nav.tsx), so a full routing library would be overkill. This gives
 * each section a real URL — deep links, browser back/forward, and shareable links all work.
 * The nginx SPA fallback (`try_files … /index.html`) + Vite's dev history fallback serve
 * index.html for these paths, so no server route config is needed.
 */

/** Path for a section key. Overview is the root landing (`/`). */
export function pathForSection(key: string): string {
  return key === 'overview' ? '/' : `/${key}`;
}

/** Section key parsed from a pathname (`/` → `overview`, `/finance` → `finance`). */
export function sectionFromPath(pathname: string): string {
  const seg = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  return seg || 'overview';
}

export function useRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((key: string, opts?: { replace?: boolean }) => {
    const path = pathForSection(key);
    if (path !== window.location.pathname) {
      if (opts?.replace) window.history.replaceState(null, '', path);
      else window.history.pushState(null, '', path);
    }
    setPathname(path);
  }, []);

  return { key: sectionFromPath(pathname), navigate };
}
