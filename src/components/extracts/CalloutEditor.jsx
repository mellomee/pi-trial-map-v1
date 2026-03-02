import React, { useRef, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Scissors, Highlighter,
  Plus, Trash2, Eye, EyeOff, CheckSquare, Square
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const COLOR_MAP = {
  yellow: "rgba(255,220,0,0.35)",
  red:    "rgba(239,68,68,0.35)",
  green:  "rgba(34,197,94,0.35)",
  blue:   "rgba(59,130,246,0.35)",
};

// ── PDF Page Renderer ─────────────────────────────────────────────────────────
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
  return <canvas ref={canvasRef} style={{ display: "block", cursor: "crosshair" }} />;
}

// ── Highlight draw overlay on snapshot image ──────────────────────────────────
function SnapshotHighlightEditor({ snapshotUrl, highlights, onAddRect, color, opacity }) {
  const imgRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);

  const toNorm = (clientX, clientY) => {
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const onMouseDown = e => {
    e.preventDefault();
    const p = toNorm(e.clientX, e.clientY);
    setDragStart(p);
    setDragCurrent(p);
    setDragging(true);
  };

  const onMouseMove = e => {
    if (!dragging) return;
    setDragCurrent(toNorm(e.clientX, e.clientY));
  };

  const onMouseUp = e => {
    if (!dragging || !dragStart) return;
    const end = toNorm(e.clientX, e.clientY);
    const x = Math.min(dragStart.x, end.x);
    const y = Math.min(dragStart.y, end.y);
    const w = Math.abs(end.x - dragStart.x);
    const h = Math.abs(end.y - dragStart.y);
    if (w > 0.01 && h > 0.01) onAddRect({ x, y, w, h });
    setDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  const draftRect = dragging && dragStart && dragCurrent ? {
    x: Math.min(dragStart.x, dragCurrent.x),
    y: Math.min(dragStart.y, dragCurrent.y),
    w: Math.abs(dragCurrent.x - dragStart.x),
    h: Math.abs(dragCurrent.y - dragStart.y),
  } : null;

  return (
    <div className="relative select-none" style={{ display: "inline-block" }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      onMouseLeave={() => { if (dragging) { setDragging(false); setDragStart(null); setDragCurrent(null); } }}>
      <img ref={imgRef} src={snapshotUrl} alt="Callout snapshot"
        draggable={false}
        style={{ display: "block", maxWidth: "100%", cursor: "crosshair", userSelect: "none" }} />
      {/* Saved highlights */}
      {highlights.map((hl, hi) =>
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
      {/* Draft rect */}
      {draftRect && (
        <div style={{
          position: "absolute",
          left: `${draftRect.x * 100}%`, top: `${draftRect.y * 100}%`,
          width: `${draftRect.w * 100}%`, height: `${draftRect.h * 100}%`,
          background: COLOR_MAP[color] || COLOR_MAP.yellow,
          border: "2px dashed rgba(255,220,0,0.8)",
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
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

  // Mode: "view" | "capture" | "highlight"
  const [mode, setMode] = useState("view");

  // Drag for callout capture
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);

  // Callouts for this extract
  const [callouts, setCallouts] = useState([]);
  const [selectedCalloutId, setSelectedCalloutId] = useState(null);
  const [highlights, setHighlights] = useState([]);

  // Pending callout name form
  const [pendingCrop, setPendingCrop] = useState(null);
  const [pendingName, setPendingName] = useState("");
  const [pendingJurySafe, setPendingJurySafe] = useState(false);
  const [saving, setSaving] = useState(false);

  // Highlight draw state
  const [hlColor, setHlColor] = useState("yellow");
  const [hlOpacity, setHlOpacity] = useState(0.35);

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
    return {
      x: (clientX - rect.left),
      y: (clientY - rect.top),
    };
  }, []);

  const onCanvasMouseDown = e => {
    if (mode !== "capture") return;
    const p = getPdfCoords(e.clientX, e.clientY);
    setDragStart(p);
    setDragCurrent(p);
    setDragging(true);
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

    // Convert from CSS px to canvas px
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = cw / rect.width;
    const sy = ch / rect.height;
    const cx = x * sx, cy = y * sy, cw2 = w * sx, ch2 = h * sy;

    const cropRectNorm = { x: cx / cw, y: cy / ch, w: cw2 / cw, h: ch2 / ch };
    setPendingCrop({ cx, cy, cw2, ch2, cropRectNorm });
    setPendingName("");
    setDragStart(null);
    setDragCurrent(null);
    setMode("view");
  };

  const savePendingCallout = async () => {
    if (!pendingCrop || !extractId) return;
    setSaving(true);
    const { cx, cy, cw2, ch2, cropRectNorm } = pendingCrop;

    // Render page at 2x for crisp snapshot
    const SNAP_SCALE = 2.5;
    let snapshotUrl = null;
    if (pdfDoc) {
      const page = await pdfDoc.getPage(pageNum);
      const vp = page.getViewport({ scale: SNAP_SCALE });
      const offscreen = document.createElement("canvas");
      offscreen.width = vp.width;
      offscreen.height = vp.height;
      await page.render({ canvasContext: offscreen.getContext("2d"), viewport: vp }).promise;

      // Scale crop to offscreen
      const renderRatio = SNAP_SCALE / scale;
      const snapX = cx * renderRatio, snapY = cy * renderRatio;
      const snapW = cw2 * renderRatio, snapH = ch2 * renderRatio;

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = Math.round(snapW);
      cropCanvas.height = Math.round(snapH);
      cropCanvas.getContext("2d").drawImage(offscreen, snapX, snapY, snapW, snapH, 0, 0, snapW, snapH);

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
    // Delete highlights first
    const hls = await base44.entities.Highlights.filter({ callout_id: id });
    await Promise.all(hls.map(h => base44.entities.Highlights.delete(h.id)));
    await base44.entities.Callouts.delete(id);
    setCallouts(prev => prev.filter(c => c.id !== id));
    if (selectedCalloutId === id) { setSelectedCalloutId(null); setHighlights([]); }
  };

  const addHighlightRect = async (rect) => {
    if (!selectedCalloutId) return;
    // Add a new Highlights record with this single rect
    const hl = await base44.entities.Highlights.create({
      callout_id: selectedCalloutId,
      kind: "highlight",
      color: hlColor,
      opacity: hlOpacity,
      rects_norm: [rect],
    });
    setHighlights(prev => [...prev, hl]);
  };

  const deleteHighlight = async (id) => {
    await base44.entities.Highlights.delete(id);
    setHighlights(prev => prev.filter(h => h.id !== id));
  };

  const toggleJurySafe = async (callout) => {
    const updated = await base44.entities.Callouts.update(callout.id, { jury_safe: !callout.jury_safe });
    setCallouts(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  // Draft rect overlay (for capture mode)
  const draftStyle = () => {
    if (!dragging || !dragStart || !dragCurrent || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const w = Math.abs(dragCurrent.x - dragStart.x);
    const h = Math.abs(dragStart.y - dragCurrent.y);
    return { left: x, top: y, width: w, height: h };
  };

  const isImageFile = !fileUrl?.toLowerCase().includes(".pdf") && fileUrl;

  return (
    <div className="flex gap-0 bg-[#080d1a] border border-[#1e2a45] rounded-xl overflow-hidden mt-2">

      {/* ── Left: PDF viewer ─────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#0f1629] border-b border-[#1e2a45] flex-wrap">
          {/* Page nav */}
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
          {/* Zoom */}
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomOut className="w-3.5 h-3.5" /></button>
          <span className="text-[10px] text-slate-500 w-9 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(4, s + 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomIn className="w-3.5 h-3.5" /></button>
          <div className="w-px h-4 bg-[#1e2a45]" />
          {/* Mode buttons */}
          <button
            onClick={() => setMode(mode === "capture" ? "view" : "capture")}
            title="Drag to create a callout snapshot"
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
              mode === "capture"
                ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                : "text-slate-400 border-[#1e2a45] hover:text-slate-200"
            }`}>
            <Scissors className="w-3 h-3" /> {mode === "capture" ? "Cancel Capture" : "Create Callout"}
          </button>
          {selectedCallout && (
            <button
              onClick={() => setMode(mode === "highlight" ? "view" : "highlight")}
              title="Draw highlights on snapshot"
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                mode === "highlight"
                  ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                  : "text-slate-400 border-[#1e2a45] hover:text-slate-200"
              }`}>
              <Highlighter className="w-3 h-3" /> {mode === "highlight" ? "Done Highlighting" : "Add Highlight"}
            </button>
          )}
          {mode === "capture" && (
            <span className="text-[10px] text-orange-300 animate-pulse ml-1">Drag a region on the page →</span>
          )}
        </div>

        {/* PDF canvas */}
        <div className="overflow-auto flex-1 bg-[#050809] p-4 flex justify-center">
          {!fileUrl && (
            <p className="text-slate-600 text-sm mt-8">No file attached to this extract.</p>
          )}
          {fileUrl && !pdfDoc && !isImageFile && (
            <p className="text-slate-600 text-sm mt-8">Loading PDF…</p>
          )}
          {isImageFile && (
            <img src={fileUrl} alt="Extract" className="max-w-full" />
          )}
          {pdfDoc && (
            <div style={{ position: "relative", display: "inline-block" }}
              onMouseDown={onCanvasMouseDown}
              onMouseMove={onCanvasMouseMove}
              onMouseUp={onCanvasMouseUp}
              onMouseLeave={() => { if (dragging) { setDragging(false); setDragStart(null); setDragCurrent(null); } }}>
              <PdfPageRenderer pdfDoc={pdfDoc} pageNum={pageNum} scale={scale} canvasRef={canvasRef} />
              {/* Drag overlay */}
              {dragging && dragStart && dragCurrent && (() => {
                const s = draftStyle();
                return s ? (
                  <div style={{
                    position: "absolute",
                    left: s.left, top: s.top,
                    width: s.width, height: s.height,
                    background: "rgba(255,140,0,0.25)",
                    border: "2px dashed rgba(255,140,0,0.9)",
                    pointerEvents: "none",
                  }} />
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* Pending callout name form */}
        {pendingCrop && (
          <div className="p-3 bg-[#0f1629] border-t border-orange-500/30 flex items-center gap-2 flex-wrap">
            <Scissors className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <Input
              value={pendingName}
              onChange={e => setPendingName(e.target.value)}
              placeholder="Callout name…"
              className="h-7 text-xs bg-[#0a0f1e] border-[#1e2a45] text-slate-200 w-44"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && !saving) savePendingCallout(); if (e.key === "Escape") setPendingCrop(null); }}
            />
            <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={pendingJurySafe} onChange={e => setPendingJurySafe(e.target.checked)}
                className="accent-green-500 w-3 h-3" />
              Jury-safe
            </label>
            <Button onClick={savePendingCallout} disabled={saving}
              className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white px-3">
              {saving ? "Saving…" : "Save Callout"}
            </Button>
            <Button variant="outline" onClick={() => setPendingCrop(null)} disabled={saving}
              className="h-7 text-xs border-[#1e2a45] text-slate-400 px-2">
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* ── Right: Callout list + Highlight editor ─────────────── */}
      <div className="w-64 flex-shrink-0 border-l border-[#1e2a45] flex flex-col bg-[#0a0f1e]">
        {/* Callout list header */}
        <div className="px-3 py-2 border-b border-[#1e2a45] flex items-center justify-between">
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
            return (
              <div key={c.id} className={`border-b border-[#1e2a45] ${isSelected ? "bg-orange-500/10" : ""}`}>
                <div className="flex items-center gap-1 px-2 py-2">
                  <button onClick={() => { setSelectedCalloutId(c.id); setMode("view"); setPageNum(c.page_number ?? 1); }}
                    className="flex-1 text-left min-w-0">
                    <p className={`text-[11px] font-medium truncate ${isSelected ? "text-orange-300" : "text-slate-300"}`}>
                      {c.name || `p.${c.page_number} callout`}
                    </p>
                    <p className="text-[9px] text-slate-600">p.{c.page_number} {c.snapshot_image_url ? "" : "· ⚠ no snapshot"}</p>
                  </button>
                  <button onClick={() => toggleJurySafe(c)} title={c.jury_safe ? "Jury-safe ON" : "Jury-safe OFF"}
                    className={`p-1 rounded ${c.jury_safe ? "text-green-400" : "text-slate-600 hover:text-slate-400"}`}>
                    {c.jury_safe ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => deleteCallout(c.id)} className="p-1 text-slate-600 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {/* Snapshot thumbnail */}
                {isSelected && c.snapshot_image_url && (
                  <div className="px-2 pb-2">
                    <img src={c.snapshot_image_url} alt="Snapshot" className="w-full rounded border border-[#1e2a45] object-contain max-h-24 bg-[#050809]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Highlight editor panel (shown when a callout is selected and mode=highlight) */}
        {selectedCallout && (
          <div className="border-t border-[#1e2a45]">
            <div className="px-3 py-2 flex items-center justify-between">
              <p className="text-[10px] font-bold text-yellow-400/80 uppercase tracking-widest flex items-center gap-1">
                <Highlighter className="w-3 h-3" /> Highlights
              </p>
              <span className="text-[9px] text-slate-600">{highlights.length}</span>
            </div>

            {mode === "highlight" && selectedCallout.snapshot_image_url && (
              <div className="px-2 pb-2 space-y-2">
                {/* Color picker */}
                <div className="flex items-center gap-1">
                  {["yellow", "red", "green", "blue"].map(col => (
                    <button key={col} onClick={() => setHlColor(col)}
                      style={{ background: COLOR_MAP[col].replace("0.35", "0.7") }}
                      className={`w-5 h-5 rounded border-2 transition-all ${hlColor === col ? "border-white scale-110" : "border-transparent"}`} />
                  ))}
                </div>
                <p className="text-[9px] text-slate-500">Drag rectangles on the snapshot below:</p>
                <div className="overflow-auto max-h-48 rounded border border-[#1e2a45]">
                  <SnapshotHighlightEditor
                    snapshotUrl={selectedCallout.snapshot_image_url}
                    highlights={highlights}
                    onAddRect={addHighlightRect}
                    color={hlColor}
                    opacity={hlOpacity}
                  />
                </div>
              </div>
            )}

            {/* Highlights list */}
            {highlights.length > 0 && (
              <div className="px-2 pb-2 space-y-1 max-h-32 overflow-y-auto">
                {highlights.map((hl, i) => (
                  <div key={hl.id} className="flex items-center gap-1 bg-[#0f1629] rounded px-1.5 py-1">
                    <div style={{ background: COLOR_MAP[hl.color] || COLOR_MAP.yellow, border: `1px solid ${COLOR_MAP[hl.color] || COLOR_MAP.yellow}` }}
                      className="w-3 h-3 rounded flex-shrink-0" />
                    <span className="text-[9px] text-slate-400 flex-1">{hl.color} · {hl.rects_norm?.length || 0} rect</span>
                    <button onClick={() => deleteHighlight(hl.id)} className="p-0.5 text-slate-600 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}