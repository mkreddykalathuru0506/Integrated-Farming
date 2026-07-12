import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as RT from '@radix-ui/react-tabs';
import { cn } from './cn';

/**
 * Underline-style tabs on Harvest tokens. Radix gives roving-tabindex keyboard
 * navigation (arrow keys), aria-selected wiring and automatic activation.
 */
export const Tabs = RT.Root;

export const TabsList = forwardRef<
  ElementRef<typeof RT.List>,
  ComponentPropsWithoutRef<typeof RT.List>
>(({ className, ...props }, ref) => (
  <RT.List
    ref={ref}
    className={cn('flex flex-wrap items-center gap-x-5 border-b border-border', className)}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<
  ElementRef<typeof RT.Trigger>,
  ComponentPropsWithoutRef<typeof RT.Trigger>
>(({ className, ...props }, ref) => (
  <RT.Trigger
    ref={ref}
    className={cn(
      '-mb-px inline-flex min-h-10 items-center gap-2 border-b-2 border-transparent px-1 text-sm font-medium text-muted-foreground transition-colors duration-150',
      'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset',
      'data-[state=active]:border-primary data-[state=active]:text-foreground',
      'disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = forwardRef<
  ElementRef<typeof RT.Content>,
  ComponentPropsWithoutRef<typeof RT.Content>
>(({ className, ...props }, ref) => (
  <RT.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';
