'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Download, Trash2, RefreshCw, Filter } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  formatted_name: string | null;
  domain: string | null;
  email: string | null;
  company_type: string | null;
  status: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('company_type', typeFilter);
      
      const res = await fetch(`/api/companies?${params}`);
      const data = await res.json();
      
      setCompanies(data.companies || []);
      setPagination(data.pagination || pagination);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(p => ({ ...p, page: 1 }));
    fetchCompanies();
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const res = await fetch('/api/companies/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          filters: {
            status: statusFilter || undefined,
            company_type: typeFilter || undefined,
          },
        }),
      });
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `companies.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} companies?`)) return;
    
    try {
      const ids = Array.from(selected).join(',');
      await fetch(`/api/companies?ids=${ids}`, { method: 'DELETE' });
      setSelected(new Set());
      fetchCompanies();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === companies.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(companies.map(c => c.id)));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400';
      case 'cleaned': return 'bg-blue-500/20 text-blue-400';
      case 'researched': return 'bg-purple-500/20 text-purple-400';
      case 'validated': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-gray-400 mt-1">
            {pagination.total} companies total
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            <Download size={18} />
            Export CSV
          </button>
          
          {selected.size > 0 && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
            >
              <Trash2 size={18} />
              Delete ({selected.size})
            </button>
          )}
          
          <Link
            href="/imports/new"
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg transition"
          >
            Import New
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <form onSubmit={handleSearch} className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-violet-500"
            />
          </div>
        </form>
        
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-violet-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="cleaned">Cleaned</option>
            <option value="researched">Researched</option>
            <option value="validated">Validated</option>
          </select>
          
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-violet-500"
          >
            <option value="">All Types</option>
            <option value="seller">Seller</option>
            <option value="buyer">Buyer</option>
          </select>
          
          <button
            onClick={fetchCompanies}
            className="p-2 hover:bg-gray-700 rounded-lg transition"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        {loading && companies.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : companies.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 mb-4">No companies found</p>
            <Link
              href="/imports/new"
              className="text-violet-400 hover:text-violet-300"
            >
              Import your first CSV →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="p-4 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === companies.length}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Name</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Domain</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Email</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Type</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Status</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-400">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    className="hover:bg-gray-700/30 transition cursor-pointer"
                    onClick={() => window.location.href = `/companies/${company.id}`}
                  >
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(company.id)}
                        onChange={() => toggleSelect(company.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{company.formatted_name || company.name}</div>
                      {company.formatted_name && company.formatted_name !== company.name && (
                        <div className="text-sm text-gray-500">{company.name}</div>
                      )}
                    </td>
                    <td className="p-4 text-gray-300">{company.domain || '-'}</td>
                    <td className="p-4 text-gray-300">{company.email || '-'}</td>
                    <td className="p-4">
                      {company.company_type && (
                        <span className={`px-2 py-1 rounded text-xs ${
                          company.company_type === 'seller' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {company.company_type}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(company.status)}`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 text-sm">
                      {new Date(company.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
