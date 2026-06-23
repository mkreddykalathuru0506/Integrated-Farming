import { useTranslation } from 'react-i18next';
import type { MyFarm } from '../auth/api';

/** Farm switcher + current-role badge (presentational). */
export function FarmsPanel({
  farms,
  selectedId,
  onSelect,
}: {
  farms: MyFarm[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const selected = farms.find((f) => f.farmId === selectedId);
  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        aria-label={t('farms.title')}
        className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3"
      >
        {farms.map((f) => (
          <option key={f.farmId} value={f.farmId}>
            {f.farmName}
          </option>
        ))}
      </select>
      {selected && (
        <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
          {t(`roles.${selected.role}`)}
        </span>
      )}
    </div>
  );
}
