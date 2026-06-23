import { useTranslation } from 'react-i18next';
import type { MyFarm } from '../auth/api';
import { Badge, Select } from '../ui';

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
      <Select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        aria-label={t('farms.title')}
        className="flex-1"
      >
        {farms.map((f) => (
          <option key={f.farmId} value={f.farmId}>
            {f.farmName}
          </option>
        ))}
      </Select>
      {selected && <Badge>{t(`roles.${selected.role}`)}</Badge>}
    </div>
  );
}
