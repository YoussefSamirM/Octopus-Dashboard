export default function LegacyInvoice() {
  return (
    <div className="w-full h-full bg-surface-50 rounded-md overflow-hidden shadow-sm border border-surface-200 dark:border-surface-700">
      <iframe src="/Invoice.html" className="w-full h-[calc(100vh-140px)] border-0" title="Legacy Engine" />
    </div>
  );
}
