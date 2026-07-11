import { useTranslation } from 'react-i18next';
import { Button } from '../ui';

/**
 * "Showing N of M" + Load more control for server-paginated lists (slice 11.8a).
 * Renders nothing when everything is already loaded.
 */
export function LoadMore({
  shown,
  total,
  loading,
  onLoadMore,
}: {
  shown: number;
  total: number;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useTranslation();
  if (total <= shown) return null;
  return (
    <div className="flex flex-col items-center gap-1.5 py-2" data-testid="load-more">
      <p className="text-xs text-muted-foreground">{t('table.showingOf', { shown, total })}</p>
      <Button type="button" variant="secondary" size="sm" loading={loading} onClick={onLoadMore}>
        {t('table.loadMore')}
      </Button>
    </div>
  );
}
