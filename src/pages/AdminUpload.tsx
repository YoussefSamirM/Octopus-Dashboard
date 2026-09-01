import { useState, useRef } from "react";
import { motion } from 'framer-motion';
import {
  Bolt,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Calendar,
  UploadCloud,
  Lock,
  Loader2
} from "lucide-react";
import { useInvoiceStore } from "../stores/invoiceStore";
import { useAppStore } from "../stores/appStore";
import { useDataStore } from "../stores/dataStore";
import { supabase } from "../lib/supabase";
import { parseChats, parseStatus } from "../services/calcLogic";

export default function AdminUpload() {
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState("");
  const [statusFile, setStatusFile] = useState<File | null>(null);
  const [reqFile, setReqFile] = useState<File | null>(null);
  const [skillsFile, setSkillsFile] = useState<File | null>(null);
  const [absFile, setAbsFile] = useState<File | null>(null);
  const [breaksFile, setBreaksFile] = useState<File | null>(null);
  const [grantedFile, setGrantedFile] = useState<File | null>(null);
  const [chatsFile, setChatsFile] = useState<File | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  const statusRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef<HTMLInputElement>(null);
  const skillsRef = useRef<HTMLInputElement>(null);
  const absRef = useRef<HTMLInputElement>(null);
  const breaksRef = useRef<HTMLInputElement>(null);
  const grantedRef = useRef<HTMLInputElement>(null);
  const chatsRef = useRef<HTMLInputElement>(null);

  const { parseStatusCSV, processOfflineFiles, isLoading, error } = useInvoiceStore();
  const token = useAppStore(s => s.token);
  const addToast = useAppStore(s => s.addToast);

  const setRawChats = useDataStore(s => s.setRawChats);
  const setRawStatus = useDataStore(s => s.setRawStatus);

  const handleStatusUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setStatusFile(file);
      try {
        await parseStatusCSV(file);
        
        // Also parse it for the AHT/CPH Data tab
        const text = await file.text();
        const parsedStatusData = parseStatus(text);
        setRawStatus(parsedStatusData);
      } catch (err: any) {
        addToast({ message: "Error parsing CSV: " + err, type: 'error' });
        setStatusFile(null);
      }
    }
  };

  const handleChatsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setChatsFile(file);
      try {
        const text = await file.text();
        // Passing empty object for dirMap since it was removed
        const parsedChatsData = parseChats(text, {});
        setRawChats(parsedChatsData);
        addToast({ message: "Chats Log processed successfully", type: 'success' });
      } catch (err: any) {
        addToast({ message: "Error parsing Chats CSV: " + err, type: 'error' });
        setChatsFile(null);
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
      await processOfflineFiles(startDate, endDate, reqFile, skillsFile, absFile, breaksFile, grantedFile);
      
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
        <h2 className="text-2xl font-semibold text-surface-900">Admin Authentication</h2>
        <p className="text-surface-500 text-sm">Please enter the admin password to access the upload portal.</p>
        
        <div className="flex items-center gap-3 w-full max-w-sm mt-4">
          <input 
            type="password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password..."
            className="input flex-1 h-11 px-4 py-2 border border-surface-200 rounded-md bg-surface-50 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600 transition-all font-medium"
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
             className="btn-primary h-11 px-6"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="page-header mb-5"
      >
        <h1 className="page-title text-2xl font-semibold text-surface-900">
          Data Admin
        </h1>
        <p className="page-description text-surface-500 text-xs sm:text-sm mt-0.5">
          Process Excel files and sync the computed data to the server.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="card p-5 mb-5 shadow-xs"
      >
        {error && (
          <div className="bg-danger-50 text-danger-600 p-4 rounded-md flex items-center gap-3 border border-danger-200 mb-6 font-semibold text-sm">
            <Bolt className="h-5 w-5" /> <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
          {/* Status CSV */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-surface-500">
              1. Agent Status (CSV)
            </label>
            <button
              onClick={() => statusRef.current?.click()}
              className={`flex items-center justify-center gap-2 h-10 px-4 border ${statusFile ? "border-solid border-success-600 bg-success-50 text-success-600" : "border-solid border-surface-200 bg-surface-50 text-surface-700 hover:border-brand-600 hover:text-brand-600"} rounded-md font-medium text-sm transition-colors truncate`}
            >
              {statusFile ? <CheckCircle2 size={16} /> : <FileText size={16} />}
              <span className="truncate">{statusFile ? statusFile.name : "Upload Status Log"}</span>
            </button>
            <input type="file" accept=".csv" className="hidden" ref={statusRef} onChange={handleStatusUpload} />
          </div>

          {/* Master Excel */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-surface-500">
              2. Master Data (Excel)
            </label>
            <button
              onClick={() => reqRef.current?.click()}
              className={`flex items-center justify-center gap-2 h-10 px-4 border ${reqFile ? "border-solid border-success-600 bg-success-50 text-success-600" : "border-solid border-surface-200 bg-surface-50 text-surface-700 hover:border-brand-600 hover:text-brand-600"} rounded-md font-medium text-sm transition-colors truncate`}
            >
              {reqFile ? <CheckCircle2 size={16} /> : <FileSpreadsheet size={16} />}
              <span className="truncate">{reqFile ? reqFile.name : "Upload Master Sheet"}</span>
            </button>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={reqRef} onChange={(e) => e.target.files && setReqFile(e.target.files[0])} />
          </div>

          {/* Skills Matrix Excel */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-surface-500">
              3. Skills Matrix (Excel)
            </label>
            <button
              onClick={() => skillsRef.current?.click()}
              className={`flex items-center justify-center gap-2 h-10 px-4 border ${skillsFile ? "border-solid border-success-600 bg-success-50 text-success-600" : "border-solid border-surface-200 bg-surface-50 text-surface-700 hover:border-brand-600 hover:text-brand-600"} rounded-md font-medium text-sm transition-colors truncate`}
            >
              {skillsFile ? <CheckCircle2 size={16} /> : <FileSpreadsheet size={16} />}
              <span className="truncate">{skillsFile ? skillsFile.name : "Upload Skills"}</span>
            </button>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={skillsRef} onChange={(e) => e.target.files && setSkillsFile(e.target.files[0])} />
          </div>

          {/* ABS Data Excel */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-surface-500">
              4. ABS Data (Excel)
            </label>
            <button
              onClick={() => absRef.current?.click()}
              className={`flex items-center justify-center gap-2 h-10 px-4 border ${absFile ? "border-solid border-success-600 bg-success-50 text-success-600" : "border-solid border-surface-200 bg-surface-50 text-surface-700 hover:border-brand-600 hover:text-brand-600"} rounded-md font-medium text-sm transition-colors truncate`}
            >
              {absFile ? <CheckCircle2 size={16} /> : <FileSpreadsheet size={16} />}
              <span className="truncate">{absFile ? absFile.name : "Upload ABS Sheet"}</span>
            </button>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={absRef} onChange={(e) => e.target.files && setAbsFile(e.target.files[0])} />
          </div>

          {/* Chats Log CSV */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-surface-500">
              5. Chats Log (CSV)
            </label>
            <button
              onClick={() => chatsRef.current?.click()}
              className={`flex items-center justify-center gap-2 h-10 px-4 border ${chatsFile ? "border-solid border-success-600 bg-success-50 text-success-600" : "border-solid border-surface-200 bg-surface-50 text-surface-700 hover:border-brand-600 hover:text-brand-600"} rounded-md font-medium text-sm transition-colors truncate`}
            >
              {chatsFile ? <CheckCircle2 size={16} /> : <FileText size={16} />}
              <span className="truncate">{chatsFile ? chatsFile.name : "Upload Chats Log"}</span>
            </button>
            <input type="file" accept=".csv" className="hidden" ref={chatsRef} onChange={handleChatsUpload} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-end justify-between pt-6 border-t border-surface-200 mt-6 gap-4">
          <div className="flex flex-wrap gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-surface-500">
                Start Date
              </label>
              <div className="flex items-center border border-surface-200 rounded-md bg-surface-50 h-10 px-3 gap-2 focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600 transition-all w-[160px]">
                <Calendar size={16} className="text-surface-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-surface-900 outline-none w-full cursor-pointer"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-surface-500">
                End Date (Optional)
              </label>
              <div className="flex items-center border border-surface-200 rounded-md bg-surface-50 h-10 px-3 gap-2 focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600 transition-all w-[160px]">
                <Calendar size={16} className="text-surface-500" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-surface-900 outline-none w-full cursor-pointer"
                />
              </div>
            </div>

            {/* Breaks Report Excel */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-surface-500">
                5. Breaks Report (Excel)
              </label>
              <button
                onClick={() => breaksRef.current?.click()}
                className={`flex items-center justify-center gap-2 h-10 px-4 border ${breaksFile ? "border-solid border-success-600 dark:border-success-500 bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400" : "border-solid border-surface-200 bg-surface-50 text-surface-700 hover:border-brand-600 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"} rounded-md font-medium text-sm transition-colors truncate`}
              >
                {breaksFile ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <FileSpreadsheet size={16} />
                )}
                <span className="truncate">
                  {breaksFile ? breaksFile.name : "Upload Breaks Report"}
                </span>
              </button>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                ref={breaksRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0)
                    setBreaksFile(e.target.files[0]);
                }}
              />
            </div>
            
            {/* Granted Req Excel */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-surface-500">
                6. Granted Req (Excel)
              </label>
              <button
                onClick={() => grantedRef.current?.click()}
                className={`flex items-center justify-center gap-2 h-10 px-4 border ${grantedFile ? "border-solid border-success-600 dark:border-success-500 bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400" : "border-solid border-surface-200 bg-surface-50 text-surface-700 hover:border-brand-600 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"} rounded-md font-medium text-sm transition-colors truncate`}
              >
                {grantedFile ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <Calendar size={16} />
                )}
                <span className="truncate">
                  {grantedFile ? grantedFile.name : "Upload Granted Req"}
                </span>
              </button>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                ref={grantedRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0)
                    setGrantedFile(e.target.files[0]);
                }}
              />
            </div>
          </div>
          
          <button
            onClick={handleProcessAndSync}
            disabled={isLoading || isPushing}
            className="btn-primary h-10"
          >
            {(isLoading || isPushing) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud size={16} />
            )}
            Process & Sync
          </button>
        </div>
      </motion.div>
    </div>
  );
}
