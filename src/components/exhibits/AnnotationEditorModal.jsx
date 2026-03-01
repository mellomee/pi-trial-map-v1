import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StickyNote } from "lucide-react";

const COLOR_OPTIONS = ["yellow", "red", "green", "blue", "none"];
const KIND_OPTIONS  = ["highlight", "redaction", "callout"];

export default function AnnotationEditorModal({ editing, setEditing, onSave, saving, groups }) {
  if (!editing) return null;

  const isNew = !editing.id;

  return (
    <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
      <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-yellow-400 flex items-center gap-2 text-sm">
            <StickyNote className="w-4 h-4" />
            {isNew ? "New Annotation" : "Edit Annotation"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Kind + color row */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">Kind</label>
              <Select value={editing.kind || "highlight"} onValueChange={v => setEditing(p => ({ ...p, kind: v }))}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editing.kind !== "redaction" && (
              <div className="flex-1">
                <label className="text-xs text-slate-400 block mb-1">Color</label>
                <div className="flex gap-1.5 mt-1.5">
                  {COLOR_OPTIONS.filter(c => c !== "none").map(c => (
                    <button
                      key={c}
                      onClick={() => setEditing(p => ({ ...p, color: c }))}
                      className={`w-5 h-5 rounded border-2 transition-all ${
                        editing.color === c ? "border-white scale-110" : "border-transparent opacity-60"
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
          {editing.kind !== "redaction" && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Opacity: {Math.round((editing.opacity ?? 0.35) * 100)}%</label>
              <input
                type="range" min="10" max="80" step="5"
                value={Math.round((editing.opacity ?? 0.35) * 100)}
                onChange={e => setEditing(p => ({ ...p, opacity: Number(e.target.value) / 100 }))}
                className="w-full accent-yellow-400"
              />
            </div>
          )}

          {/* Page (read-only when from draw) */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">Page #</label>
              <Input
                type="number"
                value={editing.page_number ?? editing.extract_page_number ?? ""}
                onChange={e => setEditing(p => ({ ...p, page_number: e.target.value ? Number(e.target.value) : null }))}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 h-8 text-xs"
                placeholder="1"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">Label (hover)</label>
              <Input
                value={editing.label_text ?? editing.label ?? ""}
                onChange={e => setEditing(p => ({ ...p, label_text: e.target.value }))}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 h-8 text-xs"
                placeholder="Key admission"
              />
            </div>
          </div>

          {/* Callout text */}
          {editing.kind === "callout" && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Callout Text</label>
              <Input
                value={editing.geometry_json?.text ?? ""}
                onChange={e => setEditing(p => ({ ...p, geometry_json: { ...(p.geometry_json || {}), text: e.target.value } }))}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 h-8 text-xs"
                placeholder="Shows on arrow label…"
              />
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Internal Note</label>
            <Textarea
              value={editing.note_text ?? ""}
              onChange={e => setEditing(p => ({ ...p, note_text: e.target.value }))}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs"
              rows={2}
              placeholder="Internal note…"
            />
          </div>

          {/* Group */}
          {groups?.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Group (optional)</label>
              <Select value={editing.group_id || "none"} onValueChange={v => setEditing(p => ({ ...p, group_id: v === "none" ? null : v }))}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs h-8">
                  <SelectValue placeholder="Assign to group…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No group —</SelectItem>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name} ({g.audience})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Jury safe toggle */}
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={!!editing.jury_safe}
              onChange={e => setEditing(p => ({ ...p, jury_safe: e.target.checked }))}
              className="accent-green-400"
            />
            Jury-safe (show in present mode even without JurySafe group)
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEditing(null)} className="border-[#1e2a45] text-xs h-8">Cancel</Button>
            <Button
              onClick={onSave}
              disabled={saving}
              className="bg-yellow-600 hover:bg-yellow-700 text-black text-xs h-8"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}