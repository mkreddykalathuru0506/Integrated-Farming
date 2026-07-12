import { RefreshCw } from 'lucide-react';
import { Button, PanelError } from '../ui';

/**
 * Standard query-error state for the 11.6a panels: message + Retry (refetch).
 * Callers pass already-translated strings so every namespace keeps its own keys.
 */
export function LoadErrorNote({
  text,
  retryLabel,
  onRetry,
}: {
  text: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
      <PanelError className="m-0">{text}</PanelError>
      <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
        <RefreshCw aria-hidden />
        {retryLabel}
      </Button>
    </div>
  );
}
