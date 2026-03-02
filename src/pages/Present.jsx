import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { pdfjs } from "react-pdf";
import {
  ChevronLeft, ChevronRight, Search, ZoomIn, ZoomOut,
  Maximize2, Minimize2, Printer, PanelLeftClose, PanelLeftOpen,
  CheckCircle, Scissors, Eye, EyeOff, X
} from "lucide-react";
import { Input } from "@/components/ui/input";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const COLOR_MAP = {
  yellow: "rgba(255,220,0,0.35)",
  red:    "rgba(239,68,68,0.35)",
  green:  "rgba(34,197,94,0.35)",
  blue:   "rgba(59,130,246,0.35)",
};

function isPdf(url) { return url?.toLowerCase().includes(".pdf"); }

// ── Simple PDF canvas renderer ────────────────────────────────────────────────
function PdfViewer({ fileUrl, currentPage, scale, onNumPages }) {
  const canvasRef = React.useRef(null);
  const [pdfDoc, setPdfDoc] = React.useState(null);

  React.useEffect(() => {
    if (!fileUrl || !isPdf(fileUrl)) return;
    pdfjs.getDocument(fileUrl).promise.then(doc => {
      setPdfDoc(doc);
      if (onNumPages) onNumPages(doc.numPages);
    });
  }, [fileUrl]);

  React.useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    pdfDoc.getPage(currentPage).then(page => {
      if (cancelled) return;
      const vp = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = vp.width;
      canvas.height = vp.height;
      page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
    });
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, scale]);

  if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(fileUrl || "")) {
    return <img src={fileUrl} alt="Exhibit" style={{ transform: `scale(${scale})`, transformOrigin: "top left", display: "block", maxWidth: "100%" }} draggable={false} />;
  }
  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}

// ── Spotlight Overlay ─────────────────────────────────────────────────────────
function SpotlightOverlay({ callout, highlights, showHighlights, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!callout?.snapshot_image_url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)" }}
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose}
          className="absolute -top-9 right-0 text-slate-400 hover:text-white flex items-center gap-1 text-xs">
          <X className="w-4 h-4" /> ESC to close
        </button>
        {/* Snapshot + highlights */}
        <div className="relative rounded-lg overflow-hidden shadow-2xl border border-white/10">
          <img
            src={callout.snapshot_image_url}
            alt={callout.name}
            style={{ display: "block", width: "100%", userSelect: "none" }}
            draggable={false}
          />
          {showHighlights && highlights.map((hl, hi) =>
            (hl.rects_norm || []).map((r, ri) => (
              <div key={`${hi}-${ri}`} style={{
                position: "absolute",
                left: `${r.x * 100}%`, top: `${r.y * 100}%`,
                width: `${r.w * 100}%`, height: `${r.h * 100}%`,
                background: COLOR_MAP[hl.color] || COLOR_MAP.yellow,
                pointerEvents: "none",
              }} />
            ))
          )}
        </div>
        {/* Label */}
        <p className="mt-2 text-center text-xs text-slate-400">
          p.{callout.page_number}{callout.name ? ` · ${callout.name}` : ""}
        </p>
      </div>
    </div>
  );
}

