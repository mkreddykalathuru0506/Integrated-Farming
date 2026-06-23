import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { myFarmsRequest, type MyFarm } from './auth/api';
import { AppShell } from './components/AppShell';
import { LoginForm } from './components/LoginForm';
import { FarmsPanel } from './components/FarmsPanel';
import { CreateFarm } from './farm/CreateFarm';
import { Button, Card } from './ui';

// Feature panels are code-split (lazy) so the initial bundle stays small (perf).
const UnitsPanel = lazy(() => import('./farm/UnitsPanel').then((m) => ({ default: m.UnitsPanel })));
const SettingsPanel = lazy(() => import('./farm/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));
const SpeciesPanel = lazy(() => import('./farm/SpeciesPanel').then((m) => ({ default: m.SpeciesPanel })));
const BatchesPanel = lazy(() => import('./farm/BatchesPanel').then((m) => ({ default: m.BatchesPanel })));
const AnimalsPanel = lazy(() => import('./farm/AnimalsPanel').then((m) => ({ default: m.AnimalsPanel })));
const WorkersPanel = lazy(() => import('./farm/WorkersPanel').then((m) => ({ default: m.WorkersPanel })));
const TasksPanel = lazy(() => import('./farm/TasksPanel').then((m) => ({ default: m.TasksPanel })));
const DailyLogPanel = lazy(() => import('./farm/DailyLogPanel').then((m) => ({ default: m.DailyLogPanel })));
const HealthPanel = lazy(() => import('./farm/HealthPanel').then((m) => ({ default: m.HealthPanel })));
const VaccinationPanel = lazy(() => import('./farm/VaccinationPanel').then((m) => ({ default: m.VaccinationPanel })));
const BreedingPanel = lazy(() => import('./farm/BreedingPanel').then((m) => ({ default: m.BreedingPanel })));
const HatcheryPanel = lazy(() => import('./farm/HatcheryPanel').then((m) => ({ default: m.HatcheryPanel })));
const FeedPanel = lazy(() => import('./farm/FeedPanel').then((m) => ({ default: m.FeedPanel })));
const ExpensesPanel = lazy(() => import('./farm/ExpensesPanel').then((m) => ({ default: m.ExpensesPanel })));
const EmiInsurancePanel = lazy(() => import('./farm/EmiInsurancePanel').then((m) => ({ default: m.EmiInsurancePanel })));
const InvoicePanel = lazy(() => import('./farm/InvoicePanel').then((m) => ({ default: m.InvoicePanel })));
const OrdersPanel = lazy(() => import('./farm/OrdersPanel').then((m) => ({ default: m.OrdersPanel })));
const ColdStoragePanel = lazy(() => import('./farm/ColdStoragePanel').then((m) => ({ default: m.ColdStoragePanel })));
const ProcessingPanel = lazy(() => import('./farm/ProcessingPanel').then((m) => ({ default: m.ProcessingPanel })));
const DispatchPanel = lazy(() => import('./farm/DispatchPanel').then((m) => ({ default: m.DispatchPanel })));
const AssetsPanel = lazy(() => import('./farm/AssetsPanel').then((m) => ({ default: m.AssetsPanel })));
const ByproductPanel = lazy(() => import('./farm/ByproductPanel').then((m) => ({ default: m.ByproductPanel })));
const CircularityPanel = lazy(() => import('./farm/CircularityPanel').then((m) => ({ default: m.CircularityPanel })));
const WeatherPanel = lazy(() => import('./farm/WeatherPanel').then((m) => ({ default: m.WeatherPanel })));
const MarketPanel = lazy(() => import('./farm/MarketPanel').then((m) => ({ default: m.MarketPanel })));
const DashboardPanel = lazy(() => import('./farm/DashboardPanel').then((m) => ({ default: m.DashboardPanel })));
const ReportsPanel = lazy(() => import('./farm/ReportsPanel').then((m) => ({ default: m.ReportsPanel })));

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
        <Suspense fallback={<p className="text-sm text-slate-500">{t('farms.loading')}</p>}>
          <Card>
            <DashboardPanel key={`db-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <ReportsPanel key={`rp-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <WeatherPanel key={`wx-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <MarketPanel key={`mk-${selectedId}`} farmId={selectedId} canWrite={canWriteFinance} />
          </Card>
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
            <AssetsPanel key={`as-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <ByproductPanel key={`bp-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <CircularityPanel key={`ci-${selectedId}`} farmId={selectedId} />
          </Card>
          <Card>
            <UnitsPanel key={`u-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <SettingsPanel key={`s-${selectedId}`} farmId={selectedId} canWrite={canWriteSettings} />
          </Card>
        </Suspense>
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
