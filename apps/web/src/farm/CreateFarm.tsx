import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, PanelError, PanelNote } from '../ui';
import { createFarm } from './api';

export function CreateFarm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setError(false);
    setSaving(true);
    try {
      await createFarm(accessToken, { name, state: state || undefined });
      onCreated();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <PanelNote>{t('farm.create.prompt')}</PanelNote>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('farm.create.name')}
        required
      />
      <Input
        value={state}
        onChange={(e) => setState(e.target.value)}
        placeholder={t('farm.create.state')}
      />
      {error && <PanelError>{t('farm.create.error')}</PanelError>}
      <Button type="submit" full disabled={saving}>
        {saving ? t('common.saving') : t('farm.create.submit')}
      </Button>
    </form>
  );
}
