import React from 'react';
import { LineChart, BarChart2, Receipt, Network, Settings as SettingsIcon } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

interface QuickAction {
  label: string;
  description: string;
  icon: React.ElementType;
  tab: string;
}

const quickActions: QuickAction[] = [
  { label: 'Data', description: 'Real-time performance metrics: SLA, AHT, CPH, Occupancy, and Utilization.', icon: LineChart, tab: 'data' },
  { label: 'Reports', description: 'Download enterprise-grade operational and performance exports.', icon: BarChart2, tab: 'reports' },
  { label: 'Talabat Invoice', description: 'Track billable hours, interval compliance, and down interval root-causes.', icon: Receipt, tab: 'ic-view' },
  { label: 'Octopus Overview', description: 'Workforce operations and organizational structure overview.', icon: Network, tab: 'brightskies' },
  { label: 'Settings', description: 'System configurations and preference controls.', icon: SettingsIcon, tab: 'settings' },
];

export default function Dashboard() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      <div className="page-header mb-5">
        <h1 className="page-title text-2xl font-semibold text-surface-900">
          Home
        </h1>
        <p className="page-description text-surface-500 text-xs sm:text-sm mt-0.5">
          Workforce management operational portal and quick access hub.
        </p>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => setActiveTab(action.tab as any)}
              className="card p-5 text-left hover:border-brand-400 dark:hover:border-brand-500/50 hover:bg-brand-50/30 dark:hover:bg-brand-950/20 shadow-xs group cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-surface-800/80 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/40 flex items-center justify-center">
                  <action.icon size={16} className="text-surface-500 dark:text-surface-400 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
                </div>
                <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
                  {action.label}
                </h3>
              </div>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed pl-12">
                {action.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
