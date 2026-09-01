// Octopus Dashboard - Enterprise Sidebar Navigation
import React, { useState, useEffect } from 'react';
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
  Moon,
  Sun,
  Receipt,
  Network,
  Upload,
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
  items: { id: TabId; label: string; icon: string; badge?: string }[];
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
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [mobile, setMobile] = useState(isMobile);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <>
      {/* Mobile Overlay - only visible on mobile */}
      <div
        className={`md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-200 ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
        onClick={toggleSidebar}
      />

      <motion.aside
        className="fixed md:relative h-screen flex flex-col flex-shrink-0 bg-[#10104a] dark:bg-[#0b0e17] border-r border-white/10 dark:border-surface-100/50 z-50 overflow-hidden select-none shadow-xl"
        initial={false}
        animate={mobile
          ? { width: 256, x: collapsed ? -256 : 0 }   // mobile: slide in/out
          : { width: collapsed ? 76 : 256, x: 0 }      // desktop: collapse width
        }
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      >

        {/* Brand Header */}
        <div className={`flex items-center h-[68px] border-b border-white/10 dark:border-surface-100/40 flex-shrink-0 px-4 transition-colors ${collapsed ? 'justify-center px-0' : 'justify-between'}`}>
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <img 
                src="/octopus-logo.png" 
                alt="Octopus" 
                className="h-8 w-auto object-contain brightness-0 invert transition-all" 
              />
            </div>
          ) : (
            <button 
              onClick={toggleSidebar} 
              className="flex items-center justify-center p-2 rounded-xl cursor-pointer outline-none w-full h-full"
              title="Expand Sidebar"
            >
              <img 
                src="/octopus-header.png" 
                alt="Octopus Icon" 
                className="w-12 h-12 object-contain brightness-0 invert" 
              />
            </button>
          )}

          {!collapsed && (
            <button
              onClick={toggleSidebar}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 dark:hover:bg-surface-100/30 transition-colors outline-none"
              title="Collapse Sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-3 hide-scrollbar">
          {navSections.map((section, index) => (
            <div key={section.title} className={`space-y-0.5 ${index !== navSections.length - 1 ? 'pb-3 border-b border-white/10 dark:border-surface-100/20' : ''}`}>
              {!collapsed && (
                <p className="text-[10px] font-bold tracking-wider text-brand-300/60 dark:text-surface-400 uppercase px-3 py-1 mb-0.5">
                  {section.title}
                </p>
              )}
              
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = iconMap[item.icon] || Home;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`group relative flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium outline-none ${
                        isActive
                          ? 'bg-[#2b2b8c] dark:bg-brand-600 text-white font-semibold shadow-md'
                          : 'text-white/80 dark:text-surface-300 hover:text-white hover:bg-white/10 dark:hover:bg-surface-100/30'
                      } ${collapsed ? 'justify-center px-0 h-9' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon 
                        className={`w-4 h-4 flex-shrink-0 ${
                          isActive ? 'text-white' : 'text-white/70 dark:text-surface-400 group-hover:text-white'
                        }`} 
                      />

                      {!collapsed && (
                        <span className="truncate tracking-normal">
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-white/10 dark:border-surface-100/40 flex flex-col gap-1.5 bg-black/10 dark:bg-black/30">
          
          <button
            onClick={toggleDarkMode}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-white/80 dark:text-surface-300 hover:text-white hover:bg-white/10 dark:hover:bg-surface-100/30 outline-none ${collapsed ? 'justify-center px-0 h-10' : ''}`}
            title={collapsed ? (darkMode ? 'Light Mode' : 'Dark Mode') : undefined}
          >
            {darkMode ? <Sun className="w-4 h-4 text-warning-400" /> : <Moon className="w-4 h-4 text-brand-300" />}
            {!collapsed && <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium outline-none ${
              activeTab === 'settings' 
                ? 'bg-[#2b2b8c] dark:bg-brand-600 text-white font-semibold shadow-md' 
                : 'text-white/80 dark:text-surface-300 hover:text-white hover:bg-white/10 dark:hover:bg-surface-100/30'
            } ${collapsed ? 'justify-center px-0 h-10' : ''}`}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="w-4 h-4 text-white/70 dark:text-surface-400" />
            {!collapsed && <span>Settings</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
