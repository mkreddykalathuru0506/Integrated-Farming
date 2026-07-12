/**
 * Harvest spot illustrations — bespoke empty-state art (slice 11.10).
 *
 * One family, three colors, zero dependencies:
 *  - INK    → `currentColor` strokes (place with `text-muted-foreground`; they
 *             re-ink automatically in dark mode).
 *  - WASH   → `hsl(var(--primary) / 0.08)` pine fill (0.30 for small emphasis
 *             fills like the thermometer mercury). Brightens with the dark
 *             `--primary`, so no `dark:` classes are ever needed.
 *  - GOLD   → exactly ONE `hsl(var(--accent))` element per illustration
 *             (a seed, dot, sparkle, or — in AllClear — the sun).
 *
 * Family rules (keep these when adding a 9th):
 *  - 120×120 viewBox, rendered 96–120px (default 108).
 *  - strokeWidth 1.75 everywhere; secondary detail lines drop to strokeOpacity
 *    0.5–0.55 instead of a thinner stroke.
 *  - Round caps + joins; rects use rx 3–5; corner language is soft, never sharp.
 *  - A low-opacity ground arc anchors (almost) every scene.
 *  - `aria-hidden` — these are decorative; the EmptyState title carries meaning.
 *
 * Suggested wiring (Builder): extend `ui/EmptyState.tsx` with an optional
 * `illustration?: SpotName` prop that renders `spotIllustrations[name]` at
 * size 108 (default) / 84 (compact) in place of the icon circle; keep the
 * existing `icon` prop as the fallback so no call-site breaks.
 *
 * File destination suggestion: `apps/web/src/ui/illustrations.tsx`.
 */
import type { ComponentType, ReactNode } from 'react';

const WASH = 'hsl(var(--primary) / 0.08)';
const WASH_DEEP = 'hsl(var(--primary) / 0.3)';
const GOLD = 'hsl(var(--accent))';

export type SpotProps = {
  /** Rendered square size in px (96–120 looks right; default 108). */
  size?: number;
  className?: string;
};

