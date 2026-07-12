import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bird } from 'lucide-react';
import { useSpecies } from '../api/hooks';
import { useSpeciesDetail } from '../api/livestock.hooks';
import type { SpeciesSummary } from './api';
import {
  Badge,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  PanelHeading,
  PanelNote,
  Skeleton,
  type DataTableColumn,
} from '../ui';
import { LoadErrorNote } from './LoadErrorNote';

/**
 * Species reference (seeded per farm). Read-only: a DataTable of species with a
 * detail dialog listing breeds + lifecycle stages (slice 11.6a rewrite).
 */
export function SpeciesPanel(_props: { farmId: string }) {
  const { t } = useTranslation();
  const species = useSpecies();
  const [openSpecies, setOpenSpecies] = useState<SpeciesSummary | null>(null);
  const detail = useSpeciesDetail(openSpecies?.id ?? null);

  const columns: DataTableColumn<SpeciesSummary>[] = [
    { header: 'species.cols.name', accessor: 'name' },
    {
      header: 'species.cols.code',
      accessor: 'code',
      cell: (s) => <span className="font-mono text-xs text-muted-foreground">{s.code}</span>,
    },
    {
      header: 'species.cols.tracking',
      accessor: 'trackingMode',
      cell: (s) => (
        <Badge variant={s.trackingMode === 'INDIVIDUAL' ? 'accent' : 'default'}>
          {t(`species.tracking.${s.trackingMode}`)}
        </Badge>
      ),
    },
  ];

  return (
    <section className="space-y-3">
      <PanelHeading>{t('species.title')}</PanelHeading>

      {species.isError && !species.data ? (
        <LoadErrorNote
          text={t('species.error')}
          retryLabel={t('species.retry')}
          onRetry={() => void species.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={species.data}
          isLoading={species.isPending}
          searchable
          pageSize={10}
          onRowClick={(s) => setOpenSpecies(s)}
          getRowId={(s) => s.id}
          emptyState={
            <EmptyState
              icon={Bird} illustration="livestock"
              title={t('species.empty')}
              description={t('species.emptyHint')}
            />
          }
        />
      )}

      <Dialog open={openSpecies !== null} onOpenChange={(open) => !open && setOpenSpecies(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{openSpecies?.name}</DialogTitle>
            <DialogDescription>
              {openSpecies ? t(`species.tracking.${openSpecies.trackingMode}`) : ''}
            </DialogDescription>
          </DialogHeader>

          {detail.isPending && (
            <div className="space-y-2" aria-hidden>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          )}
          {detail.isError && <LoadErrorNote
            text={t('species.error')}
            retryLabel={t('species.retry')}
            onRetry={() => void detail.refetch()}
          />}
          {detail.data && (
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('species.stages')}
                </h3>
                <ol className="space-y-1">
                  {detail.data.stages.map((stage) => (
                    <li key={stage.id} className="flex items-center gap-2 text-foreground">
                      <span className="tabular grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
                        {stage.sequence}
                      </span>
                      {stage.name}
                      {stage.isTerminal && <Badge variant="muted">{t('species.terminal')}</Badge>}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('species.breeds')}
                </h3>
                {detail.data.breeds.length === 0 ? (
                  <PanelNote>{t('species.noBreeds')}</PanelNote>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.data.breeds.map((breed) => (
                      <Badge key={breed.id}>{breed.name}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
