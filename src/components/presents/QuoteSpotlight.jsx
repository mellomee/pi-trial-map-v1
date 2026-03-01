import React from "react";

/**
 * QuoteSpotlight
 * Renders a full-overlay "spotlight" card showing the annotation's quote text.
 * No rectangle coordinates needed — always correct.
 *
 * Props:
 *   annotation    – ExhibitAnnotations object
 *   exhibitNo     – admitted/marked number string
 *   onClose       – called when user dismisses
 *   visible       – boolean
 */
/**
 * mode: "only" — show quote card only (default, fast, always works)
 *       "locate" — show quote card + show anchor_text hint (for scanned doc fallback info)
 */
export default function QuoteSpotlight({ annotation, exhibitNo, onClose, visible, mode = "only" }) {
  if (!visible || !annotation) return null;

  const pg = annotation.page_number ?? annotation.extract_page_number ?? "?";
  const quote = annotation.quote_text || annotation.highlight_text || annotation.label_text || "";
  const anchor = annotation.anchor_text || "";

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.78)" }}
      onClick={onClose}
    >
      {/* Callout card */}
      <div
        className="relative max-w-2xl w-full mx-8 bg-[#0f1629] border border-yellow-400/40 rounded-2xl shadow-2xl px-10 py-8"
        style={{ boxShadow: "0 0 0 2px rgba(251,191,36,0.3), 0 20px 80px rgba(0,0,0,0.9)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header label */}
        <p className="text-[11px] font-semibold text-yellow-400/70 uppercase tracking-widest mb-4">
          {exhibitNo ? `Exhibit ${exhibitNo}` : "Exhibit"} · p.{pg}
        </p>

        {/* Quote */}
        <blockquote
          className="text-xl font-medium text-white leading-relaxed"
          style={{ fontFamily: "Georgia, serif" }}
        >
          "{quote}"
        </blockquote>

        {/* Label / note */}
        {annotation.label_text && annotation.label_text !== quote && (
          <p className="mt-4 text-sm text-slate-400 italic">{annotation.label_text}</p>
        )}

        {/* Locate hint (mode=locate only) */}
        {mode === "locate" && anchor && anchor !== quote && (
          <div className="mt-4 border-t border-[#1e2a45] pt-3">
            <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">Anchor context (p.{pg})</p>
            <p className="text-[11px] text-slate-500 italic leading-relaxed line-clamp-3">"{anchor}"</p>
          </div>
        )}

        {/* Dismiss hint */}
        <p className="mt-6 text-[10px] text-slate-600 text-right">Click anywhere to dismiss</p>
      </div>
    </div>
  );
}