/**
 * Landing feature artwork — same "inked field-sketch" family as the app's
 * spot illustrations (see the designer's kit): 120×120 viewBox, 1.75px
 * `currentColor` strokes, round caps/joins, a pine wash fill, a low-opacity
 * ground arc, and exactly ONE gold accent per scene.
 *
 * Deliberately landing-local (slice 11.10 owns `ui/illustrations.tsx`);
 * these four scenes are bespoke to the feature sections.
 */
import type { ReactNode } from 'react';

const WASH = 'hsl(var(--primary) / 0.08)';
const GOLD = 'hsl(var(--accent))';

type ArtProps = {
  /** Rendered square size in px. */
  size?: number;
  className?: string;
};

/** Shared frame: ink strokes inherit currentColor from the placement context. */
function Sketch({ size = 132, className, children }: ArtProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

function Ground({ d = 'M20 99 C44 93.5 76 93.5 100 99' }: { d?: string }) {
  return <path d={d} strokeOpacity={0.5} />;
}

/* ------------------------------------------------------------------ */
/* 1. Offline field logging — phone checklist, sync cycle, sprout      */
/* ------------------------------------------------------------------ */
export function ArtFieldLog(props: ArtProps) {
  return (
    <Sketch {...props}>
      {/* phone */}
      <rect x="36" y="20" width="42" height="76" rx="6" fill={WASH} />
      <path d="M51 27 H63" strokeOpacity={0.55} />
      {/* two logged rows */}
      <path d="M44 42 l2.6 2.6 4.6 -5.2" />
      <path d="M56 42 H70" strokeOpacity={0.55} />
      <path d="M44 56 l2.6 2.6 4.6 -5.2" />
      <path d="M56 56 H68" strokeOpacity={0.55} />
      {/* one queued row */}
      <circle cx="46.5" cy="70" r="3.2" />
      <path d="M56 70 H70" strokeOpacity={0.55} />
      <path d="M52 88 H62" strokeOpacity={0.55} />
      {/* sync cycle, top right */}
      <path d="M85 33 A10 10 0 0 1 103 26" />
      <path d="M103 26 l1.6 -5.4 M103 26 l-5.5 -1.2" />
      <path d="M105 29 A10 10 0 0 1 87 36" />
      <path d="M87 36 l-1.6 5.4 M87 36 l5.5 1.2" />
      {/* the gold accent: the log riding the sync cycle */}
      <circle cx="95" cy="31" r="2.4" fill={GOLD} stroke="none" />
      {/* sprout by the ground */}
      <path d="M98 96 C98 88 98 82 98 74" />
      <path d="M98 80 C92.5 79 89 74.5 89 69.5 C94 69.5 98 73.5 98 80 Z" fill={WASH} />
      <path d="M98 74 C98 67.5 103 63.5 108.5 63.5 C108.5 69.5 104 74 98 74 Z" fill={WASH} />
      <Ground />
    </Sketch>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Finance & GST — open ledger book + rupee coin                    */
/* ------------------------------------------------------------------ */
export function ArtLedger(props: ArtProps) {
  return (
    <Sketch {...props}>
      {/* open ledger */}
      <path d="M22 42 C34 35.5 46 35.5 58 41 V88 C46 82.5 34 82.5 22 89 Z" fill={WASH} />
      <path d="M96 42 C84 35.5 72 35.5 60 41 V88 C72 82.5 84 82.5 96 89 Z" fill={WASH} />
      <path d="M59 42 V86" strokeOpacity={0.55} />
      {/* entries, left page */}
      <path d="M30 51 H50 M30 59 H46 M30 67 H50 M30 75 H44" strokeOpacity={0.55} />
      {/* amounts, right page */}
      <path d="M68 51 H88 M68 59 H84 M68 67 H88" strokeOpacity={0.55} />
      {/* totals rule */}
      <path d="M68 75 H88 M68 78.5 H88" strokeOpacity={0.8} />
      {/* rupee coin — this scene's gold accent */}
      <circle cx="92" cy="30" r="13" fill="hsl(var(--accent) / 0.16)" />
      <path d="M87 24.5 H97 M87 29 H97 M90 24.5 C95 24.5 95 31.5 90 31.5 L96.5 37.5" />
      <Ground d="M24 100 C46 95 74 95 96 100" />
    </Sketch>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Traceability & cold chain — QR swing tag + snowflake             */
/* ------------------------------------------------------------------ */
export function ArtTrace(props: ArtProps) {
  return (
    <Sketch {...props}>
      {/* string to the edge of the scene */}
      <path d="M46 41 C42 32 34 26 26 24" />
      {/* swing tag */}
      <rect x="34" y="40" width="40" height="50" rx="5" fill={WASH} />
      <circle cx="46" cy="47.5" r="2.6" />
      {/* QR finder squares */}
      <rect x="41" y="56" width="8" height="8" rx="1.5" />
      <rect x="57" y="56" width="8" height="8" rx="1.5" />
      <rect x="41" y="72" width="8" height="8" rx="1.5" />
      <path d="M44.2 59.2 h1.6 v1.6 h-1.6 Z M60.2 59.2 h1.6 v1.6 h-1.6 Z M44.2 75.2 h1.6 v1.6 h-1.6 Z" />
      {/* data modules — one rides gold (the traced lot) */}
      <rect x="66" y="68" width="3.5" height="3.5" rx="1" strokeOpacity={0.8} />
      <rect x="58" y="74" width="4.5" height="4.5" rx="1" fill={GOLD} stroke="none" />
      {/* snowflake */}
      <path d="M92 26 V50 M81.6 32 L102.4 44 M81.6 44 L102.4 32" />
      <path d="M88.5 28.5 L92 31.5 L95.5 28.5 M88.5 47.5 L92 44.5 L95.5 47.5" strokeOpacity={0.8} />
      <Ground d="M22 99 C46 94 76 94 100 99" />
    </Sketch>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Intelligence — sun behind cloud, market trend, alert bell        */
/* ------------------------------------------------------------------ */
export function ArtIntel(props: ArtProps) {
  return (
    <Sketch {...props}>
      {/* the sun IS this scene's gold accent */}
      <circle cx="67" cy="22" r="7.5" fill={GOLD} stroke="none" opacity={0.92} />
      <g stroke={GOLD}>
        <path d="M67 12 V8" />
        <path d="M74.4 15.6 L77.2 12.8" />
        <path d="M77.5 22 H81.5" />
        <path d="M59.6 15.6 L56.8 12.8" />
      </g>
      {/* cloud over the sun */}
      <path
        d="M33 46 H59 C64 46 68 42 68 37 C68 32 64 28 59 28 C58.2 28 57.4 28.1 56.6 28.3 C54.6 23.4 49.8 20 44.2 20 C37 20 31.2 25.4 30.6 32.3 C27.4 33.3 25 36.2 25 39.6 C25 43.1 28 46 33 46 Z"
        fill={WASH}
      />
      {/* market bars + trend */}
      <rect x="26" y="74" width="8" height="18" rx="2" fill={WASH} />
      <rect x="38" y="66" width="8" height="26" rx="2" fill={WASH} />
      <rect x="50" y="72" width="8" height="20" rx="2" fill={WASH} />
      <path d="M26 68 C36 60 44 62 58 54" strokeOpacity={0.8} />
      <path d="M58 54 L52.5 54.6 M58 54 L57.2 59.5" strokeOpacity={0.8} />
      {/* alert bell */}
      <path d="M80 84 C80 74 84 68 92 68 C100 68 104 74 104 84 Z" fill={WASH} />
      <path d="M78 84 H106" />
      <circle cx="92" cy="89" r="2.6" />
      <path d="M110 71 C112 74.5 112 79.5 110 83 M74 71 C72 74.5 72 79.5 74 83" strokeOpacity={0.55} />
      <Ground d="M24 100 C46 95 74 95 96 100" />
    </Sketch>
  );
}
