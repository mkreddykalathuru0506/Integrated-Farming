import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from './cn';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

type ToastItem = { id: number; variant: ToastVariant; message: string };

export type ToastApi = {
  show: (variant: ToastVariant, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

// Harvest semantic tokens only — no raw palette classes.
const ICON_COLOR: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-primary',
};

const EDGE: Record<ToastVariant, string> = {
  success: 'border-l-success',
  error: 'border-l-destructive',
  warning: 'border-l-warning',
  info: 'border-l-primary',
};

/** How long the exit animation gets before the item is dropped from state. */
const EXIT_MS = 200;

function ToastCard({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const Icon = ICONS[item.variant];

  return (
    <RadixToast.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTimeout(onDone, EXIT_MS);
      }}
      data-variant={item.variant}
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-popover',
        'border-l-4',
        EDGE[item.variant],
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
        'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform',
        'data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full',
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_COLOR[item.variant])} aria-hidden />
      <RadixToast.Description className="flex-1 text-sm text-foreground">
        {item.message}
      </RadixToast.Description>
      <RadixToast.Close
        aria-label={t('common.close')}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <X className="h-4 w-4" aria-hidden />
      </RadixToast.Close>
    </RadixToast.Root>
  );
}

/**
 * App-wide toast provider (Radix Toast): bottom-right stacked viewport,
 * swipe-to-dismiss, 5s auto-dismiss, a11y announcements via Radix.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((variant: ToastVariant, message: string) => {
    setItems((prev) => [...prev, { id: nextId.current++, variant, message }]);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show('success', message),
      error: (message) => show('error', message),
      warning: (message) => show('warning', message),
      info: (message) => show('info', message),
    }),
    [show],
  );

  return (
    <ToastCtx.Provider value={api}>
      <RadixToast.Provider swipeDirection="right" duration={5000} label={t('common.notifications')}>
        {children}
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDone={() => remove(item.id)} />
        ))}
        <RadixToast.Viewport className="fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
