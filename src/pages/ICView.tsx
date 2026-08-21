import { useEffect, useState } from "react";
import { useInvoiceStore } from "../stores/invoiceStore";
import ICMultiDayView from "../components/invoice/ICMultiDayView";
import ICLobDaysView from "../components/invoice/ICLobDaysView";
import ICDayDashboard from "../components/invoice/ICDayDashboard";
import ICAgentDetailsView from "../components/invoice/ICAgentDetailsView";
import ViewSwitcher from "../components/common/ViewSwitcher";
import { Receipt, Home, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase";
interface NavState {
  view: "home" | "lob" | "interval" | "agents";
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
  const { globalProcessedData, loadFromServer, isLoading, navState, setNavState } = useInvoiceStore();
  const [viewMode, setViewMode] = useState<'overview' | 'details'>('details');

  useEffect(() => {
    loadFromServer();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'files' },
        (payload) => {
          console.log('Real-time data update received via Supabase:', payload);
          loadFromServer();
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
      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-surface-500 mb-6 px-4 py-3 sm:px-6 sm:py-4 bg-surface-0 rounded-md border border-surface-200 w-full max-w-[1550px] mx-auto shadow-sm">
        {" "}
        <div
          onClick={() => navigateTo("home")}
          className="flex items-center gap-2 cursor-pointer hover:text-brand-600 transition-colors"
        >
          {" "}
          <Home size={16} /> Overview{" "}
        </div>{" "}
        {navState.lobId &&
          (navState.view === "lob" ||
            navState.view === "interval" ||
            navState.view === "agents") && (
            <>
              {" "}
              <div className="text-surface-300">
                <ChevronRight size={14} />
              </div>{" "}
              <div
                onClick={() =>
                  navState.view !== "lob"
                    ? navigateTo("lob", navState.lobId)
                    : undefined
                }
                className={`flex items-center gap-2 transition-colors ${navState.view === "lob" ? "text-surface-900 cursor-default" : "cursor-pointer hover:text-brand-600"}`}
              >
                {" "}
                {getLobTitle(navState.lobId)}{" "}
                {navState.view === "lob" ? "Days" : ""}{" "}
              </div>{" "}
            </>
          )}{" "}
        {navState.date &&
          (navState.view === "interval" || navState.view === "agents") && (
            <>
              {" "}
              <div className="text-surface-300">
                <ChevronRight size={14} />
              </div>{" "}
              <div
                onClick={() =>
                  navState.view !== "interval"
                    ? navigateTo("interval", navState.lobId, navState.date)
                    : undefined
                }
                className={`flex items-center gap-2 transition-colors ${navState.view === "interval" ? "text-surface-900 cursor-default" : "cursor-pointer hover:text-brand-600"}`}
              >
                {" "}
                {navState.date}{" "}
              </div>{" "}
            </>
          )}{" "}
        {navState.sk !== null && navState.view === "agents" && (
          <>
            {" "}
            <div className="text-surface-300">
              <ChevronRight size={14} />
            </div>{" "}
            <div className="flex items-center gap-2 text-surface-900 cursor-default transition-colors">
              {" "}
              {Math.floor(navState.sk / 60)}:
              {navState.sk % 60 === 0 ? "00" : "30"} Details{" "}
            </div>{" "}
          </>
        )}{" "}
      </div>
    );
  };
  return (
    <div className="max-w-[1600px] mx-auto pb-20 px-3 sm:px-6 h-full flex flex-col">
      {" "}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            Talabat Invoice
          </h1>
          <p className="text-surface-500 text-sm mt-1">
            Tracking billable hours, overage, and headcount & ABS
          </p>
        </div>
        {hasData && navState.view === "interval" && (
          <div className="pb-2">
            <ViewSwitcher activeView={viewMode} onViewChange={setViewMode} />
          </div>
        )}
      </div>{" "}
      <div className="flex-1 flex flex-col relative w-full items-center justify-center">
        {!hasData ? (
          isLoading ? (
             <div className="flex flex-col items-center justify-center gap-4 text-surface-400 mt-20">
               <span className="h-8 w-8 border-4 border-surface-200 border-t-brand-500 rounded-full animate-spin" />
               <p className="font-medium text-[15px]">Loading central data...</p>
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
            {" "}
            {renderBreadcrumbs()}{" "}
            {navState.view === "home" && (
              <ICMultiDayView onSelectLob={(lob) => navigateTo("lob", lob)} />
            )}{" "}
            {navState.view === "lob" && navState.lobId && (
              <ICLobDaysView
                lobId={navState.lobId}
                onSelectDate={(date) =>
                  navigateTo("interval", navState.lobId, date)
                }
              />
            )}{" "}
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
                />
              )}{" "}
            {navState.view === "agents" &&
              navState.lobId &&
              navState.date &&
              navState.sk !== null && (
                <ICAgentDetailsView
                  iso={navState.date}
                  lobId={navState.lobId}
                  sk={navState.sk}
                />
              )}{" "}
          </div>
        )}{" "}
      </div>{" "}
    </div>
  );
}
