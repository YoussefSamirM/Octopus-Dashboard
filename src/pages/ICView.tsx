import { useEffect, useState } from "react";
import { useInvoiceStore } from "../stores/invoiceStore";
import ICMultiDayView from "../components/invoice/ICMultiDayView";
import ICLobDaysView from "../components/invoice/ICLobDaysView";
import ICDayDashboard from "../components/invoice/ICDayDashboard";
import ICAgentDetailsView from "../components/invoice/ICAgentDetailsView";
import ICAnalysisView from "../components/invoice/ICAnalysisView";
import ViewSwitcher from "../components/common/ViewSwitcher";
import { Receipt, Home, ChevronRight, CheckCircle2, ToggleLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import { parseReferenceExcel } from "../utils/referenceParser";

interface NavState {
  view: "home" | "lob" | "interval" | "agents" | "analysis";
  lobId: string | null;
  date: string | null;
  sk: number | null;
}

const LOBs = [
  { id: "Combined", title: "Combined" },
  { id: "TPro", title: "T-Pro" },
  { id: "GHC", title: "GHC" },
  { id: "TMart-FU", title: "T-Mart Follow Up" },
];

export default function ICView() {
  const { globalProcessedData, loadFromServer, isLoading, navState, setNavState, referenceData, isLocalTestMode, setLocalTestMode } = useInvoiceStore();
  const [viewMode, setViewMode] = useState<'overview' | 'details'>('details');

  useEffect(() => {
    if (!isLocalTestMode) {
      loadFromServer();
    }

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'files' },
        (payload) => {
          console.log('Real-time data update received via Supabase:', payload);
          if (!useInvoiceStore.getState().isLocalTestMode) {
            loadFromServer();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const hasData = Object.keys(globalProcessedData).length > 0;

  const navigateTo = (
    view: NavState["view"],
    lobId: string | null = null,
    date: string | null = null,
    sk: number | null = null,
  ) => {
    setNavState({ view, lobId, date, sk });
  };

  const getLobTitle = (id: string | null) =>
    LOBs.find((l) => l.id === id)?.title || id;

  const renderBreadcrumbs = () => {
    if (navState.view === "home") return null;
    return (
      <div className="card px-4 py-3 mb-5 flex flex-wrap items-center gap-2.5 text-sm font-medium text-surface-500 w-full shadow-xs">
        <div
          onClick={() => navigateTo("home")}
          className="flex items-center gap-2 cursor-pointer hover:text-brand-600 transition-colors"
        >
          <Home size={15} /> Overview
        </div>

        {navState.lobId &&
          (navState.view === "lob" ||
            navState.view === "interval" ||
            navState.view === "agents" ||
            navState.view === "analysis") && (
            <>
              <div className="text-surface-300 dark:text-surface-600">
                <ChevronRight size={14} />
              </div>
              <div
                onClick={() =>
                  navState.view !== "lob"
                    ? navigateTo("lob", navState.lobId)
                    : undefined
                }
                className={`flex items-center gap-2 transition-colors ${navState.view === "lob" ? "text-surface-900 dark:text-white font-semibold cursor-default" : "cursor-pointer hover:text-brand-600"}`}
              >
                {getLobTitle(navState.lobId)}{" "}
                {navState.view === "lob" ? "Days" : ""}
              </div>
            </>
          )}

        {navState.date &&
          (navState.view === "interval" || navState.view === "agents" || navState.view === "analysis") && (
            <>
              <div className="text-surface-300 dark:text-surface-600">
                <ChevronRight size={14} />
              </div>
              <div
                onClick={() =>
                  navState.view !== "interval"
                    ? navigateTo("interval", navState.lobId, navState.date)
                    : undefined
                }
                className={`flex items-center gap-2 transition-colors ${navState.view === "interval" ? "text-surface-900 dark:text-white font-semibold cursor-default" : "cursor-pointer hover:text-brand-600"}`}
              >
                {navState.date}
              </div>
            </>
          )}

        {navState.sk !== null && navState.view === "agents" && (
          <>
            <div className="text-surface-300 dark:text-surface-600">
              <ChevronRight size={14} />
            </div>
            <div className="flex items-center gap-2 text-surface-900 dark:text-white font-semibold cursor-default transition-colors font-mono">
              {Math.floor(navState.sk / 60)}:
              {navState.sk % 60 === 0 ? "00" : "30"} Details
            </div>
          </>
        )}

        {navState.sk !== null && navState.view === "analysis" && (
          <>
            <div className="text-surface-300 dark:text-surface-600">
              <ChevronRight size={14} />
            </div>
            <div className="flex items-center gap-2 text-surface-900 dark:text-white font-semibold cursor-default transition-colors font-mono">
              {Math.floor(navState.sk / 60)}:
              {navState.sk % 60 === 0 ? "00" : "30"} IC Failure
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">

      <div className="page-header mb-5 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h1 className="page-title text-2xl font-semibold text-surface-900 flex items-center gap-3">
            Talabat Invoice
          </h1>
          <p className="page-description text-surface-500 text-xs sm:text-sm mt-0.5">
            Tracking billable hours, overage, and headcount & ABS
          </p>
        </div>
        
        <div className="flex items-center gap-3 pb-2">
          {hasData && navState.view === "interval" && (
            <ViewSwitcher activeView={viewMode} onViewChange={setViewMode} />
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative w-full items-center justify-center">
        {!hasData ? (
          isLoading ? (
            <div className="w-full">
              <div className="h-10 w-48 bg-surface-200 rounded-md animate-pulse mb-8" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="card p-6 h-[200px] flex flex-col justify-between">
                    <div className="h-6 w-32 bg-surface-200 rounded-md animate-pulse" />
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <div className="h-4 w-12 bg-surface-100 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-surface-200 rounded animate-pulse" />
                      </div>
                      <div className="flex justify-between">
                        <div className="h-4 w-16 bg-surface-100 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-surface-200 rounded animate-pulse" />
                      </div>
                      <div className="flex justify-between pt-3 border-t border-surface-100">
                        <div className="h-4 w-12 bg-surface-100 rounded animate-pulse" />
                        <div className="h-4 w-16 bg-surface-200 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center mt-20">
              <Receipt className="text-surface-300 w-16 h-16 mb-4" />
              <h3 className="text-[20px] font-semibold text-surface-900 mb-2">No Data Available</h3>
              <p className="text-[15px] text-surface-500 max-w-md">
                The Talabat Invoice dashboard is empty. Please wait for an Admin to upload and sync the required data from the <strong>Data Admin</strong> page.
              </p>
            </div>
          )
        ) : (
          <div className="w-full">
            {renderBreadcrumbs()}
            
            {navState.view === "home" && (
              <ICMultiDayView onSelectLob={(lob) => navigateTo("lob", lob)} />
            )}

            {navState.view === "lob" && navState.lobId && (
              <ICLobDaysView
                lobId={navState.lobId}
                onSelectDate={(date) =>
                  navigateTo("interval", navState.lobId, date)
                }
              />
            )}

            {navState.view === "interval" &&
              navState.lobId &&
              navState.date && (
                <ICDayDashboard
                  iso={navState.date}
                  lobId={navState.lobId}
                  viewMode={viewMode}
                  onViewAgentDetails={(sk) =>
                    navigateTo("agents", navState.lobId, navState.date, sk)
                  }
                  onViewAnalysis={(sk) =>
                    navigateTo("analysis", navState.lobId, navState.date, sk)
                  }
                />
              )}

            {navState.view === "agents" &&
              navState.lobId &&
              navState.date &&
              navState.sk !== null && (
                <ICAgentDetailsView
                  iso={navState.date}
                  lobId={navState.lobId}
                  sk={navState.sk}
                />
              )}

            {navState.view === "analysis" &&
              navState.lobId &&
              navState.date &&
              navState.sk !== null && (
                <ICAnalysisView
                  iso={navState.date}
                  lobId={navState.lobId}
                  sk={navState.sk}
                />
              )}
          </div>
        )}
      </div>
    </div>
  );
}
