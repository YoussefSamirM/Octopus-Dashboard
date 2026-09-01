import React from 'react';
import { LogOut, Moon, Sun, Monitor, Clock, User } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

const SESSION_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

export default function Settings() {
  const logoutApp = useAppStore((s) => s.logoutApp);
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const loginTimestamp = useAppStore((s) => s.loginTimestamp);

  const sessionExpiry = loginTimestamp ? new Date(loginTimestamp + SESSION_DURATION_MS) : null;
  const sessionExpiryStr = sessionExpiry
    ? sessionExpiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  const minutesLeft = loginTimestamp
    ? Math.max(0, Math.round((loginTimestamp + SESSION_DURATION_MS - Date.now()) / 60000))
    : null;

  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      <div className="page-header mb-6">
        <h1 className="page-title text-2xl font-semibold text-surface-900 dark:text-white">
          Settings
        </h1>
        <p className="page-description text-surface-500 dark:text-surface-400 text-xs sm:text-sm mt-0.5">
          Manage application preferences and account.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Account Management */}
        <div className="card dark:bg-[#1e293b] dark:border-[#334155] p-5 col-span-1">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-[#334155] flex items-center justify-center">
              <User size={15} className="text-surface-500 dark:text-slate-400" />
            </div>
            <h2 className="text-sm font-semibold text-surface-900 dark:text-white">Account</h2>
          </div>

          <div className="text-xs border-t border-surface-100 dark:border-[#334155] pt-4 mb-4">
            <div className="flex justify-between items-center py-2">
              <span className="text-surface-400 dark:text-slate-400">Role</span>
              <span className="font-semibold text-surface-700 dark:text-slate-200">Administrator</span>
            </div>
            <div className="flex justify-between items-center py-2 border-t border-surface-100 dark:border-[#334155]">
              <span className="text-surface-400 dark:text-slate-400">Platform</span>
              <span className="font-semibold text-surface-700 dark:text-slate-200">Octopus WFM</span>
            </div>
          </div>

          <button
            onClick={logoutApp}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-danger-200 dark:border-red-900/60 bg-danger-50 dark:bg-red-950/30 text-danger-600 dark:text-red-400 hover:bg-danger-100 dark:hover:bg-red-900/40 text-sm font-semibold"
          >
            <LogOut size={15} />
            Log Out
          </button>
        </div>

        {/* Session Info */}
        <div className="card dark:bg-[#1e293b] dark:border-[#334155] p-5 col-span-1">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-[#334155] flex items-center justify-center">
              <Clock size={15} className="text-surface-500 dark:text-slate-400" />
            </div>
            <h2 className="text-sm font-semibold text-surface-900 dark:text-white">Session</h2>
          </div>

          <div className="text-xs border-t border-surface-100 dark:border-[#334155] pt-4">
            <div className="flex justify-between items-center py-2">
              <span className="text-surface-400 dark:text-slate-400">Duration</span>
              <span className="font-semibold text-surface-700 dark:text-slate-200">3 hours</span>
            </div>
            <div className="flex justify-between items-center py-2 border-t border-surface-100 dark:border-[#334155]">
              <span className="text-surface-400 dark:text-slate-400">Expires at</span>
              <span className="font-semibold text-surface-700 dark:text-slate-200">{sessionExpiryStr}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-t border-surface-100 dark:border-[#334155]">
              <span className="text-surface-400 dark:text-slate-400">Time left</span>
              <span className={`font-semibold ${minutesLeft !== null && minutesLeft < 30 ? 'text-amber-600 dark:text-amber-400' : 'text-surface-700 dark:text-slate-200'}`}>
                {minutesLeft !== null ? `${minutesLeft} min` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="card dark:bg-[#1e293b] dark:border-[#334155] p-5 col-span-1">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-[#334155] flex items-center justify-center">
              <Monitor size={15} className="text-surface-500 dark:text-slate-400" />
            </div>
            <h2 className="text-sm font-semibold text-surface-900 dark:text-white">Appearance</h2>
          </div>

          <div className="border-t border-surface-100 dark:border-[#334155] pt-4">
            <p className="text-xs text-surface-400 dark:text-slate-400 mb-3">Theme</p>
            <div className="flex gap-2">
              <button
                onClick={() => { if (darkMode) toggleDarkMode(); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold ${!darkMode ? 'bg-brand-600 border-brand-600 text-white' : 'bg-transparent border-[#334155] text-slate-300 hover:border-slate-500'}`}
              >
                <Sun size={13} />
                Light
              </button>
              <button
                onClick={() => { if (!darkMode) toggleDarkMode(); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold ${darkMode ? 'bg-brand-600 border-brand-600 text-white' : 'bg-transparent border-surface-200 text-surface-600 hover:border-surface-300'}`}
              >
                <Moon size={13} />
                Dark
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
