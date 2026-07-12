import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import * as RT from '@radix-ui/react-tooltip';
import { cn } from './cn';

/** App-wide provider (mounted once in App). 300 ms delay before tooltips show. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RT.Provider delayDuration={300}>{children}</RT.Provider>;
}

export const Tooltip = RT.Root;
export const TooltipTrigger = RT.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof RT.Content>,
  ComponentPropsWithoutRef<typeof RT.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <RT.Portal>
    <RT.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-w-xs rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-popover',
        'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        className,
      )}
      {...props}
    />
  </RT.Portal>
));
TooltipContent.displayName = 'TooltipContent';
