import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { cn } from '../ui';

/**
 * SPA navigation for cross-links inside feature panels (slice 11.6e).
 * AppLayout's useRoute() listens to `popstate`, so after pushState we ping it with a
 * synthetic PopStateEvent — same URL semantics as the sidebar without touching router.ts.
 */
export function spaNavigate(path: string): void {
  if (path !== window.location.pathname) window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Anchor that navigates in-app on plain left-click but stays a real link
 * (middle/ctrl-click open a new tab), mirroring the sidebar's behaviour.
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
