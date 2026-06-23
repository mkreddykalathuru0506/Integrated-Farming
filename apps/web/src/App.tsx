import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { myFarmsRequest, type MyFarm } from './auth/api';
import { AppShell } from './components/AppShell';
import { LoginForm } from './components/LoginForm';
import { FarmsPanel } from './components/FarmsPanel';
import { CreateFarm } from './farm/CreateFarm';
import { UnitsPanel } from './farm/UnitsPanel';
import { SettingsPanel } from './farm/SettingsPanel';
import { SpeciesPanel } from './farm/SpeciesPanel';
import { BatchesPanel } from './farm/BatchesPanel';
import { AnimalsPanel } from './farm/AnimalsPanel';
import { WorkersPanel } from './farm/WorkersPanel';
import { TasksPanel } from './farm/TasksPanel';
import { DailyLogPanel } from './farm/DailyLogPanel';
import { HealthPanel } from './farm/HealthPanel';
import { VaccinationPanel } from './farm/VaccinationPanel';
import { BreedingPanel } from './farm/BreedingPanel';
import { HatcheryPanel } from './farm/HatcheryPanel';
import { FeedPanel } from './farm/FeedPanel';
import { ExpensesPanel } from './farm/ExpensesPanel';
import { EmiInsurancePanel } from './farm/EmiInsurancePanel';
import { InvoicePanel } from './farm/InvoicePanel';
import { OrdersPanel } from './farm/OrdersPanel';
import { ColdStoragePanel } from './farm/ColdStoragePanel';
import { ProcessingPanel } from './farm/ProcessingPanel';
import { DispatchPanel } from './farm/DispatchPanel';
import { Button, Card } from './ui';

function Dashboard() {
  const { t } = useTranslation();
  const { user, accessToken, logout } = useAuth();
  const [farms, setFarms] = useState<MyFarm[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState(false);

  const loadFarms = useCallback(() => {
    if (!accessToken) return;
    setError(false);
    myFarmsRequest(accessToken)
      .then((r) => {
        setFarms(r.farms);
        setSelectedId((prev) =>
          r.farms.some((f) => f.farmId === prev) ? prev : (r.farms[0]?.farmId ?? ''),
        );
      })
      .catch(() => setError(true));
  }, [accessToken]);

  useEffect(loadFarms, [loadFarms]);

  const selected = farms?.find((f) => f.farmId === selectedId);
  const canWriteUnits = selected?.role === 'OWNER' || selected?.role === 'MANAGER';
  const canWriteSettings = selected?.role === 'OWNER';
  const canWriteFinance = canWriteUnits || selected?.role === 'ACCOUNTANT';
  const canBill = selected?.role === 'OWNER' || selected?.role === 'ACCOUNTANT';
  const canLogTemp = canWriteUnits || selected?.role === 'LABOUR';

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="truncate">
            <p className="font-medium text-slate-800">{t('auth.welcome', { name: user?.name })}</p>
            <p className="truncate text-sm text-slate-500">{user?.email}</p>
          </div>
          <Button variant="secondary" onClick={() => void logout()}>
            {t('auth.logout')}
          </Button>
        </div>
        {farms && farms.length > 0 && selectedId && (
          <div className="mt-4">
            <FarmsPanel farms={farms} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        )}
      </Card>

      {error && !farms && (
        <p role="alert" className="text-sm text-red-600">
          {t('farms.error')}
        </p>
      )}
      {!error && farms === null && <p className="text-sm text-slate-500">{t('farms.loading')}</p>}

      {farms && farms.length === 0 && (
        <Card>
          <CreateFarm onCreated={loadFarms} />
        </Card>
      )}

      {farms && farms.length > 0 && selectedId && (
        <>
          <Card>
            <SpeciesPanel key={`sp-${selectedId}`} farmId={selectedId} />
          </Card>
          <Card>
            <BatchesPanel key={`b-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <AnimalsPanel key={`a-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <WorkersPanel key={`w-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <TasksPanel key={`tk-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <DailyLogPanel key={`dl-${selectedId}`} farmId={selectedId} />
          </Card>
          <Card>
            <HealthPanel key={`hp-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <VaccinationPanel key={`vx-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <BreedingPanel key={`br-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <HatcheryPanel key={`hx-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <FeedPanel key={`fd-${selectedId}`} farmId={selectedId} canWrite={canWriteFinance} />
          </Card>
          <Card>
            <ExpensesPanel key={`ex-${selectedId}`} farmId={selectedId} canWrite={canWriteFinance} />
          </Card>
          <Card>
            <EmiInsurancePanel key={`emi-${selectedId}`} farmId={selectedId} canWrite={canWriteFinance} />
          </Card>
          <Card>
            <InvoicePanel key={`inv-${selectedId}`} farmId={selectedId} canWrite={canBill} />
          </Card>
          <Card>
            <OrdersPanel key={`ord-${selectedId}`} farmId={selectedId} canWrite={canWriteFinance} />
          </Card>
          <Card>
            <ColdStoragePanel key={`cs-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} canLog={canLogTemp} />
          </Card>
          <Card>
            <ProcessingPanel key={`pr-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <DispatchPanel key={`dp-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <UnitsPanel key={`u-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <SettingsPanel key={`s-${selectedId}`} farmId={selectedId} canWrite={canWriteSettings} />
          </Card>
        </>
      )}
    </div>
  );
}

function Root() {
  const { user } = useAuth();
  return (
    <AppShell>
      {user ? (
        <Dashboard />
      ) : (
        <Card className="mx-auto max-w-sm">
          <LoginForm />
        </Card>
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
