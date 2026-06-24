import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as RDM from '@radix-ui/react-dropdown-menu';
import { cn } from './cn';

export const DropdownMenu = RDM.Root;
export const DropdownMenuTrigger = RDM.Trigger;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof RDM.Content>,
  ComponentPropsWithoutRef<typeof RDM.Content>
>(({ className, sideOffset = 6, align = 'end', ...props }, ref) => (
  <RDM.Portal>
    <RDM.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[12rem] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-popover',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        className,
      )}
      {...props}
    />
  </RDM.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof RDM.Item>,
  ComponentPropsWithoutRef<typeof RDM.Item> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <RDM.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none transition-colors',
      'focus:bg-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      '[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof RDM.Label>) {
  return (
    <RDM.Label
      className={cn('px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof RDM.Separator>) {
  return <RDM.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
