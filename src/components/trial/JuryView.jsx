import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Monitor } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function JuryView({ sessionState, jointExhibits, admittedExhibits, extracts, onUpdateState }) {
  const [scale, setScale] = useState(1.0);
  const [numPages, setNumPages] = useState(null);

  const admittedById = useMemo(() => {
    const m = {};
    admittedExhibits.forEach(a => { m[a.joint_exhibit_id] = a; });
    return m;
  }, [admittedExhibits]);

  const selectedExhibit = jointExhibits.find(j => j.id === sessionState.jury_selected_joint_exhibit_id);
  const adm = selectedExhibit ? admittedById[selectedExhibit.id] : null;
  const currentPage = sessionState.jury_selected_page || 1;

  const ext = selectedExhibit?.exhibit_extract_id ? extracts.find(e => e.id === selectedExhibit.exhibit_extract_id) : null;
  const fileUrl = ext?.extract_file_url || selectedExhibit?.file_url;
  const isPdf = fileUrl?.toLowerCase().includes(".pdf");

  return (
    <div className="flex flex-col h-full bg-[#050809]">
      {/* Header: admitted number display */}
      {selectedExhibit && (
        <div className="px-3 py-2 border-b border-[#1e2a45] flex-shrink-0 bg-[#0a0f1e]">
          {adm ? (
            <div>
              <p className="text-sm font-black text-green-300 tracking-wide">
                Admitted Exhibit {adm.admitted_no}
              </p>
              <p className="text-[10px] text-slate-500">(Marked #{selectedExhibit.marked_no}) — {selectedExhibit.marked_title}</p>
            </div>
          ) : (
            <p className="text-sm font-bold text-cyan-300">#{selectedExhibit.marked_no} — {selectedExhibit.marked_title}</p>
          )}
          {/* Page controls */}
          {isPdf && (
            <div className="flex items-center gap-2 mt-1.5">
              <button onClick={() => onUpdateState({ jury_selected_page: Math.max(1, currentPage - 1) })} disabled={currentPage <= 1}
                className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="text-[10px] text-slate-400">{currentPage} / {numPages || "…"}</span>
              <button onClick={() => onUpdateState({ jury_selected_page: Math.min(numPages || currentPage, currentPage + 1) })} disabled={currentPage >= (numPages || 1)}
                className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
              <div className="w-px h-3 bg-[#1e2a45]" />
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-0.5 text-slate-500 hover:text-white"><ZoomOut className="w-3 h-3" /></button>
              <span className="text-[9px] text-slate-600">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-0.5 text-slate-500 hover:text-white"><ZoomIn className="w-3 h-3" /></button>
            </div>
          )}
        </div>
      )}

      {/* Document area */}
      <div className="flex-1 overflow-auto flex justify-center items-start p-2">
        {!selectedExhibit && (
          <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-3 w-full">
            <Monitor className="w-12 h-12 opacity-20" />
            <p className="text-xs">No exhibit selected</p>
          </div>
        )}
        {selectedExhibit && !fileUrl && (
          <p className="text-xs text-slate-600 mt-8">No file attached to this exhibit.</p>
        )}
        {fileUrl && isPdf && (
          <Document file={fileUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            className="shadow-2xl">
            <Page pageNumber={currentPage} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
          </Document>
        )}
        {fileUrl && !isPdf && (
          <img src={fileUrl} alt={selectedExhibit?.marked_title} className="max-w-full shadow-2xl" style={{ transform: `scale(${scale})`, transformOrigin: "top center" }} />
        )}
      </div>

      {/* Spotlight overlay */}
      {sessionState.spotlight_on && sessionState.jury_selected_callout_id && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
          <div className="max-w-lg max-h-[80vh] overflow-hidden rounded-xl border border-yellow-500/30 shadow-2xl bg-[#080d1a]">
            <div className="px-4 py-2 border-b border-[#1e2a45] flex items-center justify-between">
              <span className="text-xs text-yellow-400 font-semibold">✦ Spotlight</span>
            </div>
            <p className="p-6 text-center text-slate-300 text-sm">Callout spotlight active</p>
          </div>
        </div>
      )}
    </div>
  );
}