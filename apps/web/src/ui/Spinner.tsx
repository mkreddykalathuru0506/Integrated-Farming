import { cn } from './cn';

/** Small SVG spinner on currentColor — inherits the surrounding text colour. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 motion-safe:animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      data-slot="spinner"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
