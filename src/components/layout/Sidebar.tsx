// Octopus Dashboard - Sidebar Navigation
import { motion } from 'framer-motion';
import {
  Home,
  LineChart,
  BarChart2,
  PlusCircle,
  UserMinus,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Receipt,
  Network,
  Upload
} from 'lucide-react';
import type { TabId } from '@/types';
import { useAppStore } from '@/stores/appStore';

const iconMap: Record<string, React.ElementType> = {
  home: Home,
  'line-chart': LineChart,
  'bar-chart-2': BarChart2,
  'plus-circle': PlusCircle,
  'user-minus': UserMinus,
  'zap': Zap,
  settings: Settings,
  'receipt': Receipt,
  'network': Network,
  'upload': Upload,
};

interface NavSection {
  title: string;
  items: { id: TabId; label: string; icon: string }[];
}

const navSections: NavSection[] = [
  {
    title: 'GENERAL',
    items: [
      { id: 'dashboard', label: 'Home', icon: 'home' },
    ],
  },
  {
    title: 'TALABAT WFM',
    items: [
      { id: 'data', label: 'Data', icon: 'line-chart' },
      { id: 'reports', label: 'Reports', icon: 'bar-chart-2' },
    ],
  },
  {
    title: 'OCTOPUS & INVOICING',
    items: [
      { id: 'ic-view', label: 'Talabat Invoice', icon: 'receipt' },
      { id: 'brightskies', label: 'Octopus Overview', icon: 'network' },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { id: 'admin-upload', label: 'Data Admin', icon: 'upload' },
    ],
  },
];

export default function Sidebar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onClick={toggleSidebar}
      />

      <motion.aside
        className={`fixed md:relative h-screen flex flex-col flex-shrink-0 bg-[#10104a] dark:bg-surface-0 border-r border-white/10 dark:border-surface-100 z-50 transition-transform duration-300 md:transition-none overflow-hidden ${collapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}
        initial={false}
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <style>{`
          @media (max-width: 767px) {
            aside { width: 240px !important; }
          }
        `}</style>
        {/* Header */}
        <div className={`flex items-center h-16 border-b border-white/10 dark:border-surface-100 flex-shrink-0 transition-colors ${collapsed ? 'justify-center px-0 hidden md:flex' : 'justify-between px-4'}`}>
        {!collapsed && (
          <div className="flex items-center">
            <img src="/octopus-logo.png" alt="Octopus" className="h-8 w-auto object-contain brightness-0 invert" />
          </div>
        )}
        {collapsed && (
          <button onClick={toggleSidebar} className="flex items-center justify-center p-2 w-full h-full hover:bg-[#1a1a6b] dark:hover:bg-surface-100/10 transition-colors cursor-pointer outline-none">
            <img src="/octopus-header.png" alt="Octopus Icon" className="w-8 h-8 object-contain brightness-0 invert" />
          </button>
        )}
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            className="w-6 h-6 rounded flex items-center justify-center text-brand-300 hover:text-white hover:bg-[#1a1a6b] dark:hover:bg-surface-100/10 transition-colors outline-none"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>


      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 hide-scrollbar">
        {navSections.map((section) => (
          <div key={section.title} className="mb-3">
            {!collapsed && (
              <p className="text-2xs font-medium text-brand-400/60 px-3 mb-1">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = iconMap[item.icon] || Home;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`sidebar-nav-item w-full ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="nav-icon" size={18} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-white/10 dark:border-surface-100 flex flex-col gap-1">
        <button
          onClick={toggleDarkMode}
          className={`sidebar-nav-item w-full ${collapsed ? 'justify-center px-0' : ''}`}
          title={collapsed ? 'Toggle Theme' : undefined}
        >
          {darkMode ? <Sun className="nav-icon" size={18} /> : <Moon className="nav-icon" size={18} />}
          {!collapsed && <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`sidebar-nav-item w-full ${activeTab === 'settings' ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings className="nav-icon" size={18} />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </motion.aside>
    </>
  );
}
