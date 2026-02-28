import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileText } from "lucide-react";

/**
 * ExtractModal — reusable modal to create/edit an ExhibitExtract
 *
 * Props:
 *   open: bool
 *   onClose: fn()
 *   caseId: string
 *   sourceDepoExhibit: { id, depo_exhibit_no, depo_exhibit_title } (pre-filled source)
 *   initialData: extract obj (for editing)
 *   onSaved: fn(extractRecord) — called after save
 */
export default function ExtractModal({ open, onClose, caseId, sourceDepoExhibit, initialData, onSaved }) {
  const [form, setForm] = useState(() => initialData ? { ...initialData } : {
    extract_title_official: sourceDepoExhibit?.display_title || sourceDepoExhibit?.depo_exhibit_title || "",
    extract_title_internal: "",
    extract_page_start: "",
    extract_page_end: "",
    extract_file_url: "",
    notes: "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens with new source
  React.useEffect(() => {
    if (open) {
      if (initialData) {
        setForm({ ...initialData });
      } else {
        setForm({
          extract_title_official: sourceDepoExhibit?.display_title || sourceDepoExhibit?.depo_exhibit_title || "",
          extract_title_internal: "",
          extract_page_start: "",
          extract_page_end: "",
          extract_file_url: "",
          notes: "",
        });
      }
    }
  }, [open, sourceDepoExhibit?.id, initialData?.id]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(p => ({ ...p, extract_file_url: file_url }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.extract_title_official || !form.extract_file_url) return;
    setSaving(true);
    const payload = {
      case_id: caseId,
      source_depo_exhibit_id: sourceDepoExhibit?.id || form.source_depo_exhibit_id || null,
      extract_title_official: form.extract_title_official,
      extract_title_internal: form.extract_title_internal || null,
      extract_page_start: form.extract_page_start ? Number(form.extract_page_start) : null,
      extract_page_end: form.extract_page_end ? Number(form.extract_page_end) : null,
      extract_file_url: form.extract_file_url,
      notes: form.notes || null,
    };
    let result;
    if (form.id) {
      result = await base44.entities.ExhibitExtracts.update(form.id, payload);
    } else {
      result = await base44.entities.ExhibitExtracts.create(payload);
    }
    setSaving(false);
    onSaved?.(result);
    onClose?.();
  };

  const canSave = form.extract_title_official && form.extract_file_url && !uploading;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose?.()}>
      <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-emerald-400 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {form.id ? "Edit Extract" : "Create Extract"}
          </DialogTitle>
          {sourceDepoExhibit && (
            <p className="text-xs text-slate-500 mt-1">
              Source: {sourceDepoExhibit.depo_exhibit_no ? `#${sourceDepoExhibit.depo_exhibit_no} ` : ""}
              {sourceDepoExhibit.display_title || sourceDepoExhibit.depo_exhibit_title}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Official Title (judge-facing) *</label>
            <Input value={form.extract_title_official}
              onChange={e => setForm(p => ({ ...p, extract_title_official: e.target.value }))}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
              placeholder="e.g. Traffic Signal Maintenance Log" />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Internal Name (team only)</label>
            <Input value={form.extract_title_internal || ""}
              onChange={e => setForm(p => ({ ...p, extract_title_internal: e.target.value }))}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
              placeholder="e.g. Sightlines blocked" />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">Raw Page Start</label>
              <Input type="number" value={form.extract_page_start || ""}
                onChange={e => setForm(p => ({ ...p, extract_page_start: e.target.value }))}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="1" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">Raw Page End</label>
              <Input type="number" value={form.extract_page_end || ""}
                onChange={e => setForm(p => ({ ...p, extract_page_end: e.target.value }))}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="20" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Upload Extract PDF / Image *
              <span className="text-slate-600 ml-1">(use Print-to-PDF to export the page range first)</span>
            </label>
            <div className="flex gap-2 items-center">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={e => handleUpload(e.target.files?.[0])}
                className="hidden" id="extract-modal-file" />
              <label htmlFor="extract-modal-file"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e2a45] hover:bg-[#263450] text-slate-300 text-xs cursor-pointer border border-[#2e3a55]">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "Uploading…" : "Choose File"}
              </label>
              {form.extract_file_url && (
                <a href={form.extract_file_url} target="_blank" rel="noreferrer"
                  className="text-xs text-emerald-400 hover:underline truncate max-w-[180px]">
                  ✓ File uploaded
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Notes</label>
            <Textarea value={form.notes || ""}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#1e2a45]">Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}
            className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? "Saving…" : "Save Extract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}