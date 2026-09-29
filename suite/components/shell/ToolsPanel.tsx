"use client";

import { Plus, X } from "lucide-react";
import { useTrousseauStore } from "@/lib/store/useTrousseauStore";
import { shownTools, withTool } from "@/lib/model/toolbox";
import { TOOLS, type Tool } from "@/lib/tools";
import { Button } from "@/components/ui/controls";
import { SlideOver } from "@/components/ui/SlideOver";

/**
 * The tools this wedding uses, each with what it is for, and Add or Remove.
 *
 * The choice is kept in the wedding, so whoever it is planned with sees the
 * same tools. Removing one hides it and nothing more: what was made in it is
 * kept, and is there again when it is added back. Either is one step on the
 * wedding's history.
 */
export function ToolsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shown = useTrousseauStore((s) => shownTools(s.doc));
  // The store refuses a write before the wedding is read; say so by being off.
  const ready = useTrousseauStore((s) => s.status === "ready");
  const setSlice = useTrousseauStore((s) => s.setSlice);

  const choose = (tool: Tool, show: boolean) =>
    setSlice("tools", withTool(useTrousseauStore.getState().raw, tool.id, show), {
      label: `${show ? "adding" : "removing"} ${tool.name}`,
    });

  return (
    <SlideOver open={open} onClose={onClose} labelledBy="tools-title">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-4">
          <h2 id="tools-title" className="font-display text-2xl text-charcoal">
            Tools
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1.5 text-slate hover:bg-stone hover:text-charcoal">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p className="text-sm text-slate">The tools this wedding uses. Whoever you plan it with sees the same ones.</p>
          <ul className="mt-4 space-y-3">
            {TOOLS.map((tool) => {
              const on = shown.includes(tool);
              return (
                <li key={tool.id} className={`${tool.tokens} flex items-center gap-3 rounded border border-charcoal/10 bg-stone/40 p-3`}>
                  <tool.icon size={18} aria-hidden className="shrink-0 text-[var(--accent-bright)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-charcoal">{tool.name}</p>
                    <p className="text-xs text-slate">{tool.tagline}</p>
                  </div>
                  {on ? (
                    <Button onClick={() => choose(tool, false)} disabled={!ready}>
                      Remove<span className="sr-only"> {tool.name}</span>
                    </Button>
                  ) : (
                    <Button tone="primary" icon={Plus} onClick={() => choose(tool, true)} disabled={!ready}>
                      Add<span className="sr-only"> {tool.name}</span>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-slate">
            Removing a tool only hides it. Everything made in it is kept, and is there again when you add it back.
          </p>
        </div>
      </div>
    </SlideOver>
  );
}
