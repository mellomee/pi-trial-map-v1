import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StickyNote, RefreshCw } from "lucide-react";

const COLOR_OPTIONS = ["yellow", "red", "green", "blue"];
const KIND_OPTIONS  = ["QUOTE_SPOTLIGHT", "highlight", "redaction", "callout", "NOTE"];

/**
 * Edit modal for annotations.
 * Uses LOCAL controlled state so all fields persist properly.
 * Parent passes `editing` (annotation object) and `setEditing` to close.
 * `onSave` is called with the local state values.
 */
export default function AnnotationEditorModal({ editing, setEditing, onSave, saving, groups, onReextract }) {
  const [form, setForm] = useState(null);

  // Initialize local state each time a new annotation is opened
  useEffect(() => {
    if (!editing) { setForm(null); return; }
    setForm({
      kind:                  editing.kind || "QUOTE_SPOTLIGHT",
      color:                 editing.color || "yellow",
      opacity:               editing.opacity ?? 0.35,
      page_number:           editing.page_number ?? editing.extract_page_number ?? 1,
      label_text:            editing.label_text ?? editing.label ?? "",
      quote_text:            editing.quote_text ?? "",
      anchor_text:           editing.anchor_text ?? "",
      internal_note:         editing.internal_note ?? editing.note_text ?? "",
      extracted_text:        editing.extracted_text ?? "",
      note_text:             editing.note_text ?? editing.internal_note ?? "",
      show_quote_in_present: editing.show_quote_in_present !== false,
      show_in_spotlight:     editing.show_in_spotlight !== false,
      jury_safe:             !!editing.jury_safe,
      group_id:              editing.group_id || "",
      text_highlights_mode:  editing.text_highlights_mode || "auto",
      has_text_layer:        !!editing.has_text_layer,
      snapshot_file:         editing.snapshot_file || null,
      // preserve geometry fields
      geometry_json:         editing.geometry_json || null,
      rect_norm:             editing.rect_norm || null,
      id:                    editing.id,
    });
  }, [editing?.id, editing ? JSON.stringify({
    quote_text: editing.quote_text,
    anchor_text: editing.anchor_text,
    label_text: editing.label_text,
    internal_note: editing.internal_note,
    note_text: editing.note_text,
    text_highlights_mode: editing.text_highlights_mode,
  }) : null]);

  if (!editing || !form) return null;

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    // Pass local form state back to parent's save handler
    onSave(form);
  };

  const handleReextract = () => {
    if (onReextract) onReextract(form, (newText) => {
      setForm(prev => ({
        ...prev,
        extracted_text: newText,
        quote_text: prev.quote_text || newText,
      }));
    });
  };

  return (
    <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
      <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-yellow-400 flex items-center gap-2 text-sm">
            <StickyNote className="w-4 h-4" />
            Edit Annotation
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">

          {/* Kind + Color */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">Kind</label>
              <Select value={form.kind} onValueChange={v => set("kind", v)}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.kind !== "redaction" && (
              <div className="flex-1">
                <label className="text-xs text-slate-400 block mb-1">Color</label>
                <div className="flex gap-1.5 mt-1.5">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c} onClick={() => set("color", c)}
                      className={`w-5 h-5 rounded border-2 transition-all ${
                        form.color === c ? "border-white scale-110" : "border-transparent opacity-60"
                      } ${
                        c === "yellow" ? "bg-yellow-400" :
                        c === "red" ? "bg-red-500" :
                        c === "green" ? "bg-green-500" : "bg-blue-500"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Opacity */}
          {form.kind !== "redaction" && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Opacity: {Math.round((form.opacity ?? 0.35) * 100)}%
              </label>
              <input type="range" min="10" max="80" step="5"
                value={Math.round((form.opacity ?? 0.35) * 100)}
                onChange={e => set("opacity", Number(e.target.value) / 100)}
                className="w-full accent-yellow-400"
              />
            </div>
          )}

          {/* Page + Label */}
          <div className="flex gap-2">
            <div className="w-20">
              <label className="text-xs text-slate-400 block mb-1">Page #</label>
              <Input type="number"
                value={form.page_number}
                onChange={e => set("page_number", e.target.value ? Number(e.target.value) : "")}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 h-8 text-xs"
                placeholder="1"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">Short Label</label>
              <Input
                value={form.label_text}
                onChange={e => set("label_text", e.target.value)}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 h-8 text-xs"
                placeholder="e.g. Sightlines blocked"
              />
            </div>
          </div>

          {/* Quote Text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">
                Quote Text <span className="text-orange-400">★</span>
                <span className="text-slate-600 ml-1">— shown in Present Spotlight</span>
              </label>
              {form.extracted_text && !form.quote_text && (
                <button onClick={() => set("quote_text", form.extracted_text)}
                  className="text-[9px] text-cyan-400 border border-cyan-500/30 rounded px-1.5 py-0.5 hover:bg-cyan-500/10">
                  Use extracted
                </button>
              )}
            </div>
            <Textarea
              value={form.quote_text}
              onChange={e => set("quote_text", e.target.value)}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs"
              rows={3}
              placeholder="Paste the exact excerpt to display in Spotlight…"
            />
          </div>

          {/* Extracted text (read-only preview + re-extract) */}
          {(form.extracted_text || onReextract) && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">
                  Auto-extracted Text
                  <span className="text-slate-600 ml-1">(from PDF text layer)</span>
                </label>
                {onReextract && form.rect_norm && (
                  <button onClick={handleReextract}
                    className="flex items-center gap-1 text-[9px] text-violet-400 border border-violet-500/30 rounded px-1.5 py-0.5 hover:bg-violet-500/10">
                    <RefreshCw className="w-2.5 h-2.5" /> Re-extract
                  </button>
                )}
              </div>
              {form.extracted_text ? (
                <div className="bg-[#0a0f1e] border border-[#1e2a45] rounded px-2 py-1.5 text-[11px] text-slate-400 italic max-h-20 overflow-y-auto">
                  "{form.extracted_text}"
                </div>
              ) : (
                <p className="text-[10px] text-slate-600 italic">
                  No selectable text detected in highlight area. Paste quote manually above.
                </p>
              )}
            </div>
          )}

          {/* Anchor Text */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Anchor Text <span className="text-slate-600">(optional — surrounding passage for search)</span>
            </label>
            <Textarea
              value={form.anchor_text}
              onChange={e => set("anchor_text", e.target.value)}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs"
              rows={2}
              placeholder="Surrounding sentence for future auto-locate…"
            />
          </div>

          {/* Internal Note */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Internal Note</label>
            <Textarea
              value={form.note_text}
              onChange={e => set("note_text", e.target.value)}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs"
              rows={2}
              placeholder="Internal note (not shown to jury)…"
            />
          </div>

          {/* Group */}
          {groups?.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Group (optional)</label>
              <Select value={form.group_id || "none"} onValueChange={v => set("group_id", v === "none" ? "" : v)}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs h-8">
                  <SelectValue placeholder="Assign to group…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No group —</SelectItem>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Snapshot preview */}
          {form.snapshot_file && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Snapshot</label>
              <img src={form.snapshot_file} alt="Snapshot" className="w-full max-h-32 object-contain rounded border border-[#1e2a45] bg-[#050809]" />
            </div>
          )}

          {/* Text highlights toggle */}
          {form.has_text_layer && (
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox"
                checked={form.text_highlights_mode === "auto"}
                onChange={e => set("text_highlights_mode", e.target.checked ? "auto" : "none")}
                className="accent-yellow-400"
              />
              Auto-highlight text inside crop (selectable text detected)
            </label>
          )}

          {/* Toggles */}
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox"
              checked={form.show_quote_in_present}
              onChange={e => set("show_quote_in_present", e.target.checked)}
              className="accent-yellow-400"
            />
            Show quote in Present Spotlight
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox"
              checked={form.jury_safe}
              onChange={e => set("jury_safe", e.target.checked)}
              className="accent-green-400"
            />
            Jury-safe (visible in Present mode)
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEditing(null)} className="border-[#1e2a45] text-xs h-8">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-black text-xs h-8">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}