/** Shared SVG frame: ink strokes inherit currentColor from the placement context. */
function Spot({ size = 108, className, children }: SpotProps & { children: ReactNode }) {
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

/** The single gold accent — a seed/dot. */
function GoldDot({ cx, cy, r = 2.4 }: { cx: number; cy: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={GOLD} stroke="none" />;
}

/** The single gold accent — a four-point sparkle (quadratics through center pinch the star). */
function GoldStar({ cx, cy, r = 4.5 }: { cx: number; cy: number; r?: number }) {
  const d = `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r} Z`;
  return <path d={d} fill={GOLD} stroke="none" />;
}

/** Soft ground line shared by the family. */
function Ground({ d = 'M20 99 C44 93.5 76 93.5 100 99' }: { d?: string }) {
  return <path d={d} strokeOpacity={0.5} />;
}

/* ------------------------------------------------------------------ */
/* 1. EmptyLivestock — hen + chick (batches, animals, species)         */
/* ------------------------------------------------------------------ */
export function EmptyLivestock(props: SpotProps) {
  return (
    <Spot {...props}>
      {/* hen body */}
      <path
        d="M28 71 C28 56 41 48 55 48 C68 48 77 57 77 68 C77 79 67 86 53 86 L39 86 C32.9 86 28 81.1 28 75 Z"
        fill={WASH}
      />
      {/* tail feathers */}
      <path d="M31 63 C23 59 19 51 21 42" />
      <path d="M36 57 C30 52 28 45 30 39" />
      {/* wing */}
      <path d="M42 64 C50 59 61 61 66 69" strokeOpacity={0.55} />
      {/* head */}
      <circle cx="74" cy="46" r="9" fill={WASH} />
      {/* comb */}
      <path d="M68 38 C68 34 71 32 73 35 C74 31 78 31 79 35 C82 33 84 36 82 39" />
      {/* beak */}
      <path d="M83 45 L89 47.5 L83 50 Z" />
      {/* wattle */}
      <path d="M78 54 C78 57 75 58 73 56" />
      {/* eye */}
      <circle cx="75" cy="44" r="1.4" fill="currentColor" stroke="none" />
      {/* legs */}
      <path d="M48 86 V93 M60 86 V93" />
      {/* chick, facing the seed */}
      <circle cx="100" cy="82" r="8" fill={WASH} />
      <path d="M93 80 L88.5 81.5 L93 83 Z" />
      <circle cx="96.5" cy="79.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M101 84 C104 82.5 106.5 83.5 107 86" strokeOpacity={0.55} />
      <path d="M97 90 V94 M103 90 V94" />
      <Ground />
      {/* the gold accent: one seed between hen and chick */}
      <GoldDot cx={88} cy={95.5} r={2.2} />
    </Spot>
  );
}

/* ------------------------------------------------------------------ */
/* 2. EmptyFinance — invoice + rupee coin + leaf (expenses, invoices)  */
/* ------------------------------------------------------------------ */
export function EmptyFinance(props: SpotProps) {
  return (
    <Spot {...props}>
      {/* document with folded corner */}
      <path d="M42 24 H68 L82 38 V86 C82 88.2 80.2 90 78 90 H42 C39.8 90 38 88.2 38 86 V28 C38 25.8 39.8 24 42 24 Z" />
      <path d="M68 24 V34 C68 36.2 69.8 38 72 38 H82" />
      {/* invoice lines */}
      <path d="M46 48 H66 M46 56 H74 M46 64 H58" strokeOpacity={0.55} />
      {/* leaf sprig off the document edge (pine wash) */}
      <path d="M38 44 C29 42 24 35 24 27 C32 27 38 33 38 44 Z" fill={WASH} />
      {/* rupee coin — the gold accent of this scene */}
      <circle cx="80" cy="76" r="13" fill="hsl(var(--accent) / 0.16)" />
      <path d="M75 70.5 H85 M75 75 H85 M78 70.5 C83 70.5 83 77.5 78 77.5 L84.5 83.5" />
      <Ground d="M24 100 C46 95 74 95 96 100" />
    </Spot>
  );
}

/* ------------------------------------------------------------------ */
/* 3. EmptyOrders — produce crate (sales orders, dispatches, buyers)   */
/* ------------------------------------------------------------------ */
export function EmptyOrders(props: SpotProps) {
  return (
    <Spot {...props}>
      {/* produce peeking above the rim */}
      <path d="M39 56 A8 8 0 0 1 55 56" fill={WASH} />
      <path d="M53 56 A9.5 9.5 0 0 1 72 56" fill={WASH} />
      <path d="M70 56 A6.5 6.5 0 0 1 83 56" fill={WASH} />
      {/* leaf on the middle one */}
      <path d="M62.5 46.5 C62.5 40.5 67 36.5 72 36.5 C72 41.5 68 46 62.5 46.5 Z" fill={WASH} />
      {/* crate */}
      <rect x="30" y="56" width="60" height="34" rx="3.5" fill={WASH} />
      <path d="M30 64.5 H90" />
      <path d="M45 64.5 V90 M60 64.5 V90 M75 64.5 V90" strokeOpacity={0.55} />
      <Ground d="M22 99 C46 94 76 94 100 99" />
      {/* gold sparkle */}
      <GoldStar cx={98} cy={40} r={5} />
    </Spot>
  );
}

/* ------------------------------------------------------------------ */
/* 4. EmptyHealth — rounded cross + leaf (health, vaccination)         */
/* ------------------------------------------------------------------ */
export function EmptyHealth(props: SpotProps) {
  return (
    <Spot {...props}>
      {/* rounded cross */}
      <path
        d="M48 38 H64 C66.2 38 68 39.8 68 42 V52 H78 C80.2 52 82 53.8 82 56 V72 C82 74.2 80.2 76 78 76 H68 V86 C68 88.2 66.2 90 64 90 H48 C45.8 90 44 88.2 44 86 V76 H34 C31.8 76 30 74.2 30 72 V56 C30 53.8 31.8 52 34 52 H44 V42 C44 39.8 45.8 38 48 38 Z"
        fill={WASH}
      />
      {/* leaf reaching in from the top right */}
      <path d="M82 36 C82 25 90 18 100 18 C100 28 93 36 82 36 Z" fill={WASH} />
      <path d="M86 32 C90 27 94 23 97 21" strokeOpacity={0.55} />
      <path d="M82 36 C77 40 73 44 71 49" />
      <Ground d="M24 100 C46 95 74 95 96 100" />
      {/* gold heart of the cross */}
      <GoldDot cx={56} cy={64} r={2.6} />
    </Spot>
  );
}

/* ------------------------------------------------------------------ */
/* 5. EmptyColdChain — thermometer + snowflake (cold storage)          */
/* ------------------------------------------------------------------ */
export function EmptyColdChain(props: SpotProps) {
  return (
    <Spot {...props}>
      {/* thermometer outline (tube + bulb in one path) */}
      <path d="M44 73.5 V28 A6 6 0 0 1 56 28 V73.5 A10.5 10.5 0 1 1 44 73.5 Z" fill={WASH} />
      {/* mercury — pine wash at emphasis opacity */}
      <circle cx="50" cy="82" r="4.5" fill={WASH_DEEP} stroke="none" />
      <path d="M50 79 V52" stroke={WASH_DEEP} strokeWidth={3} />
      {/* scale ticks */}
      <path d="M61 36 H66 M61 46 H66 M61 56 H66" strokeOpacity={0.55} />
      {/* snowflake */}
      <path d="M85 30 V58 M72.9 37 L97.1 51 M72.9 51 L97.1 37" />
      <path d="M81 33.5 L85 37 L89 33.5 M81 54.5 L85 51 L89 54.5" strokeOpacity={0.8} />
      <Ground d="M24 100 C46 94.5 74 94.5 96 100" />
      {/* gold sparkle */}
      <GoldStar cx={103} cy={22} r={4.5} />
    </Spot>
  );
}

/* ------------------------------------------------------------------ */
/* 6. EmptyTasks — checklist + sprout (tasks, schedules, daily logs)   */
/* ------------------------------------------------------------------ */
export function EmptyTasks(props: SpotProps) {
  return (
    <Spot {...props}>
      {/* clipboard + clip */}
      <rect x="30" y="28" width="48" height="62" rx="5" fill={WASH} />
      <rect x="45" y="23" width="18" height="9" rx="3.5" fill={WASH} />
      {/* two done rows */}
      <path d="M37 47 l2.6 2.6 4.6 -5.2" />
      <path d="M50 47 H72" strokeOpacity={0.55} />
      <path d="M37 61 l2.6 2.6 4.6 -5.2" />
      <path d="M50 61 H68" strokeOpacity={0.55} />
      {/* one pending row */}
      <circle cx="40" cy="75" r="3.2" />
      <path d="M50 75 H73" strokeOpacity={0.55} />
      {/* sprout growing beside the board */}
      <path d="M92 93 C92 83 92 74 92 64" />
      <path d="M92 70 C86 69 82 64 82 58 C88 58 92 63 92 70 Z" fill={WASH} />
      <path d="M92 64 C92 56 98 51 105 51 C105 59 99 64 92 64 Z" fill={WASH} />
      <Ground d="M22 99 C46 94 74 94 98 99" />
      {/* gold seed above the sprout */}
      <GoldDot cx={101} cy={44} r={2.4} />
    </Spot>
  );
}

/* ------------------------------------------------------------------ */
/* 7. AllClear — sun over a sown field ("nothing due" / all-clear)     */
/* ------------------------------------------------------------------ */
function Tuft({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 V-7" />
      <path d="M0 -5 C-5 -6 -7 -10 -7 -14 C-2.5 -14 0 -10 0 -5 Z" fill={WASH} />
      <path d="M0 -5 C5 -6 7 -10 7 -14 C2.5 -14 0 -10 0 -5 Z" fill={WASH} />
    </g>
  );
}

export function AllClear(props: SpotProps) {
  return (
    <Spot {...props}>
      {/* the sun IS this scene's gold accent */}
      <circle cx="60" cy="40" r="10" fill={GOLD} stroke="none" opacity={0.92} />
      <g stroke={GOLD}>
        <path d="M60 25 V19" />
        <path d="M70.6 29.4 L74.9 25.1" />
        <path d="M49.4 29.4 L45.1 25.1" />
        <path d="M75 40 H81" />
        <path d="M45 40 H39" />
      </g>
      {/* field contours */}
      <path d="M18 88 C40 79 80 79 102 88" />
      <path d="M26 98 C46 89 74 89 94 98" strokeOpacity={0.5} />
      {/* crop tufts riding the contour */}
      <Tuft x={38} y={84} />
      <Tuft x={60} y={82} />
      <Tuft x={82} y={84} />
    </Spot>
  );
}

/* ------------------------------------------------------------------ */
/* 8. EmptyGeneric — seedling (default for any list with no art yet)   */
/* ------------------------------------------------------------------ */
export function EmptyGeneric(props: SpotProps) {
  return (
    <Spot {...props}>
      <Ground />
      {/* mound */}
      <path d="M45 97 C48 90 72 90 75 97" fill={WASH} />
      {/* stem */}
      <path d="M60 92 C60 84 60 74 60 62" />
      {/* leaves */}
      <path d="M60 76 C50 75 43 67 43 57 C53 57 60 65 60 76 Z" fill={WASH} />
      <path d="M60 68 C60 57 68 50 78 50 C78 60 70 68 60 68 Z" fill={WASH} />
      {/* veins */}
      <path d="M56 70 C52 67 49 63 48 60 M64 63 C68 60 71 57 73 55" strokeOpacity={0.5} />
      {/* gold seed */}
      <GoldDot cx={79} cy={90} r={2.4} />
    </Spot>
  );
}

/* ------------------------------------------------------------------ */
/* Typed registry                                                      */
/* ------------------------------------------------------------------ */
export type SpotName =
  | 'livestock'
  | 'finance'
  | 'orders'
  | 'health'
  | 'coldChain'
  | 'tasks'
  | 'allClear'
  | 'generic';

export const spotIllustrations: Record<SpotName, ComponentType<SpotProps>> = {
  livestock: EmptyLivestock,
  finance: EmptyFinance,
  orders: EmptyOrders,
  health: EmptyHealth,
  coldChain: EmptyColdChain,
  tasks: EmptyTasks,
  allClear: AllClear,
  generic: EmptyGeneric,
};

/**
 * Placement map (Designer's intent — Builder wires these):
 *  livestock → BatchesPanel / AnimalsPanel / SpeciesPanel empty lists
 *  finance   → ExpensesPanel / InvoicePanel / EmiInsurancePanel, FinanceTrend no-activity
 *  orders    → OrdersPanel / DispatchPanel / ProcessingPanel, feed inventory empty
 *  health    → HealthPanel / VaccinationPanel / BreedingPanel
 *  coldChain → ColdStoragePanel, Dashboard cold-chain panel empty
 *  tasks     → TasksPanel / DailyLogPanel / WorkersPanel attendance
 *  allClear  → Dashboard "Today — all clear", zero open risks donut slot, no alerts
 *  generic   → everything else (Assets, Byproducts, Reports, Settings lists)
 */
