import { createClient } from "@/lib/supabase/server";
import { Upload, FileSpreadsheet, Clock, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

export default async function ImportsPage() {
  const supabase = await createClient();
  
  const { data: imports, error } = await supabase
    .from("imports")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Imports</h1>
          <p className="text-[var(--color-text-secondary)]">
            Manage your CSV imports and track processing status
          </p>
        </div>
        <Link
          href="/imports/new"
          className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium rounded-xl transition-colors flex items-center gap-2"
        >
          <Upload className="w-5 h-5" />
          Upload CSV
        </Link>
      </div>

      {/* Imports List */}
      {error ? (
        <div className="p-6 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-2xl text-[var(--color-error)]">
          Error loading imports: {error.message}
        </div>
      ) : imports && imports.length > 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Filename</th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Status</th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Rows</th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Processed</th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-elevated)]">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-[var(--color-text-muted)]" />
                      <Link href={`/imports/${imp.id}`} className="font-medium hover:text-[var(--color-accent)]">
                        {imp.filename}
                      </Link>
                    </div>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={imp.status} />
                  </td>
                  <td className="p-4 text-[var(--color-text-secondary)]">
                    {imp.row_count.toLocaleString()}
                  </td>
                  <td className="p-4 text-[var(--color-text-secondary)]">
                    {imp.processed_count.toLocaleString()} / {imp.skipped_count} skipped
                  </td>
                  <td className="p-4 text-[var(--color-text-secondary)]">
                    {new Date(imp.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No imports yet</h3>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Upload your first CSV to start processing company data
          </p>
          <Link
            href="/imports/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium rounded-xl transition-colors"
          >
            <Upload className="w-5 h-5" />
            Upload CSV
          </Link>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ElementType }> = {
    pending: { color: "bg-yellow-500/10 text-yellow-500", icon: Clock },
    mapping: { color: "bg-blue-500/10 text-blue-500", icon: FileSpreadsheet },
    processing: { color: "bg-purple-500/10 text-purple-500", icon: Clock },
    completed: { color: "bg-green-500/10 text-green-500", icon: CheckCircle2 },
    failed: { color: "bg-red-500/10 text-red-500", icon: XCircle },
  };

  const { color, icon: Icon } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}
