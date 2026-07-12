import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Leaf, Sprout } from 'lucide-react';
import { Button } from '../ui';
import { LanguageToggle } from '../components/LanguageToggle';
import { ThemeToggle } from '../components/ThemeToggle';
import { ArtFieldLog, ArtIntel, ArtLedger, ArtTrace } from './art';
import { HeroMock } from './HeroMock';
import { ENTRANCE, Reveal } from './reveal';

/**
 * Marketing front door for logged-out visitors (slice 11.11) — the "Harvest"
 * editorial take on a product landing: bone-paper canvas, Fraunces headlines,
 * inked field-sketch artwork, one deep-pine credibility band. Everything is
 * token-driven (light + dark for free) and fully i18n'd (`landing` namespace).
 */

type LandingProps = {
  /** Open the sign-in card. */
  onSignIn: () => void;
  /** Open the create-account card. */
  onGetStarted: () => void;
};

function BrandMark({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Leaf className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block whitespace-nowrap font-display text-base font-extrabold text-foreground">
          {t('nav.brand')}
        </span>
        {!compact && (
          <span className="hidden text-[11px] text-muted-foreground sm:block">{t('app.tagline')}</span>
        )}
      </span>
    </span>
  );
}

/** Decorative sown-field contours anchoring the hero (echoes the AllClear scene). */
function FieldContours() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full text-foreground/[0.08] sm:h-32"
      viewBox="0 0 1200 140"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M-20 80 C260 30 940 30 1220 80" />
      <path d="M-20 120 C300 70 900 70 1220 120" strokeOpacity="0.6" />
      <path d="M80 150 C400 105 800 105 1120 150" strokeOpacity="0.35" />
    </svg>
  );
}

function FeatureRow({
  art: Art,
  base,
  flip = false,
}: {
  art: ComponentType<{ size?: number; className?: string }>;
  /** i18n base path, e.g. `landing.features.offline`. */
  base: string;
  flip?: boolean;
}) {
  const { t } = useTranslation();
  const points = [t(`${base}.p1`), t(`${base}.p2`), t(`${base}.p3`)];
  const headingId = `${base.replace(/\./g, '-')}-title`;
  return (
    <Reveal>
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
        <div className={flip ? 'md:order-2' : undefined}>
          <div className="mx-auto grid aspect-[16/9] w-full max-w-md place-items-center rounded-lg border border-border/70 bg-secondary/50 text-muted-foreground sm:aspect-[4/3]">
            <Art className="h-[72%] w-auto sm:h-[62%]" />
          </div>
        </div>
        <div className={flip ? 'md:order-1' : undefined}>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{t(`${base}.kicker`)}</p>
          <h3 id={headingId} className="mt-2 font-display text-2xl font-bold leading-snug text-foreground sm:text-3xl">
            {t(`${base}.title`)}
          </h3>
          <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">{t(`${base}.body`)}</p>
          <ul className="mt-5 space-y-2.5">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-foreground">
                <Sprout className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Reveal>
  );
}

export function Landing({ onSignIn, onGetStarted }: LandingProps) {
  const { t } = useTranslation();
  const stats = [1, 2, 3, 4].map((n) => ({
    value: t(`landing.stats.s${n}Value`),
    label: t(`landing.stats.s${n}Label`),
  }));

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ------------------------------------------------ top bar */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <BrandMark />
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Button
              variant="secondary"
              size="sm"
              onClick={onSignIn}
              className="whitespace-nowrap"
              data-testid="landing-signin"
            >
              {t('landing.topbar.signIn')}
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ------------------------------------------------ hero */}
        <section aria-labelledby="landing-hero-title" className="relative overflow-hidden">
          <FieldContours />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-32">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.16em] text-accent ${ENTRANCE}`}>
                {t('landing.hero.kicker')}
              </p>
              <h1
                id="landing-hero-title"
                className={`mt-3 font-display text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem] ${ENTRANCE}`}
                style={{ animationDelay: '40ms' }}
              >
                {t('landing.hero.title')}{' '}
                <span className="relative whitespace-nowrap text-accent">
                  {t('landing.hero.titleAccent')}
                  <svg
                    className="absolute -bottom-1.5 left-0 h-2.5 w-full text-accent/60 sm:-bottom-2 sm:h-3"
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M4 9 C60 3 140 3 196 8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>
              <p
                className={`mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg ${ENTRANCE}`}
                style={{ animationDelay: '80ms' }}
              >
                {t('landing.hero.sub')}
              </p>
              <div className={`mt-8 flex flex-wrap items-center gap-3 ${ENTRANCE}`} style={{ animationDelay: '120ms' }}>
                <Button onClick={onGetStarted} className="min-h-12 px-7 text-base" data-testid="landing-get-started">
                  {t('landing.hero.getStarted')}
                </Button>
                <Button variant="secondary" onClick={onSignIn} className="min-h-12 px-7 text-base">
                  {t('landing.hero.signIn')}
                </Button>
              </div>
              <p className={`mt-5 text-sm text-muted-foreground ${ENTRANCE}`} style={{ animationDelay: '160ms' }}>
                {t('landing.hero.trust')}
              </p>
            </div>
            <HeroMock />
          </div>
        </section>

        {/* ------------------------------------------------ features */}
        <section aria-labelledby="landing-features-title" className="border-t border-border/60">
          <div className="mx-auto max-w-6xl space-y-20 px-4 py-20 sm:px-6 lg:space-y-28 lg:py-28">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
                {t('landing.features.kicker')}
              </p>
              <h2
                id="landing-features-title"
                className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl"
              >
                {t('landing.features.title')}
              </h2>
            </Reveal>
            <FeatureRow art={ArtFieldLog} base="landing.features.offline" />
            <FeatureRow art={ArtLedger} base="landing.features.finance" flip />
            <FeatureRow art={ArtTrace} base="landing.features.trace" />
            <FeatureRow art={ArtIntel} base="landing.features.intel" flip />
          </div>
        </section>

        {/* ------------------------------------------------ credibility band */}
        <section
          aria-labelledby="landing-stats-title"
          className="border-y border-sidebar-border bg-gradient-to-b from-sidebar to-[hsl(var(--sidebar-2))] text-sidebar-foreground"
        >
          <h2 id="landing-stats-title" className="sr-only">
            {t('landing.stats.heading')}
          </h2>
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:py-20">
            {stats.map((s) => (
              <Reveal key={s.value} className="border-t-2 border-accent/80 pt-4">
                <p className="font-display text-2xl font-bold tabular">{s.value}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-sidebar-muted">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      {/* ------------------------------------------------ footer */}
      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <BrandMark compact />
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{t('landing.footer.line')}</p>
          <p className="text-xs text-muted-foreground">
            {t('landing.footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </div>
  );
}
