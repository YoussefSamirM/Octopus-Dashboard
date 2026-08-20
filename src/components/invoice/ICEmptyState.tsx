import { useState, useRef } from "react";
import {
  Bolt,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Calendar,
  PieChart as PieChartIcon,
} from "lucide-react";
import { useInvoiceStore } from "../../stores/invoiceStore";
export default function ICEmptyState() {
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState("");
  const [statusFile, setStatusFile] = useState<File | null>(null);
  const [reqFile, setReqFile] = useState<File | null>(null);
  const [skillsFile, setSkillsFile] = useState<File | null>(null);
  const [absFile, setAbsFile] = useState<File | null>(null);
  const statusRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef<HTMLInputElement>(null);
  const skillsRef = useRef<HTMLInputElement>(null);
  const absRef = useRef<HTMLInputElement>(null);
  const { parseStatusCSV, processOfflineFiles, isLoading, error } =
    useInvoiceStore();
  const handleStatusUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setStatusFile(file);
      try {
        await parseStatusCSV(file);
      } catch (err: any) {
        alert("Error parsing CSV: " + err);
        setStatusFile(null);
      }
    }
  };
  const handleProcess = async () => {
    if (!statusFile)
      return alert("Please upload the Agent Status Log (CSV) first.");
    if (!reqFile) return alert("Please upload the Master Sheet (REQ Excel).");
    if (!skillsFile) return alert("Please upload the Skills Matrix (Excel).");
    if (!absFile) return alert("Please upload the ABS Data (Excel).");
    if (!startDate) return alert("Please select a Start Date.");
    await processOfflineFiles(startDate, endDate, reqFile, skillsFile, absFile);
  };
  return (
    <div className="max-w-[1550px] mx-auto w-full animate-in fade-in duration-300">
      {" "}
      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 p-4 rounded-lg flex items-center gap-3 border border-danger-200 dark:border-danger-800/30 mb-6 font-[700] text-[14px]">
          {" "}
          <Bolt className="h-5 w-5" /> <span>{error}</span>{" "}
        </div>
      )}{" "}
      {/* Toolbar */}{" "}
      <div className="bg-surface-0 border border-surface-200 rounded-[12px] p-6 mb-6 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
        {" "}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {" "}
          {/* Status CSV */}{" "}
          <div className="flex flex-col gap-[10px]">
            {" "}
            <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
              1. Agent Status (CSV)
            </label>{" "}
            <button
              onClick={() => statusRef.current?.click()}
              className={`flex items-center justify-center gap-[10px] h-[44px] px-5 border ${statusFile ? "border-solid border-success-600 dark:border-success-500 bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400" : "border-dashed border-surface-200 bg-surface-0 text-surface-900 hover:border-brand-600 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"} rounded-[8px] font-[700] text-[12px] transition-all truncate`}
            >
              {" "}
              {statusFile ? (
                <CheckCircle2 size={16} />
              ) : (
                <FileText size={16} />
              )}{" "}
              <span className="truncate">
                {statusFile ? statusFile.name : "Upload Status Log"}
              </span>{" "}
            </button>{" "}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={statusRef}
              onChange={handleStatusUpload}
            />{" "}
          </div>{" "}
          {/* Master Excel */}{" "}
          <div className="flex flex-col gap-[10px]">
            {" "}
            <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
              2. Master Data (Excel)
            </label>{" "}
            <button
              onClick={() => reqRef.current?.click()}
              className={`flex items-center justify-center gap-[10px] h-[44px] px-5 border ${reqFile ? "border-solid border-success-600 dark:border-success-500 bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400" : "border-dashed border-surface-200 bg-surface-0 text-surface-900 hover:border-brand-600 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"} rounded-[8px] font-[700] text-[12px] transition-all truncate`}
            >
              {" "}
              {reqFile ? (
                <CheckCircle2 size={16} />
              ) : (
                <FileSpreadsheet size={16} />
              )}{" "}
              <span className="truncate">
                {reqFile ? reqFile.name : "Upload Master Sheet"}
              </span>{" "}
            </button>{" "}
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              ref={reqRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0)
                  setReqFile(e.target.files[0]);
              }}
            />{" "}
          </div>{" "}
          {/* Skills Matrix Excel */}{" "}
          <div className="flex flex-col gap-[10px]">
            {" "}
            <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
              3. Skills Matrix (Excel)
            </label>{" "}
            <button
              onClick={() => skillsRef.current?.click()}
              className={`flex items-center justify-center gap-[10px] h-[44px] px-5 border ${skillsFile ? "border-solid border-success-600 dark:border-success-500 bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400" : "border-dashed border-surface-200 bg-surface-0 text-surface-900 hover:border-brand-600 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"} rounded-[8px] font-[700] text-[12px] transition-all truncate`}
            >
              {" "}
              {skillsFile ? (
                <CheckCircle2 size={16} />
              ) : (
                <FileSpreadsheet size={16} />
              )}{" "}
              <span className="truncate">
                {skillsFile ? skillsFile.name : "Upload Skills"}
              </span>{" "}
            </button>{" "}
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              ref={skillsRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0)
                  setSkillsFile(e.target.files[0]);
              }}
            />{" "}
          </div>{" "}
          {/* ABS Data Excel */}{" "}
          <div className="flex flex-col gap-[10px]">
            {" "}
            <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
              4. ABS Data (Excel)
            </label>{" "}
            <button
              onClick={() => absRef.current?.click()}
              className={`flex items-center justify-center gap-[10px] h-[44px] px-5 border ${absFile ? "border-solid border-success-600 dark:border-success-500 bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400" : "border-dashed border-surface-200 bg-surface-0 text-surface-900 hover:border-brand-600 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"} rounded-[8px] font-[700] text-[12px] transition-all truncate`}
            >
              {" "}
              {absFile ? (
                <CheckCircle2 size={16} />
              ) : (
                <FileSpreadsheet size={16} />
              )}{" "}
              <span className="truncate">
                {absFile ? absFile.name : "Upload ABS Sheet"}
              </span>{" "}
            </button>{" "}
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              ref={absRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0)
                  setAbsFile(e.target.files[0]);
              }}
            />{" "}
          </div>{" "}
        </div>{" "}
        {/* Footer */}{" "}
        <div className="flex flex-wrap items-end justify-between pt-4 border-t border-surface-200 mt-2">
          {" "}
          <div className="flex gap-[20px]">
            {" "}
            <div className="flex flex-col gap-[10px]">
              {" "}
              <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
                Start Date
              </label>{" "}
              <div className="flex items-center border border-surface-200 rounded-[8px] bg-surface-50 h-[44px] px-4 gap-[12px] focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-600/10 transition-all w-[170px]">
                {" "}
                <Calendar size={16} className="text-surface-900 " />{" "}
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-[14px] font-[700] text-surface-900 outline-none w-full cursor-pointer"
                />{" "}
              </div>{" "}
            </div>{" "}
            <div className="flex flex-col gap-[10px]">
              {" "}
              <label className="text-[11px] font-[800] text-surface-500 uppercase tracking-[0.5px]">
                End Date (Optional)
              </label>{" "}
              <div className="flex items-center border border-surface-200 rounded-[8px] bg-surface-50 h-[44px] px-4 gap-[12px] focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-600/10 transition-all w-[170px]">
                {" "}
                <Calendar size={16} className="text-surface-900 " />{" "}
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-[14px] font-[700] text-surface-900 outline-none w-full cursor-pointer"
                />{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
          <button
            onClick={handleProcess}
            disabled={isLoading}
            className="h-[44px] px-[32px] bg-brand-600 hover:bg-brand-700 dark:hover:bg-brand-500 text-white rounded-[8px] font-[700] text-[14px] flex items-center gap-[10px] shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:-translate-y-[2px] hover:shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-all disabled:opacity-50 mt-4 md:mt-0"
          >
            {" "}
            {isLoading ? (
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Bolt size={16} />
            )}{" "}
            Generate Dashboard{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
      <div className="text-center py-[60px] px-[20px]">
        {" "}
        <PieChartIcon className="w-[64px] h-[64px] text-surface-200 mx-auto mb-[24px]" />{" "}
        <h3 className="text-[24px] font-[900] text-surface-900 mb-[12px]">
          Data Center Ready
        </h3>{" "}
        <p className="text-[15px] text-surface-500 max-w-[600px] mx-auto leading-[1.6]">
          {" "}
          Upload the required files locally. The engine validates dropped
          intervals strictly and calculates metrics precisely.{" "}
        </p>{" "}
      </div>{" "}
    </div>
  );
}
