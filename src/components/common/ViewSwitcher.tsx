import React from 'react';

interface ViewSwitcherProps {
  activeView: 'overview' | 'details';
  onViewChange: (view: 'overview' | 'details') => void;
}

export default function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="inline-flex bg-surface-100 p-0.5 rounded-md border border-surface-200">
      <button
        onClick={() => onViewChange('overview')}
        className={`px-3 py-1 text-sm font-medium rounded-sm transition-all ${
          activeView === 'overview'
            ? 'bg-surface-0 text-surface-900 shadow-xs border border-surface-200'
            : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50/50 border border-transparent'
        }`}
      >
        Overview
      </button>
      <button
        onClick={() => onViewChange('details')}
        className={`px-3 py-1 text-sm font-medium rounded-sm transition-all ${
          activeView === 'details'
            ? 'bg-surface-0 text-surface-900 shadow-xs border border-surface-200'
            : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50/50 border border-transparent'
        }`}
      >
        Details
      </button>
    </div>
  );
}
