import fs from 'fs';

let content = fs.readFileSync('src/pages/Data.tsx', 'utf-8');

// 1. Imports
content = content.replace(
import {
  parseDirectory, parseChats, parseStatus,
  processAHT, processCPH, exportToExcel,
  type DirectoryMeta, type ParsedChat, type ParsedStatus, type AHTResult, type CPHResult
} from '@/services/calcLogic';,
import {
  parseChats, parseStatus,
  processAHT, processCPH, exportToExcel,
  type DirectoryMeta, type ParsedChat, type ParsedStatus, type AHTResult, type CPHResult
} from '@/services/calcLogic';
import { useDataStore } from '@/stores/dataStore';
import ViewSwitcher from '@/components/common/ViewSwitcher';
);

// 2. State
const stateBlock =   const [activeTab, setActiveTab] = useState<'aht' | 'cph' | 'sla'>('cph');
  const [siteFilter, setSiteFilter] = useState('All');
  const [lobFilter, setLobFilter] = useState('All');
  const [boundsStart, setBoundsStart] = useState('');
  const [boundsEnd, setBoundsEnd] = useState('');

  const [dirMap, setDirMap] = useState<Record<string, DirectoryMeta> | null>(null);
  const [rawChats, setRawChats] = useState<ParsedChat[]>([]);
  const [rawStatus, setRawStatus] = useState<ParsedStatus[]>([]);

  const [ahtResult, setAhtResult] = useState<AHTResult | null>(null);
  const [cphResult, setCphResult] = useState<CPHResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem('wfm_sheet_url') || '');
  const [isFetchingDir, setIsFetchingDir] = useState(false);

  const chatsInputRef = useRef<HTMLInputElement>(null);
  const statusInputRef = useRef<HTMLInputElement>(null);;

const newStateBlock =   const [activeTab, setActiveTab] = useState<'aht' | 'cph' | 'sla'>('cph');
  const [viewMode, setViewMode] = useState<'overview' | 'details'>('overview');
  const [siteFilter, setSiteFilter] = useState('All');
  const [lobFilter, setLobFilter] = useState('All');
  const [boundsStart, setBoundsStart] = useState('');
  const [boundsEnd, setBoundsEnd] = useState('');

  const rawChats = useDataStore((s) => s.rawChats);
  const rawStatus = useDataStore((s) => s.rawStatus);

  const [ahtResult, setAhtResult] = useState<AHTResult | null>(null);
  const [cphResult, setCphResult] = useState<CPHResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);;

content = content.replace(stateBlock, newStateBlock);

// 3. Remove Data Input panel
content = content.replace(/  \/\/ --- LOAD FROM URL ---[\s\S]*?  \/\/ --- PROCESS DATA ---/, '  // --- PROCESS DATA ---');
content = content.replace(/      \{\/\* --- DATA INPUT PANEL --- \*\/\}[\s\S]*?      \{\/\* --- TABS & EXPORT --- \*\/\}/, '      {/* --- TABS & EXPORT */}');

// 4. ViewSwitcher
const tabExportBlock =       {/* --- TABS & EXPORT */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between mb-5 border-b border-surface-200"
      >
        <div className="flex gap-6">
          {(['cph', 'aht', 'sla'] as const).map(tab => {
            const labels: Record<string, string> = { cph: 'CPH View', aht: 'AHT View', sla: 'Main Matrix' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={\pb-3 text-sm font-medium border-b-2 transition-all duration-200 \\}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
        <div className="pb-2">;

const newTabExportBlock =       {/* --- TABS, SWITCHER & EXPORT --- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between mb-5 border-b border-surface-200"
      >
        <div className="flex gap-6 items-center">
          {(['cph', 'aht', 'sla'] as const).map(tab => {
            const labels: Record<string, string> = { cph: 'CPH View', aht: 'AHT View', sla: 'Main Matrix' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={\pb-3 text-sm font-medium border-b-2 transition-all duration-200 \\}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 pb-2">
          {activeTab !== 'sla' && (
            <ViewSwitcher activeView={viewMode} onViewChange={setViewMode} />
          )};

content = content.replace(tabExportBlock, newTabExportBlock);

// 5. CPH View split
const cphKpiStart =             {/* KPI Cards - CPH */}
            <motion.div
              variants={containerVariants} initial="hidden" animate="show"
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >;

const newCphKpiStart =             {/* --- OVERVIEW: KPI & CHARTS --- */}
            {viewMode === 'overview' && (
              <>
                <motion.div
                  variants={containerVariants} initial="hidden" animate="show"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                >;
content = content.replace(cphKpiStart, newCphKpiStart);

const cphSvBarEnd =                   </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Agent Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="card p-5"
            >;

const newCphSvBarEnd =                   </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
              </>
            )}

            {/* --- DETAILS: TABLES --- */}
            {viewMode === 'details' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {/* Agent Table */}
                <motion.div
                  className="card p-5"
                >;
content = content.replace(cphSvBarEnd, newCphSvBarEnd);

const cphIntervalEnd =                   </>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ------ AHT VIEW ------ */};

const newCphIntervalEnd =                   </>
                )}
              </motion.div>
            </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ------ AHT VIEW ------ */};
content = content.replace(cphIntervalEnd, newCphIntervalEnd);

// 6. AHT View split
const ahtKpiStart =             {/* KPI Cards - AHT */}
            <motion.div
              variants={containerVariants} initial="hidden" animate="show"
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >;

const newAhtKpiStart =             {/* --- OVERVIEW: KPI & CHARTS --- */}
            {viewMode === 'overview' && (
              <>
                <motion.div
                  variants={containerVariants} initial="hidden" animate="show"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                >;
content = content.replace(ahtKpiStart, newAhtKpiStart);

const ahtSvBarEnd =                   </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Agent Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="card p-5"
            >;

const newAhtSvBarEnd =                   </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
              </>
            )}

            {/* --- DETAILS: TABLES --- */}
            {viewMode === 'details' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {/* Agent Table */}
                <motion.div
                  className="card p-5"
                >;
content = content.replace(ahtSvBarEnd, newAhtSvBarEnd);

const ahtIntervalEnd =                   </>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ------ EMPTY STATE ------ */};

const newAhtIntervalEnd =                   </>
                )}
              </motion.div>
            </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ------ EMPTY STATE ------ */};
content = content.replace(ahtIntervalEnd, newAhtIntervalEnd);

fs.writeFileSync('src/pages/Data.tsx', content, 'utf-8');
console.log("Data.tsx successfully patched via Node script.");
