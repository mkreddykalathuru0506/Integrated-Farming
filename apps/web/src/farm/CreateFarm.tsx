import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCreateFarm } from '../api/ops.hooks';
import { Button, Field, Input, PanelNote } from '../ui';

const createFarmSchema = z.object({
  name: z.string().trim().min(1, 'farm.create.nameRequired'),
  state: z.string(),
});
type CreateFarmValues = z.infer<typeof createFarmSchema>;

/** First-run experience: create the initial farm (RHF + zod, toast on success/error). */
export function CreateFarm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const createFarm = useCreateFarm();
  const form = useForm<CreateFarmValues>({
    resolver: zodResolver(createFarmSchema),
    defaultValues: { name: '', state: '' },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = form.handleSubmit((v) => {
    createFarm.mutate(
      { name: v.name.trim(), state: v.state.trim() || undefined },
      { onSuccess: () => onCreated() },
    );
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
      <PanelNote>{t('farm.create.prompt')}</PanelNote>
      <Field label={t('farm.create.name')} required error={err(form.formState.errors.name?.message)}>
        <Input autoFocus {...form.register('name')} />
      </Field>
      <Field label={t('farm.create.state')} hint={t('farm.create.stateHint')}>
        <Input {...form.register('state')} />
      </Field>
      <Button type="submit" full loading={createFarm.isPending}>
        {t('farm.create.submit')}
      </Button>
    </form>
  );
}
