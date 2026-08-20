// ============================================
// WFM Platform — Main App Component
// Root layout with sidebar + content area
// ============================================


import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import Sidebar from '@/components/layout/Sidebar';
import ToastContainer from '@/components/layout/ToastContainer';
import Dashboard from '@/pages/Dashboard';
import StaffingBuffer from '@/pages/StaffingBuffer';
import ShapeAnalysis from '@/pages/ShapeAnalysis';
import SmartActions from '@/pages/SmartActions';
import Login from '@/pages/Login';
import ActivityManager from '@/pages/ActivityManager';
import TardyManager from '@/pages/TardyManager';
import Settings from '@/pages/Settings';
import Data from '@/pages/Data';
import Reports from '@/pages/Reports';
import BrightskiesOverview from '@/pages/BrightskiesOverview';
import ICView from '@/pages/ICView';
import AdminUpload from '@/pages/AdminUpload';
import type { TabId } from '@/types';
import { Radar } from 'lucide-react';

import GSAPPageTransition from '@/components/common/GSAPPageTransition';

const pageComponents: Record<TabId, React.ComponentType> = {
  dashboard: Dashboard,
  buffer: StaffingBuffer,
  shape: ShapeAnalysis,
  'smart-actions': SmartActions,
  activity: ActivityManager,
  tardy: TardyManager,
  settings: Settings,
  data: Data,
  reports: Reports,
  brightskies: BrightskiesOverview,
  'ic-view': ICView,
  'admin-upload': AdminUpload,
};

export default function App() {
  const activeTab = useAppStore((s) => s.activeTab);
  const isAppLoggedIn = useAppStore((s) => s.isAppLoggedIn);
  const darkMode = useAppStore((s) => s.darkMode);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const ActivePage = pageComponents[activeTab] || Dashboard;

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  if (!isAppLoggedIn) {
    return <Login />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-50">
      <Sidebar />

      <main className="relative flex-1 flex flex-col h-screen overflow-x-hidden overflow-y-auto">
        {/* Global Background Animated Logo */}
        <div className="fixed inset-y-0 right-0 z-0 pointer-events-none flex items-center justify-center opacity-[0.03] dark:opacity-[0.04] overflow-hidden transition-all duration-500" style={{ left: collapsed ? '64px' : '240px' }}>
          <img 
            src="/logo-icon.png" 
            alt="Background Logo" 
            className="w-[350px] h-[350px] object-contain animate-breathe filter drop-shadow-2xl"
          />
        </div>

        <div className="flex-1 px-8 py-8 lg:px-10 lg:py-8 relative z-10">
          <GSAPPageTransition pageKey={activeTab}>
            <ActivePage />
          </GSAPPageTransition>
        </div>
        
        <footer className="w-full py-3 px-4 sm:px-6 border-t border-surface-200 dark:border-surface-100 bg-surface-0 flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto flex-shrink-0 relative z-10">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <img src="/octopus-header.png" alt="Octopus" className="h-5 w-auto object-contain opacity-90 dark:brightness-0 dark:invert" />
              <span className="text-xs font-bold text-surface-700 tracking-tight">Octopus Dashboard</span>
            </div>
            <div className="hidden sm:block h-3 w-[1px] bg-surface-300 dark:bg-white/20" />
            <p className="text-[10px] text-surface-400">&copy; {new Date().getFullYear()}. All rights reserved. Confidential & Proprietary.</p>
          </div>
          
          <div className="text-[10px] sm:text-[11px] text-surface-500 font-medium tracking-wide flex items-center gap-1.5">
            <span className="text-surface-400">Designed and Developed by</span>
            <span className="font-bold text-brand-600">Yousef Samir</span>
          </div>
        </footer>
      </main>

      <ToastContainer />
    </div>
  );
}
