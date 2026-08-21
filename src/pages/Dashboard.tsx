import { LineChart, BarChart2, Receipt, Network, Settings as SettingsIcon } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

interface QuickAction {
  label: string;
  description: string;
  icon: React.ElementType;
  tab: string;
}

const quickActions: QuickAction[] = [
  { label: 'Data', description: 'See all data like SLA, AHT, CHP, Occupancy, Utilization.', icon: LineChart, tab: 'data' },
  { label: 'Reports', description: 'Download all reports in professional way.', icon: BarChart2, tab: 'reports' },
  { label: 'Talabat Invoice', description: 'View and manage Talabat invoices.', icon: Receipt, tab: 'ic-view' },
  { label: 'Octopus Overview', description: 'Enterprise workforce overview and operations.', icon: Network, tab: 'brightskies' },
  { label: 'Settings', description: 'Configure system settings.', icon: SettingsIcon, tab: 'settings' },
];

export default function Dashboard() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <div className="relative min-h-[80vh] max-w-[1200px] mx-auto rounded-md">
      <div className="relative z-10">
        <div className="page-header">
          <h1 className="page-title">Home</h1>
          <p className="page-description">Overview and quick access to all tools.</p>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 mt-8">
          <h2 className="text-xs font-medium text-surface-400 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => setActiveTab(action.tab as any)}
                className="card p-5 text-left hover:border-brand-300 dark:hover:border-brand-500/30 hover:bg-brand-50/50 dark:hover:bg-brand-900/20 transition-colors group"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-md bg-surface-100 group-hover:bg-brand-100 flex items-center justify-center transition-colors">
                    <action.icon className="text-surface-500 group-hover:text-brand-600 transition-colors" size={16} />
                  </div>
                  <h3 className="text-base font-medium text-surface-800">{action.label}</h3>
                </div>
                <p className="text-sm text-surface-500 leading-relaxed pl-10">{action.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
