import React, { useEffect } from "react";
import { X, Highlighter } from "lucide-react";

const COLOR_CSS = {
  yellow: "rgba(255,220,0,0.42)",
  red:    "rgba(239,68,68,0.40)",
  green:  "rgba(34,197,94,0.40)",
  blue:   "rgba(59,130,246,0.40)",
};

/**
 * Full-screen callout overlay for Present page.
 * Shows baked callout snapshot + optional highlight rects drawn on top.
 *
 * Props:
 *   callout       – ExhibitCallouts record
 *   highlights    – ExhibitAnnotations[] that belong to this callout (filtered jury_safe already)
 *   showHighlights – boolean
 *   onToggleHighlights – callback
 *   onClose
 */
export default function CalloutOverlay({ callout, highlights = [], showHighlights = true, onToggleHighlights, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!callout) return null;

  const imageUrl = callout.callout_image || callout.snapshot_image_url;
  const activeHighlights = showHighlights ? highlights : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full mx-6 flex flex-col items-center gap-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <div>
            <p className="text-[10px] text-yellow-400/80 uppercase tracking-widest font-semibold">Callout Clip</p>
            <p className="text-base font-semibold text-white mt-0.5">{callout.label || `Page ${callout.page_number}`}</p>
          </div>
          <div className="flex items-center gap-2">
            {highlights.length > 0 && onToggleHighlights && (
              <button
                onClick={onToggleHighlights}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                  showHighlights
                    ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                    : "text-slate-500 border-slate-600 hover:text-slate-300"
                }`}
              >
                <Highlighter className="w-3 h-3" />
                Highlights {showHighlights ? "ON" : "OFF"}
              </button>
            )}
            <button onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Callout image + highlights overlay */}
        <div className="relative rounded-xl overflow-hidden border-2 border-yellow-400/40 shadow-2xl w-full bg-[#050809]"
          style={{ boxShadow: "0 0 0 2px rgba(251,191,36,0.3), 0 20px 80px rgba(0,0,0,0.9)" }}>
          <img
            src={imageUrl}
            alt={callout.label || "Callout"}
            className="w-full object-contain block"
            style={{ maxHeight: "72vh" }}
            draggable={false}
          />
          {/* Highlight rects rendered as % positions over the image */}
          {activeHighlights.map((ann, i) => {
            const rn = ann.rect_norm;
            if (!rn) return null;
            const color = ann.color || "yellow";
            return (
              <div
                key={ann.id || i}
                style={{
                  position: "absolute",
                  left:   `${rn.x * 100}%`,
                  top:    `${rn.y * 100}%`,
                  width:  `${rn.w * 100}%`,
                  height: `${rn.h * 100}%`,
                  background: COLOR_CSS[color] || COLOR_CSS.yellow,
                  borderRadius: "2px",
                  pointerEvents: "none",
                }}
              />
            );
          })}
        </div>

        {highlights.length > 0 && (
          <p className="text-[10px] text-slate-500">
            {activeHighlights.length} highlight{activeHighlights.length !== 1 ? "s" : ""} shown · Press ESC or click outside to close
          </p>
        )}
        {highlights.length === 0 && (
          <p className="text-[10px] text-slate-500">Press ESC or click outside to close</p>
        )}
      </div>
    </div>
  );
}