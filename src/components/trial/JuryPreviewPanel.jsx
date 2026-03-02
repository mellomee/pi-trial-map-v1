/**
 * JuryPreviewPanel — attorney-side preview of what jury sees.
 * Shows current LiveState content in a compact panel.
 * Does NOT modify LiveState — read-only preview.
 */
import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Monitor, Eye, EyeOff, X } from "lucide-react";
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const COLOR_MAP = {
  yellow: "rgba(255,220,0,0.45)",
  red: "rgba(239,68,68,0.45)",
  green: "rgba(34,197,94,0.45)",
  blue: "rgba(59,130,246,0.45)",
};

export default function JuryPreviewPanel({ liveState, jointExhibits, admittedExhibits, extracts, onToggleHighlights, onClear }) {
  const [numPages, setNumPages] = useState(null);
  const admittedById = {};
  admittedExhibits.forEach(a => { admittedById[a.joint_exhibit_id] = a; });

  const je = liveState?.joint_exhibit_id ? jointExhibits.find(j => j.id === liveState.joint_exhibit_id) : null;
  const ext = liveState?.extract_id ? extracts.find(e => e.id === liveState.extract_id) : null;
  const fileUrl = ext?.extract_file_url || je?.file_url;
  const isPdf = fileUrl?.toLowerCase().includes(".pdf");
  const adm = je ? admittedById[je.id] : null;

  const mode = liveState?.mode || "blank";
  const page = liveState?.page || 1;

  return (
    <div className="flex flex-col h-full bg-[#050809] border border-[#1e2a45] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0f1e] border-b border-[#1e2a45] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Monitor className="w-3 h-3 text-green-400" />
          <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Jury Preview</span>
          <span className={`text-[9px] px-1.5 rounded ml-1 ${mode === "blank" ? "text-slate-500 bg-slate-800" : "text-green-400 bg-green-900/30"}`}>
            {mode.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {mode === "spotlight" && (
            <button onClick={onToggleHighlights}
              className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border transition-colors ${liveState?.highlights_visible ? "bg-yellow-500/20 text-yellow-300 border-yellow-600/40" : "text-slate-500 border-slate-700/40 hover:text-slate-300"}`}>
              {liveState?.highlights_visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
              Highlights
            </button>
          )}
          <button onClick={onClear} title="Clear jury screen"
            className="text-[9px] px-2 py-0.5 rounded border border-red-700/30 text-red-400 hover:bg-red-900/20 transition-colors">
            Clear
          </button>
        </div>
      </div>

      {/* Display */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-black">
        {mode === "blank" && (
          <div className="text-slate-700 text-center">
            <Monitor className="w-10 h-10 opacity-20 mx-auto mb-2" />
            <p className="text-xs opacity-30">Waiting…</p>
          </div>
        )}

        {mode === "exhibit" && fileUrl && isPdf && (
          <div className="overflow-auto w-full h-full flex justify-center">
            <Document file={fileUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
              <Page pageNumber={page} scale={0.5} renderTextLayer={false} renderAnnotationLayer={false} />
            </Document>
          </div>
        )}

        {mode === "exhibit" && fileUrl && !isPdf && (
          <img src={fileUrl} alt="" className="max-w-full max-h-full object-contain" />
        )}

        {mode === "spotlight" && liveState?.spotlight_image_url && (
          <div className="relative w-full h-full flex items-center justify-center p-2">
            <div className="relative">
              <img src={liveState.spotlight_image_url} alt="Spotlight" className="max-w-full max-h-full object-contain rounded" />
              {liveState.highlights_visible && (liveState.highlight_rects || []).map((r, i) => (
                <div key={i} style={{
                  position: "absolute",
                  left: `${r.x * 100}%`, top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`, height: `${r.h * 100}%`,
                  background: COLOR_MAP[r.color] || COLOR_MAP.yellow,
                  pointerEvents: "none",
                }} />
              ))}
            </div>
          </div>
        )}

        {liveState?.label && mode !== "blank" && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-slate-200 text-center py-1 px-2 truncate">
            {liveState.label}
          </div>
        )}
      </div>
    </div>
  );
}