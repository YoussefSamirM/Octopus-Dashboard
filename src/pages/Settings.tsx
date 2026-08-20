import { LogOut } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export default function Settings() {
  const logoutApp = useAppStore((s) => s.logoutApp);

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage application settings and configurations.</p>
      </div>
      
      <div className="card p-5 space-y-6">

        {/* App Logout */}
        <div>
          <h2 className="text-sm font-medium text-surface-800 mb-2 flex items-center gap-2">
            <LogOut size={16} /> Account
          </h2>
          <button 
            onClick={logoutApp}
            className="btn-danger"
          >
            Log Out of Octopus Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}
