// ============================================
// WFM Platform — Main App Component
// Root layout with sidebar + content area
// ============================================


import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
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
import { Radar, Menu } from 'lucide-react';

import GSAPPageTransition from '@/components/common/GSAPPageTransition';
import ChatbotWidget from '@/components/common/ChatbotWidget';

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
  const loginTimestamp = useAppStore((s) => s.loginTimestamp);
  const logoutApp = useAppStore((s) => s.logoutApp);
  const addToast = useAppStore((s) => s.addToast);
  const darkMode = useAppStore((s) => s.darkMode);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const ActivePage = pageComponents[activeTab] || Dashboard;
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  const [showSplash, setShowSplash] = useState(true);
  const splashRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const appContainerRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Handle 3-hour session expiration
  useEffect(() => {
    if (isAppLoggedIn && loginTimestamp) {
      const SESSION_DURATION = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
      const timeElapsed = Date.now() - loginTimestamp;
      
      if (timeElapsed >= SESSION_DURATION) {
        // Session already expired
        logoutApp();
        addToast({ message: 'Your session has expired. Please log in again.', type: 'info' });
      } else {
        // Set a timer for the remaining time
        const timeRemaining = SESSION_DURATION - timeElapsed;
        const timerId = setTimeout(() => {
          logoutApp();
          addToast({ message: 'Your session has expired. Please log in again.', type: 'info' });
        }, timeRemaining);
        
        return () => clearTimeout(timerId);
      }
    }
  }, [isAppLoggedIn, loginTimestamp, logoutApp, addToast]);

  useLayoutEffect(() => {
    if (!isAppLoggedIn) return;
    
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          setShowSplash(false);
        }
      });
      
      // Initial state
      gsap.set(appContainerRef.current, { opacity: 0 });
      gsap.set(logoRef.current, { scale: 0.8, opacity: 0 });
      
      // Animate logo in
      tl.to(logoRef.current, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.5)" })
        // Hold for a moment
        .to({}, { duration: 0.1 })
        // Animate splash out and app in simultaneously
        .to(splashRef.current, { opacity: 0, filter: "blur(5px)", duration: 0.3, ease: "power2.inOut" })
        .to(appContainerRef.current, { opacity: 1, duration: 0.3, ease: "power2.out" }, "<0.1");
        
    });
    return () => ctx.revert();
  }, [isAppLoggedIn]);

  useEffect(() => {
    isFirstLoad.current = false;
  }, [activeTab]);

  if (!isAppLoggedIn) {
    return <Login />;
  }

  return (
    <>
      {showSplash && (
        <div
          ref={splashRef}
          className="fixed inset-0 z-[100] bg-surface-50 dark:bg-surface-0 flex items-center justify-center pointer-events-none"
        >
          <img
            ref={logoRef}
            src="/octopus-logo.png"
            alt="Octopus Logo"
            className="w-[180px] object-contain brightness-0 dark:invert opacity-90"
          />
        </div>
      )}

      <div ref={appContainerRef} className="flex h-screen w-screen overflow-hidden bg-surface-50 opacity-0 relative">
        <Sidebar />

      <main className="relative flex-1 flex flex-col h-screen overflow-x-hidden overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between bg-[#10104a] dark:bg-surface-0 px-4 py-3 border-b border-white/10 dark:border-surface-100 flex-shrink-0 z-20">
          <div className="flex items-center gap-2">
            <img src="/octopus-logo.png" alt="Octopus" className="h-6 w-auto object-contain brightness-0 invert" />
          </div>
          <button onClick={toggleSidebar} className="text-white outline-none p-1">
            <Menu size={24} />
          </button>
        </div>

        <div className="flex-1 px-3 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8 relative z-10 overflow-x-hidden">
          <GSAPPageTransition pageKey={activeTab} delay={isFirstLoad.current ? 0.5 : 0}>
            <ActivePage />
          </GSAPPageTransition>
        </div>
        
        <footer className="w-full py-3 px-4 sm:px-6 border-t border-surface-200 dark:border-surface-100 bg-surface-0 flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto flex-shrink-0 relative z-10">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <img src="/octopus-header.png" alt="Octopus" className="h-5 w-auto object-contain opacity-90 dark:brightness-0 dark:invert" />
              <span className="text-xs font-semibold text-surface-700 tracking-tight">Octopus Dashboard</span>
            </div>
            <div className="hidden sm:block h-3 w-[1px] bg-surface-300 dark:bg-white/20" />
            <p className="text-[10px] text-surface-400">&copy; {new Date().getFullYear()}. All rights reserved. Confidential & Proprietary.</p>
          </div>
        </footer>
      </main>

        <ToastContainer />
        <ChatbotWidget />
      </div>
    </>
  );
}
