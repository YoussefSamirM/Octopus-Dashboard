import React from 'react';
import { FileSpreadsheet, Activity } from 'lucide-react';

export default function Reports() {
  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      <div className="page-header mb-5">
        <h1 className="page-title text-2xl font-semibold text-surface-900">
          Reports
        </h1>
        <p className="page-description text-surface-500 text-xs sm:text-sm mt-0.5">
          Download operational reports, invoicing files, and performance summaries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Card 1: Talabat Invoice */}
        <div className="card p-5 flex flex-col justify-between h-48 shadow-xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 flex items-center justify-center mb-3">
              <FileSpreadsheet size={20} />
            </div>
            <h3 className="text-base font-semibold text-surface-900">
              Talabat Invoice
            </h3>
            <p className="text-xs text-surface-500 mt-1">
              Multi-tab Excel export of daily metrics and interval compliance per LOB.
            </p>
          </div>
          <div className="pt-3 border-t border-surface-100 flex items-center justify-between">
            <span className="text-2xs font-semibold text-surface-400">Status</span>
            <span className="px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-surface-100 text-surface-500">
              Coming Soon...
            </span>
          </div>
        </div>

        {/* Card 2: Operational Metrics */}
        <div className="card p-5 flex flex-col justify-between h-48 shadow-xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-surface-100 text-surface-600 dark:text-surface-300 flex items-center justify-center mb-3">
              <Activity size={20} />
            </div>
            <h3 className="text-base font-semibold text-surface-900">
              Operational Metrics
            </h3>
            <p className="text-xs text-surface-500 mt-1">
              SLA, Occupancy, Utilization, AHT, and CPH operational performance reports.
            </p>
          </div>
          <div className="pt-3 border-t border-surface-100 flex items-center justify-between">
            <span className="text-2xs font-semibold text-surface-400">Status</span>
            <span className="px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-surface-100 text-surface-500">
              Coming Soon...
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
