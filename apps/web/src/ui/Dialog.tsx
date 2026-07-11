import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { cn } from './cn';

/**
 * Centered modal on Radix Dialog (the nav Sheet skins the same primitive as a drawer).
 * Radix provides the focus trap, Esc-to-close, scrim click and aria wiring.
 */
export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

const SIZE = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

export type DialogSize = keyof typeof SIZE;

export const DialogContent = forwardRef<
  ElementRef<typeof RD.Content>,
  ComponentPropsWithoutRef<typeof RD.Content> & { size?: DialogSize }
>(({ className, size = 'md', children, ...props }, ref) => {
  const { t } = useTranslation();
  return (
    <RD.Portal>
      <RD.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        )}
      />
      <RD.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-card p-5 text-card-foreground shadow-elevated focus:outline-none sm:p-6',
          SIZE[size],
          'duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
        <RD.Close
          aria-label={t('common.close')}
          className="absolute right-4 top-4 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <X className="h-4 w-4" aria-hidden />
        </RD.Close>
      </RD.Content>
    </RD.Portal>
  );
});
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 space-y-1.5 pr-8', className)} {...props} />;
}

export const DialogTitle = forwardRef<
  ElementRef<typeof RD.Title>,
  ComponentPropsWithoutRef<typeof RD.Title>
>(({ className, ...props }, ref) => (
  <RD.Title
    ref={ref}
    className={cn('font-display text-lg font-semibold text-foreground', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = forwardRef<
  ElementRef<typeof RD.Description>,
  ComponentPropsWithoutRef<typeof RD.Description>
>(({ className, ...props }, ref) => (
  <RD.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
DialogDescription.displayName = 'DialogDescription';

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Defaults to common.confirm. */
  confirmLabel?: string;
  /** Defaults to common.cancel. */
  cancelLabel?: string;
  /** 'danger' renders a solid destructive confirm button. */
  variant?: 'default' | 'danger';
  /** Shows a spinner + disables the confirm button while the action runs. */
  loading?: boolean;
  onConfirm: () => void;
};

/** Small controlled confirm modal for destructive/irreversible actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" {...(description ? {} : { 'aria-describedby': undefined })}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'destructive' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