// ── Present page ──────────────────────────────────────────────────────────────
export default function Present() {
  const { activeCase } = useActiveCase();
  const urlParams = new URLSearchParams(window.location.search);
  const initExhibitId = urlParams.get("exhibit_id") || null;

  const [admittedExhibits, setAdmittedExhibits] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);

  const [selectedExhibitId, setSelectedExhibitId] = useState(initExhibitId);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.2);

  const [panelOpen, setPanelOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Callouts for selected exhibit's extract
  const [callouts, setCallouts] = useState([]);
  const [selectedCalloutId, setSelectedCalloutId] = useState(null);
  const [calloutHighlights, setCalloutHighlights] = useState([]);

  // Jury-safe filter
  const [jurySafeOnly, setJurySafeOnly] = useState(true);

  // Panel collapse
  const [calloutPanelOpen, setCalloutPanelOpen] = useState(true);

  // Spotlight state
  const [spotlightOn, setSpotlightOn] = useState(false);
  const [highlightsOn, setHighlightsOn] = useState(true); // default ON

  // Load exhibits
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

  // Load callouts for extract
  useEffect(() => {
    if (!extractForExhibit?.id) { setCallouts([]); setSelectedCalloutId(null); return; }
    base44.entities.Callouts.filter({ extract_id: extractForExhibit.id }).then(cs => {
      setCallouts(cs.sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0)));
    });
  }, [extractForExhibit]);

  // Load highlights for selected callout
  useEffect(() => {
    if (!selectedCalloutId) { setCalloutHighlights([]); return; }
    base44.entities.Highlights.filter({ callout_id: selectedCalloutId }).then(setCalloutHighlights);
  }, [selectedCalloutId]);

  // Reset on exhibit change
  useEffect(() => {
    setSelectedCalloutId(null);
    setSpotlightOn(false);
    setHighlightsOn(false);
    setCurrentPage(1);
  }, [selectedExhibitId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = e => {
      if (e.key === "Escape") { setFullscreen(false); setSpotlightOn(false); }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setCurrentPage(p => Math.min(numPages || p, p + 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") setCurrentPage(p => Math.max(1, p - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [numPages]);

  const filteredExhibits = admittedExhibits.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (e.admitted_no || e.marked_no || "").toLowerCase().includes(q) ||
      (e.marked_title || e.internal_name || "").toLowerCase().includes(q);
  });

  const visibleCallouts = useMemo(() =>
    callouts.filter(c => !jurySafeOnly || c.jury_safe),
    [callouts, jurySafeOnly]
  );

  const displayNumber = selectedExhibit
    ? (selectedExhibit.admitted_no || selectedExhibit.marked_no || "—")
    : null;

  const selectedCallout = callouts.find(c => c.id === selectedCalloutId) || null;

  const selectCallout = (c) => {
    setSelectedCalloutId(c.id);
    setCurrentPage(c.page_number ?? 1);
    setSpotlightOn(true);
    setHighlightsOn(false);
  };

  // Group callouts by page
  const calloutsByPage = useMemo(() => {
    const m = {};
    visibleCallouts.forEach(c => {
      const p = c.page_number ?? 1;
      if (!m[p]) m[p] = [];
      m[p].push(c);
    });
    return m;
  }, [visibleCallouts]);

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className={`flex h-screen bg-black text-slate-100 overflow-hidden ${fullscreen ? "fixed inset-0 z-50" : ""}`}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; color: black; }
        }
      `}</style>

      {/* Spotlight overlay */}
      {spotlightOn && selectedCallout && (
        <SpotlightOverlay
          callout={selectedCallout}
          highlights={calloutHighlights}
          showHighlights={highlightsOn}
          onClose={() => setSpotlightOn(false)}
        />
      )}

      {/* ── Left Panel: admitted exhibits ─────────────────────── */}
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
              <p className="text-[10px] text-slate-600 italic p-4 text-center">No admitted exhibits.</p>
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
                <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Admitted</span>
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
            {/* Zoom */}
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-[10px] text-slate-600 w-9 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomIn className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-[#1e2a45]" />
            {/* Spotlight toggle */}
            <button onClick={() => setSpotlightOn(v => !v)} disabled={!selectedCallout}
              title="Toggle Spotlight overlay"
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold border transition-colors disabled:opacity-30 ${
                spotlightOn
                  ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                  : "text-slate-400 border-[#1e2a45] hover:text-slate-200 hover:border-slate-500"
              }`}>
              ✦ Spotlight {spotlightOn ? "ON" : "OFF"}
            </button>
            {/* Highlights toggle */}
            <button onClick={() => setHighlightsOn(v => !v)} disabled={!spotlightOn}
              title="Toggle highlights inside spotlight"
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold border transition-colors disabled:opacity-30 ${
                highlightsOn
                  ? "bg-green-500/20 text-green-300 border-green-500/40"
                  : "text-slate-400 border-[#1e2a45] hover:text-slate-200"
              }`}>
              {highlightsOn ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Highlights {highlightsOn ? "ON" : "OFF"}
            </button>
            <div className="w-px h-4 bg-[#1e2a45]" />
            <button onClick={() => window.print()} className="p-1 text-slate-400 hover:text-white" title="Print"><Printer className="w-4 h-4" /></button>
            <button onClick={() => setFullscreen(v => !v)} className="p-1 text-slate-400 hover:text-white" title="Fullscreen">
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Document + right panel */}
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
              <PdfViewer fileUrl={fileUrl} currentPage={currentPage} scale={scale} onNumPages={setNumPages} />
            )}
          </div>

          {/* Right: Callouts panel (collapsible) */}
          {selectedExhibitId && (
            <div className="flex-shrink-0 border-l border-[#1e2a45] flex flex-col bg-[#0a0f1e] no-print transition-all duration-200"
              style={{ width: calloutPanelOpen ? 224 : 40 }}>
              {/* Collapsed: icon only */}
              {!calloutPanelOpen && (
                <button onClick={() => setCalloutPanelOpen(true)} title="Expand callouts"
                  className="flex flex-col items-center justify-center h-full gap-2 text-slate-600 hover:text-orange-400">
                  <Scissors className="w-4 h-4" />
                </button>
              )}
              {calloutPanelOpen && <div className="w-56 flex flex-col flex-1 min-h-0">
              {/* Header */}
              <div className="px-3 pt-3 pb-2 border-b border-[#1e2a45] flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-orange-400/80 uppercase tracking-widest flex items-center gap-1">
                    <Scissors className="w-3 h-3" /> Callouts
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-600">{visibleCallouts.length}</span>
                    <button onClick={() => setCalloutPanelOpen(false)} className="p-0.5 text-slate-600 hover:text-slate-400" title="Collapse">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Jury-safe filter */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={jurySafeOnly} onChange={e => setJurySafeOnly(e.target.checked)}
                    className="accent-green-500 w-3 h-3" />
                  <span className="text-[9px] text-slate-400">Jury-safe only</span>
                </label>
              </div>

              {/* Callout list grouped by page */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {visibleCallouts.length === 0 && (
                  <p className="text-[10px] text-slate-600 italic text-center py-4">
                    {callouts.length > 0 ? "No jury-safe callouts." : "No callouts for this exhibit."}
                  </p>
                )}
                {Object.entries(calloutsByPage).sort((a, b) => Number(a[0]) - Number(b[0])).map(([pg, pcs]) => (
                  <div key={pg}>
                    {/* Page divider */}
                    <div className="flex items-center gap-1 px-1 py-0.5">
                      <div className="h-px flex-1 bg-[#1e2a45]" />
                      <button onClick={() => setCurrentPage(Number(pg))}
                        className={`text-[9px] px-1.5 rounded transition-colors ${currentPage === Number(pg) ? "text-green-400 font-bold" : "text-slate-600 hover:text-slate-400"}`}>
                        p.{pg}
                      </button>
                      <div className="h-px flex-1 bg-[#1e2a45]" />
                    </div>
                    {pcs.map(c => {
                      const isActive = selectedCalloutId === c.id;
                      const hasSnapshot = !!c.snapshot_image_url;
                      return (
                        <div key={c.id} className={`rounded border transition-colors ${
                          isActive ? "bg-orange-500/15 border-orange-500/40" : "border-transparent hover:bg-white/5 hover:border-[#1e2a45]"
                        }`}>
                          <button
                            onClick={() => hasSnapshot ? selectCallout(c) : null}
                            disabled={!hasSnapshot}
                            className={`w-full text-left px-2 py-1.5 flex items-start gap-1.5 ${!hasSnapshot ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <Scissors className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className={`text-[11px] font-medium leading-tight truncate ${isActive ? "text-orange-200" : "text-slate-300"}`}>
                                {c.name || `p.${c.page_number}`}
                              </p>
                              {!hasSnapshot && (
                                <span className="text-[9px] text-amber-500">⚠ needs snapshot</span>
                              )}
                            </div>
                          </button>
                          {/* Thumbnail + controls */}
                          {isActive && hasSnapshot && (
                            <div className="px-2 pb-2 space-y-1.5">
                              <img src={c.snapshot_image_url} alt={c.name}
                                className="w-full rounded border border-[#1e2a45] object-contain max-h-20 bg-[#050809]" />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => { setSpotlightOn(true); setHighlightsOn(false); }}
                                  className="flex-1 py-0.5 text-[9px] font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded hover:bg-orange-500/20 transition-colors">
                                  ✦ Spotlight
                                </button>
                                <button
                                  onClick={() => { setSpotlightOn(true); setHighlightsOn(true); }}
                                  className="flex-1 py-0.5 text-[9px] font-semibold text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 rounded hover:bg-yellow-500/20 transition-colors">
                                  + Highlights
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Selected callout footer */}
              {selectedCalloutId && (
                <div className="p-2 border-t border-[#1e2a45]">
                  <button onClick={() => { setSelectedCalloutId(null); setSpotlightOn(false); setHighlightsOn(false); }}
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