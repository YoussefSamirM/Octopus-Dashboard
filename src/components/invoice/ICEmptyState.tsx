import { useState, useRef } from "react";
import {
  Bolt,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Calendar,
  PieChart as PieChartIcon,
  Loader2
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
        <div className="bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 p-4 rounded-md flex items-center gap-3 border border-danger-200 dark:border-danger-800/30 mb-6 font-semibold text-sm">
          {" "}
          <Bolt className="h-5 w-5" /> <span>{error}</span>{" "}
        </div>
      )}{" "}
      {/* Toolbar */}{" "}
      <div className="card p-6 mb-6">
        {" "}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {" "}
          {/* Status CSV */}{" "}
          <div className="flex flex-col gap-2">
            {" "}
            <label className="text-xs font-semibold text-surface-500">
              1. Agent Status (CSV)
            </label>{" "}
            <button
              onClick={() => statusRef.current?.click()}
              className={`flex items-center justify-center gap-2 h-10 px-4 border ${statusFile ? "border-solid border-success-600 dark:border-success-500 bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400" : "border-solid border-surface-200 bg-surface-50 text-surface-700 hover:border-brand-600 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"} rounded-md font-medium text-sm transition-colors truncate`}
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
          <div className="flex flex-col gap-2">
            {" "}
            <label className="text-xs font-semibold text-surface-500">
              2. Master Data (Excel)
            </label>{" "}
            <button
              onClick={() => reqRef.current?.click()}
              className={`flex items-center justify-center gap-2 h-10 px-4 border ${reqFile ? "border-solid border-success-600 dark:border-success-500 bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400" : "border-solid border-surface-200 bg-surface-50 text-surface-700 hover:border-brand-600 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"} rounded-md font-medium text-sm transition-colors truncate`}
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
          <div className="flex flex-col gap-2">
            {" "}
            <label className="text-xs font-semibold text-surface-500">
              3. Skills Matrix (Excel)
            </label>{" "}
            <button
              onClick={() => skillsRef.current?.click()}
              className={`flex items-center justify-center gap-2 h-10 px-4 border ${skillsFile ? "border-solid border-success-600 dark:border-success-500 bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400" : "border-solid border-surface-200 bg-surface-50 text-surface-700 hover:border-brand-600 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"} rounded-md font-medium text-sm transition-colors truncate`}
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
          <div className="flex flex-col gap-2">
            {" "}
            <label className="text-xs font-semibold text-surface-500">
              4. ABS Data (Excel)
            </label>{" "}
            <button
              onClick={() => absRef.current?.click()}
              className={`flex items-center justify-center gap-2 h-10 px-4 border ${absFile ? "border-solid border-success-600 dark:border-success-500 bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400" : "border-solid border-surface-200 bg-surface-50 text-surface-700 hover:border-brand-600 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"} rounded-md font-medium text-sm transition-colors truncate`}
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
          <div className="flex flex-wrap gap-5">
            {" "}
            <div className="flex flex-col gap-2">
              {" "}
              <label className="text-xs font-semibold text-surface-500">
                Start Date
              </label>{" "}
              <div className="flex items-center border border-surface-200 rounded-md bg-surface-50 h-10 px-3 gap-2 focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600 transition-all w-[160px]">
                {" "}
                <Calendar size={16} className="text-surface-500" />{" "}
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-surface-900 outline-none w-full cursor-pointer"
                />{" "}
              </div>{" "}
            </div>{" "}
            <div className="flex flex-col gap-2">
              {" "}
              <label className="text-xs font-semibold text-surface-500">
                End Date (Optional)
              </label>{" "}
              <div className="flex items-center border border-surface-200 rounded-md bg-surface-50 h-10 px-3 gap-2 focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600 transition-all w-[160px]">
                {" "}
                <Calendar size={16} className="text-surface-500" />{" "}
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-surface-900 outline-none w-full cursor-pointer"
                />{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
          <button
            onClick={handleProcess}
            disabled={isLoading}
            className="btn-primary h-10 mt-4 md:mt-0"
          >
            {" "}
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bolt size={16} />
            )}{" "}
            Generate Dashboard{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
      <div className="text-center py-16 px-5">
        {" "}
        <PieChartIcon className="w-16 h-16 text-surface-200 mx-auto mb-6" />{" "}
        <h3 className="text-2xl font-semibold text-surface-900 mb-3">
          Data Center Ready
        </h3>{" "}
        <p className="text-sm text-surface-500 max-w-[600px] mx-auto leading-relaxed">
          {" "}
          Upload the required files locally. The engine validates dropped
          intervals strictly and calculates metrics precisely.{" "}
        </p>{" "}
      </div>{" "}
    </div>
  );
}
