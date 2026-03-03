import React, { useRef, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Scissors, Highlighter,
  Plus, Trash2, CheckSquare, Square, ChevronRight as PanelClose, ChevronsLeft, ChevronsRight,
  Printer, User
} from "lucide-react";
import HighlightEditorModal from "./HighlightEditorModal";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const COLOR_CSS = {
  yellow: "rgba(255,220,0,0.40)",
  red:    "rgba(239,68,68,0.40)",
  green:  "rgba(34,197,94,0.40)",
  blue:   "rgba(59,130,246,0.40)",
};

// ── PDF page renderer ─────────────────────────────────────────────────────────
function PdfPageRenderer({ pdfDoc, pageNum, scale, canvasRef }) {
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    pdfDoc.getPage(pageNum).then(page => {
      if (cancelled) return;
      const vp = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = vp.width;
      canvas.height = vp.height;
      page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
    });
    return () => { cancelled = true; };
  }, [pdfDoc, pageNum, scale]);
  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}

// ── Print helper: renders snapshot + highlights onto a canvas, then prints ────
async function printCalloutWithHighlights(callout, highlights) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      // Draw highlights
      highlights.forEach(hl => {
        (hl.rects_norm || []).forEach(r => {
          const colors = { yellow: "rgba(255,220,0,0.50)", red: "rgba(239,68,68,0.50)", green: "rgba(34,197,94,0.50)", blue: "rgba(59,130,246,0.50)" };
          ctx.fillStyle = colors[hl.color] || colors.yellow;
          ctx.fillRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
        });
      });
      const dataUrl = canvas.toDataURL("image/png");
      const win = window.open("", "_blank");
      win.document.write(`<!DOCTYPE html><html><head><title>${callout.name || "Callout"}</title>
        <style>body{margin:0;background:white;} img{max-width:100%;display:block;}</style></head>
        <body><img src="${dataUrl}" onload="window.print();window.close();" /></body></html>`);
      win.document.close();
      resolve();
    };
    img.src = callout.snapshot_image_url;
  });
}

