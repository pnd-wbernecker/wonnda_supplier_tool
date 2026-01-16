import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Mail, Phone, MapPin, Building2, Tag, Shield, Clock } from "lucide-react";
import Link from "next/link";
import type { Company, ProcessingLog } from "@/types/database";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single() as { data: Company | null; error: unknown };

  if (error || !company) {
    notFound();
  }

  const { data: logs } = await supabase
    .from("processing_logs")
    .select("*")
    .eq("company_id", id)
    .order("created_at", { ascending: false })
    .limit(10) as { data: ProcessingLog[] | null };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/companies"
          className="inline-flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Companies
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {company.formatted_name || company.name || "Unknown Company"}
            </h1>
            <div className="flex items-center gap-4">
              {company.domain && (
                <a
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[var(--color-accent)] hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  {company.domain}
                </a>
              )}
              <StatusBadge status={company.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Description</h2>
            <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap">
              {company.enriched_description || company.description || "No description available"}
            </p>
          </div>

          {/* Contact */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem
                icon={Mail}
                label="Email"
                value={company.email}
              />
              <InfoItem
                icon={Phone}
                label="Phone"
                value={company.phone}
              />
              <InfoItem
                icon={MapPin}
                label="Address"
                value={company.formatted_address || company.address}
                className="col-span-2"
              />
              <InfoItem
                icon={Globe}
                label="Country"
                value={company.country_name || company.country_code}
              />
            </div>
          </div>

          {/* Categories & Tags */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Classifications</h2>
            <div className="space-y-4">
              {company.company_type && (
                <div>
                  <span className="text-sm text-[var(--color-text-secondary)]">Type</span>
                  <div className="mt-1">
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      company.company_type === "seller"
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-purple-500/10 text-purple-500"
                    }`}>
                      {company.company_type}
                    </span>
                  </div>
                </div>
              )}
              
              {company.categories && company.categories.length > 0 && (
                <div>
                  <span className="text-sm text-[var(--color-text-secondary)]">Categories</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {company.categories.map((cat) => (
                      <span key={cat} className="px-3 py-1 bg-[var(--color-surface-elevated)] rounded-lg text-sm">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {company.tags && company.tags.length > 0 && (
                <div>
                  <span className="text-sm text-[var(--color-text-secondary)]">Tags</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {company.tags.map((tag) => (
                      <span key={tag} className="px-3 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-lg text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {company.certifications && company.certifications.length > 0 && (
                <div>
                  <span className="text-sm text-[var(--color-text-secondary)]">Certifications</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {company.certifications.map((cert) => (
                      <span key={cert} className="px-3 py-1 bg-green-500/10 text-green-500 rounded-lg text-sm">
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Meta */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Metadata</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">ID</span>
                <span className="font-mono">{company.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Hash</span>
                <span className="font-mono">{company.company_hash.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Created</span>
                <span>{new Date(company.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Updated</span>
                <span>{new Date(company.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Processing History */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-[var(--color-text-muted)]" />
              <h2 className="font-semibold">Processing History</h2>
            </div>
            {logs && logs.length > 0 ? (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{log.step}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {log.duration_ms && (
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {log.duration_ms}ms
                      </span>
                    )}
                    {log.error && (
                      <p className="text-xs text-[var(--color-error)] mt-1">{log.error}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No processing history</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
        <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      </div>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500",
    cleaning: "bg-blue-500/10 text-blue-500",
    researching: "bg-purple-500/10 text-purple-500",
    validating: "bg-orange-500/10 text-orange-500",
    validated: "bg-green-500/10 text-green-500",
    failed: "bg-red-500/10 text-red-500",
  };

  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${colors[status] || colors.pending}`}>
      {status}
    </span>
  );
}
