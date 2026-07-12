import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '../ui';

function BoundaryFallback() {
  const { t } = useTranslation();
  return (
    <Card className="mx-auto max-w-md text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="mt-3 font-display text-lg font-semibold text-foreground">
        {t('errors.boundaryTitle')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('errors.boundaryBody')}</p>
      <Button type="button" className="mt-4" onClick={() => window.location.reload()}>
        <RotateCw aria-hidden />
        {t('errors.reload')}
      </Button>
    </Card>
  );
}

type Props = {
  children: ReactNode;
  /** When this changes (e.g. section navigation) a caught error is cleared and children re-render. */
  resetKey?: unknown;
};
type State = { hasError: boolean };

/**
 * Catches render/lazy-chunk errors below it (React error boundaries must be
 * class components) and shows a friendly retry card instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  override componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  override render() {
    return this.state.hasError ? <BoundaryFallback /> : this.props.children;
  }
}
