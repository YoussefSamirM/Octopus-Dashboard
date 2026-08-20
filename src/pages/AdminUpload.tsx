import { useState, useRef } from "react";
import { motion } from 'framer-motion';
import {
  Bolt,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Calendar,
  UploadCloud,
  Lock
} from "lucide-react";
import { useInvoiceStore } from "../stores/invoiceStore";
import { useAppStore } from "../stores/appStore";
import { supabase } from "../lib/supabase";

export default function AdminUpload() {
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState("");
  const [statusFile, setStatusFile] = useState<File | null>(null);
  const [reqFile, setReqFile] = useState<File | null>(null);
  const [skillsFile, setSkillsFile] = useState<File | null>(null);
  const [absFile, setAbsFile] = useState<File | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  const statusRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef<HTMLInputElement>(null);
  const skillsRef = useRef<HTMLInputElement>(null);
  const absRef = useRef<HTMLInputElement>(null);

  const { parseStatusCSV, processOfflineFiles, isLoading, error } = useInvoiceStore();
  const token = useAppStore(s => s.token);
  const addToast = useAppStore(s => s.addToast);

  const handleStatusUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setStatusFile(file);
      try {
        await parseStatusCSV(file);
      } catch (err: any) {
        addToast({ message: "Error parsing CSV: " + err, type: 'error' });
        setStatusFile(null);
      }
    }
  };

  const handleProcessAndSync = async () => {
    if (!statusFile) return addToast({ message: "Please upload the Agent Status Log (CSV) first.", type: 'warning' });
    if (!reqFile) return addToast({ message: "Please upload the Master Sheet (REQ Excel).", type: 'warning' });
    if (!skillsFile) return addToast({ message: "Please upload the Skills Matrix (Excel).", type: 'warning' });
    if (!absFile) return addToast({ message: "Please upload the ABS Data (Excel).", type: 'warning' });
    if (!startDate) return addToast({ message: "Please select a Start Date.", type: 'warning' });

    try {
      // 1. Process files locally
      await processOfflineFiles(startDate, endDate, reqFile, skillsFile, absFile);
      
      // 2. Get the processed data from store
      const storeState = useInvoiceStore.getState();
      if (!storeState.globalProcessedData || Object.keys(storeState.globalProcessedData).length === 0) {
         throw new Error("Processing failed, no data generated.");
      }

      // 3. Push to Supabase Storage
      setIsPushing(true);
      const jsonPayload = JSON.stringify({
           globalProcessedData: storeState.globalProcessedData,
           sortedDates: storeState.sortedDates,
           agentInfo: storeState.agentInfo,
           rawStatusParsed: storeState.rawStatusParsed
      });

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload('invoice_data.json', jsonPayload, { upsert: true, contentType: 'application/json' });

      if (uploadError) throw new Error("Failed to upload data to Supabase Storage: " + uploadError.message);

      // 4. Update the 'files' table to trigger real-time subscriptions for all connected clients
      const { error: dbError } = await supabase
        .from('files')
        .upsert({ id: 'latest_upload', updated_at: new Date().toISOString() });

      if (dbError) console.error("Warning: Could not trigger real-time update in files table.", dbError);

      addToast({ message: "Invoice data successfully processed and synced to Supabase!", type: 'success' });
    } catch (err: any) {
      addToast({ message: err.message, type: 'error' });
    } finally {
      setIsPushing(false);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center text-surface-400 mb-2">
           <Lock size={32} />
        </div>
        <h2 className="text-[24px] font-[800] text-surface-900">Admin Authentication</h2>
        <p className="text-surface-500 text-[14px]">Please enter the admin password to access the upload portal.</p>
        
        <div className="flex items-center gap-3 w-full max-w-sm mt-4">
          <input 
            type="password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password..."
            className="flex-1 px-4 py-3 border border-surface-200 rounded-[8px] bg-surface-50 outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/10 transition-all font-medium"
            onKeyDown={e => {
               if (e.key === 'Enter') {
                  if (password === '106528Oct@WFM') setIsUnlocked(true);
                  else addToast({ message: "Incorrect password", type: "error" });
               }
            }}
          />
          <button 
             onClick={() => { 
                if (password === '106528Oct@WFM') setIsUnlocked(true); 
                else addToast({ message: "Incorrect password", type: "error" });
             }}
             className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-[8px] font-[700] text-[14px] transition-all"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto pb-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="page-header mb-6"
      >
        <h1 className="page-title">Talabat Invoice Admin</h1>
        <p className="page-description">Process Excel files and sync the computed data to the server.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-surface-0 border border-surface-200 rounded-[12px] p-6 mb-6 shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
      >
        {error && (
          <div className="bg-danger-50 text-danger-600 p-4 rounded-lg flex items-center gap-3 border border-danger-200 mb-6 font-[700] text-[14px]">
            <Bolt className="h-5 w-5" /> <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* Status CSV */}
          <div className="flex flex-col gap-[10px]">
            <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
              1. Agent Status (CSV)
            </label>
            <button
              onClick={() => statusRef.current?.click()}
              className={`flex items-center justify-center gap-[10px] h-[44px] px-5 border ${statusFile ? "border-solid border-success-600 bg-success-50 text-success-600" : "border-dashed border-surface-200 bg-surface-0 text-surface-900 hover:border-brand-600 hover:text-brand-600 hover:bg-brand-50"} rounded-[8px] font-[700] text-[12px] transition-all truncate`}
            >
              {statusFile ? <CheckCircle2 size={16} /> : <FileText size={16} />}
              <span className="truncate">{statusFile ? statusFile.name : "Upload Status Log"}</span>
            </button>
            <input type="file" accept=".csv" className="hidden" ref={statusRef} onChange={handleStatusUpload} />
          </div>

          {/* Master Excel */}
          <div className="flex flex-col gap-[10px]">
            <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
              2. Master Data (Excel)
            </label>
            <button
              onClick={() => reqRef.current?.click()}
              className={`flex items-center justify-center gap-[10px] h-[44px] px-5 border ${reqFile ? "border-solid border-success-600 bg-success-50 text-success-600" : "border-dashed border-surface-200 bg-surface-0 text-surface-900 hover:border-brand-600 hover:text-brand-600 hover:bg-brand-50"} rounded-[8px] font-[700] text-[12px] transition-all truncate`}
            >
              {reqFile ? <CheckCircle2 size={16} /> : <FileSpreadsheet size={16} />}
              <span className="truncate">{reqFile ? reqFile.name : "Upload Master Sheet"}</span>
            </button>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={reqRef} onChange={(e) => e.target.files && setReqFile(e.target.files[0])} />
          </div>

          {/* Skills Matrix Excel */}
          <div className="flex flex-col gap-[10px]">
            <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
              3. Skills Matrix (Excel)
            </label>
            <button
              onClick={() => skillsRef.current?.click()}
              className={`flex items-center justify-center gap-[10px] h-[44px] px-5 border ${skillsFile ? "border-solid border-success-600 bg-success-50 text-success-600" : "border-dashed border-surface-200 bg-surface-0 text-surface-900 hover:border-brand-600 hover:text-brand-600 hover:bg-brand-50"} rounded-[8px] font-[700] text-[12px] transition-all truncate`}
            >
              {skillsFile ? <CheckCircle2 size={16} /> : <FileSpreadsheet size={16} />}
              <span className="truncate">{skillsFile ? skillsFile.name : "Upload Skills"}</span>
            </button>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={skillsRef} onChange={(e) => e.target.files && setSkillsFile(e.target.files[0])} />
          </div>

          {/* ABS Data Excel */}
          <div className="flex flex-col gap-[10px]">
            <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
              4. ABS Data (Excel)
            </label>
            <button
              onClick={() => absRef.current?.click()}
              className={`flex items-center justify-center gap-[10px] h-[44px] px-5 border ${absFile ? "border-solid border-success-600 bg-success-50 text-success-600" : "border-dashed border-surface-200 bg-surface-0 text-surface-900 hover:border-brand-600 hover:text-brand-600 hover:bg-brand-50"} rounded-[8px] font-[700] text-[12px] transition-all truncate`}
            >
              {absFile ? <CheckCircle2 size={16} /> : <FileSpreadsheet size={16} />}
              <span className="truncate">{absFile ? absFile.name : "Upload ABS Sheet"}</span>
            </button>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={absRef} onChange={(e) => e.target.files && setAbsFile(e.target.files[0])} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-end justify-between pt-6 border-t border-surface-200 mt-6 gap-4">
          <div className="flex flex-wrap gap-[20px]">
            <div className="flex flex-col gap-[10px]">
              <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
                Start Date
              </label>
              <div className="flex items-center border border-surface-200 rounded-[8px] bg-surface-50 h-[44px] px-4 gap-[12px] focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-600/10 transition-all w-[170px]">
                <Calendar size={16} className="text-surface-900" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-[14px] font-[700] text-surface-900 outline-none w-full cursor-pointer"
                />
              </div>
            </div>
            <div className="flex flex-col gap-[10px]">
              <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
                End Date (Optional)
              </label>
              <div className="flex items-center border border-surface-200 rounded-[8px] bg-surface-50 h-[44px] px-4 gap-[12px] focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-600/10 transition-all w-[170px]">
                <Calendar size={16} className="text-surface-900" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-[14px] font-[700] text-surface-900 outline-none w-full cursor-pointer"
                />
              </div>
            </div>
          </div>
          
          <button
            onClick={handleProcessAndSync}
            disabled={isLoading || isPushing}
            className="h-[44px] px-[32px] bg-brand-600 hover:bg-brand-700 text-white rounded-[8px] font-[700] text-[14px] flex items-center gap-[10px] shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:-translate-y-[2px] transition-all disabled:opacity-50"
          >
            {(isLoading || isPushing) ? (
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <UploadCloud size={16} />
            )}
            Process & Sync to Server
          </button>
        </div>
      </motion.div>
    </div>
  );
}
