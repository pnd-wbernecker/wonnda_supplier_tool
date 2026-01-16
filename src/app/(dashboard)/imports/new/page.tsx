'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CSVUploader, CSVPreview, SchemaMapper } from '@/components/imports';
import { ArrowRight, Loader2, CheckCircle, AlertCircle, Settings2, Terminal, ChevronDown, ChevronUp } from 'lucide-react';

interface ParsedCSV {
  headers: string[];
  data: Record<string, string>[];
  filename: string;
}

interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
}

interface SkippedCompany {
  name: string;
  domain: string | null;
  reason: 'duplicate_in_db' | 'duplicate_in_csv' | 'missing_name';
}

interface ImportResult {
  import_id: string;
  total_rows: number;
  processed_count: number;
  skipped_count: number;
  error_count: number;
  skipped_companies: SkippedCompany[];
  errors: Array<{ row: number; error: string }>;
}

interface PipelineStepResult {
  processed: number;
  errors: string[];
  valid?: number;
  invalid?: number;
}

type Step = 'upload' | 'map' | 'processing' | 'done';

export default function NewImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [csvData, setCsvData] = useState<ParsedCSV | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [rowLimit, setRowLimit] = useState<number | null>(null);
  
  // Progress tracking
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Results
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [pipelineResults, setPipelineResults] = useState<{
    clean?: PipelineStepResult;
    research?: PipelineStepResult;
    validate?: PipelineStepResult;
  }>({});
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleCSVParsed = (headers: string[], data: Record<string, string>[], filename: string) => {
    setCsvData({ headers, data, filename });
    setStep('map');
    addLog(`CSV loaded: ${filename} (${data.length} rows, ${headers.length} columns)`);
  };

  const handleMappingComplete = (newMappings: ColumnMapping[]) => {
    setMappings(newMappings);
  };

  const startImport = async () => {
    if (!csvData || mappings.length === 0) return;
    
    setError(null);
    setStep('processing');
    setStartTime(new Date());
    setLogs([]);
    
    const effectiveRowLimit = rowLimit || csvData.data.length;
    addLog(`Starting import of ${effectiveRowLimit} rows...`);
    setCurrentPhase('Importing data');
    setProgress({ current: 0, total: effectiveRowLimit });
    
    try {
      // Phase 1: Import
      addLog('Phase 1/4: Importing data to database...');
      const res = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: csvData.data,
          mappings,
          filename: csvData.filename,
          rowLimit: rowLimit || undefined,
        }),
      });
      
      const result: ImportResult = await res.json();
      
      if (!res.ok) {
        throw new Error(result.errors?.[0]?.error || 'Import failed');
      }
      
      setImportResult(result);
      setProgress({ current: result.processed_count, total: effectiveRowLimit });
      addLog(`✓ Import complete: ${result.processed_count} imported, ${result.skipped_count} skipped`);
      
      if (result.skipped_count > 0) {
        const dbDupes = result.skipped_companies.filter(s => s.reason === 'duplicate_in_db').length;
        const csvDupes = result.skipped_companies.filter(s => s.reason === 'duplicate_in_csv').length;
        const noName = result.skipped_companies.filter(s => s.reason === 'missing_name').length;
        if (dbDupes > 0) addLog(`  → ${dbDupes} already in database`);
        if (csvDupes > 0) addLog(`  → ${csvDupes} duplicates within CSV`);
        if (noName > 0) addLog(`  → ${noName} missing company name`);
      }
      
      // Phase 2: Clean
      if (result.processed_count > 0) {
        addLog('Phase 2/4: Cleaning & formatting with AI...');
        setCurrentPhase('Cleaning data');
        setProgress({ current: 0, total: result.processed_count });
        
        const cleanRes = await fetch('/api/pipeline/clean', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ importId: result.import_id }),
        });
        
        const cleanResult: PipelineStepResult = await cleanRes.json();
        setPipelineResults(prev => ({ ...prev, clean: cleanResult }));
        setProgress({ current: cleanResult.processed, total: result.processed_count });
        addLog(`✓ Clean complete: ${cleanResult.processed} processed`);
        if (cleanResult.errors.length > 0) {
          addLog(`  ⚠ ${cleanResult.errors.length} errors`);
        }
        
        // Phase 3: Research
        addLog('Phase 3/4: Researching missing data...');
        setCurrentPhase('Researching');
        setProgress({ current: 0, total: cleanResult.processed });
        
        const researchRes = await fetch('/api/pipeline/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ importId: result.import_id }),
        });
        
        const researchResult: PipelineStepResult = await researchRes.json();
        setPipelineResults(prev => ({ ...prev, research: researchResult }));
        setProgress({ current: researchResult.processed, total: cleanResult.processed });
        addLog(`✓ Research complete: ${researchResult.processed} processed`);
        if (researchResult.errors.length > 0) {
          addLog(`  ⚠ ${researchResult.errors.length} errors`);
        }
        
        // Phase 4: Validate
        addLog('Phase 4/4: Validating against rules...');
        setCurrentPhase('Validating');
        
        const validateRes = await fetch('/api/pipeline/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ importId: result.import_id }),
        });
        
        const validateResult: PipelineStepResult = await validateRes.json();
        setPipelineResults(prev => ({ ...prev, validate: validateResult }));
        addLog(`✓ Validation complete: ${validateResult.valid || 0} valid, ${validateResult.invalid || 0} invalid`);
      }
      
      setEndTime(new Date());
      addLog('─────────────────────────────');
      addLog('Pipeline finished successfully!');
      setStep('done');
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Import failed';
      setError(errorMsg);
      addLog(`✗ Error: ${errorMsg}`);
      setEndTime(new Date());
      setStep('done');
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'duplicate_in_db': return 'Already in database';
      case 'duplicate_in_csv': return 'Duplicate in CSV';
      case 'missing_name': return 'Missing company name';
      default: return reason;
    }
  };

  const getDuration = () => {
    if (!startTime || !endTime) return null;
    const seconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Import CSV</h1>
          <p className="text-gray-400 mt-1">Upload and process company data</p>
        </div>
        
        {step === 'map' && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            <Settings2 size={16} />
            Settings
          </button>
        )}
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0" />
          <p className="text-red-300">{error}</p>
        </div>
      )}
      
      {/* Settings Panel */}
      {showSettings && step === 'map' && (
        <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
          <h3 className="font-medium mb-3">Debug Settings</h3>
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-400">Row Limit:</label>
            <input
              type="number"
              min="1"
              max={csvData?.data.length || 10000}
              placeholder="All rows"
              value={rowLimit || ''}
              onChange={(e) => setRowLimit(e.target.value ? parseInt(e.target.value) : null)}
              className="w-32 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm"
            />
            <span className="text-sm text-gray-500">
              {rowLimit ? `Process first ${rowLimit} rows` : `Process all ${csvData?.data.length || 0} rows`}
            </span>
          </div>
        </div>
      )}
      
      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-8">
          <CSVUploader onParsed={handleCSVParsed} />
        </div>
      )}
      
      {/* Step: Map */}
      {step === 'map' && csvData && (
        <div className="space-y-6">
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-4">
              Preview ({rowLimit || csvData.data.length} of {csvData.data.length} rows)
            </h2>
            <CSVPreview headers={csvData.headers} data={csvData.data.slice(0, 5)} />
          </div>
          
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-4">Map Columns</h2>
            <SchemaMapper 
              sourceColumns={csvData.headers} 
              onMappingChange={handleMappingComplete}
            />
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={() => { setCsvData(null); setStep('upload'); }}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              Back
            </button>
            <button
              onClick={startImport}
              disabled={mappings.length === 0 || !mappings.some(m => m.targetColumn === 'name')}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Start Import
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
      
      {/* Step: Processing */}
      {step === 'processing' && (
        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                <span className="font-medium">{currentPhase}</span>
              </div>
              <span className="text-sm text-gray-400">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-violet-500 transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
          
          {/* Console */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
              <Terminal size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-300">Console</span>
            </div>
            <div className="p-4 h-64 overflow-y-auto font-mono text-sm">
              {logs.map((log, i) => (
                <div key={i} className={`${log.includes('✓') ? 'text-green-400' : log.includes('✗') ? 'text-red-400' : log.includes('⚠') ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
      
      {/* Step: Done */}
      {step === 'done' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              {error ? (
                <AlertCircle className="w-8 h-8 text-red-400" />
              ) : (
                <CheckCircle className="w-8 h-8 text-green-400" />
              )}
              <div>
                <h2 className="text-xl font-semibold">
                  {error ? 'Import Failed' : 'Import Complete'}
                </h2>
                {getDuration() && (
                  <p className="text-sm text-gray-400">Duration: {getDuration()}</p>
                )}
              </div>
            </div>
            
            {importResult && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold">{importResult.total_rows}</div>
                  <div className="text-sm text-gray-400">Total Rows</div>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-400">{importResult.processed_count}</div>
                  <div className="text-sm text-gray-400">Imported</div>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-400">{importResult.skipped_count}</div>
                  <div className="text-sm text-gray-400">Skipped</div>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-400">{importResult.error_count}</div>
                  <div className="text-sm text-gray-400">Errors</div>
                </div>
              </div>
            )}
            
            {/* Pipeline Results */}
            {(pipelineResults.clean || pipelineResults.research || pipelineResults.validate) && (
              <div className="border-t border-gray-700 pt-4">
                <h3 className="font-medium mb-3">Pipeline Results</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {pipelineResults.clean && (
                    <div className="bg-gray-700/30 p-3 rounded-lg">
                      <div className="font-medium text-blue-400">Clean</div>
                      <div className="text-gray-300">{pipelineResults.clean.processed} processed</div>
                      {pipelineResults.clean.errors.length > 0 && (
                        <div className="text-yellow-400">{pipelineResults.clean.errors.length} errors</div>
                      )}
                    </div>
                  )}
                  {pipelineResults.research && (
                    <div className="bg-gray-700/30 p-3 rounded-lg">
                      <div className="font-medium text-purple-400">Research</div>
                      <div className="text-gray-300">{pipelineResults.research.processed} processed</div>
                      {pipelineResults.research.errors.length > 0 && (
                        <div className="text-yellow-400">{pipelineResults.research.errors.length} errors</div>
                      )}
                    </div>
                  )}
                  {pipelineResults.validate && (
                    <div className="bg-gray-700/30 p-3 rounded-lg">
                      <div className="font-medium text-green-400">Validate</div>
                      <div className="text-gray-300">{pipelineResults.validate.valid || 0} valid</div>
                      {(pipelineResults.validate.invalid || 0) > 0 && (
                        <div className="text-yellow-400">{pipelineResults.validate.invalid} invalid</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Skipped Details */}
          {importResult && importResult.skipped_count > 0 && (
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
              <button
                onClick={() => setShowSkipped(!showSkipped)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-700/30 transition"
              >
                <span className="font-medium">Skipped Companies ({importResult.skipped_count})</span>
                {showSkipped ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              {showSkipped && (
                <div className="border-t border-gray-700 max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900/50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-400">Company</th>
                        <th className="px-4 py-2 text-left text-gray-400">Domain</th>
                        <th className="px-4 py-2 text-left text-gray-400">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.skipped_companies.slice(0, 100).map((company, i) => (
                        <tr key={i} className="border-t border-gray-700/50">
                          <td className="px-4 py-2 text-gray-300">{company.name}</td>
                          <td className="px-4 py-2 text-gray-400">{company.domain || '-'}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              company.reason === 'duplicate_in_db' ? 'bg-blue-500/20 text-blue-400' :
                              company.reason === 'duplicate_in_csv' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {getReasonLabel(company.reason)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importResult.skipped_companies.length > 100 && (
                    <div className="px-4 py-2 text-sm text-gray-500 text-center border-t border-gray-700">
                      Showing first 100 of {importResult.skipped_companies.length}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Console Log */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
              <Terminal size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-300">Console Log</span>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto font-mono text-sm">
              {logs.map((log, i) => (
                <div key={i} className={`${log.includes('✓') ? 'text-green-400' : log.includes('✗') ? 'text-red-400' : log.includes('⚠') ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-center gap-4">
            <button
              onClick={() => router.push('/companies')}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg transition"
            >
              View Companies
            </button>
            <button
              onClick={() => {
                setCsvData(null);
                setImportResult(null);
                setPipelineResults({});
                setLogs([]);
                setStep('upload');
              }}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              Import Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
