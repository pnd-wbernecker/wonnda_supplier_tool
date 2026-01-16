"use client";

import { FileSpreadsheet } from "lucide-react";

interface CSVPreviewProps {
  headers: string[];
  data: Record<string, string>[];
  filename?: string;
}

export function CSVPreview({ headers, data, filename }: CSVPreviewProps) {
  return (
    <div className="bg-gray-700/30 rounded-xl overflow-hidden">
      {/* Header */}
      {filename && (
        <div className="p-4 border-b border-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-gray-400" />
            <span className="font-medium">{filename}</span>
          </div>
          <span className="text-sm text-gray-400">
            {data.length} rows • {headers.length} columns
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50">
              <th className="px-4 py-3 text-left text-gray-500 font-medium w-12">#</th>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-gray-400 font-medium whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={index}
                className="border-t border-gray-700 hover:bg-gray-700/30"
              >
                <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                {headers.map((header) => (
                  <td
                    key={header}
                    className="px-4 py-3 text-gray-300 max-w-[200px] truncate"
                    title={row[header]}
                  >
                    {row[header] || <span className="text-gray-600">-</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {!filename && (
        <div className="p-3 border-t border-gray-700 text-center text-sm text-gray-500">
          Showing {data.length} rows
        </div>
      )}
    </div>
  );
}
