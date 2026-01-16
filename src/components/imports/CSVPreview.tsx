"use client";

import { FileSpreadsheet } from "lucide-react";

interface CSVPreviewProps {
  filename: string;
  headers: string[];
  preview: Record<string, string>[];
  totalRows: number;
}

export function CSVPreview({ filename, headers, preview, totalRows }: CSVPreviewProps) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-[var(--color-text-muted)]" />
          <span className="font-medium">{filename}</span>
        </div>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {totalRows.toLocaleString()} rows • {headers.length} columns
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface-elevated)]">
              <th className="px-4 py-3 text-left text-[var(--color-text-muted)] font-medium w-12">#</th>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-[var(--color-text-secondary)] font-medium whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, index) => (
              <tr
                key={index}
                className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]"
              >
                <td className="px-4 py-3 text-[var(--color-text-muted)]">{index + 1}</td>
                {headers.map((header) => (
                  <td
                    key={header}
                    className="px-4 py-3 text-[var(--color-text-primary)] max-w-[200px] truncate"
                    title={row[header]}
                  >
                    {row[header] || <span className="text-[var(--color-text-muted)]">-</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--color-border)] text-center text-sm text-[var(--color-text-muted)]">
        Showing first {preview.length} of {totalRows.toLocaleString()} rows
      </div>
    </div>
  );
}
