import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, StickyNote } from "lucide-react";

const EMPTY_ANN = { extract_page_number: "", label: "", highlight_text: "", note_text: "" };

export default function AnnotationsSection({ extractId }) {
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | ann obj
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!extractId) return;
    base44.entities.ExhibitAnnotations.filter({ extract_id: extractId })
      .then(setAnnotations)
      .finally(() => setLoading(false));
  }, [extractId]);

  const openNew = () => setEditing({ ...EMPTY_ANN });
  const openEdit = (a) => setEditing({ ...a });

  const save = async () => {
    if (!editing || !editing.note_text.trim()) return;
    setSaving(true);
    const payload = {
      extract_id: extractId,
      extract_page_number: editing.extract_page_number ? Number(editing.extract_page_number) : null,
      label: editing.label || null,
      highlight_text: editing.highlight_text || null,
      note_text: editing.note_text,
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
    setSaving(false);
  };

  const remove = async (a) => {
    if (!confirm("Delete this annotation?")) return;
    await base44.entities.ExhibitAnnotations.delete(a.id);
    setAnnotations(prev => prev.filter(x => x.id !== a.id));
  };

  return (
    <div className="mt-3 pt-3 border-t border-[#1e2a45]">
      <div className="flex items-center justify-between mb-2">
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
        <p className="text-[10px] text-slate-600 italic">No annotations yet.</p>
      ) : (
        <div className="space-y-1.5">
          {annotations
            .slice()
            .sort((a, b) => (a.extract_page_number || 0) - (b.extract_page_number || 0))
            .map(a => (
              <div key={a.id} className="bg-[#0a0f1e] border border-[#1e2a45] rounded-lg px-3 py-2 flex gap-2">
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
                  </div>
                  {a.highlight_text && (
                    <p className="text-[10px] text-slate-500 italic mt-1 border-l-2 border-yellow-500/30 pl-1.5">
                      "{a.highlight_text}"
                    </p>
                  )}
                  <p className="text-xs text-slate-300 mt-1">{a.note_text}</p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
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

      {/* Add/Edit Modal */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-yellow-400 flex items-center gap-2 text-sm">
              <StickyNote className="w-4 h-4" />
              {editing?.id ? "Edit Annotation" : "Add Annotation"}
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
                <Button variant="outline" onClick={() => setEditing(null)} className="border-[#1e2a45]">Cancel</Button>
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