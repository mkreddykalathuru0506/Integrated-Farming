import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '../ui';
import type { Section } from './nav';
import { pathForSection } from './router';

type Props = {
  section: Section;
  activePanelKey: string;
  navigate: (key: string, opts?: { panel?: string }) => void;
};

/**
 * Panel tab bar for multi-panel sections. Triggers are real links (middle/
 * ctrl-click opens a new browser tab); plain clicks navigate in-app. Manual
 * activation so arrow-key browsing doesn't spam history.
 */
export function SectionTabs({ section, activePanelKey, navigate }: Props) {
  const { t } = useTranslation();
  if (section.panels.length < 2) return null;

  return (
    <Tabs value={activePanelKey} activationMode="manual" className="mb-5">
      <TabsList aria-label={t(`nav.${section.key}`)}>
        {section.panels.map((p, i) => {
          const panelArg = i === 0 ? undefined : p.key;
          const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
            // Modified / non-primary clicks fall through to the browser (new tab).
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            navigate(section.key, panelArg === undefined ? undefined : { panel: panelArg });
          };
          return (
            <TabsTrigger key={p.key} value={p.key} asChild>
              <a href={pathForSection(section.key, panelArg)} onClick={onClick} className="no-underline">
                {t(`nav.panels.${p.key}`)}
              </a>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
