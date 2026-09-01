// ============================================
// WFM Platform — Global State Store (Zustand)
// ============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TabId, Toast } from '@/types';

interface AppState {
  // App Auth
  isAppLoggedIn: boolean;
  loginTimestamp: number | null;
  loginApp: () => void;
  logoutApp: () => void;

  // Calabrio API Token Auth
  token: string;
  isAuthenticated: boolean;
  setToken: (token: string) => void;
  clearToken: () => void;

  // Navigation
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Appearance
  darkMode: boolean;
  toggleDarkMode: () => void;

  // LOB Config
  lobConfig: Record<string, string[]>;
  setLobConfig: (config: Record<string, string[]>) => void;

  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Undo tracking
  lastTardyOpId: string | null;
  lastActivityOpId: string | null;
  setLastTardyOpId: (id: string | null) => void;
  setLastActivityOpId: (id: string | null) => void;

  // Operation state
  isExecuting: boolean;
  setIsExecuting: (val: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // App Auth
      isAppLoggedIn: false,
      loginTimestamp: null,
      loginApp: () => set({ isAppLoggedIn: true, loginTimestamp: Date.now(), activeTab: 'dashboard' }),
      logoutApp: () => set({ isAppLoggedIn: false, loginTimestamp: null, token: '', isAuthenticated: false, activeTab: 'dashboard' }),

      // Calabrio Auth
      token: '',
      isAuthenticated: false,
      setToken: (token) => set({ token, isAuthenticated: !!token }),
      clearToken: () => set({ token: '', isAuthenticated: false }),

      // Navigation
      activeTab: 'dashboard',
      setActiveTab: (tab) => set({ activeTab: tab }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // Appearance
      darkMode: false,
      toggleDarkMode: () => set((s) => {
        const next = !s.darkMode;
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { darkMode: next };
      }),

      // LOB Config
      lobConfig: {
        'Combined': ['Delivery', 'FCR', 'GCC', 'Pick up', 'T-Mart'],
        'TPRO': ['Nursery'],
      },
      setLobConfig: (config) => set({ lobConfig: config }),

      // Toasts
      toasts: [],
      addToast: (toast) =>
        set((s) => ({
          toasts: [...s.toasts, { ...toast, id: Date.now().toString() + Math.random().toString(36).slice(2) }],
        })),
      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      // Undo
      lastTardyOpId: null,
      lastActivityOpId: null,
      setLastTardyOpId: (id) => set({ lastTardyOpId: id }),
      setLastActivityOpId: (id) => set({ lastActivityOpId: id }),

      // Operation
      isExecuting: false,
      setIsExecuting: (val) => set({ isExecuting: val }),
    }),
    {
      name: 'octopus-rtm-state-v2',
      version: 1,
      partialize: (state) => ({
        isAppLoggedIn: state.isAppLoggedIn,
        loginTimestamp: state.loginTimestamp,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        sidebarCollapsed: state.sidebarCollapsed,
        lobConfig: state.lobConfig,
        darkMode: state.darkMode,
        activeTab: state.activeTab,
      }),
    }
  )
);
