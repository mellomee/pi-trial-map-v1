import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { pdfjs } from "react-pdf";
import {
  ChevronLeft, ChevronRight, Search, Eye, EyeOff, ZoomIn, ZoomOut,
  Maximize2, Minimize2, Printer, PanelLeftClose, PanelLeftOpen, CheckCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuoteSpotlight from "@/components/presents/QuoteSpotlight";



pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

function isPdf(url) { return url?.toLowerCase().includes(".pdf"); }
function isImage(url) { return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url || ""); }

// ── Simple PDF viewer (no annotation overlay needed — text-based now) ────────
function PdfViewer({ fileUrl, currentPage, scale, onNumPages }) {
  const canvasRef = React.useRef(null);
  const [pdfDoc, setPdfDoc] = React.useState(null);

  React.useEffect(() => {
    if (!fileUrl) return;
    if (fileUrl.toLowerCase().includes(".pdf")) {
      pdfjs.getDocument(fileUrl).promise.then(doc => {
        setPdfDoc(doc);
        if (onNumPages) onNumPages(doc.numPages);
      });
    }
  }, [fileUrl]);

  React.useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    pdfDoc.getPage(currentPage).then(page => {
      const vp = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = vp.width;
      canvas.height = vp.height;
      page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
    });
  }, [pdfDoc, currentPage, scale]);

  const isImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(fileUrl || "");
  if (isImage) {
    return <img src={fileUrl} alt="Exhibit" style={{ transform: `scale(${scale})`, transformOrigin: "top left", display: "block", maxWidth: "100%" }} draggable={false} />;
  }
  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}

