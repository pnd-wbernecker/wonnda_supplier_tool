"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle2 } from "lucide-react";
import Papa from "papaparse";

interface CSVUploaderProps {
  onFileLoaded: (data: {
    filename: string;
    headers: string[];
    rows: Record<string, string>[];
    preview: Record<string, string>[];
  }) => void;
}

export function CSVUploader({ onFileLoaded }: CSVUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const processFile = useCallback((file: File) => {
    setIsLoading(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsLoading(false);
        
        if (results.errors.length > 0) {
          setError(`CSV parsing error: ${results.errors[0].message}`);
          return;
        }

        const rows = results.data as Record<string, string>[];
        const headers = results.meta.fields || [];
        
        if (rows.length === 0) {
          setError("CSV file is empty");
          return;
        }

        setFile(file);
        onFileLoaded({
          filename: file.name,
          headers,
          rows,
          preview: rows.slice(0, 5),
        });
      },
      error: (err) => {
        setIsLoading(false);
        setError(`Failed to parse CSV: ${err.message}`);
      },
    });
  }, [onFileLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "text/csv") {
      processFile(droppedFile);
    } else {
      setError("Please upload a CSV file");
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, [processFile]);

  const clearFile = () => {
    setFile(null);
    setError(null);
  };

  if (file) {
    return (
      <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={clearFile}
            className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative p-12 border-2 border-dashed rounded-2xl text-center transition-colors ${
          isDragging
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
            : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
        }`}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center">
          {isLoading ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4 animate-pulse">
                <FileSpreadsheet className="w-8 h-8 text-[var(--color-accent)]" />
              </div>
              <p className="text-lg font-medium mb-2">Processing...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-elevated)] flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-[var(--color-text-muted)]" />
              </div>
              <p className="text-lg font-medium mb-2">
                Drop your CSV here
              </p>
              <p className="text-[var(--color-text-secondary)]">
                or click to browse
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-xl flex items-center gap-3 text-[var(--color-error)]">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
