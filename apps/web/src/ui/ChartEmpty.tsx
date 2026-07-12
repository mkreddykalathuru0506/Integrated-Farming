import { cn } from './cn';
import { spotIllustrations, type SpotName } from './illustrations';

/**
 * Empty slot for a chart (chart-spec §8): never render an empty axis box — swap the
 * plot for a spot illustration + one line, inside a container with the SAME fixed
 * height as the chart (pass it via className, e.g. `h-48`) so filter/data toggles
 * cause zero layout shift.
 */
export function ChartEmpty({ art, text, className }: { art: SpotName; text: string; className?: string }) {
  const Art = spotIllustrations[art];
  return (
    <div className={cn('grid place-content-center place-items-center gap-1.5 py-2 text-center', className)}>
      <span className="text-muted-foreground">
        <Art size={96} />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
