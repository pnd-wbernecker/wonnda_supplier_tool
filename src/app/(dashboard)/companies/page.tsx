"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Building2, Search, Filter, Download, ChevronLeft, ChevronRight, Play } from "lucide-react";
import Link from "next/link";
import type { Company } from "@/types/database";

const ITEMS_PER_PAGE = 25;

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const supabase = createClient();

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    
    let query = supabase
      .from("companies")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,formatted_name.ilike.%${search}%,domain.ilike.%${search}%`);
    }

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Error fetching companies:", error);
    } else {
      setCompanies(data || []);
      setTotalCount(count || 0);
    }
    
    setIsLoading(false);
  }, [supabase, page, search, statusFilter]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchCompanies();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === companies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(companies.map((c) => c.id));
    }
  };

  const runPipeline = async (step: "clean" | "research" | "validate") => {
    if (selectedIds.length === 0) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/pipeline/${step}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: selectedIds }),
      });
      
      if (!response.ok) throw new Error("Pipeline failed");
      
      await fetchCompanies();
      setSelectedIds([]);
    } catch (error) {
      console.error("Pipeline error:", error);
    }
    setIsProcessing(false);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Companies</h1>
          <p className="text-[var(--color-text-secondary)]">
            {totalCount.toLocaleString()} companies in database
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium rounded-xl transition-colors flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <form onSubmit={handleSearch} className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="w-full pl-10 pr-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="cleaning">Cleaning</option>
          <option value="researching">Researching</option>
          <option value="validating">Validating</option>
          <option value="validated">Validated</option>
          <option value="failed">Failed</option>
        </select>
        <button
          type="submit"
          className="px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium rounded-xl transition-colors flex items-center gap-2"
        >
          <Filter className="w-5 h-5" />
          Filter
        </button>
      </form>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="mb-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between">
          <span className="text-sm">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => runPipeline("clean")}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg text-sm font-medium hover:bg-blue-500/20 disabled:opacity-50"
            >
              <Play className="w-4 h-4 inline mr-1" />
              Clean
            </button>
            <button
              onClick={() => runPipeline("research")}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-orange-500/10 text-orange-500 rounded-lg text-sm font-medium hover:bg-orange-500/20 disabled:opacity-50"
            >
              <Play className="w-4 h-4 inline mr-1" />
              Research
            </button>
            <button
              onClick={() => runPipeline("validate")}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg text-sm font-medium hover:bg-green-500/20 disabled:opacity-50"
            >
              <Play className="w-4 h-4 inline mr-1" />
              Validate
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-12 text-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      ) : companies.length > 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === companies.length && companies.length > 0}
                    onChange={selectAll}
                    className="rounded"
                  />
                </th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Company</th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Domain</th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Country</th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Type</th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-elevated)]">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(company.id)}
                      onChange={() => toggleSelect(company.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-4">
                    <Link href={`/companies/${company.id}`} className="font-medium hover:text-[var(--color-accent)]">
                      {company.formatted_name || company.name || "Unknown"}
                    </Link>
                  </td>
                  <td className="p-4 text-[var(--color-text-secondary)]">
                    {company.domain || "-"}
                  </td>
                  <td className="p-4 text-[var(--color-text-secondary)]">
                    {company.country_name || company.country_code || "-"}
                  </td>
                  <td className="p-4">
                    {company.company_type ? (
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        company.company_type === "seller" 
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-purple-500/10 text-purple-500"
                      }`}>
                        {company.company_type}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={company.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Showing {page * ITEMS_PER_PAGE + 1}-{Math.min((page + 1) * ITEMS_PER_PAGE, totalCount)} of {totalCount}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-4 py-2 text-sm">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-12 text-center">
          <Building2 className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No companies found</h3>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {search || statusFilter ? "Try adjusting your filters" : "Import a CSV to add companies"}
          </p>
          {!search && !statusFilter && (
            <Link
              href="/imports/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium rounded-xl transition-colors"
            >
              Import CSV
            </Link>
          )}
        </div>
      )}
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
