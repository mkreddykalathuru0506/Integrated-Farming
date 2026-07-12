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
        // Anchored to the trigger origin; 4px slide from the trigger side (motion-standard §2.3).
        'origin-[--radix-tooltip-content-transform-origin]',
        'animate-in fade-in-0 zoom-in-95 duration-150',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-100',
        'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
        'data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
        className,
      )}
      {...props}
    />
  </RT.Portal>
));
TooltipContent.displayName = 'TooltipContent';
