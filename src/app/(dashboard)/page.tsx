import { createClient } from "@/lib/supabase/server";
import { 
  Building2, 
  FileSpreadsheet, 
  CheckCircle2,
  Upload,
  TrendingUp,
  Clock
} from "lucide-react";
import Link from "next/link";
import type { Company, Import } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // Fetch stats
  const companiesResult = await supabase.from("companies").select("id, status", { count: "exact" }) as unknown as { data: Pick<Company, "id" | "status">[] | null; count: number | null };
  const importsResult = await supabase.from("imports").select("id, status", { count: "exact" }) as unknown as { data: Pick<Import, "id" | "status">[] | null; count: number | null };

  const totalCompanies = companiesResult.count || 0;
  const totalImports = importsResult.count || 0;
  const validatedCompanies = companiesResult.data?.filter(
    (c) => c.status === "validated"
  ).length || 0;
  const validationRate = totalCompanies > 0 
    ? Math.round((validatedCompanies / totalCompanies) * 100) 
    : 0;

  const recentImports = importsResult.data?.slice(0, 5) || [];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-[var(--color-text-secondary)]">
          Overview of your supplier data pipeline
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon={Building2}
          label="Total Companies"
          value={totalCompanies.toLocaleString()}
          trend={null}
        />
        <StatCard
          icon={FileSpreadsheet}
          label="Total Imports"
          value={totalImports.toLocaleString()}
          trend={null}
        />
        <StatCard
          icon={CheckCircle2}
          label="Validation Rate"
          value={`${validationRate}%`}
          trend={null}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          href="/imports/new"
          className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl hover:border-[var(--color-accent)] transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center group-hover:bg-[var(--color-accent)]/20 transition-colors">
              <Upload className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Upload CSV</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Import new company data
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/companies"
          className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl hover:border-[var(--color-accent)] transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center group-hover:bg-[var(--color-accent)]/20 transition-colors">
              <Building2 className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">View Companies</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Browse and manage your data
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-[var(--color-text-muted)]" />
          <h2 className="font-semibold">Recent Imports</h2>
        </div>
        
        {recentImports.length === 0 ? (
          <p className="text-[var(--color-text-secondary)] text-center py-8">
            No imports yet. Upload your first CSV to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {recentImports.map((imp) => (
              <div
                key={imp.id}
                className="flex items-center justify-between p-3 bg-[var(--color-surface-elevated)] rounded-xl"
              >
                <span className="text-sm font-mono">{imp.id.slice(0, 8)}...</span>
                <StatusBadge status={imp.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend: number | null;
}) {
  return (
    <div className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-5 h-5 text-[var(--color-text-muted)]" />
        <span className="text-[var(--color-text-secondary)]">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold">{value}</span>
        {trend !== null && (
          <span
            className={`text-sm flex items-center gap-1 ${
              trend >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-error)]"
            }`}
          >
            <TrendingUp className={`w-4 h-4 ${trend < 0 ? "rotate-180" : ""}`} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500",
    mapping: "bg-blue-500/10 text-blue-500",
    processing: "bg-purple-500/10 text-purple-500",
    completed: "bg-green-500/10 text-green-500",
    failed: "bg-red-500/10 text-red-500",
  };

  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${colors[status] || colors.pending}`}>
      {status}
    </span>
  );
}
