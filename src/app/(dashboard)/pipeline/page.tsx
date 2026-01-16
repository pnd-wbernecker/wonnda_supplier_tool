"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GitBranch, Sparkles, Search, CheckCircle2, FileText, Settings, Play, Loader2 } from "lucide-react";
import type { Prompt } from "@/types/database";
import Link from "next/link";

const pipelineSteps = [
  { id: "understand", name: "Understand", description: "Map CSV columns to target schema", icon: FileText, color: "blue" },
  { id: "clean", name: "Clean", description: "Format names, addresses, classify", icon: Sparkles, color: "purple" },
  { id: "research", name: "Research", description: "Fill missing data via web search", icon: Search, color: "orange" },
  { id: "validate", name: "Validate", description: "Check against column rules", icon: CheckCircle2, color: "green" },
];

export default function PipelinePage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [stats, setStats] = useState({ pending: 0, cleaning: 0, researching: 0, validating: 0, validated: 0, failed: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const [runningStep, setRunningStep] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [promptsRes, statsRes] = await Promise.all([
      supabase.from("prompts").select("*").eq("is_active", true),
      supabase.from("companies").select("status"),
    ]);

    if (promptsRes.data) setPrompts(promptsRes.data);
    
    if (statsRes.data) {
      const counts = { pending: 0, cleaning: 0, researching: 0, validating: 0, validated: 0, failed: 0 };
      statsRes.data.forEach((c) => {
        if (c.status in counts) counts[c.status as keyof typeof counts]++;
      });
      setStats(counts);
    }
  };

  const runPipelineStep = async (step: string) => {
    setIsRunning(true);
    setRunningStep(step);

    try {
      // Get companies at the right status for this step
      const statusMap: Record<string, string> = {
        clean: "pending",
        research: "cleaning", // After cleaning, status is "researching"
        validate: "researching", // After research, status is "validating"
      };

      const { data: companies } = await supabase
        .from("companies")
        .select("id")
        .eq("status", statusMap[step] || "pending")
        .limit(50);

      if (companies && companies.length > 0) {
        await fetch(`/api/pipeline/${step}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyIds: companies.map((c) => c.id) }),
        });
      }

      await loadData();
    } catch (error) {
      console.error("Pipeline error:", error);
    }

    setIsRunning(false);
    setRunningStep(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pipeline</h1>
        <p className="text-[var(--color-text-secondary)]">
          Run and monitor your data processing pipeline
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-6 gap-4 mb-8">
        {Object.entries(stats).map(([status, count]) => (
          <div key={status} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 text-center">
            <span className="text-2xl font-bold">{count}</span>
            <p className="text-sm text-[var(--color-text-secondary)] capitalize">{status}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Steps */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 mb-8">
        <h2 className="font-semibold mb-6">Pipeline Steps</h2>
        <div className="grid grid-cols-4 gap-4">
          {pipelineSteps.map((step, index) => {
            const isRunnable = step.id !== "understand"; // Understand is done during import
            const isCurrentlyRunning = runningStep === step.id;
            
            return (
              <div
                key={step.id}
                className="p-4 bg-[var(--color-surface-elevated)] rounded-xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-${step.color}-500/10 flex items-center justify-center`}>
                    <step.icon className={`w-5 h-5 text-${step.color}-500`} />
                  </div>
                  <div>
                    <h3 className="font-medium">{step.name}</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">{step.description}</p>
                  </div>
                </div>
                
                {isRunnable && (
                  <button
                    onClick={() => runPipelineStep(step.id)}
                    disabled={isRunning}
                    className={`w-full mt-2 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                      isCurrentlyRunning
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
                    } disabled:opacity-50`}
                  >
                    {isCurrentlyRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Run Step
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Prompts */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[var(--color-text-muted)]" />
            <h2 className="font-semibold">Active Prompts</h2>
          </div>
          <Link
            href="/pipeline/prompts"
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            Edit Prompts →
          </Link>
        </div>

        <div className="space-y-4">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="p-4 bg-[var(--color-surface-elevated)] rounded-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{prompt.name}</span>
                <span className="px-2 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-lg text-xs font-medium">
                  {prompt.step}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 font-mono">
                {prompt.template.substring(0, 150)}...
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
