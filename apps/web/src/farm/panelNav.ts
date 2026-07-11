import { pathForSection } from '../components/router';

/**
 * Cross-link navigation from inside a feature panel.
 *
 * AppLayout owns the routing `useRoute()` instance; a panel-local instance
 * would desync (pushState does not fire popstate). So panels push the new
 * path and then dispatch a synthetic `popstate`, which AppLayout's listener
 * picks up exactly like a browser back/forward — the URL, active section and
 * rendered panel all update without touching the protected router/nav files.
 */
export function goToPanel(sectionKey: string, panelKey?: string): void {
  const path = pathForSection(sectionKey, panelKey);
  if (path !== window.location.pathname) window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
