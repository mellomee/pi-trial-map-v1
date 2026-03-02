import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Scissors } from "lucide-react";

/**
 * Modal shown after drag-select on AnnotatePage.
 * Receives: extractId, pageNumber, cropBlob (png blob from canvas crop)
 * On save: uploads PNG, creates ExhibitCallouts record, calls onSaved(record).
 */
export default function CalloutCaptureModal({ open, onClose, extractId, pageNumber, cropBlob, onSaved }) {
  const [label, setLabel] = useState("");
  const [jurySafe, setJurySafe] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!cropBlob) return;
    const url = URL.createObjectURL(cropBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cropBlob]);

  useEffect(() => {
    if (open) {
      setLabel("");
      setJurySafe(true);
      setSaving(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!cropBlob || !extractId) return;
    setSaving(true);
    // Upload the PNG blob
    const file = new File([cropBlob], `callout_p${pageNumber}_${Date.now()}.png`, { type: "image/png" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    // Create DB record
    const record = await base44.entities.ExhibitCallouts.create({
      extract_id: extractId,
      page_number: pageNumber,
      label: label.trim() || `Page ${pageNumber} callout`,
      callout_image: file_url,
      jury_safe: jurySafe,
    });
    setSaving(false);
    onSaved(record);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
      <DialogContent className="bg-[#0f1629] border border-[#1e2a45] text-slate-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-300">
            <Scissors className="w-4 h-4" /> Save Callout Clip
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        {previewUrl && (
          <div className="rounded-lg overflow-hidden border border-[#1e2a45] bg-[#050809]">
            <img src={previewUrl} alt="Callout preview" className="w-full object-contain max-h-48" />
          </div>
        )}

        <div className="space-y-3 mt-1">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Label</label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={`Page ${pageNumber} callout`}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && !saving) handleSave(); }}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={jurySafe}
              onChange={e => setJurySafe(e.target.checked)}
              className="accent-green-500 w-3.5 h-3.5"
            />
            <span className="text-xs text-slate-300">Jury-safe (visible in Present mode)</span>
          </label>

          <p className="text-[10px] text-slate-500">
            Page {pageNumber} · Callout clip (PNG) will be saved with highlight baked in.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}
            className="border-[#1e2a45] text-slate-400 hover:text-slate-200">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !cropBlob}
            className="bg-orange-600 hover:bg-orange-700 text-white">
            {saving ? "Saving…" : "Save Callout"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}