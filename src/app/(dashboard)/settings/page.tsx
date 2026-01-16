import { Settings, Key, FileText, User } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-[var(--color-text-secondary)]">
          Configure your application settings
        </p>
      </div>

      <div className="grid gap-6">
        {/* API Keys */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-[var(--color-text-muted)]" />
            <h2 className="font-semibold">API Keys</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">OpenAI API Key</label>
              <input
                type="password"
                value="sk-proj-***************"
                disabled
                className="w-full px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Configured via environment variable
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Perplexity API Key</label>
              <input
                type="password"
                value="pplx-***************"
                disabled
                className="w-full px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Configured via environment variable
              </p>
            </div>
          </div>
        </div>

        {/* Export Templates */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-[var(--color-text-muted)]" />
            <h2 className="font-semibold">Export Settings</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Default Export Format</label>
              <select className="w-full px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl">
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="xlsx">Excel (XLSX)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Include Fields</label>
              <p className="text-sm text-[var(--color-text-secondary)]">
                All validated fields will be included in exports
              </p>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-[var(--color-text-muted)]" />
            <h2 className="font-semibold">Account</h2>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            Manage your account settings in Supabase Dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
