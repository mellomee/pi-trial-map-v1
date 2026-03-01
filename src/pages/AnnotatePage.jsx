import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import PdfPageWithOverlay from "@/components/PdfPageWithOverlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Trash2, Pencil, Check, X,
  Eye, EyeOff, Plus, StickyNote, ZoomIn, ZoomOut
} from "lucide-react";

function isPdf(url) { return url?.toLowerCase().includes(".pdf"); }

export default function AnnotatePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const extractId = urlParams.get("extractId");

  const [extract, setExtract] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [pageIndex, setPageIndex] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.25);
  const [mode, setMode] = useState("view"); // "view" | "annotate"
  const [showJurySafeOnly, setShowJurySafeOnly] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!extractId) return;
    Promise.all([
      base44.entities.ExhibitExtracts.filter({ id: extractId }),
      base44.entities.ExhibitAnnotations.filter({ extract_id: extractId }),
    ]).then(([exts, anns]) => {
      setExtract(exts[0] || null);
      setAnnotations(anns);
    }).finally(() => setLoading(false));
  }, [extractId]);

  // Auto-detect num pages from PDF (we'll just load the doc and count)
  // We track it via onNumPages callback from PdfPageWithOverlay
  const handleNumPages = useCallback((n) => setNumPages(n), []);

  const handleCreateAnnotation = useCallback(async (coordPayload) => {
    if (!extractId) return;
    const label = `p.${coordPayload.page_number ?? pageIndex}`;
    const ann = await base44.entities.ExhibitAnnotations.create({
      extract_id: extractId,
      kind: "highlight",
      color: "yellow",
      opacity: 0.35,
      label_text: label,
      jury_safe: true,
      sort_index: annotations.length,
      ...coordPayload, // source_type, page_number, page_rotation, rect_pdf | rect_norm, viewport_meta
    });
    setAnnotations(prev => [...prev, ann]);
    setActiveId(ann.id);
    setMode("view");
  }, [extractId, pageIndex, annotations.length]);

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

  const fileUrl = extract?.extract_file_url || null;
  const visibleAnns = showJurySafeOnly
    ? annotations.filter(a => a.jury_safe)
    : annotations;

  const pageAnns = visibleAnns.filter(a => (a.page_number ?? a.extract_page_number ?? 1) === pageIndex);

  if (!extractId) {
    return <div className="p-8 text-slate-400">No extractId in URL. Use ?extractId=...</div>;
  }

  if (loading) {
    return <div className="p-8 text-slate-400">Loading extract…</div>;
  }

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden">

      {/* ── Left sidebar ───────────────────────────────── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r border-[#1e2a45] bg-[#0f1629]">
        {/* Header */}
        <div className="p-4 border-b border-[#1e2a45]">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Annotating</p>
          <p className="text-sm font-semibold text-slate-200 leading-tight">
            {extract?.extract_title_official || extract?.extract_title_internal || "Extract"}
          </p>
          {extract?.extract_page_count && (
            <p className="text-[10px] text-slate-500 mt-0.5">{extract.extract_page_count} pages</p>
          )}
        </div>

        {/* Controls */}
        <div className="p-3 border-b border-[#1e2a45] flex flex-col gap-2">
          <button
            onClick={() => setMode(m => m === "annotate" ? "view" : "annotate")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium border transition-colors ${
              mode === "annotate"
                ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                : "text-slate-400 border-[#1e2a45] hover:text-slate-200 hover:border-slate-500"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            {mode === "annotate" ? "Cancel — click to draw" : "New Highlight"}
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
              No annotations yet.<br />Use "New Highlight" to draw one.
            </p>
          )}
          {/* Group by page */}
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
                  <div key={ann.id}
                    onClick={() => selectAnnotation(ann)}
                    className={`group flex items-start gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                      isActive ? "bg-orange-500/15 border border-orange-500/30" : "hover:bg-white/5 border border-transparent"
                    }`}>
                    <span className="text-orange-400 mt-0.5 flex-shrink-0 text-[10px]">▪</span>
                    <div className="flex-1 min-w-0">
                      {editingId === ann.id ? (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Input
                            value={editLabel}
                            onChange={e => setEditLabel(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveLabel(); if (e.key === "Escape") setEditingId(null); }}
                            className="h-5 text-[10px] bg-[#0a0f1e] border-[#1e2a45] text-slate-200 flex-1 px-1"
                            autoFocus
                          />
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
        {/* Top toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-[#0f1629] border-b border-[#1e2a45] flex-shrink-0">
          {/* Page nav */}
          <button onClick={() => setPageIndex(p => Math.max(1, p - 1))} disabled={pageIndex <= 1}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs text-slate-400 w-16 text-center">{pageIndex} / {numPages || "…"}</span>
          <button onClick={() => setPageIndex(p => Math.min(numPages || p, p + 1))} disabled={pageIndex >= (numPages || 1)}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          <div className="w-px h-4 bg-[#1e2a45]" />
          {/* Zoom */}
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-[10px] text-slate-500 w-8 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-1 text-slate-400 hover:text-white"><ZoomIn className="w-4 h-4" /></button>
          <div className="w-px h-4 bg-[#1e2a45]" />
          <span className="text-[10px] text-slate-500">
            <StickyNote className="w-3.5 h-3.5 inline mr-1" />
            {annotations.length} annotations
          </span>
          {mode === "annotate" && (
            <span className="ml-2 text-[10px] text-orange-300 animate-pulse font-medium">
              ✦ Draw mode — drag to highlight
            </span>
          )}
        </div>

        {/* Viewer */}
        <div className="flex-1 overflow-auto flex justify-center items-start bg-[#050809] p-6">
          {!fileUrl ? (
            <div className="text-slate-500 text-sm mt-16">No PDF file attached to this extract.</div>
          ) : (
            <PdfPageWithOverlay
              fileUrl={fileUrl}
              pageIndex={pageIndex}
              scale={scale}
              highlights={visibleAnns}
              mode={mode}
              activeId={activeId}
              onCreateRect={handleCreateRect}
              onSelect={(id) => { setActiveId(id); }}
              onNumPages={handleNumPages}
            />
          )}
        </div>
      </div>
    </div>
  );
}