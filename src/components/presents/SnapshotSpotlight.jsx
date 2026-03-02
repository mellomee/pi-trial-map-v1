import React, { useRef } from "react";
import { X } from "lucide-react";

/**
 * SnapshotSpotlight
 * Full-screen overlay for Present page. Displays annotation snapshot (no drift).
 * If annotation.text_highlights exist and mode != 'none', draws marker highlights on top.
 *
 * Props:
 *   annotation – ExhibitAnnotations record
 *   exhibitNo  – display string
 *   onClose    – callback
 *   visible    – boolean
 */
const COLOR_CSS = {
  yellow: "rgba(255,220,0,0.38)",
  red:    "rgba(239,68,68,0.35)",
  green:  "rgba(34,197,94,0.35)",
  blue:   "rgba(59,130,246,0.35)",
};

export default function SnapshotSpotlight({ annotation, exhibitNo, onClose, visible }) {
  const imgContainerRef = useRef(null);

  if (!visible || !annotation) return null;

  const pg = annotation.page_number ?? annotation.extract_page_number ?? "?";
  const label = annotation.label_text || annotation.label || "";
  const quote = annotation.show_quote_in_present !== false ? (annotation.quote_text || "") : "";
  const hasSnapshot = !!annotation.snapshot_file;
  const highlights = (annotation.text_highlights_mode !== "none" && annotation.text_highlights?.length)
    ? annotation.text_highlights
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full mx-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-yellow-400/80 uppercase tracking-widest font-semibold">
              {exhibitNo ? `Admitted Exhibit ${exhibitNo}` : "Exhibit"} · p.{pg}
            </p>
            {label && <p className="text-base font-semibold text-white mt-0.5">{label}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Snapshot image with optional text highlight overlay */}
        {hasSnapshot ? (
          <div
            ref={imgContainerRef}
            className="relative rounded-xl overflow-hidden border-2 border-yellow-400/40 shadow-2xl bg-[#050809]"
            style={{ boxShadow: "0 0 0 2px rgba(251,191,36,0.3), 0 20px 80px rgba(0,0,0,0.9)" }}
          >
            <img
              src={annotation.snapshot_file}
              alt={label || "Annotation snapshot"}
              className="w-full object-contain block"
              style={{ maxHeight: "60vh" }}
              draggable={false}
            />
            {/* Text highlight rects — normalized 0-1 over the image */}
            {highlights.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {highlights.map((rect, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left:   `${rect.x * 100}%`,
                      top:    `${rect.y * 100}%`,
                      width:  `${rect.w * 100}%`,
                      height: `${rect.h * 100}%`,
                      background: rect.color
                        ? COLOR_CSS[rect.color] || COLOR_CSS.yellow
                        : (COLOR_CSS[annotation.color] || COLOR_CSS.yellow),
                      opacity: rect.opacity ?? 1,
                      borderRadius: "2px",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Fallback: text-only card when no snapshot */
          <div
            className="bg-[#0f1629] border border-yellow-400/40 rounded-2xl shadow-2xl px-10 py-8"
            style={{ boxShadow: "0 0 0 2px rgba(251,191,36,0.3), 0 20px 80px rgba(0,0,0,0.9)" }}
          >
            <blockquote className="text-xl font-medium text-white leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
              {quote ? `"${quote}"` : <span className="text-slate-500 italic">No snapshot or quote available.</span>}
            </blockquote>
            {label && quote && label !== quote && (
              <p className="mt-4 text-sm text-slate-400 italic">{label}</p>
            )}
          </div>
        )}

        {/* Quote text below image */}
        {quote && (
          <div className="bg-[#0f1629]/80 border border-yellow-500/20 rounded-xl px-6 py-3">
            <blockquote className="text-base font-medium text-white leading-relaxed text-center" style={{ fontFamily: "Georgia, serif" }}>
              "{quote}"
            </blockquote>
          </div>
        )}

        <p className="text-[10px] text-slate-500 text-center">Press ESC or click outside to dismiss</p>
      </div>
    </div>
  );
}