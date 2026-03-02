import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Trash2, Pencil, Check, X,
  Eye, EyeOff, Plus, StickyNote, ZoomIn, ZoomOut, Highlighter, Scissors, Image,
  ExternalLink, ArrowLeft
} from "lucide-react";
import useActiveCase from "@/components/hooks/useActiveCase";
import { createPageUrl } from "@/utils";
import QuoteAnnotationModal from "@/components/annotate/QuoteAnnotationModal";
import FindOnPage from "@/components/annotate/FindOnPage";
import AnnotationEditorModal from "@/components/exhibits/AnnotationEditorModal";
import CalloutCaptureModal from "@/components/annotate/CalloutCaptureModal";
import CalloutHighlightModal from "@/components/annotate/CalloutHighlightModal";
import AnnotationSnapshotModal from "@/components/annotate/AnnotationSnapshotModal";
import { captureAnnotationSnapshot } from "@/components/annotate/AnnotationSnapshotCapture";
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function AnnotatePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const extractId = urlParams.get("extractId");

  const [extract, setExtract] = useState(null);
  const [sourceDepoExhibit, setSourceDepoExhibit] = useState(null);
  const [linkedJoint, setLinkedJoint] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [pageIndex, setPageIndex] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.25);
  const [showJurySafeOnly, setShowJurySafeOnly] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [selectedCalloutId, setSelectedCalloutId] = useState(null); // selected callout in left rail
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [rendering, setRendering] = useState(false);
  const canvasRef = React.useRef(null);
  const [showFindOnPage, setShowFindOnPage] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSeedText, setModalSeedText] = useState("");
  const [editModalAnn, setEditModalAnn] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  // ── Callout state ─────────────────────────────────────────────────────────
  const [callouts, setCallouts] = useState([]);
  const [calloutMode, setCalloutMode] = useState(false);
  const [dragRect, setDragRect] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const [pendingCropBlob, setPendingCropBlob] = useState(null);
  const [highlightModalOpen, setHighlightModalOpen] = useState(false);
  const [pendingCalloutForHighlight, setPendingCalloutForHighlight] = useState(null);
  const overlayRef = useRef(null);

  // ── Highlight annotation drag state ──────────────────────────────────────
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightDragRect, setHighlightDragRect] = useState(null);
  const [highlightDragging, setHighlightDragging] = useState(false);
  const [highlightDragStart, setHighlightDragStart] = useState(null);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [pendingCaptureData, setPendingCaptureData] = useState(null);
  const [highlightColor, setHighlightColor] = useState("yellow");
  const [highlightOpacity] = useState(0.35);

  // ── Picker mode (no extractId) ───────────────────────────────────────────
  const { activeCase } = useActiveCase();
  const [allExtracts, setAllExtracts] = useState([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelected, setPickerSelected] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => {
    if (extractId) return;
    if (!activeCase) return;
    setPickerLoading(true);
    base44.entities.ExhibitExtracts.filter({ case_id: activeCase.id })
      .then(setAllExtracts)
      .finally(() => setPickerLoading(false));
  }, [extractId, activeCase]);

  const filteredPicker = useMemo(() => {
    if (!pickerSearch) return allExtracts;
    const q = pickerSearch.toLowerCase();
    return allExtracts.filter(e =>
      (e.extract_title_official || "").toLowerCase().includes(q) ||
      (e.extract_title_internal || "").toLowerCase().includes(q)
    );
  }, [allExtracts, pickerSearch]);

  // ── Load extract + related data ───────────────────────────────────────────
  useEffect(() => {
    if (!extractId) return;
    Promise.all([
      base44.entities.ExhibitExtracts.filter({ id: extractId }),
      base44.entities.ExhibitAnnotations.filter({ extract_id: extractId }),
      base44.entities.ExhibitAnnotationGroups.filter({ extract_id: extractId }),
      base44.entities.ExhibitCallouts.filter({ extract_id: extractId }),
    ]).then(async ([exts, anns, grps, cts]) => {
      const ext = exts[0] || null;
      setExtract(ext);
      setAnnotations(anns);
      setGroups(grps);
      setCallouts(cts);

      // Load source depo exhibit for header
      if (ext?.source_depo_exhibit_id) {
        const depo = await base44.entities.DepositionExhibits.filter({ id: ext.source_depo_exhibit_id });
        setSourceDepoExhibit(depo[0] || null);
        // Try to find linked joint exhibit
        const joints = await base44.entities.JointExhibits.filter({ case_id: ext.case_id });
        const linked = joints.find(j =>
          j.exhibit_extract_id === extractId ||
          j.primary_depo_exhibit_id === ext.source_depo_exhibit_id ||
          (j.source_depo_exhibit_ids || []).includes(ext.source_depo_exhibit_id)
        );
        setLinkedJoint(linked || null);
      }
    }).finally(() => setLoading(false));
  }, [extractId]);

  // ── Load PDF ──────────────────────────────────────────────────────────────
  const fileUrl = extract?.extract_file_url || null;
  const isPdf = fileUrl?.toLowerCase().includes(".pdf");

  useEffect(() => {
    if (!fileUrl || !isPdf) return;
    pdfjs.getDocument(fileUrl).promise.then(doc => {
      setPdfDoc(doc);
      setNumPages(doc.numPages);
    });
  }, [fileUrl, isPdf]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    setRendering(true);
    pdfDoc.getPage(pageIndex).then(page => {
      const vp = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = vp.width;
      canvas.height = vp.height;
      return page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    }).finally(() => setRendering(false));
  }, [pdfDoc, pageIndex, scale]);

  // ── Annotation CRUD ───────────────────────────────────────────────────────
  const handleSaveQuote = useCallback(async (data) => {
    if (!extractId) return;
    const ann = await base44.entities.ExhibitAnnotations.create({
      extract_id: extractId,
      sort_index: annotations.length,
      ...data,
    });
    setAnnotations(prev => [...prev, ann]);
    setActiveId(ann.id);
  }, [extractId, annotations.length]);

  const deleteAnnotation = async (id) => {
    if (!confirm("Delete this annotation?")) return;
    await base44.entities.ExhibitAnnotations.delete(id);
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const startEdit = (ann) => setEditModalAnn({ ...ann });

  const saveEditModal = async (formData) => {
    if (!formData?.id) return;
    setEditSaving(true);
    const pg = Number(formData.page_number ?? 1);
    const payload = {
      kind:                  formData.kind || "QUOTE_SPOTLIGHT",
      color:                 formData.color || "yellow",
      opacity:               formData.opacity ?? 0.35,
      label_text:            (formData.label_text ?? "").trim() || null,
      label:                 (formData.label_text ?? "").trim() || null,
      note_text:             (formData.note_text ?? formData.internal_note ?? "").trim() || null,
      internal_note:         (formData.internal_note ?? formData.note_text ?? "").trim() || null,
      quote_text:            (formData.quote_text ?? "").trim() || null,
      anchor_text:           (formData.anchor_text ?? "").trim() || null,
      extracted_text:        (formData.extracted_text ?? "").trim() || null,
      show_quote_in_present: formData.show_quote_in_present !== false,
      show_in_spotlight:     formData.show_in_spotlight !== false,
      page_number:           pg,
      extract_page_number:   pg,
      jury_safe:             !!formData.jury_safe,
      group_id:              formData.group_id || null,
      text_highlights_mode:  formData.text_highlights_mode || "auto",
    };
    await base44.entities.ExhibitAnnotations.update(formData.id, payload);
    const fresh = await base44.entities.ExhibitAnnotations.filter({ extract_id: extractId });
    setAnnotations(fresh);
    setEditModalAnn(null);
    setEditSaving(false);
  };

  const handleReextract = useCallback(async (formData, callback) => {
    if (!pdfDoc || !formData.rect_norm) return;
    const pg = Number(formData.page_number ?? 1);
    const page = await pdfDoc.getPage(pg);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const rn = formData.rect_norm;
    const x1 = rn.x * viewport.width, y1 = rn.y * viewport.height;
    const x2 = (rn.x + rn.w) * viewport.width, y2 = (rn.y + rn.h) * viewport.height;
    const extracted = textContent.items
      .filter(item => {
        const [, , , , tx, ty] = item.transform;
        const ix = tx, iy = viewport.height - ty;
        const iw = item.width ?? 0, ih = Math.abs(item.transform[3]) || 10;
        return ix < x2 && ix + iw > x1 && iy - ih < y2 && iy > y1;
      })
      .map(item => item.str).join(" ").replace(/\s+/g, " ").trim();
    callback(extracted);
  }, [pdfDoc]);

  const saveLabel = async () => {
    await base44.entities.ExhibitAnnotations.update(editingId, { label_text: editLabel });
    setAnnotations(prev => prev.map(a => a.id === editingId ? { ...a, label_text: editLabel } : a));
    setEditingId(null);
  };

  const toggleJurySafe = async (ann) => {
    const updated = { ...ann, jury_safe: !ann.jury_safe };
    await base44.entities.ExhibitAnnotations.update(ann.id, { jury_safe: updated.jury_safe });
    setAnnotations(prev => prev.map(a => a.id === ann.id ? updated : a));
  };

  const selectAnnotation = (ann) => {
    setActiveId(ann.id);
    setPageIndex(ann.page_number ?? ann.extract_page_number ?? 1);
  };

  // ── Derived lists ─────────────────────────────────────────────────────────
  // When a callout is selected, show only its highlights; otherwise show all
  const visibleAnns = useMemo(() => {
    const base = showJurySafeOnly ? annotations.filter(a => a.jury_safe) : annotations;
    if (selectedCalloutId) return base.filter(a => a.callout_id === selectedCalloutId);
    return base;
  }, [annotations, showJurySafeOnly, selectedCalloutId]);

  const visibleCallouts = showJurySafeOnly ? callouts.filter(c => c.jury_safe) : callouts;

  const deleteCallout = async (id) => {
    if (!confirm("Delete this callout and all its highlights?")) return;
    // Delete linked annotations
    const linked = annotations.filter(a => a.callout_id === id);
    await Promise.all(linked.map(a => base44.entities.ExhibitAnnotations.delete(a.id)));
    await base44.entities.ExhibitCallouts.delete(id);
    setCallouts(prev => prev.filter(c => c.id !== id));
    setAnnotations(prev => prev.filter(a => a.callout_id !== id));
    if (selectedCalloutId === id) setSelectedCalloutId(null);
  };

  // ── Canvas drag helpers ───────────────────────────────────────────────────
  const getCanvasRelativePos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // Callout drag
  const onCalloutMouseDown = useCallback((e) => {
    if (!calloutMode) return;
    e.preventDefault();
    setDragStart(getCanvasRelativePos(e));
    setDragRect(null);
    setIsDragging(true);
  }, [calloutMode, getCanvasRelativePos]);

  const onCalloutMouseMove = useCallback((e) => {
    if (!isDragging || !dragStart) return;
    const pos = getCanvasRelativePos(e);
    setDragRect({ x: Math.min(dragStart.x, pos.x), y: Math.min(dragStart.y, pos.y), w: Math.abs(pos.x - dragStart.x), h: Math.abs(pos.y - dragStart.y) });
  }, [isDragging, dragStart, getCanvasRelativePos]);

  const onCalloutMouseUp = useCallback(async (e) => {
    if (!isDragging || !dragStart) return;
    setIsDragging(false);
    const pos = getCanvasRelativePos(e);
    const rect = { x: Math.min(dragStart.x, pos.x), y: Math.min(dragStart.y, pos.y), w: Math.abs(pos.x - dragStart.x), h: Math.abs(pos.y - dragStart.y) };
    setDragRect(null);
    if (rect.w < 10 || rect.h < 10) return;

    const CROP_SCALE = 3;
    const hiddenCanvas = document.createElement("canvas");
    const page = await pdfDoc.getPage(pageIndex);
    const vp = page.getViewport({ scale: CROP_SCALE });
    hiddenCanvas.width = vp.width;
    hiddenCanvas.height = vp.height;
    await page.render({ canvasContext: hiddenCanvas.getContext("2d"), viewport: vp }).promise;

    const displayCanvas = canvasRef.current;
    const scaleX = hiddenCanvas.width / displayCanvas.width;
    const scaleY = hiddenCanvas.height / displayCanvas.height;
    const sx = rect.x * scaleX, sy = rect.y * scaleY;
    const sw = rect.w * scaleX, sh = rect.h * scaleY;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = sw; cropCanvas.height = sh;
    const ctx = cropCanvas.getContext("2d");
    ctx.drawImage(hiddenCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

    cropCanvas.toBlob((blob) => {
      setPendingCropBlob(blob);
      setCaptureModalOpen(true);
    }, "image/png");
  }, [isDragging, dragStart, getCanvasRelativePos, pdfDoc, pageIndex]);

  // Highlight drag
  const onHighlightMouseDown = useCallback((e) => {
    if (!highlightMode) return;
    e.preventDefault();
    setHighlightDragStart(getCanvasRelativePos(e));
    setHighlightDragRect(null);
    setHighlightDragging(true);
  }, [highlightMode, getCanvasRelativePos]);

  const onHighlightMouseMove = useCallback((e) => {
    if (!highlightDragging || !highlightDragStart) return;
    const pos = getCanvasRelativePos(e);
    setHighlightDragRect({ x: Math.min(highlightDragStart.x, pos.x), y: Math.min(highlightDragStart.y, pos.y), w: Math.abs(pos.x - highlightDragStart.x), h: Math.abs(pos.y - highlightDragStart.y) });
  }, [highlightDragging, highlightDragStart, getCanvasRelativePos]);

  const onHighlightMouseUp = useCallback(async (e) => {
    if (!highlightDragging || !highlightDragStart) return;
    setHighlightDragging(false);
    const pos = getCanvasRelativePos(e);
    const rect = { x: Math.min(highlightDragStart.x, pos.x), y: Math.min(highlightDragStart.y, pos.y), w: Math.abs(pos.x - highlightDragStart.x), h: Math.abs(pos.y - highlightDragStart.y) };
    setHighlightDragRect(null);
    if (rect.w < 8 || rect.h < 8) return;
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(pageIndex);
    const captureResult = await captureAnnotationSnapshot({
      displayCanvas: canvasRef.current,
      pdfPage: page,
      renderScale: scale,
      dragRect: rect,
      color: highlightColor,
      bakeHighlight: true,
    });
    setPendingCaptureData(captureResult);
    setSnapshotModalOpen(true);
  }, [highlightDragging, highlightDragStart, getCanvasRelativePos, pdfDoc, pageIndex, scale, highlightColor]);

  // ── PICKER UI ─────────────────────────────────────────────────────────────
  if (!extractId) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] text-slate-200 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <Highlighter className="w-6 h-6 text-orange-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Annotate an Extract</h1>
              <p className="text-xs text-slate-500">Select an extract to open the annotation editor</p>
            </div>
          </div>
          <div className="bg-[#0f1629] border border-[#1e2a45] rounded-xl p-5 space-y-4">
            <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Search extracts…"
              className="w-full h-9 pl-3 pr-3 rounded-md bg-[#0a0f1e] border border-[#1e2a45] text-slate-200 text-sm outline-none focus:border-orange-500/50" />
            {pickerLoading && <p className="text-xs text-slate-500 text-center py-4">Loading extracts…</p>}
            {!pickerLoading && filteredPicker.length === 0 && (
              <p className="text-xs text-slate-600 italic text-center py-4">
                {allExtracts.length === 0 ? "No extracts found. Create one in the Extracts page first." : "No extracts match your search."}
              </p>
            )}
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {filteredPicker.map(ex => (
                <button key={ex.id} onClick={() => setPickerSelected(ex.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    pickerSelected === ex.id ? "bg-orange-500/15 border-orange-500/40 text-orange-200" : "border-transparent hover:bg-white/5 hover:border-[#1e2a45] text-slate-300"
                  }`}>
                  <p className="text-sm font-medium leading-snug">{ex.extract_title_official}</p>
                  {ex.extract_title_internal && <p className="text-[11px] text-slate-500 italic mt-0.5">"{ex.extract_title_internal}"</p>}
                </button>
              ))}
            </div>
            <Button disabled={!pickerSelected}
              onClick={() => { window.location.href = createPageUrl(`AnnotatePage?extractId=${pickerSelected}`); }}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-40">
              Open in Annotation Editor
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-slate-400">Loading extract…</div>;

  // ── Header info ───────────────────────────────────────────────────────────
  const pageRange = (extract?.extract_page_start && extract?.extract_page_end)
    ? `pp. ${extract.extract_page_start}–${extract.extract_page_end}`
    : extract?.extract_page_count ? `${extract.extract_page_count} pages` : null;

  const selectedCallout = callouts.find(c => c.id === selectedCalloutId) || null;

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden flex-col">

      {/* ── Top header bar (Extracts-style) ──────────────────────────────── */}
      <div className="flex-shrink-0 bg-[#0f1629] border-b border-[#1e2a45] px-5 py-3 flex items-start gap-4">
        <button onClick={() => window.history.back()} className="mt-1 p-1 text-slate-500 hover:text-slate-300 flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {extract?.extract_title_internal && (
              <h1 className="text-base font-bold text-white leading-tight">{extract.extract_title_internal}</h1>
            )}
            {linkedJoint && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 flex-shrink-0">
                Joint #{linkedJoint.marked_no}
              </span>
            )}
            {linkedJoint?.admitted_no && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex-shrink-0">
                Admitted #{linkedJoint.admitted_no}
              </span>
            )}
          </div>
          {extract?.extract_title_official && (
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">{extract.extract_title_official}</p>
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {sourceDepoExhibit && (
              <span className="text-[10px] text-slate-500">
                Source: {sourceDepoExhibit.depo_exhibit_title || sourceDepoExhibit.display_title}
                {sourceDepoExhibit.deponent_name && ` · ${sourceDepoExhibit.deponent_name}`}
              </span>
            )}
            {pageRange && <span className="text-[10px] text-slate-600">{pageRange}</span>}
          </div>
        </div>
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-slate-700/50 text-slate-300 border border-[#1e2a45] hover:bg-slate-700 transition-colors flex-shrink-0">
            <ExternalLink className="w-3.5 h-3.5" /> View File
          </a>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar ──────────────────────────────── */}
        <div className="w-64 flex-shrink-0 flex flex-col border-r border-[#1e2a45] bg-[#0f1629]">

          {/* Action buttons */}
          <div className="p-3 border-b border-[#1e2a45] flex flex-col gap-2">
            <button onClick={() => setModalOpen(true)}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium border bg-orange-500/20 text-orange-300 border-orange-500/40 hover:bg-orange-500/30 transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Spotlight Quote
            </button>
            <button
              onClick={() => { setHighlightMode(v => !v); if (calloutMode) setCalloutMode(false); }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium border transition-colors ${
                highlightMode ? "bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse"
                  : "bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20"
              }`}>
              <Highlighter className="w-3.5 h-3.5" /> {highlightMode ? "Cancel Highlight" : "Highlight + Snapshot"}
            </button>
            {highlightMode && (
              <div className="flex items-center gap-1 px-1">
                {["yellow","red","green","blue"].map(c => (
                  <button key={c} onClick={() => setHighlightColor(c)}
                    className={`w-4 h-4 rounded border-2 ${highlightColor === c ? "border-white" : "border-transparent opacity-50"} ${
                      c==="yellow"?"bg-yellow-400":c==="red"?"bg-red-500":c==="green"?"bg-green-500":"bg-blue-500"}`}
                  />
                ))}
              </div>
            )}
            <button
              onClick={() => { setCalloutMode(v => !v); if (highlightMode) setHighlightMode(false); }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium border transition-colors ${
                calloutMode ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 animate-pulse"
                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20"
              }`}>
              <Scissors className="w-3.5 h-3.5" /> {calloutMode ? "Cancel Callout" : "Create Callout"}
            </button>
            <button onClick={() => setShowJurySafeOnly(v => !v)}
              className={`flex items-center gap-1.5 py-1 rounded text-[10px] border transition-colors px-2 ${
                showJurySafeOnly ? "bg-green-500/10 text-green-400 border-green-500/30" : "text-slate-500 border-[#1e2a45] hover:text-slate-300"
              }`}>
              {showJurySafeOnly ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Jury-safe only
            </button>
          </div>

          {/* Callouts section */}
          <div className="border-b border-[#1e2a45]">
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
              <p className="text-[9px] text-yellow-500/70 uppercase tracking-widest flex items-center gap-1">
                <Scissors className="w-2.5 h-2.5" /> Callouts ({visibleCallouts.length})
              </p>
              {selectedCalloutId && (
                <button onClick={() => setSelectedCalloutId(null)}
                  className="text-[9px] text-slate-500 hover:text-slate-300 border border-[#1e2a45] rounded px-1.5 py-0.5">
                  Show all
                </button>
              )}
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto px-2 pb-2">
              {visibleCallouts.length === 0 && (
                <p className="text-[10px] text-slate-600 italic text-center py-2">No callouts yet.</p>
              )}
              {visibleCallouts.sort((a, b) => (a.order_index ?? a.page_number ?? 0) - (b.order_index ?? b.page_number ?? 0)).map(c => {
                const isSelected = selectedCalloutId === c.id;
                const annCount = annotations.filter(a => a.callout_id === c.id).length;
                return (
                  <div key={c.id} className={`group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer border transition-colors ${
                    isSelected ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-200" : "border-transparent hover:bg-white/5 hover:border-[#1e2a45]"
                  }`} onClick={() => setSelectedCalloutId(isSelected ? null : c.id)}>
                    <Image className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-medium truncate ${isSelected ? "text-yellow-200" : "text-slate-300"}`}>{c.label || `p.${c.page_number}`}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] text-slate-600">p.{c.page_number}</span>
                        <span className="text-[8px] text-slate-600">{annCount} highlight{annCount !== 1 ? "s" : ""}</span>
                        <span className={`text-[8px] ${c.jury_safe ? "text-green-500/70" : "text-slate-600"}`}>{c.jury_safe ? "jury-safe" : "internal"}</span>
                      </div>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setPendingCalloutForHighlight(c); setHighlightModalOpen(true); }}
                        title="Add highlight to this callout"
                        className="p-0.5 text-slate-600 hover:text-yellow-400"><Plus className="w-2.5 h-2.5" /></button>
                      <button onClick={() => deleteCallout(c.id)}
                        className="p-0.5 text-slate-600 hover:text-red-400"><Trash2 className="w-2.5 h-2.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Highlights / Annotations list */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 pt-2.5 pb-1">
              <p className="text-[9px] text-orange-400/70 uppercase tracking-widest flex items-center gap-1">
                <Highlighter className="w-2.5 h-2.5" />
                {selectedCalloutId ? `Highlights for "${selectedCallout?.label || "callout"}"` : `All Highlights (${visibleAnns.length})`}
              </p>
            </div>

            {/* "Add highlight to selected callout" shortcut */}
            {selectedCalloutId && (
              <div className="px-2 pb-2">
                <button
                  onClick={() => { setPendingCalloutForHighlight(selectedCallout); setHighlightModalOpen(true); }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add highlight to this callout
                </button>
              </div>
            )}

            <div className="p-2 space-y-1">
              {visibleAnns.length === 0 && (
                <p className="text-[10px] text-slate-600 italic text-center py-4">
                  {selectedCalloutId ? "No highlights for this callout yet." : "No annotations yet."}
                </p>
              )}
              {[...new Set(visibleAnns.map(a => a.page_number ?? a.extract_page_number ?? 1))].sort((a, b) => a - b).map(pg => (
                <div key={pg}>
                  <div className="flex items-center gap-1 px-1 py-0.5">
                    <div className="h-px flex-1 bg-[#1e2a45]" />
                    <button onClick={() => setPageIndex(pg)}
                      className={`text-[9px] px-1.5 rounded ${pageIndex === pg ? "text-orange-400 font-bold" : "text-slate-600 hover:text-slate-400"}`}>
                      p.{pg}
                    </button>
                    <div className="h-px flex-1 bg-[#1e2a45]" />
                  </div>
                  {visibleAnns.filter(a => (a.page_number ?? a.extract_page_number ?? 1) === pg).map(ann => {
                    const isActive = activeId === ann.id;
                    return (
                      <div key={ann.id} onClick={() => selectAnnotation(ann)}
                        className={`group flex items-start gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                          isActive ? "bg-orange-500/15 border border-orange-500/30" : "hover:bg-white/5 border border-transparent"
                        }`}>
                        {ann.callout_id ? (
                          <span className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded ${
                            (ann.color||"yellow")==="yellow"?"bg-yellow-400":(ann.color)==="red"?"bg-red-500":(ann.color)==="green"?"bg-green-500":"bg-blue-500"
                          }`} />
                        ) : (
                          <span className="text-yellow-400 mt-0.5 flex-shrink-0 text-[10px]">✦</span>
                        )}
                        <div className="flex-1 min-w-0">
                          {editingId === ann.id ? (
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                              <Input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") saveLabel(); if (e.key === "Escape") setEditingId(null); }}
                                className="h-5 text-[10px] bg-[#0a0f1e] border-[#1e2a45] text-slate-200 flex-1 px-1" autoFocus />
                              <button onClick={saveLabel} className="text-green-400 hover:text-green-300"><Check className="w-3 h-3" /></button>
                              <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-300"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <p className={`text-[11px] leading-tight ${isActive ? "text-orange-200" : "text-slate-300"}`}>
                              {ann.label_text || ann.label || <em className="text-slate-600">no label</em>}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] px-1 rounded ${ann.jury_safe ? "bg-green-500/15 text-green-400" : "bg-slate-700/30 text-slate-500"}`}>
                              {ann.jury_safe ? "jury-safe" : "internal"}
                            </span>
                            {ann.callout_id && <span className="text-[9px] text-yellow-600/70">linked to callout</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button onClick={() => toggleJurySafe(ann)} className="p-0.5 text-slate-500 hover:text-green-400"><Eye className="w-3 h-3" /></button>
                          <button onClick={() => startEdit(ann)} className="p-0.5 text-slate-500 hover:text-cyan-400"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => deleteAnnotation(ann.id)} className="p-0.5 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main viewer ──────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#0f1629] border-b border-[#1e2a45] flex-shrink-0">
            <button onClick={() => setPageIndex(p => Math.max(1, p - 1))} disabled={pageIndex <= 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs text-slate-400 w-16 text-center">{pageIndex} / {numPages || "…"}</span>
            <button onClick={() => setPageIndex(p => Math.min(numPages || p, p + 1))} disabled={pageIndex >= (numPages || 1)}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-[#1e2a45]" />
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-[10px] text-slate-500 w-8 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomIn className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-[#1e2a45]" />
            <span className="text-[10px] text-slate-500">
              <StickyNote className="w-3.5 h-3.5 inline mr-1" />{annotations.length} annotations · {callouts.length} callouts
            </span>
            {isPdf && pdfDoc && (
              <button onClick={() => setShowFindOnPage(v => !v)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border transition-colors ${
                  showFindOnPage ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" : "text-slate-500 border-[#1e2a45] hover:text-slate-300"
                }`}>
                <ZoomIn className="w-3.5 h-3.5" /> Find
              </button>
            )}
            <button onClick={() => setModalOpen(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Quote
            </button>
          </div>

          {showFindOnPage && pdfDoc && <FindOnPage pdfDoc={pdfDoc} pageIndex={pageIndex} />}

          <div className="flex-1 overflow-auto flex justify-center items-start bg-[#050809] p-6"
            style={{ cursor: (calloutMode || highlightMode) ? "crosshair" : "default" }}>
            {!fileUrl ? (
              <div className="text-slate-500 text-sm mt-16">No file attached to this extract.</div>
            ) : isPdf ? (
              <div className="relative inline-block select-none"
                onMouseDown={e => { onCalloutMouseDown(e); onHighlightMouseDown(e); }}
                onMouseMove={e => { onCalloutMouseMove(e); onHighlightMouseMove(e); }}
                onMouseUp={e => { onCalloutMouseUp(e); onHighlightMouseUp(e); }}
                ref={overlayRef}>
                <canvas ref={canvasRef} style={{ display: "block", pointerEvents: "none" }} />
                {rendering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1e]/60 text-slate-500 text-sm pointer-events-none">Rendering…</div>
                )}
                {calloutMode && dragRect && (
                  <div className="absolute pointer-events-none border-2 border-yellow-400"
                    style={{ left: dragRect.x, top: dragRect.y, width: dragRect.w, height: dragRect.h, background: "rgba(255,220,0,0.18)" }} />
                )}
                {highlightMode && highlightDragRect && (
                  <div className="absolute pointer-events-none border-2 border-orange-400"
                    style={{ left: highlightDragRect.x, top: highlightDragRect.y, width: highlightDragRect.w, height: highlightDragRect.h, background: "rgba(251,146,60,0.2)" }} />
                )}
                {calloutMode && !isDragging && (
                  <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
                    <div className="bg-yellow-500/90 text-black text-xs font-semibold px-3 py-1 rounded-full shadow">Drag to select a region → Save as callout clip</div>
                  </div>
                )}
                {highlightMode && !highlightDragging && (
                  <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
                    <div className="bg-orange-500/90 text-black text-xs font-semibold px-3 py-1 rounded-full shadow">Drag to highlight → Save as annotation with snapshot</div>
                  </div>
                )}
              </div>
            ) : (
              <img src={fileUrl} alt="Extract" style={{ maxWidth: "100%" }} draggable={false} />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <QuoteAnnotationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setModalSeedText(""); }}
        onSave={handleSaveQuote}
        defaultPage={pageIndex}
        groups={groups}
        seedQuoteText={modalSeedText}
      />
      <CalloutCaptureModal
        open={captureModalOpen}
        onClose={() => { setCaptureModalOpen(false); setPendingCropBlob(null); setCalloutMode(false); }}
        extractId={extractId}
        pageNumber={pageIndex}
        cropBlob={pendingCropBlob}
        onSaved={(record) => {
          setCallouts(prev => [...prev, record]);
          setCalloutMode(false);
          setPendingCalloutForHighlight(record);
          setHighlightModalOpen(true);
        }}
      />
      <CalloutHighlightModal
        open={highlightModalOpen}
        onClose={() => { setHighlightModalOpen(false); setPendingCalloutForHighlight(null); }}
        callout={pendingCalloutForHighlight}
        extractId={extractId}
        pageNumber={pageIndex}
        onSaved={(savedAnns) => {
          setAnnotations(prev => {
            // merge: replace if already exists (re-drawing), append new
            const ids = new Set(savedAnns.map(a => a.id));
            return [...prev.filter(a => !ids.has(a.id)), ...savedAnns];
          });
          if (savedAnns.length > 0) setActiveId(savedAnns[0].id);
        }}
      />
      <AnnotationSnapshotModal
        open={snapshotModalOpen}
        onClose={() => { setSnapshotModalOpen(false); setPendingCaptureData(null); setHighlightMode(false); }}
        extractId={extractId}
        pageNumber={pageIndex}
        captureData={pendingCaptureData}
        color={highlightColor}
        opacity={highlightOpacity}
        onSaved={(record) => {
          setAnnotations(prev => [...prev, record]);
          setActiveId(record.id);
          setHighlightMode(false);
        }}
      />
      <AnnotationEditorModal
        editing={editModalAnn}
        setEditing={setEditModalAnn}
        onSave={saveEditModal}
        saving={editSaving}
        groups={groups}
        onReextract={handleReextract}
      />
    </div>
  );
}