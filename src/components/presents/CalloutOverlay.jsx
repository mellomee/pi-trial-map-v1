import React, { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Full-screen callout overlay for Present page.
 * Shows the full PDF page dimmed behind, callout image enlarged on top.
 */
export default function CalloutOverlay({ callout, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!callout) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)" }}
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full mx-6 flex flex-col items-center gap-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <div>
            <p className="text-[10px] text-orange-400/80 uppercase tracking-widest font-semibold">Callout Clip</p>
            <p className="text-base font-semibold text-white mt-0.5">{callout.label || `Page ${callout.page_number}`}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Callout image */}
        <div className="rounded-xl overflow-hidden border-2 border-orange-400/40 shadow-2xl w-full bg-[#050809]">
          <img
            src={callout.callout_image}
            alt={callout.label || "Callout"}
            className="w-full object-contain"
            style={{ maxHeight: "72vh" }}
          />
        </div>

        <p className="text-[10px] text-slate-500">Press ESC or click outside to close</p>
      </div>
    </div>
  );
}