// ── Present page ─────────────────────────────────────────────────────────────
export default function Present() {
  const { activeCase } = useActiveCase();
  const urlParams = new URLSearchParams(window.location.search);
  const initExhibitId = urlParams.get("exhibit_id") || null;
  const initAnnotationId = urlParams.get("annotation_id") || null;

  const [admittedExhibits, setAdmittedExhibits] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);

  const [selectedExhibitId, setSelectedExhibitId] = useState(initExhibitId);
  const [activeAnnotationId, setActiveAnnotationId] = useState(initAnnotationId);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.2);

  const [panelOpen, setPanelOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Spotlight state
  const [spotlightOn, setSpotlightOn] = useState(false);
  // "Spotlight Only" (default) vs "Spotlight + Try Locate" (uses anchor text search)
  const [spotlightMode, setSpotlightMode] = useState("only"); // "only" | "locate"

  useEffect(() => {
    if (!activeCase) return;
    Promise.all([
      base44.entities.JointExhibits.filter({ case_id: activeCase.id }),
      base44.entities.ExhibitExtracts.filter({ case_id: activeCase.id }),
      base44.entities.DepositionExhibits.filter({ case_id: activeCase.id }),
    ]).then(([joints, exts, depo]) => {
      setAdmittedExhibits(joints.filter(j => j.status === "Admitted" || j.admitted_no));
      setExtracts(exts);
      setDepoExhibits(depo);
    }).finally(() => setLoading(false));
  }, [activeCase]);

  const selectedExhibit = admittedExhibits.find(e => e.id === selectedExhibitId) || null;

  const extractForExhibit = useMemo(() => {
    if (!selectedExhibit) return null;
    return extracts.find(ex =>
      ex.id === selectedExhibit.exhibit_extract_id ||
      (selectedExhibit.primary_depo_exhibit_id &&
        ex.source_depo_exhibit_id === selectedExhibit.primary_depo_exhibit_id)
    ) || null;
  }, [selectedExhibit, extracts]);

  const fileUrl = useMemo(() => {
    if (extractForExhibit?.extract_file_url) return extractForExhibit.extract_file_url;
    if (selectedExhibit?.primary_depo_exhibit_id) {
      const de = depoExhibits.find(d => d.id === selectedExhibit.primary_depo_exhibit_id);
      return de?.file_url || null;
    }
    return null;
  }, [extractForExhibit, selectedExhibit, depoExhibits]);

  useEffect(() => {
    if (!extractForExhibit?.id) { setAnnotations([]); return; }
    base44.entities.ExhibitAnnotations.filter({ extract_id: extractForExhibit.id })
      .then(anns => {
        const juryAnns = anns.filter(a => a.jury_safe);
        setAnnotations(juryAnns);
        if (initAnnotationId && anns.find(a => a.id === initAnnotationId)) {
          setActiveAnnotationId(initAnnotationId);
          const target = anns.find(a => a.id === initAnnotationId);
          if (target) setCurrentPage(target.page_number ?? target.extract_page_number ?? 1);
        }
      });
  }, [extractForExhibit]);

  useEffect(() => {
    if (!initAnnotationId) { setActiveAnnotationId(null); setCurrentPage(1); }
    setSpotlightCanvas(null);
  }, [selectedExhibitId]);

  const selectAnnotation = useCallback((ann) => {
    setActiveAnnotationId(ann.id);
    const pg = ann.page_number ?? ann.extract_page_number ?? 1;
    if (pg !== currentPage) setCurrentPage(pg);
  }, [currentPage]);

  const sortedAnns = useMemo(() =>
    [...annotations].sort((a, b) => {
      const pa = a.page_number ?? a.extract_page_number ?? 0;
      const pb = b.page_number ?? b.extract_page_number ?? 0;
      return pa !== pb ? pa - pb : (a.sort_index ?? 0) - (b.sort_index ?? 0);
    }), [annotations]);

  const activeIdx = sortedAnns.findIndex(a => a.id === activeAnnotationId);
  const goPrev = () => { const i = activeIdx - 1; if (i >= 0) selectAnnotation(sortedAnns[i]); };
  const goNext = () => { const i = activeIdx + 1; if (i < sortedAnns.length) selectAnnotation(sortedAnns[i]); };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        if (activeAnnotationId) goNext();
        else setCurrentPage(p => Math.min(numPages || p, p + 1));
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        if (activeAnnotationId) goPrev();
        else setCurrentPage(p => Math.max(1, p - 1));
      }
      if (e.key === "Escape") { setFullscreen(false); setSpotlightOn(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [numPages, activeAnnotationId, activeIdx, sortedAnns]);



  const filteredExhibits = admittedExhibits.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (e.admitted_no || e.marked_no || "").toLowerCase().includes(q) ||
      (e.marked_title || e.internal_name || "").toLowerCase().includes(q);
  });

  const displayNumber = selectedExhibit
    ? (selectedExhibit.admitted_no || selectedExhibit.marked_no || "—")
    : null;

  const activeAnn = annotations.find(a => a.id === activeAnnotationId) || null;
  const showSpotlight = spotlightOn && activeAnn;

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className={`flex h-screen bg-black text-slate-100 overflow-hidden ${fullscreen ? "fixed inset-0 z-50" : ""}`}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; color: black; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ── Left Panel ─────────────────────────────────────── */}
      {panelOpen && (
        <div className="w-60 flex-shrink-0 border-r border-[#1e2a45] flex flex-col bg-[#0a0f1e] no-print">
          <div className="p-3 border-b border-[#1e2a45] space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-green-400" /> Admitted Exhibits
            </p>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search exhibits…"
                className="pl-7 h-7 text-[11px] bg-[#080d1a] border-[#1e2a45] text-slate-200" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <p className="text-[10px] text-slate-600 p-3">Loading…</p>}
            {!loading && filteredExhibits.length === 0 && (
              <p className="text-[10px] text-slate-600 italic p-4 text-center">No admitted exhibits found.</p>
            )}
            {filteredExhibits.map(ex => {
              const isSelected = ex.id === selectedExhibitId;
              const num = ex.admitted_no || ex.marked_no || "?";
              return (
                <button key={ex.id} onClick={() => setSelectedExhibitId(ex.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-[#1e2a45] transition-colors ${
                    isSelected ? "bg-green-600/15 border-l-2 border-l-green-400" : "hover:bg-white/5 border-l-2 border-l-transparent"
                  }`}>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-green-300 mt-0.5 flex-shrink-0">#{num}</span>
                    <div>
                      <p className="text-xs text-slate-200 leading-snug line-clamp-2">{ex.marked_title || ex.internal_name || "—"}</p>
                      {ex.admitted_date && <p className="text-[10px] text-slate-500">Admitted {ex.admitted_date}</p>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main Area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Bar */}
        <div className="no-print flex flex-wrap items-center justify-between px-4 py-2 bg-[#0a0f1e] border-b border-[#1e2a45] flex-shrink-0 gap-2">
          <div className="flex items-center gap-3">
            <button onClick={() => setPanelOpen(v => !v)} className="p-1 text-slate-500 hover:text-slate-200">
              {panelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            {displayNumber && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Admitted Exhibit</span>
                <span className="text-xl font-black text-green-300 tracking-wide">{displayNumber}</span>
                {selectedExhibit?.marked_title && (
                  <span className="text-sm text-slate-400 hidden md:block">— {selectedExhibit.marked_title}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Page nav */}
            {isPdf(fileUrl) && (
              <>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs text-slate-400 w-14 text-center">{currentPage} / {numPages || "…"}</span>
                <button onClick={() => setCurrentPage(p => Math.min(numPages || p, p + 1))} disabled={currentPage >= (numPages || 1)}
                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                <div className="w-px h-4 bg-[#1e2a45]" />
              </>
            )}
            {/* Annotation prev/next */}
            {annotations.length > 0 && (
              <>
                <button onClick={goPrev} disabled={activeIdx <= 0} title="Prev annotation"
                  className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white border border-[#1e2a45] rounded disabled:opacity-30">
                  ← Ann
                </button>
                <span className="text-[10px] text-slate-600">
                  {activeIdx >= 0 ? `${activeIdx + 1}/${sortedAnns.length}` : `0/${sortedAnns.length}`}
                </span>
                <button onClick={goNext} disabled={activeIdx >= sortedAnns.length - 1} title="Next annotation"
                  className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white border border-[#1e2a45] rounded disabled:opacity-30">
                  Ann →
                </button>
                <div className="w-px h-4 bg-[#1e2a45]" />
              </>
            )}
            {/* Zoom */}
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-[10px] text-slate-600 w-9 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomIn className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-[#1e2a45]" />

            {/* Spotlight toggle + mode */}
            <button onClick={() => setSpotlightOn(v => !v)} title="Spotlight quote"
              disabled={!activeAnnotationId}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors disabled:opacity-30 ${
                spotlightOn
                  ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                  : "text-slate-500 border-[#1e2a45] hover:text-slate-200"
              }`}>
              ✦ Spotlight
            </button>
            <select
              value={spotlightMode}
              onChange={e => setSpotlightMode(e.target.value)}
              title="Spotlight mode"
              className="text-[9px] bg-[#0a0f1e] border border-[#1e2a45] text-slate-400 rounded px-1 py-0.5 h-5"
            >
              <option value="only">Spotlight Only</option>
              <option value="locate">+ Try Locate</option>
            </select>
            <div className="w-px h-4 bg-[#1e2a45]" />
            <button onClick={() => window.print()} className="p-1 text-slate-400 hover:text-white" title="Print"><Printer className="w-4 h-4" /></button>
            <button onClick={() => setFullscreen(v => !v)} className="p-1 text-slate-400 hover:text-white" title="Fullscreen">
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Print-only header */}
        <div className="print-only p-4 border-b border-gray-300 text-black">
          <p className="text-2xl font-bold">ADMITTED EXHIBIT {displayNumber}</p>
          <p className="text-sm">{selectedExhibit?.marked_title || ""} — Page {currentPage}</p>
        </div>

        {/* Document area + right annotation panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Document */}
          <div className="flex-1 overflow-auto flex justify-center items-start bg-[#050809] p-6">
            {!selectedExhibitId && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
                <CheckCircle className="w-16 h-16 opacity-10" />
                <p className="text-lg">Select an admitted exhibit from the left panel</p>
              </div>
            )}
            {selectedExhibitId && !fileUrl && (
              <div className="flex items-center justify-center h-full text-slate-600">No file attached to this exhibit.</div>
            )}
            {fileUrl && (
              <div style={{ position: "relative", display: "inline-block" }}>
                <PdfViewer
                  fileUrl={fileUrl}
                  currentPage={currentPage}
                  scale={scale}
                  onNumPages={setNumPages}
                />
                {/* Quote Spotlight overlay — text-anchored, never drifts */}
                <QuoteSpotlight
                  annotation={activeAnn}
                  exhibitNo={displayNumber}
                  visible={showSpotlight}
                  mode={spotlightMode}
                  onClose={() => setSpotlightOn(false)}
                />
              </div>
            )}
          </div>

          {/* Right: Annotation Selector */}
          {selectedExhibitId && (
            <div className="w-52 flex-shrink-0 border-l border-[#1e2a45] flex flex-col bg-[#0a0f1e] no-print">
              <div className="p-3 border-b border-[#1e2a45]">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Annotations</p>
                <p className="text-[9px] text-slate-600 mt-0.5">Jury-safe only</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {annotations.length === 0 && (
                  <p className="text-[10px] text-slate-600 italic text-center py-4">No jury-safe annotations.</p>
                )}
                {(() => {
                  const pages = [...new Set(annotations.map(a => a.page_number ?? a.extract_page_number ?? 1))].sort((a, b) => a - b);
                  return pages.map(pg => {
                    const pageAnns = annotations.filter(a => (a.page_number ?? a.extract_page_number ?? 1) === pg);
                    return (
                      <div key={pg}>
                        <div className="flex items-center gap-1 px-1 py-0.5">
                          <div className="h-px flex-1 bg-[#1e2a45]" />
                          <button onClick={() => setCurrentPage(pg)}
                            className={`text-[9px] px-1.5 rounded transition-colors ${currentPage === pg ? "text-green-400 font-bold" : "text-slate-600 hover:text-slate-400"}`}>
                            p.{pg}
                          </button>
                          <div className="h-px flex-1 bg-[#1e2a45]" />
                        </div>
                        {pageAnns.map(a => {
                          const isActive = activeAnnotationId === a.id;
                          return (
                            <button key={a.id}
                              onClick={() => { selectAnnotation(a); setSpotlightOn(true); }}
                              className={`w-full text-left px-2 py-1.5 rounded transition-colors flex items-start gap-1.5 ${
                                isActive ? "bg-green-600/20 border border-green-600/40" : "hover:bg-white/5 border border-transparent"
                              }`}>
                              <span className="text-yellow-400 mt-0.5 flex-shrink-0 text-[10px]">✦</span>
                              <div className="min-w-0">
                                {a.label_text
                                  ? <p className={`text-[11px] font-medium leading-tight ${isActive ? "text-green-300" : "text-slate-300"}`}>{a.label_text}</p>
                                  : <p className={`text-[10px] leading-tight italic ${isActive ? "text-green-400" : "text-slate-500"}`}>p.{pg} quote</p>
                                }
                                {a.quote_text && (
                                  <p className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-2">"{a.quote_text}"</p>
                                )}
                              </div>
                              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 mt-1.5" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
              {activeAnnotationId && (
                <div className="p-2 border-t border-[#1e2a45]">
                  <button onClick={() => setActiveAnnotationId(null)}
                    className="w-full py-1 text-[10px] text-slate-500 hover:text-slate-300 border border-[#1e2a45] rounded">
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}