import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal History-API router (no dependency). The app's navigation is a flat list of
 * section keys with optional panel sub-keys (see nav.tsx), so a full routing library
 * would be overkill. This gives each section/panel a real URL — deep links, browser
 * back/forward, and shareable links all work.
 * The nginx SPA fallback (`try_files … /index.html`) + Vite's dev history fallback serve
 * index.html for these paths, so no server route config is needed.
 */

/**
 * Path for a section (+ optional panel). The FIRST panel of a section is canonical at
 * the bare section path — pass `panel` only for non-first panels. Overview stays `/`.
 */
export function pathForSection(key: string, panel?: string): string {
  if (key === 'overview') return '/'; // overview has a single panel; never a segment
  return panel ? `/${key}/${panel}` : `/${key}`;
}

/** Section key parsed from a pathname (`/` → `overview`, `/finance` → `finance`). */
export function sectionFromPath(pathname: string): string {
  const seg = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  return seg || 'overview';
}

/** Panel key = second path segment, or undefined (`/finance/invoices` → `invoices`). */
export function panelFromPath(pathname: string): string | undefined {
  const segs = pathname.replace(/^\/+/, '').split('/');
  return segs[1] || undefined;
}

export type ResolvedRoute = { sectionKey: string; panelKey: string; canonicalPath: string };

/**
 * Pure resolver used by AppLayout and tests. Given a pathname and the VISIBLE section
 * list (already role-filtered), returns the resolved section/panel plus the canonical
 * pathname for it. Unknown/hidden sections fall back to the first visible section;
 * unknown panels (and the first panel spelled out, e.g. `/finance/feed`) canonicalise
 * to the bare section path.
 */
export function resolveRoute(
  pathname: string,
  sections: readonly { key: string; panels: readonly { key: string }[] }[],
): ResolvedRoute {
  const section = sections.find((s) => s.key === sectionFromPath(pathname)) ?? sections[0]!;
  const rawPanel = panelFromPath(pathname);
  const panel = section.panels.find((p) => p.key === rawPanel) ?? section.panels[0]!;
  const isFirst = panel.key === section.panels[0]!.key;
  return {
    sectionKey: section.key,
    panelKey: panel.key,
    canonicalPath: pathForSection(section.key, isFirst ? undefined : panel.key),
  };
}

export function useRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((key: string, opts?: { panel?: string; replace?: boolean }) => {
    const path = pathForSection(key, opts?.panel);
    if (path !== window.location.pathname) {
      if (opts?.replace) window.history.replaceState(null, '', path);
      else window.history.pushState(null, '', path);
    }
    setPathname(path);
  }, []);

  return {
    pathname,
    key: sectionFromPath(pathname),
    panel: panelFromPath(pathname),
    navigate,
  };
}
