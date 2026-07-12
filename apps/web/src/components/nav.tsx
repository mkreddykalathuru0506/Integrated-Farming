import { lazy, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Bird,
  ClipboardList,
  HeartPulse,
  Wallet,
  ShoppingCart,
  Wrench,
  Sparkles,
  FileText,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import type { MyFarm } from '../auth/api';

// Feature panels are code-split (lazy) so the initial bundle stays small (perf).
const Dashboard = lazy(() => import('../farm/Dashboard').then((m) => ({ default: m.Dashboard })));
const SpeciesPanel = lazy(() => import('../farm/SpeciesPanel').then((m) => ({ default: m.SpeciesPanel })));
const BatchesPanel = lazy(() => import('../farm/BatchesPanel').then((m) => ({ default: m.BatchesPanel })));
const AnimalsPanel = lazy(() => import('../farm/AnimalsPanel').then((m) => ({ default: m.AnimalsPanel })));
const WorkersPanel = lazy(() => import('../farm/WorkersPanel').then((m) => ({ default: m.WorkersPanel })));
const TasksPanel = lazy(() => import('../farm/TasksPanel').then((m) => ({ default: m.TasksPanel })));
const DailyLogPanel = lazy(() => import('../farm/DailyLogPanel').then((m) => ({ default: m.DailyLogPanel })));
const HealthPanel = lazy(() => import('../farm/HealthPanel').then((m) => ({ default: m.HealthPanel })));
const VaccinationPanel = lazy(() => import('../farm/VaccinationPanel').then((m) => ({ default: m.VaccinationPanel })));
const BreedingPanel = lazy(() => import('../farm/BreedingPanel').then((m) => ({ default: m.BreedingPanel })));
const HatcheryPanel = lazy(() => import('../farm/HatcheryPanel').then((m) => ({ default: m.HatcheryPanel })));
const FeedPanel = lazy(() => import('../farm/FeedPanel').then((m) => ({ default: m.FeedPanel })));
const ExpensesPanel = lazy(() => import('../farm/ExpensesPanel').then((m) => ({ default: m.ExpensesPanel })));
const EmiInsurancePanel = lazy(() => import('../farm/EmiInsurancePanel').then((m) => ({ default: m.EmiInsurancePanel })));
const InvoicePanel = lazy(() => import('../farm/InvoicePanel').then((m) => ({ default: m.InvoicePanel })));
const OrdersPanel = lazy(() => import('../farm/OrdersPanel').then((m) => ({ default: m.OrdersPanel })));
const ColdStoragePanel = lazy(() => import('../farm/ColdStoragePanel').then((m) => ({ default: m.ColdStoragePanel })));
const ProcessingPanel = lazy(() => import('../farm/ProcessingPanel').then((m) => ({ default: m.ProcessingPanel })));
const DispatchPanel = lazy(() => import('../farm/DispatchPanel').then((m) => ({ default: m.DispatchPanel })));
const AssetsPanel = lazy(() => import('../farm/AssetsPanel').then((m) => ({ default: m.AssetsPanel })));
const ByproductPanel = lazy(() => import('../farm/ByproductPanel').then((m) => ({ default: m.ByproductPanel })));
const CircularityPanel = lazy(() => import('../farm/CircularityPanel').then((m) => ({ default: m.CircularityPanel })));
const WeatherPanel = lazy(() => import('../farm/WeatherPanel').then((m) => ({ default: m.WeatherPanel })));
const MarketPanel = lazy(() => import('../farm/MarketPanel').then((m) => ({ default: m.MarketPanel })));
const ReportsPanel = lazy(() => import('../farm/ReportsPanel').then((m) => ({ default: m.ReportsPanel })));
const UnitsPanel = lazy(() => import('../farm/UnitsPanel').then((m) => ({ default: m.UnitsPanel })));
const SettingsPanel = lazy(() => import('../farm/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));

/** Farm membership roles (mirrors the API's FarmRole enum). */
export type Role = 'OWNER' | 'MANAGER' | 'VETERINARIAN' | 'ACCOUNTANT' | 'LABOUR' | 'BUYER';

/** Role-derived write permissions, computed once from the selected farm membership. */
export type Perms = {
  /** The membership role itself — for role-aware layouts (e.g. dashboard ordering). */
  role?: Role;
  canWriteUnits: boolean;
  canWriteSettings: boolean;
  canWriteFinance: boolean;
  canBill: boolean;
  canLogTemp: boolean;
};

export function permsFor(farm: MyFarm | undefined): Perms {
  const role = farm?.role as Role | undefined;
  const canWriteUnits = role === 'OWNER' || role === 'MANAGER';
  return {
    role,
    canWriteUnits,
    canWriteSettings: role === 'OWNER',
    canWriteFinance: canWriteUnits || role === 'ACCOUNTANT',
    canBill: role === 'OWNER' || role === 'ACCOUNTANT',
    canLogTemp: canWriteUnits || role === 'LABOUR',
  };
}

type PanelEntry = { key: string; full?: boolean; render: (farmId: string, p: Perms) => ReactNode };

export type Section = {
  key: string; // also the i18n key under `nav.*`
  icon: LucideIcon;
  /** Roles that see this section in nav/palette/routes. Omit = every role. UX only — server RBAC is the real guard. */
  roles?: Role[];
  panels: PanelEntry[];
};

/**
 * Sections visible to a role (sidebar, drawer, palette, tab bar and route resolution
 * all consume this). Nav-level UX filter only — the server enforces real RBAC.
 * Pre-selection edge (no role yet): show all; the server guards every request.
 */
export function visibleSections(role: Role | undefined): Section[] {
  if (!role) return SECTIONS;
  return SECTIONS.filter((s) => !s.roles || s.roles.includes(role));
}

/** Section → feature-panel map. The first section (overview) is the dashboard landing. */
export const SECTIONS: Section[] = [
  {
    key: 'overview',
    icon: LayoutDashboard,
    panels: [
      { key: 'dashboard', full: true, render: (f, p) => <Dashboard farmId={f} canWrite={p.canWriteUnits} role={p.role} /> },
    ],
  },
  {
    key: 'livestock',
    icon: Bird,
    roles: ['OWNER', 'MANAGER', 'VETERINARIAN', 'ACCOUNTANT', 'LABOUR'],
    panels: [
      { key: 'species', render: (f) => <SpeciesPanel farmId={f} /> },
      { key: 'batches', render: (f, p) => <BatchesPanel farmId={f} canWrite={p.canWriteUnits} /> },
      { key: 'animals', render: (f, p) => <AnimalsPanel farmId={f} canWrite={p.canWriteUnits} /> },
    ],
  },
  {
    key: 'daily',
    icon: ClipboardList,
    roles: ['OWNER', 'MANAGER', 'VETERINARIAN', 'LABOUR'],
    panels: [
      { key: 'workers', render: (f, p) => <WorkersPanel farmId={f} canWrite={p.canWriteUnits} /> },
      { key: 'tasks', render: (f, p) => <TasksPanel farmId={f} canWrite={p.canWriteUnits} /> },
      { key: 'logs', render: (f) => <DailyLogPanel farmId={f} /> },
    ],
  },
  {
    key: 'health',
    icon: HeartPulse,
    roles: ['OWNER', 'MANAGER', 'VETERINARIAN', 'LABOUR'],
    panels: [
      { key: 'health', render: (f, p) => <HealthPanel farmId={f} canWrite={p.canWriteUnits} /> },
      { key: 'vaccination', render: (f, p) => <VaccinationPanel farmId={f} canWrite={p.canWriteUnits} /> },
      { key: 'breeding', render: (f, p) => <BreedingPanel farmId={f} canWrite={p.canWriteUnits} /> },
      { key: 'hatchery', render: (f, p) => <HatcheryPanel farmId={f} canWrite={p.canWriteUnits} /> },
    ],
  },
  {
    key: 'finance',
    icon: Wallet,
    roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'],
    panels: [
      { key: 'feed', render: (f, p) => <FeedPanel farmId={f} canWrite={p.canWriteFinance} /> },
      { key: 'expenses', render: (f, p) => <ExpensesPanel farmId={f} canWrite={p.canWriteFinance} /> },
      { key: 'emi', render: (f, p) => <EmiInsurancePanel farmId={f} canWrite={p.canWriteFinance} /> },
      { key: 'invoices', render: (f, p) => <InvoicePanel farmId={f} canWrite={p.canBill} /> },
    ],
  },
  {
    key: 'sales',
    icon: ShoppingCart,
    roles: ['OWNER', 'MANAGER', 'ACCOUNTANT', 'LABOUR'],
    panels: [
      { key: 'orders', render: (f, p) => <OrdersPanel farmId={f} canWrite={p.canWriteFinance} canAddCustomer={p.canBill} /> },
      { key: 'coldstorage', render: (f, p) => <ColdStoragePanel farmId={f} canWrite={p.canWriteUnits} canLog={p.canLogTemp} /> },
      { key: 'processing', render: (f, p) => <ProcessingPanel farmId={f} canWrite={p.canWriteUnits} /> },
      { key: 'dispatch', render: (f, p) => <DispatchPanel farmId={f} canWrite={p.canWriteUnits} /> },
    ],
  },
  {
    key: 'maintenance',
    icon: Wrench,
    roles: ['OWNER', 'MANAGER', 'LABOUR'],
    panels: [
      { key: 'assets', render: (f, p) => <AssetsPanel farmId={f} canWrite={p.canWriteUnits} /> },
      { key: 'byproducts', render: (f, p) => <ByproductPanel farmId={f} canWrite={p.canWriteUnits} /> },
      { key: 'circularity', render: (f) => <CircularityPanel farmId={f} /> },
    ],
  },
  {
    key: 'intelligence',
    icon: Sparkles,
    roles: ['OWNER', 'MANAGER', 'VETERINARIAN', 'ACCOUNTANT'],
    panels: [
      { key: 'weather', render: (f, p) => <WeatherPanel farmId={f} canWrite={p.canWriteUnits} /> },
      { key: 'market', render: (f, p) => <MarketPanel farmId={f} canWrite={p.canWriteFinance} /> },
    ],
  },
  {
    key: 'reports',
    icon: FileText,
    roles: ['OWNER', 'MANAGER', 'VETERINARIAN', 'ACCOUNTANT'],
    panels: [{ key: 'reports', render: (f, p) => <ReportsPanel farmId={f} canWrite={p.canWriteUnits} /> }],
  },
  {
    key: 'settings',
    icon: SettingsIcon,
    roles: ['OWNER', 'MANAGER'],
    panels: [
      { key: 'units', render: (f, p) => <UnitsPanel farmId={f} canWrite={p.canWriteUnits} /> },
      { key: 'settings', render: (f, p) => <SettingsPanel farmId={f} canWrite={p.canWriteSettings} /> },
    ],
  },
];
