import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tag } from "lucide-react";

/**
 * MarkJointModal — mark a depo exhibit as a joint exhibit, tied to a specific extract
 *
 * Props:
 *   open: bool
 *   onClose: fn()
 *   caseId: string
 *   extract: ExhibitExtract record (required — exhibit_extract_id)
 *   sourceExhibit: DepositionExhibit (the raw depo exhibit being marked)
 *   onSaved: fn(jointRecord)
 */
export default function MarkJointModal({ open, onClose, caseId, extract, sourceExhibit, onSaved }) {
  const [form, setForm] = useState({
    marked_no: "",
    marked_title: "",
    internal_name: "",
    marked_by_side: "Plaintiff",
    is_photo: false,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open && extract) {
      setForm(f => ({
        ...f,
        marked_title: extract.extract_title_official || sourceExhibit?.display_title || sourceExhibit?.depo_exhibit_title || "",
        internal_name: extract.extract_title_internal || "",
      }));
    }
  }, [open, extract?.id]);

  const handleSave = async () => {
    if (!form.marked_no || !extract) return;
    setSaving(true);
    const joint = await base44.entities.JointExhibits.create({
      case_id: caseId,
      exhibit_extract_id: extract.id,
      primary_depo_exhibit_id: sourceExhibit?.id || null,
      source_depo_exhibit_ids: sourceExhibit ? [sourceExhibit.id] : [],
      marked_no: form.marked_no,
      marked_title: form.marked_title || extract.extract_title_official,
      internal_name: form.internal_name || null,
      marked_by_side: form.marked_by_side,
      is_photo: form.is_photo,
      status: "Marked",
      notes: form.notes || null,
    });
    // Link the depo exhibit back to this joint record
    if (sourceExhibit) {
      await base44.entities.DepositionExhibits.update(sourceExhibit.id, { joint_exhibit_id: joint.id });
    }
    setSaving(false);
    onSaved?.(joint);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose?.()}>
      <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-cyan-400 flex items-center gap-2">
            <Tag className="w-4 h-4" /> Mark as Joint Exhibit
          </DialogTitle>
          {extract && (
            <div className="mt-1 text-xs text-slate-500 space-y-0.5">
              <p>Extract: <span className="text-emerald-400">{extract.extract_title_official}</span></p>
              {(extract.extract_page_start || extract.extract_page_end) && (
                <p>Raw pages: {extract.extract_page_start}–{extract.extract_page_end}</p>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs">Joint Exhibit Number *</Label>
              <Input placeholder="e.g. 10" value={form.marked_no}
                onChange={e => setForm(f => ({ ...f, marked_no: e.target.value }))}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Marked By</Label>
              <Select value={form.marked_by_side} onValueChange={v => setForm(f => ({ ...f, marked_by_side: v }))}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-slate-400 text-xs">Judge Title (official)</Label>
            <Input value={form.marked_title}
              onChange={e => setForm(f => ({ ...f, marked_title: e.target.value }))}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
              placeholder="Defaults to extract official title" />
          </div>

          <div>
            <Label className="text-slate-400 text-xs">Internal Name (team only)</Label>
            <Input value={form.internal_name}
              onChange={e => setForm(f => ({ ...f, internal_name: e.target.value }))}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
              placeholder="Optional shorthand" />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_photo" checked={form.is_photo}
              onChange={e => setForm(f => ({ ...f, is_photo: e.target.checked }))}
              className="accent-cyan-500" />
            <label htmlFor="is_photo" className="text-xs text-slate-400 cursor-pointer">Is photograph / image exhibit</label>
          </div>

          <div>
            <Label className="text-slate-400 text-xs">Notes</Label>
            <Textarea value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#1e2a45]">Cancel</Button>
          <Button onClick={handleSave} disabled={!form.marked_no || saving}
            className="bg-cyan-600 hover:bg-cyan-700">
            {saving ? "Saving…" : "Add to Joint List"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}