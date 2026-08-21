import re

with open('src/pages/Data.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    '''import {
  parseDirectory, parseChats, parseStatus,
  processAHT, processCPH, exportToExcel,
  type DirectoryMeta, type ParsedChat, type ParsedStatus, type AHTResult, type CPHResult
} from '@/services/calcLogic';''',
    '''import {
  parseChats, parseStatus,
  processAHT, processCPH, exportToExcel,
  type DirectoryMeta, type ParsedChat, type ParsedStatus, type AHTResult, type CPHResult
} from '@/services/calcLogic';
import { useDataStore } from '@/stores/dataStore';
import ViewSwitcher from '@/components/common/ViewSwitcher';'''
)

# 2. State definition block
state_block = '''  const [activeTab, setActiveTab] = useState<'aht' | 'cph' | 'sla'>('cph');
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
  const statusInputRef = useRef<HTMLInputElement>(null);'''

new_state_block = '''  const [activeTab, setActiveTab] = useState<'aht' | 'cph' | 'sla'>('cph');
  const [viewMode, setViewMode] = useState<'overview' | 'details'>('overview');
  const [siteFilter, setSiteFilter] = useState('All');
  const [lobFilter, setLobFilter] = useState('All');
  const [boundsStart, setBoundsStart] = useState('');
  const [boundsEnd, setBoundsEnd] = useState('');

  const rawChats = useDataStore((s) => s.rawChats);
  const rawStatus = useDataStore((s) => s.rawStatus);

  const [ahtResult, setAhtResult] = useState<AHTResult | null>(null);
  const [cphResult, setCphResult] = useState<CPHResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);'''

content = content.replace(state_block, new_state_block)

# 3. Remove Data Input panel and functions
# First, remove the functions (from // --- LOAD FROM URL --- up to // --- EXPORT ---)
# It's easier to use a regex for this
content = re.sub(
    r'  // --- LOAD FROM URL ---.*?  // --- PROCESS DATA ---',
    r'  // --- PROCESS DATA ---',
    content,
    flags=re.DOTALL
)

# Also remove the Data Input Panel JSX
content = re.sub(
    r'      {/\* --- DATA INPUT PANEL --- \*/}.*?      {/\* --- TABS & EXPORT --- \*/}',
    r'      {/* --- TABS & EXPORT --- */}',
    content,
    flags=re.DOTALL
)


# 4. ViewSwitcher header
tab_export_block = '''      {/* --- TABS & EXPORT --- */}
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
                className={pb-3 text-sm font-medium border-b-2 transition-all duration-200 }
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
        <div className="pb-2">'''

new_tab_export_block = '''      {/* --- TABS, SWITCHER & EXPORT --- */}
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
                className={pb-3 text-sm font-medium border-b-2 transition-all duration-200 }
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 pb-2">
          {activeTab !== 'sla' && (
            <ViewSwitcher activeView={viewMode} onViewChange={setViewMode} />
          )}'''

content = content.replace(tab_export_block, new_tab_export_block)

# 5. CPH View split
cph_kpi_start = '''            {/* KPI Cards - CPH */}
            <motion.div
              variants={containerVariants} initial="hidden" animate="show"
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >'''

new_cph_kpi_start = '''            {/* --- OVERVIEW: KPI & CHARTS --- */}
            {viewMode === 'overview' && (
              <>
                <motion.div
                  variants={containerVariants} initial="hidden" animate="show"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                >'''

content = content.replace(cph_kpi_start, new_cph_kpi_start)

# End of CPH overview, start of details
cph_chart_end = '''                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>'''
            
# Wait, let's use the actual text from the file for cph_chart_end
cph_sv_bar_end = '''                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Agent Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="card p-5"
            >'''

new_cph_sv_bar_end = '''                  </Bar>
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
                >'''

content = content.replace(cph_sv_bar_end, new_cph_sv_bar_end)

# End of CPH details
cph_interval_end = '''                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ------ AHT VIEW ------ */}'''

new_cph_interval_end = '''                  </>
                )}
              </motion.div>
            </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ------ AHT VIEW ------ */}'''

content = content.replace(cph_interval_end, new_cph_interval_end)

# 6. AHT View split
aht_kpi_start = '''            {/* KPI Cards - AHT */}
            <motion.div
              variants={containerVariants} initial="hidden" animate="show"
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >'''

new_aht_kpi_start = '''            {/* --- OVERVIEW: KPI & CHARTS --- */}
            {viewMode === 'overview' && (
              <>
                <motion.div
                  variants={containerVariants} initial="hidden" animate="show"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                >'''

content = content.replace(aht_kpi_start, new_aht_kpi_start)

# End of AHT overview, start of details
aht_sv_bar_end = '''                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Agent Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="card p-5"
            >'''

new_aht_sv_bar_end = '''                  </Bar>
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
                >'''

content = content.replace(aht_sv_bar_end, new_aht_sv_bar_end)

# End of AHT details
aht_interval_end = '''                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ------ EMPTY STATE ------ */}'''

new_aht_interval_end = '''                  </>
                )}
              </motion.div>
            </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ------ EMPTY STATE ------ */}'''

content = content.replace(aht_interval_end, new_aht_interval_end)


with open('src/pages/Data.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Data.tsx successfully patched via script.")
