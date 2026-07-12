import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { pathForSection } from '../components/router';
import { cn } from '../ui';

/**
 * The single cross-link helper for feature panels (slice 11.8a consolidation —
 * replaces the parallel SpaLink / panelNav.goToPanel / plain-<a> variants).
 *
 * AppLayout's useRoute() listens to `popstate`, so after pushState we ping it with a
 * synthetic PopStateEvent — same URL semantics as the sidebar without touching router.ts.
 */
export function spaNavigate(path: string): void {
  if (path !== window.location.pathname) window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Imperative SPA nav to a section/panel (for onClick handlers, e.g. dialog CTAs). */
export function goToPanel(sectionKey: string, panelKey?: string): void {
  spaNavigate(pathForSection(sectionKey, panelKey));
}

/**
 * Anchor that navigates in-app on plain left-click but stays a real link
 * (middle/ctrl-click open a new tab), mirroring the sidebar's behaviour.
 * Prefer this for every panel cross-link so links remain shareable/openable.
 */
export function SpaLink({
  href,
  onClick,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    spaNavigate(href);
  }
  return (
    <a
      href={href}
      onClick={handleClick}
      className={cn('font-semibold text-primary underline-offset-2 hover:underline', className)}
      {...props}
    />
  );
}
