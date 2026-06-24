import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as RD from '@radix-ui/react-dialog';
import { cn } from './cn';

export const Sheet = RD.Root;
export const SheetTrigger = RD.Trigger;
export const SheetClose = RD.Close;
export const SheetTitle = RD.Title;
export const SheetDescription = RD.Description;

/**
 * Slide-in panel (drawer). Used for the mobile navigation drawer at ≤lg.
 * Radix Dialog gives focus trap, Esc-to-close, scrim and aria wiring for free (a11y).
 */
export const SheetContent = forwardRef<
  ElementRef<typeof RD.Content>,
  ComponentPropsWithoutRef<typeof RD.Content> & { side?: 'left' | 'right' }
>(({ className, side = 'left', children, ...props }, ref) => (
  <RD.Portal>
    <RD.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      )}
    />
    <RD.Content
      ref={ref}
      className={cn(
        'fixed inset-y-0 z-50 flex w-[84%] max-w-xs flex-col bg-sidebar text-sidebar-foreground shadow-elevated focus:outline-none',
        side === 'left' ? 'left-0' : 'right-0',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300',
        side === 'left'
          ? 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left'
          : 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        className,
      )}
      {...props}
    >
      {children}
    </RD.Content>
  </RD.Portal>
));
SheetContent.displayName = 'SheetContent';
