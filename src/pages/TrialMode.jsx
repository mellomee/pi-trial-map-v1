import React from "react";
import { createPageUrl } from "@/utils";
import { Play, ExternalLink } from "lucide-react";

/**
 * TrialMode — placeholder home for the unified live-trial experience.
 * Batch 2 will build out the full UI here. For now it explains the concept
 * and links to the parts that are still functional.
 */
export default function TrialMode() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200 p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Play className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Trial Mode</h1>
            <p className="text-sm text-slate-500">Unified live-trial command center (coming in Batch 2)</p>
          </div>
        </div>

        {/* Status card */}
        <div className="bg-cyan-950/30 border border-cyan-700/40 rounded-xl p-5 space-y-2">
          <p className="text-sm font-semibold text-cyan-300">What Trial Mode will include:</p>
          <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>Live witness exam with Evidence Groups driving the flow</li>
            <li>Attorney view: questions, proof, callouts, battle cards</li>
            <li>Jury display: admitted exhibits + spotlight/highlights</li>
            <li>Session state sync (attorney ↔ jury screen)</li>
            <li>Admit workflow + ExhibitNumberHistory logging</li>
          </ul>
        </div>

        {/* Legacy links */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Legacy pages (still functional)</p>

          {[
            { label: "Trial Runner (legacy)", page: "TrialRunner", desc: "Question-by-question live exam" },
            { label: "Present (legacy)", page: "Present", desc: "Exhibit display with callout spotlight" },
            { label: "Runner (legacy)", page: "Runner", desc: "Simplified question runner" },
            { label: "Battle Cards (legacy)", page: "BattleCards", desc: "Tactical impeachment cards" },
          ].map(item => (
            <a
              key={item.page}
              href={createPageUrl(item.page)}
              className="flex items-center justify-between p-3 bg-[#131a2e] border border-[#1e2a45] rounded-lg hover:border-slate-500 transition-colors group"
            >
              <div>
                <p className="text-sm text-slate-300 group-hover:text-white">{item.label}</p>
                <p className="text-xs text-slate-600">{item.desc}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
            </a>
          ))}
        </div>

      </div>
    </div>
  );
}