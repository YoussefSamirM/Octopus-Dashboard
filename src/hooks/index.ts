// ============================================
// WFM Platform — Custom React Hooks
// ============================================

import { useAppStore } from '@/stores/appStore';
import { useCallback } from 'react';

/**
 * Hook for showing toast notifications with auto-dismiss
 */
export function useToast() {
  const addToast = useAppStore((s) => s.addToast);
  const removeToast = useAppStore((s) => s.removeToast);

  const toast = useCallback(
    (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 4000) => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2);
      addToast({ message, type, duration });
      setTimeout(() => removeToast(id), duration);
    },
    [addToast, removeToast]
  );

  return {
    success: (msg: string) => toast(msg, 'success'),
    error: (msg: string) => toast(msg, 'error'),
    warning: (msg: string) => toast(msg, 'warning'),
    info: (msg: string) => toast(msg, 'info'),
  };
}

/**
 * Hook for token management
 */
export function useAuth() {
  const token = useAppStore((s) => s.token);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setToken = useAppStore((s) => s.setToken);

  const requireToken = useCallback((): string | null => {
    if (!token) {
      return null;
    }
    return token;
  }, [token]);

  return { token, isAuthenticated, setToken, requireToken };
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function useTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}
