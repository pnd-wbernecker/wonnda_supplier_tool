'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CSVUploader, CSVPreview, SchemaMapper } from '@/components/imports';
import { ArrowRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface ParsedCSV {
  headers: string[];
  data: Record<string, string>[];
  filename: string;
}

interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
}

type Step = 'upload' | 'map' | 'import' | 'pipeline' | 'done';

export default function NewImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [csvData, setCsvData] = useState<ParsedCSV | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importId, setImportId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    processed_count: number;
    skipped_count: number;
    error_count: number;
  } | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<{
    step: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCSVParsed = (headers: string[], data: Record<string, string>[], filename: string) => {
    setCsvData({ headers, data, filename });
    setStep('map');
  };

  const handleMappingComplete = (newMappings: ColumnMapping[]) => {
    setMappings(newMappings);
  };

  const startImport = async () => {
    if (!csvData || mappings.length === 0) return;
    
    setLoading(true);
    setError(null);
    setStep('import');
    
    try {
      const res = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: csvData.data,
          mappings,
          filename: csvData.filename,
        }),
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || 'Import failed');
      }
      
      setImportId(result.import_id);
      setImportResult({
        processed_count: result.processed_count,
        skipped_count: result.skipped_count,
        error_count: result.error_count,
      });
      
      // Automatically start pipeline
      if (result.processed_count > 0) {
        await runPipeline(result.import_id);
      } else {
        setStep('done');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('map');
    } finally {
      setLoading(false);
    }
  };

  const runPipeline = async (id: string) => {
    setStep('pipeline');
    
    try {
      // Run CLEAN
      setPipelineStatus({ step: 'clean', message: 'Formatting company data with AI...' });
      const cleanRes = await fetch('/api/pipeline/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: id }),
      });
      
      if (!cleanRes.ok) {
        const err = await cleanRes.json();
        console.error('Clean step error:', err);
      }
      
      // Run RESEARCH
      setPipelineStatus({ step: 'research', message: 'Researching missing data...' });
      const researchRes = await fetch('/api/pipeline/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: id }),
      });
      
      if (!researchRes.ok) {
        const err = await researchRes.json();
        console.error('Research step error:', err);
      }
      
      // Run VALIDATE
      setPipelineStatus({ step: 'validate', message: 'Validating data against rules...' });
      const validateRes = await fetch('/api/pipeline/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: id }),
      });
      
      if (!validateRes.ok) {
        const err = await validateRes.json();
        console.error('Validate step error:', err);
      }
      
      setStep('done');
    } catch (err) {
      console.error('Pipeline error:', err);
      setStep('done'); // Still show done, errors are logged
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'upload', label: 'Upload' },
      { key: 'map', label: 'Map Columns' },
      { key: 'import', label: 'Import' },
      { key: 'pipeline', label: 'Process' },
      { key: 'done', label: 'Done' },
    ];
    
    const currentIndex = steps.findIndex(s => s.key === step);
    
    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${i < currentIndex ? 'bg-green-600 text-white' : ''}
              ${i === currentIndex ? 'bg-violet-600 text-white' : ''}
              ${i > currentIndex ? 'bg-gray-700 text-gray-400' : ''}
            `}>
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span className={`ml-2 text-sm ${i === currentIndex ? 'text-white' : 'text-gray-500'}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <ArrowRight className="mx-3 text-gray-600" size={16} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Import CSV</h1>
      <p className="text-gray-400 mb-8">Upload a CSV file and map columns to import companies</p>
      
      {renderStepIndicator()}
      
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="text-red-400" />
          <p className="text-red-300">{error}</p>
        </div>
      )}
      
      {step === 'upload' && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-8">
          <CSVUploader onParsed={handleCSVParsed} />
        </div>
      )}
      
      {step === 'map' && csvData && (
        <div className="space-y-6">
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-4">Preview ({csvData.data.length} rows)</h2>
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
      
      {(step === 'import' || step === 'pipeline') && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-8 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-violet-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {step === 'import' ? 'Importing Data...' : 'Processing Pipeline...'}
          </h2>
          {pipelineStatus && (
            <p className="text-gray-400">{pipelineStatus.message}</p>
          )}
          {importResult && (
            <div className="mt-4 text-sm text-gray-400">
              {importResult.processed_count} imported, {importResult.skipped_count} skipped
            </div>
          )}
        </div>
      )}
      
      {step === 'done' && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Import Complete!</h2>
          
          {importResult && (
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto my-6">
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-400">{importResult.processed_count}</div>
                <div className="text-sm text-gray-400">Imported</div>
              </div>
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-400">{importResult.skipped_count}</div>
                <div className="text-sm text-gray-400">Skipped</div>
              </div>
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-400">{importResult.error_count}</div>
                <div className="text-sm text-gray-400">Errors</div>
              </div>
            </div>
          )}
          
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => router.push('/companies')}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg transition"
            >
              View Companies
            </button>
            <button
              onClick={() => { setCsvData(null); setImportResult(null); setStep('upload'); }}
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
