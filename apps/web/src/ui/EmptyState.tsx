import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { spotIllustrations, type SpotName } from './illustrations';

export type EmptyStateProps = {
  icon: LucideIcon;
  /** Bespoke spot illustration (slice 11.10); when set it replaces the icon circle. */
  illustration?: SpotName;
  title: string;
  /** One-line supporting description. */
  description?: string;
  /** Primary call to action, usually a <Button>. */
  action?: ReactNode;
  /** Optional secondary action/link next to the CTA. */
  secondary?: ReactNode;
  size?: 'default' | 'compact';
  className?: string;
};

/** Friendly empty state: spot illustration (or icon in a muted circle), title, description, optional CTA. */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  secondary,
  size = 'default',
  className,
}: EmptyStateProps) {
  const compact = size === 'compact';
  const Spot = illustration ? spotIllustrations[illustration] : null;
  return (
    <div
      className={cn(
        'grid place-items-center text-center',
        compact ? 'gap-2 py-6' : 'gap-3 py-12',
        className,
      )}
    >
      {Spot ? (
        <span className="text-muted-foreground">
          <Spot size={compact ? 84 : 108} />
        </span>
      ) : (
        <span
          className={cn(
            'grid place-items-center rounded-full bg-muted text-muted-foreground',
            compact ? 'h-10 w-10' : 'h-14 w-14',
          )}
        >
          <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} aria-hidden />
        </span>
      )}
      <div className="space-y-1">
        <p className={cn('font-display font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
          {title}
        </p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {(action || secondary) && (
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}