// ── Main CalloutEditor ────────────────────────────────────────────────────────
export default function CalloutEditor({ extract }) {
  const fileUrl = extract?.extract_file_url;
  const extractId = extract?.id;

  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(1);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.2);
  const canvasRef = useRef(null);

  // Mode: "view" | "capture"
  const [mode, setMode] = useState("view");

  // Drag for callout capture
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);

  // Callouts & highlights
  const [callouts, setCallouts] = useState([]);
  const [selectedCalloutId, setSelectedCalloutId] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [highlightModalOpen, setHighlightModalOpen] = useState(false);

  // Pending callout form
  const [pendingCrop, setPendingCrop] = useState(null);
  const [pendingName, setPendingName] = useState("");
  const [pendingJurySafe, setPendingJurySafe] = useState(false);
  const [saving, setSaving] = useState(false);

  // Panel collapse
  const [panelOpen, setPanelOpen] = useState(true);

  // Load PDF
  useEffect(() => {
    if (!fileUrl?.toLowerCase().includes(".pdf")) return;
    pdfjs.getDocument(fileUrl).promise.then(doc => {
      setPdfDoc(doc);
      setNumPages(doc.numPages);
    });
  }, [fileUrl]);

  // Load callouts
  const loadCallouts = useCallback(async () => {
    if (!extractId) return;
    const cs = await base44.entities.Callouts.filter({ extract_id: extractId });
    setCallouts(cs.sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0)));
  }, [extractId]);
  useEffect(() => { loadCallouts(); }, [loadCallouts]);

  // Load highlights for selected callout
  useEffect(() => {
    if (!selectedCalloutId) { setHighlights([]); return; }
    base44.entities.Highlights.filter({ callout_id: selectedCalloutId }).then(setHighlights);
  }, [selectedCalloutId]);

  const selectedCallout = callouts.find(c => c.id === selectedCalloutId) || null;

  // ── Drag on PDF for callout capture ─────────────────────────────────────────
  const getPdfCoords = useCallback((clientX, clientY) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const onCanvasMouseDown = e => {
    if (mode !== "capture") return;
    const p = getPdfCoords(e.clientX, e.clientY);
    setDragStart(p); setDragCurrent(p); setDragging(true);
  };
  const onCanvasMouseMove = e => {
    if (!dragging || mode !== "capture") return;
    setDragCurrent(getPdfCoords(e.clientX, e.clientY));
  };
  const onCanvasMouseUp = async (e) => {
    if (!dragging || mode !== "capture" || !dragStart) return;
    const end = getPdfCoords(e.clientX, e.clientY);
    setDragging(false);
    if (!canvasRef.current) return;
    const cw = canvasRef.current.width;
    const ch = canvasRef.current.height;
    const x = Math.min(dragStart.x, end.x);
    const y = Math.min(dragStart.y, end.y);
    const w = Math.abs(end.x - dragStart.x);
    const h = Math.abs(end.y - dragStart.y);
    if (w < 10 || h < 10) { setDragStart(null); setDragCurrent(null); return; }
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = cw / rect.width, sy = ch / rect.height;
    const cx = x * sx, cy = y * sy, cw2 = w * sx, ch2 = h * sy;
    const cropRectNorm = { x: cx / cw, y: cy / ch, w: cw2 / cw, h: ch2 / ch };
    setPendingCrop({ cx, cy, cw2, ch2, cropRectNorm });
    setPendingName(""); setDragStart(null); setDragCurrent(null); setMode("view");
  };

  const savePendingCallout = async () => {
    if (!pendingCrop || !extractId) return;
    setSaving(true);
    const { cx, cy, cw2, ch2, cropRectNorm } = pendingCrop;
    let snapshotUrl = null;
    if (pdfDoc) {
      const SNAP_SCALE = 2.5;
      const page = await pdfDoc.getPage(pageNum);
      const vp = page.getViewport({ scale: SNAP_SCALE });
      const offscreen = document.createElement("canvas");
      offscreen.width = vp.width; offscreen.height = vp.height;
      await page.render({ canvasContext: offscreen.getContext("2d"), viewport: vp }).promise;
      const ratio = SNAP_SCALE / scale;
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = Math.round(cw2 * ratio); cropCanvas.height = Math.round(ch2 * ratio);
      cropCanvas.getContext("2d").drawImage(offscreen, cx * ratio, cy * ratio, cw2 * ratio, ch2 * ratio, 0, 0, cropCanvas.width, cropCanvas.height);
      const blob = await new Promise(res => cropCanvas.toBlob(res, "image/png"));
      const file = new File([blob], `callout_p${pageNum}_${Date.now()}.png`, { type: "image/png" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      snapshotUrl = file_url;
    }
    const record = await base44.entities.Callouts.create({
      extract_id: extractId,
      page_number: pageNum,
      name: pendingName.trim() || `p.${pageNum} callout`,
      jury_safe: pendingJurySafe,
      crop_rect_norm: cropRectNorm,
      snapshot_image_url: snapshotUrl,
    });
    setCallouts(prev => [...prev, record].sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0)));
    setSelectedCalloutId(record.id);
    setPendingCrop(null);
    setSaving(false);
  };

  const deleteCallout = async (id) => {
    if (!confirm("Delete this callout and all its highlights?")) return;
    const hls = await base44.entities.Highlights.filter({ callout_id: id });
    await Promise.all(hls.map(h => base44.entities.Highlights.delete(h.id)));
    await base44.entities.Callouts.delete(id);
    setCallouts(prev => prev.filter(c => c.id !== id));
    if (selectedCalloutId === id) { setSelectedCalloutId(null); setHighlights([]); }
  };

  const toggleJurySafe = async (callout) => {
    const updated = await base44.entities.Callouts.update(callout.id, { jury_safe: !callout.jury_safe });
    setCallouts(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const draftStyle = () => {
    if (!dragging || !dragStart || !dragCurrent) return null;
    return {
      left: Math.min(dragStart.x, dragCurrent.x),
      top: Math.min(dragStart.y, dragCurrent.y),
      width: Math.abs(dragCurrent.x - dragStart.x),
      height: Math.abs(dragStart.y - dragCurrent.y),
    };
  };

  const isImageFile = fileUrl && !fileUrl.toLowerCase().includes(".pdf");

  return (
    <>
      {/* Highlight editor modal */}
      {highlightModalOpen && selectedCallout && (
        <HighlightEditorModal
          callout={selectedCallout}
          highlights={highlights}
          onHighlightsChange={setHighlights}
          onClose={() => setHighlightModalOpen(false)}
        />
      )}

      <div className="flex bg-[#080d1a] border border-[#1e2a45] rounded-xl overflow-hidden mt-2"
        style={{ height: "calc(100vh - 220px)", minHeight: 500 }}>

        {/* ── Left: PDF viewer ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#0f1629] border-b border-[#1e2a45] flex-wrap flex-shrink-0">
            {pdfDoc && (
              <>
                <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1}
                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <span className="text-[10px] text-slate-400">{pageNum} / {numPages}</span>
                <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum >= numPages}
                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
                <div className="w-px h-4 bg-[#1e2a45]" />
              </>
            )}
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomOut className="w-3.5 h-3.5" /></button>
            <span className="text-[10px] text-slate-500 w-9 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(4, s + 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomIn className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-[#1e2a45]" />
            <button
              onClick={() => setMode(mode === "capture" ? "view" : "capture")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                mode === "capture"
                  ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                  : "text-slate-400 border-[#1e2a45] hover:text-slate-200"
              }`}>
              <Scissors className="w-3 h-3" /> {mode === "capture" ? "Cancel" : "Create Callout"}
            </button>
            {mode === "capture" && (
              <span className="text-[10px] text-orange-300 animate-pulse">← Drag a region on the PDF</span>
            )}
            {/* Toggle callout panel */}
            <button onClick={() => setPanelOpen(v => !v)} className="ml-auto p-1 text-slate-500 hover:text-slate-200" title="Toggle callout panel">
              {panelOpen ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* PDF Canvas */}
          <div className="overflow-auto flex-1 bg-[#050809] p-4 flex justify-center"
            style={{ cursor: mode === "capture" ? "crosshair" : "default" }}>
            {!fileUrl && <p className="text-slate-600 text-sm mt-8">No file attached.</p>}
            {isImageFile && <img src={fileUrl} alt="Extract" className="max-w-full" />}
            {pdfDoc && (
              <div style={{ position: "relative", display: "inline-block" }}
                onMouseDown={onCanvasMouseDown}
                onMouseMove={onCanvasMouseMove}
                onMouseUp={onCanvasMouseUp}
                onMouseLeave={() => { if (dragging) { setDragging(false); setDragStart(null); setDragCurrent(null); } }}>
                <PdfPageRenderer pdfDoc={pdfDoc} pageNum={pageNum} scale={scale} canvasRef={canvasRef} />
                {dragging && (() => { const s = draftStyle(); return s ? (
                  <div style={{
                    position: "absolute", left: s.left, top: s.top, width: s.width, height: s.height,
                    background: "rgba(255,140,0,0.22)", border: "2px dashed rgba(255,140,0,0.9)", pointerEvents: "none",
                  }} />
                ) : null; })()}
              </div>
            )}
          </div>

          {/* Pending callout name form */}
          {pendingCrop && (
            <div className="p-3 bg-[#0f1629] border-t border-orange-500/30 flex items-center gap-2 flex-wrap flex-shrink-0">
              <Scissors className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <Input value={pendingName} onChange={e => setPendingName(e.target.value)}
                placeholder="Callout name…"
                className="h-7 text-xs bg-[#0a0f1e] border-[#1e2a45] text-slate-200 w-44" autoFocus
                onKeyDown={e => { if (e.key === "Enter" && !saving) savePendingCallout(); if (e.key === "Escape") setPendingCrop(null); }} />
              <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer select-none">
                <input type="checkbox" checked={pendingJurySafe} onChange={e => setPendingJurySafe(e.target.checked)}
                  className="accent-green-500 w-3 h-3" /> Jury-safe
              </label>
              <Button onClick={savePendingCallout} disabled={saving}
                className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white px-3">
                {saving ? "Saving…" : "Save Callout"}
              </Button>
              <Button variant="outline" onClick={() => setPendingCrop(null)} disabled={saving}
                className="h-7 text-xs border-[#1e2a45] text-slate-400 px-2">Cancel</Button>
            </div>
          )}
        </div>

        {/* ── Right: Callout panel (collapsible) ──────────────────────── */}
        <div className="flex-shrink-0 border-l border-[#1e2a45] flex flex-col bg-[#0a0f1e] transition-all duration-200"
          style={{ width: panelOpen ? 340 : 40 }}>

          {/* Collapsed state: just icon */}
          {!panelOpen && (
            <button onClick={() => setPanelOpen(true)} title="Expand callout panel"
              className="flex items-center justify-center h-full text-slate-600 hover:text-orange-400">
              <Scissors className="w-4 h-4" />
            </button>
          )}

          {/* Expanded state */}
          {panelOpen && (
            <>
              <div className="px-3 py-2 border-b border-[#1e2a45] flex items-center justify-between flex-shrink-0">
                <p className="text-[10px] font-bold text-orange-400/80 uppercase tracking-widest flex items-center gap-1">
                  <Scissors className="w-3 h-3" /> Callouts ({callouts.length})
                </p>
              </div>

              {callouts.length === 0 && (
                <p className="text-[10px] text-slate-600 italic p-3 text-center">
                  No callouts yet. Use "Create Callout" to drag a region.
                </p>
              )}

              <div className="flex-1 overflow-y-auto">
                {callouts.map(c => {
                  const isSelected = selectedCalloutId === c.id;
                  const hlsForThis = isSelected ? highlights : [];
                  return (
                    <div key={c.id} className={`border-b border-[#1e2a45] ${isSelected ? "bg-orange-500/10" : ""}`}>
                      <div className="flex items-center gap-1 px-2 py-2">
                        <button onClick={() => { setSelectedCalloutId(c.id); setPageNum(c.page_number ?? 1); }}
                          className="flex-1 text-left min-w-0">
                          <p className={`text-[11px] font-medium truncate ${isSelected ? "text-orange-300" : "text-slate-300"}`}>
                            {c.name || `p.${c.page_number} callout`}
                          </p>
                          <p className="text-[9px] text-slate-600">p.{c.page_number}{!c.snapshot_image_url ? " · ⚠ no snapshot" : ""}</p>
                        </button>
                        <button onClick={() => toggleJurySafe(c)} title={c.jury_safe ? "Jury-safe ON" : "Off"}
                          className={`p-1 rounded ${c.jury_safe ? "text-green-400" : "text-slate-600 hover:text-slate-400"}`}>
                          {c.jury_safe ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => deleteCallout(c.id)} className="p-1 text-slate-600 hover:text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Selected callout: thumbnail + actions */}
                      {isSelected && c.snapshot_image_url && (
                        <div className="px-2 pb-2 space-y-1.5">
                          <div className="relative rounded overflow-hidden border border-[#1e2a45] bg-[#050809]">
                            <img src={c.snapshot_image_url} alt="Snapshot"
                              className="w-full object-contain max-h-28" />
                            {/* Highlight rects preview */}
                            {highlights.map(hl =>
                              (hl.rects_norm || []).map((r, ri) => (
                                <div key={`${hl.id}-${ri}`} style={{
                                  position: "absolute",
                                  left: `${r.x * 100}%`, top: `${r.y * 100}%`,
                                  width: `${r.w * 100}%`, height: `${r.h * 100}%`,
                                  background: COLOR_CSS[hl.color] || COLOR_CSS.yellow,
                                  pointerEvents: "none",
                                }} />
                              ))
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setHighlightModalOpen(true)}
                              className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-semibold text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 rounded hover:bg-yellow-500/20 transition-colors">
                              <Highlighter className="w-3 h-3" /> Add Highlight
                            </button>
                            <button
                              onClick={() => printCalloutWithHighlights(c, isSelected ? highlights : [])}
                              className="flex items-center justify-center px-2 py-1 text-[10px] font-semibold text-slate-400 bg-[#0f1629] border border-[#1e2a45] rounded hover:text-slate-200 transition-colors">
                              <Printer className="w-3 h-3" />
                            </button>
                          </div>
                          {highlights.length > 0 && (
                            <p className="text-[9px] text-slate-600 text-center">{highlights.length} highlight{highlights.length > 1 ? "s" : ""}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}