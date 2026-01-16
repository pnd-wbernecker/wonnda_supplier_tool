// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Prompt } from "@/types/database";

export default function PromptsEditorPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [editedTemplate, setEditedTemplate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    const { data } = await supabase
      .from("prompts")
      .select("*")
      .order("step") as unknown as { data: Prompt[] | null };
    
    if (data) {
      setPrompts(data);
      if (data.length > 0 && !selectedPrompt) {
        setSelectedPrompt(data[0]);
        setEditedTemplate(data[0].template);
      }
    }
  };

  const selectPrompt = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setEditedTemplate(prompt.template);
  };

  const savePrompt = async () => {
    if (!selectedPrompt) return;
    
    setIsSaving(true);
    
    const { error } = await supabase
      .from("prompts")
      .update({ template: editedTemplate })
      .eq("id", selectedPrompt.id);

    if (!error) {
      setPrompts((prev) =>
        prev.map((p) =>
          p.id === selectedPrompt.id ? { ...p, template: editedTemplate } : p
        )
      );
      setSelectedPrompt({ ...selectedPrompt, template: editedTemplate });
    }
    
    setIsSaving(false);
  };

  const toggleActive = async (prompt: Prompt) => {
    const { error } = await supabase
      .from("prompts")
      .update({ is_active: !prompt.is_active })
      .eq("id", prompt.id);

    if (!error) {
      loadPrompts();
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/pipeline"
          className="inline-flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Pipeline
        </Link>
        <h1 className="text-3xl font-bold mb-2">Prompts Editor</h1>
        <p className="text-[var(--color-text-secondary)]">
          Edit the prompts used in each pipeline step
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Prompt List */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
          <h2 className="font-semibold mb-4">Prompts</h2>
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => selectPrompt(prompt)}
                className={`w-full p-3 rounded-xl text-left transition-colors ${
                  selectedPrompt?.id === prompt.id
                    ? "bg-[var(--color-accent)]/10 border border-[var(--color-accent)]"
                    : "bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-elevated)]/80"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{prompt.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    prompt.is_active
                      ? "bg-green-500/10 text-green-500"
                      : "bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]"
                  }`}>
                    {prompt.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">{prompt.step}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="col-span-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
          {selectedPrompt ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold">{selectedPrompt.name}</h2>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    Step: {selectedPrompt.step}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(selectedPrompt)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      selectedPrompt.is_active
                        ? "bg-green-500/10 text-green-500"
                        : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {selectedPrompt.is_active ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={savePrompt}
                    disabled={isSaving || editedTemplate === selectedPrompt.template}
                    className="px-4 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                </div>
              </div>
              
              <textarea
                value={editedTemplate}
                onChange={(e) => setEditedTemplate(e.target.value)}
                className="w-full h-[500px] p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl font-mono text-sm focus:outline-none focus:border-[var(--color-accent)] resize-none"
                placeholder="Enter prompt template..."
              />
              
              <div className="mt-4 p-4 bg-[var(--color-surface-elevated)] rounded-xl">
                <h3 className="text-sm font-medium mb-2">Available Variables</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedPrompt.step === "clean" && (
                    <code className="px-2 py-1 bg-[var(--color-surface)] rounded text-xs">{"{companies}"}</code>
                  )}
                  {selectedPrompt.step === "research_address" && (
                    <>
                      <code className="px-2 py-1 bg-[var(--color-surface)] rounded text-xs">{"{company_name}"}</code>
                      <code className="px-2 py-1 bg-[var(--color-surface)] rounded text-xs">{"{domain}"}</code>
                      <code className="px-2 py-1 bg-[var(--color-surface)] rounded text-xs">{"{country}"}</code>
                    </>
                  )}
                  {selectedPrompt.step === "research_description" && (
                    <>
                      <code className="px-2 py-1 bg-[var(--color-surface)] rounded text-xs">{"{company_name}"}</code>
                      <code className="px-2 py-1 bg-[var(--color-surface)] rounded text-xs">{"{domain}"}</code>
                    </>
                  )}
                  {selectedPrompt.step === "validate" && (
                    <code className="px-2 py-1 bg-[var(--color-surface)] rounded text-xs">{"{company_data}"}</code>
                  )}
                  {selectedPrompt.step === "understand" && (
                    <code className="px-2 py-1 bg-[var(--color-surface)] rounded text-xs">{"{csv_headers}"}</code>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
              Select a prompt to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
