"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, Plus, AlertCircle, Trash2, Edit2, X, Save } from "lucide-react";
import type { ColumnRule } from "@/types/database";

const RULE_TYPES = [
  { value: "required", label: "Required", description: "Field must not be empty" },
  { value: "format", label: "Format", description: "Must match regex pattern" },
  { value: "enum", label: "Enum", description: "Must be one of allowed values" },
  { value: "min_length", label: "Min Length", description: "Minimum text length" },
  { value: "max_length", label: "Max Length", description: "Maximum text length" },
  { value: "custom", label: "Custom", description: "Custom LLM validation" },
];

const TARGET_COLUMNS = [
  "name", "formatted_name", "website", "domain", "email", "phone",
  "address", "formatted_address", "country_code", "country_name",
  "description", "enriched_description", "company_type",
  "categories", "tags", "certifications", "production_types",
];

export default function RulesPage() {
  const [rules, setRules] = useState<ColumnRule[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ColumnRule | null>(null);
  const [formData, setFormData] = useState({
    column_name: "",
    rule_type: "required" as ColumnRule["rule_type"],
    rule_config: {} as Record<string, unknown>,
    error_message: "",
  });
  
  const supabase = createClient();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const { data } = await supabase
      .from("column_rules")
      .select("*")
      .order("column_name");
    
    if (data) setRules(data);
  };

  const openModal = (rule?: ColumnRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        column_name: rule.column_name,
        rule_type: rule.rule_type,
        rule_config: rule.rule_config as Record<string, unknown>,
        error_message: rule.error_message || "",
      });
    } else {
      setEditingRule(null);
      setFormData({
        column_name: "",
        rule_type: "required",
        rule_config: {},
        error_message: "",
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const saveRule = async () => {
    const ruleData = {
      column_name: formData.column_name,
      rule_type: formData.rule_type,
      rule_config: formData.rule_config,
      error_message: formData.error_message || null,
      is_active: true,
    };

    if (editingRule) {
      await supabase
        .from("column_rules")
        .update(ruleData)
        .eq("id", editingRule.id);
    } else {
      await supabase.from("column_rules").insert(ruleData);
    }

    closeModal();
    loadRules();
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    
    await supabase.from("column_rules").delete().eq("id", id);
    loadRules();
  };

  const toggleActive = async (rule: ColumnRule) => {
    await supabase
      .from("column_rules")
      .update({ is_active: !rule.is_active })
      .eq("id", rule.id);
    loadRules();
  };

  const updateConfig = (key: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      rule_config: { ...prev.rule_config, [key]: value },
    }));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Rules</h1>
          <p className="text-[var(--color-text-secondary)]">
            Define validation rules for each column
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium rounded-xl transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Rule
        </button>
      </div>

      {/* Rules List */}
      {rules.length > 0 ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Column</th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Rule Type</th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Config</th>
                <th className="text-left p-4 text-[var(--color-text-secondary)] font-medium">Status</th>
                <th className="text-right p-4 text-[var(--color-text-secondary)] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-elevated)]">
                  <td className="p-4 font-medium font-mono text-sm">{rule.column_name}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-lg text-xs font-medium">
                      {rule.rule_type}
                    </span>
                  </td>
                  <td className="p-4 text-[var(--color-text-secondary)] font-mono text-sm">
                    {JSON.stringify(rule.rule_config).substring(0, 40)}
                    {JSON.stringify(rule.rule_config).length > 40 ? "..." : ""}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        rule.is_active 
                          ? "bg-green-500/10 text-green-500"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {rule.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openModal(rule)}
                        className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg"
                      >
                        <Edit2 className="w-4 h-4 text-[var(--color-text-muted)]" />
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-12 text-center">
          <Shield className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No rules defined</h3>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Add validation rules to ensure data quality
          </p>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add First Rule
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-[var(--color-info)]/10 border border-[var(--color-info)]/20 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[var(--color-info)] mt-0.5" />
        <div>
          <h4 className="font-medium text-[var(--color-info)] mb-1">Rule Types</h4>
          <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
            {RULE_TYPES.map((type) => (
              <li key={type.value}>
                <strong>{type.label}</strong> - {type.description}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="font-semibold text-lg">
                {editingRule ? "Edit Rule" : "Add Rule"}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Column</label>
                <select
                  value={formData.column_name}
                  onChange={(e) => setFormData({ ...formData, column_name: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl"
                >
                  <option value="">Select column...</option>
                  {TARGET_COLUMNS.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Rule Type</label>
                <select
                  value={formData.rule_type}
                  onChange={(e) => setFormData({ ...formData, rule_type: e.target.value as ColumnRule["rule_type"], rule_config: {} })}
                  className="w-full px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl"
                >
                  {RULE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Config fields based on rule type */}
              {formData.rule_type === "format" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Regex Pattern</label>
                  <input
                    type="text"
                    value={(formData.rule_config.pattern as string) || ""}
                    onChange={(e) => updateConfig("pattern", e.target.value)}
                    placeholder="e.g. ^[A-Z].*"
                    className="w-full px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl font-mono text-sm"
                  />
                </div>
              )}

              {formData.rule_type === "enum" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Allowed Values (comma-separated)</label>
                  <input
                    type="text"
                    value={((formData.rule_config.values as string[]) || []).join(", ")}
                    onChange={(e) => updateConfig("values", e.target.value.split(",").map((s) => s.trim()))}
                    placeholder="e.g. seller, buyer"
                    className="w-full px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl"
                  />
                </div>
              )}

              {formData.rule_type === "min_length" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Minimum Length</label>
                  <input
                    type="number"
                    value={(formData.rule_config.min as number) || ""}
                    onChange={(e) => updateConfig("min", parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl"
                  />
                </div>
              )}

              {formData.rule_type === "max_length" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Maximum Length</label>
                  <input
                    type="number"
                    value={(formData.rule_config.max as number) || ""}
                    onChange={(e) => updateConfig("max", parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl"
                  />
                </div>
              )}

              {formData.rule_type === "custom" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Custom Validation Prompt</label>
                  <textarea
                    value={(formData.rule_config.prompt as string) || ""}
                    onChange={(e) => updateConfig("prompt", e.target.value)}
                    placeholder="Describe what makes this field valid..."
                    className="w-full px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl h-24 resize-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Error Message (optional)</label>
                <input
                  type="text"
                  value={formData.error_message}
                  onChange={(e) => setFormData({ ...formData, error_message: e.target.value })}
                  placeholder="Custom error message when validation fails"
                  className="w-full px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl"
                />
              </div>
            </div>

            <div className="p-6 border-t border-[var(--color-border)] flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={saveRule}
                disabled={!formData.column_name}
                className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
