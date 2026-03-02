import React, { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

const STEPS = [
  "1. Build Trial Points hierarchy (global)",
  "2. Create Evidence Groups → attach proof (callouts, exhibits, depo clips)",
  "3. Add groups to Witness Plans",
  "4. Generate / adjust questions per witness",
  "5. Live Trial Mode: ask questions → Proof Drawer → admit exhibits → push to jury",
];

export default function WorkflowBanner() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#0f1629] border-b border-[#1e2a45] px-4 py-2">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-slate-200">
        <Info className="w-3.5 h-3.5 text-cyan-500" />
        <span className="font-medium text-cyan-400">Quick Workflow Guide</span>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {open && (
        <ol className="mt-2 space-y-0.5 pl-4">
          {STEPS.map((s, i) => (
            <li key={i} className="text-[11px] text-slate-400">{s}</li>
          ))}
        </ol>
      )}
    </div>
  );
}