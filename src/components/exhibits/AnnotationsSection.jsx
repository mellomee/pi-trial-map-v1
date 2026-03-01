import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, StickyNote, MapPin } from "lucide-react";
import AnnotatedFileViewer from "@/components/exhibits/AnnotatedFileViewer";

const EMPTY_ANN = { extract_page_number: "", label: "", highlight_text: "", note_text: "", highlight_boxes: [] };

export default function AnnotationsSection({ extractId, extractFileUrl, presentMode = false }) {
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [flashId, setFlashId] = useState(null);

  // When in draw mode: we store the pending box here and open the save dialog
  const [pendingBox, setPendingBox] = useState(null);

  useEffect(() => {
    if (!extractId) return;
    base44.entities.ExhibitAnnotations.filter({ extract_id: extractId })
      .then(setAnnotations)
      .finally(() => setLoading(false));
  }, [extractId]);

  const openNew = () => setEditing({ ...EMPTY_ANN });
  const openEdit = (a) => setEditing({ ...a, highlight_boxes: a.highlight_boxes || [] });

  const flashAnnotation = (a) => {
    setFlashId(a.id);
    setTimeout(() => setFlashId(null), 2200);
  };

  // Called when user finishes drawing a box on the viewer
  const handleDrawComplete = (box) => {
    setPendingBox(box);
    setEditing({ ...EMPTY_ANN, extract_page_number: box.page, highlight_boxes: [box] });
  };

  const save = async () => {
    if (!editing || !editing.note_text.trim()) return;
    setSaving(true);
    const payload = {
      extract_id: extractId,
      extract_page_number: editing.extract_page_number ? Number(editing.extract_page_number) : null,
      label: editing.label || null,
      highlight_text: editing.highlight_text || null,
      note_text: editing.note_text,
      highlight_boxes: editing.highlight_boxes?.length ? editing.highlight_boxes : null,
    };
    let result;
    if (editing.id) {
      result = await base44.entities.ExhibitAnnotations.update(editing.id, payload);
      setAnnotations(prev => prev.map(a => a.id === result.id ? result : a));
    } else {
      result = await base44.entities.ExhibitAnnotations.create(payload);
      setAnnotations(prev => [...prev, result]);
    }
    setEditing(null);
    setPendingBox(null);
    setSaving(false);
    // Flash the newly saved annotation
    setTimeout(() => { setFlashId(result.id); setTimeout(() => setFlashId(null), 2200); }, 100);
  };

  const remove = async (a) => {
    if (!confirm("Delete this annotation?")) return;
    await base44.entities.ExhibitAnnotations.delete(a.id);
    setAnnotations(prev => prev.filter(x => x.id !== a.id));
  };

  return (
    <div className="mt-3 pt-3 border-t border-[#1e2a45] space-y-3">
      {/* File viewer with highlight overlay */}
      {extractFileUrl && (
        <AnnotatedFileViewer
          fileUrl={extractFileUrl}
          annotations={annotations}
          onDrawComplete={handleDrawComplete}
          presentMode={presentMode}
          flashAnnotationId={flashId}
        />
      )}

      {/* Annotation list */}
      {!presentMode && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-1">
              <StickyNote className="w-3 h-3" /> Annotations {annotations.length > 0 && `(${annotations.length})`}
            </p>
            <Button size="sm" onClick={openNew}
              className="h-6 px-2 text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 gap-1">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>

          {loading ? (
            <p className="text-[10px] text-slate-600">Loading…</p>
          ) : annotations.length === 0 ? (
            <p className="text-[10px] text-slate-600 italic">No annotations yet. Use the Highlight button above to draw on the document, or click Add.</p>
          ) : (
            <div className="space-y-1.5">
              {annotations
                .slice()
                .sort((a, b) => (a.extract_page_number || 0) - (b.extract_page_number || 0))
                .map(a => (
                  <div
                    key={a.id}
                    className="bg-[#0a0f1e] border border-[#1e2a45] rounded-lg px-3 py-2 flex gap-2 cursor-pointer hover:border-yellow-500/30 transition-colors"
                    onClick={() => flashAnnotation(a)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.extract_page_number && (
                          <span className="text-[10px] font-semibold text-yellow-400 bg-yellow-400/10 rounded px-1.5 py-0.5">
                            p.{a.extract_page_number}
                          </span>
                        )}
                        {a.label && (
                          <span className="text-[10px] font-medium text-slate-300">{a.label}</span>
                        )}
                        {(a.highlight_boxes?.length > 0) && (
                          <span className="text-[10px] text-yellow-500/60 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" /> {a.highlight_boxes.length} box{a.highlight_boxes.length > 1 ? "es" : ""}
                          </span>
                        )}
                      </div>
                      {a.highlight_text && (
                        <p className="text-[10px] text-slate-500 italic mt-1 border-l-2 border-yellow-500/30 pl-1.5">
                          "{a.highlight_text}"
                        </p>
                      )}
                      <p className="text-xs text-slate-300 mt-1">{a.note_text}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(a)} className="p-1 text-slate-500 hover:text-slate-200">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => remove(a)} className="p-1 text-slate-500 hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={!!editing} onOpenChange={() => { setEditing(null); setPendingBox(null); }}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-yellow-400 flex items-center gap-2 text-sm">
              <StickyNote className="w-4 h-4" />
              {editing?.id ? "Edit Annotation" : "Add Annotation"}
              {pendingBox && <span className="text-[10px] text-yellow-500/70 font-normal ml-1">— highlight drawn on p.{pendingBox.page}</span>}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 block mb-1">Page # (in extract)</label>
                  <Input
                    type="number"
                    value={editing.extract_page_number}
                    onChange={e => setEditing(p => ({ ...p, extract_page_number: e.target.value }))}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                    placeholder="1"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 block mb-1">Label (optional)</label>
                  <Input
                    value={editing.label}
                    onChange={e => setEditing(p => ({ ...p, label: e.target.value }))}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                    placeholder="e.g. Key admission"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Highlighted Text (optional)</label>
                <Textarea
                  value={editing.highlight_text}
                  onChange={e => setEditing(p => ({ ...p, highlight_text: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                  rows={2}
                  placeholder="Paste the text from the document you're highlighting…"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Note (required)</label>
                <Textarea
                  value={editing.note_text}
                  onChange={e => setEditing(p => ({ ...p, note_text: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                  rows={3}
                  placeholder="Internal note about this section…"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setEditing(null); setPendingBox(null); }} className="border-[#1e2a45]">Cancel</Button>
                <Button onClick={save} disabled={saving || !editing.note_text?.trim()}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black">
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}