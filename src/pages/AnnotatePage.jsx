import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Trash2, Pencil, Check, X,
  Eye, EyeOff, Plus, StickyNote, ZoomIn, ZoomOut, Highlighter
} from "lucide-react";
import useActiveCase from "@/components/hooks/useActiveCase";
import { createPageUrl } from "@/utils";
import QuoteAnnotationModal from "@/components/annotate/QuoteAnnotationModal";
import FindOnPage from "@/components/annotate/FindOnPage";
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function AnnotatePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const extractId = urlParams.get("extractId");

  const [extract, setExtract] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [pageIndex, setPageIndex] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.25);
  const [showJurySafeOnly, setShowJurySafeOnly] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [rendering, setRendering] = useState(false);
  const canvasRef = React.useRef(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

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

  // ── Load extract data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!extractId) return;
    Promise.all([
      base44.entities.ExhibitExtracts.filter({ id: extractId }),
      base44.entities.ExhibitAnnotations.filter({ extract_id: extractId }),
      base44.entities.ExhibitAnnotationGroups.filter({ extract_id: extractId }),
    ]).then(([exts, anns, grps]) => {
      setExtract(exts[0] || null);
      setAnnotations(anns);
      setGroups(grps);
    }).finally(() => setLoading(false));
  }, [extractId]);

  // ── Load PDF document ────────────────────────────────────────────────────
  const fileUrl = extract?.extract_file_url || null;
  const isPdf = fileUrl?.toLowerCase().includes(".pdf");

  useEffect(() => {
    if (!fileUrl || !isPdf) return;
    pdfjs.getDocument(fileUrl).promise.then(doc => {
      setPdfDoc(doc);
      setNumPages(doc.numPages);
    });
  }, [fileUrl, isPdf]);

  // ── Render current PDF page ──────────────────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    setRendering(true);
    pdfDoc.getPage(pageIndex).then(page => {
      const vp = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext("2d");
      return page.render({ canvasContext: ctx, viewport: vp }).promise;
    }).finally(() => setRendering(false));
  }, [pdfDoc, pageIndex, scale]);

  // ── Annotation CRUD ──────────────────────────────────────────────────────
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

  const startEdit = (ann) => {
    setEditingId(ann.id);
    setEditLabel(ann.label_text || ann.label || "");
  };

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
    const pg = ann.page_number ?? ann.extract_page_number ?? 1;
    setPageIndex(pg);
  };

  const visibleAnns = showJurySafeOnly ? annotations.filter(a => a.jury_safe) : annotations;

  // ── PICKER UI ────────────────────────────────────────────────────────────
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
            <input
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              placeholder="Search extracts…"
              className="w-full h-9 pl-3 pr-3 rounded-md bg-[#0a0f1e] border border-[#1e2a45] text-slate-200 text-sm outline-none focus:border-orange-500/50"
            />
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
                    pickerSelected === ex.id
                      ? "bg-orange-500/15 border-orange-500/40 text-orange-200"
                      : "border-transparent hover:bg-white/5 hover:border-[#1e2a45] text-slate-300"
                  }`}>
                  <p className="text-sm font-medium leading-snug">{ex.extract_title_official}</p>
                  {ex.extract_title_internal && (
                    <p className="text-[11px] text-slate-500 italic mt-0.5">"{ex.extract_title_internal}"</p>
                  )}
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

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden">

      {/* ── Left sidebar ───────────────────────────────── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r border-[#1e2a45] bg-[#0f1629]">
        <div className="p-4 border-b border-[#1e2a45]">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Annotating</p>
          <p className="text-sm font-semibold text-slate-200 leading-tight">
            {extract?.extract_title_official || extract?.extract_title_internal || "Extract"}
          </p>
          {extract?.extract_page_count && (
            <p className="text-[10px] text-slate-500 mt-0.5">{extract.extract_page_count} pages</p>
          )}
        </div>

        <div className="p-3 border-b border-[#1e2a45] flex flex-col gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium border bg-orange-500/20 text-orange-300 border-orange-500/40 hover:bg-orange-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Spotlight Quote
          </button>
          <button
            onClick={() => setShowJurySafeOnly(v => !v)}
            className={`flex items-center gap-1.5 py-1 rounded text-[10px] border transition-colors px-2 ${
              showJurySafeOnly
                ? "bg-green-500/10 text-green-400 border-green-500/30"
                : "text-slate-500 border-[#1e2a45] hover:text-slate-300"
            }`}
          >
            {showJurySafeOnly ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Jury-safe only
          </button>
        </div>

        {/* Annotation list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {visibleAnns.length === 0 && (
            <p className="text-[10px] text-slate-600 italic text-center py-6">
              No annotations yet.<br />Use "New Spotlight Quote" to add one.
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
                    <span className="text-yellow-400 mt-0.5 flex-shrink-0 text-[10px]">✦</span>
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
                        <>
                          <p className={`text-[11px] leading-tight ${isActive ? "text-orange-200" : "text-slate-300"}`}>
                            {ann.label_text || ann.label || <em className="text-slate-600">no label</em>}
                          </p>
                          {ann.quote_text && (
                            <p className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-2">"{ann.quote_text}"</p>
                          )}
                        </>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[9px] px-1 rounded ${ann.jury_safe ? "bg-green-500/15 text-green-400" : "bg-slate-700/30 text-slate-500"}`}>
                          {ann.jury_safe ? "jury-safe" : "internal"}
                        </span>
                        <span className="text-[9px] text-slate-600">{ann.kind === "QUOTE_SPOTLIGHT" ? "quote" : ann.kind}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleJurySafe(ann)} title="Toggle jury-safe"
                        className="p-0.5 text-slate-500 hover:text-green-400"><Eye className="w-3 h-3" /></button>
                      <button onClick={() => startEdit(ann)} title="Edit label"
                        className="p-0.5 text-slate-500 hover:text-cyan-400"><Pencil className="w-3 h-3" /></button>
                      <button onClick={() => deleteAnnotation(ann.id)} title="Delete"
                        className="p-0.5 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
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
            <StickyNote className="w-3.5 h-3.5 inline mr-1" />
            {annotations.length} annotations
          </span>
          <button
            onClick={() => setModalOpen(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Quote
          </button>
        </div>

        <div className="flex-1 overflow-auto flex justify-center items-start bg-[#050809] p-6">
          {!fileUrl ? (
            <div className="text-slate-500 text-sm mt-16">No file attached to this extract.</div>
          ) : isPdf ? (
            <div className="relative inline-block">
              <canvas ref={canvasRef} style={{ display: "block" }} />
              {rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1e]/60 text-slate-500 text-sm">
                  Rendering…
                </div>
              )}
              {/* Show active quote highlight overlay hint */}
              {activeId && (() => {
                const ann = annotations.find(a => a.id === activeId);
                if (!ann || !ann.quote_text) return null;
                if ((ann.page_number ?? 1) !== pageIndex) return null;
                return (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                    <div className="bg-[#0f1629]/90 border border-orange-400/40 rounded-xl px-5 py-3 max-w-lg text-center shadow-xl">
                      <p className="text-[10px] text-orange-400/70 uppercase tracking-widest mb-1">Selected Quote</p>
                      <p className="text-sm text-white font-medium leading-snug">"{ann.quote_text}"</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <img src={fileUrl} alt="Extract" style={{ maxWidth: "100%" }} draggable={false} />
          )}
        </div>
      </div>

      {/* Quote Modal */}
      <QuoteAnnotationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveQuote}
        defaultPage={pageIndex}
        groups={groups}
      />
    </div>
  );
}