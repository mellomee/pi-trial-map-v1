import React from "react";
import { createPageUrl } from "@/utils";
import { AlertTriangle, ArrowRight } from "lucide-react";

export default function LegacyBanner({ pageName }) {
  return (
    <div className="bg-amber-950/40 border-b border-amber-700/40 px-4 py-2 flex items-center gap-3 flex-wrap">
      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
      <span className="text-xs text-amber-300 font-medium">
        This is a legacy page. Use <strong>Trial Mode</strong> instead.
      </span>
      <a
        href={createPageUrl("TrialMode")}
        className="ml-auto flex items-center gap-1 text-xs text-amber-400 hover:text-amber-200 border border-amber-700/50 rounded px-2 py-0.5 hover:bg-amber-500/10 transition-colors"
      >
        Go to Trial Mode <ArrowRight className="w-3 h-3" />
      </a>
    </div>
  );
}