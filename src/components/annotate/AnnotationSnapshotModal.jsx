import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Highlighter, RefreshCw } from "lucide-react";

/**
 * Modal shown after drag-select in Highlight mode on AnnotatePage.
 * Creates an ExhibitAnnotations record with a snapshot PNG.
 *
 * Props:
 *   open, onClose
 *   extractId, pageNumber
 *   captureData: { blob, snapshotW, snapshotH, cropRectCanvas, textHighlights, hasTextLayer }
 *   color, opacity
 *   onSaved(record)
 */
export default function AnnotationSnapshotModal({
  open, onClose, extractId, pageNumber, captureData, color, opacity, onSaved,
}) {
  const [label, setLabel] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [anchorText, setAnchorText] = useState("");
  const [jurySafe, setJurySafe] = useState(true);
  const [showInSpotlight, setShowInSpotlight] = useState(true);
  const [textHighlightsMode, setTextHighlightsMode] = useState("auto");
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!captureData?.blob) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(captureData.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [captureData?.blob]);

  useEffect(() => {
    if (open) {
      setLabel("");
      setQuoteText("");
      setAnchorText("");
      setJurySafe(true);
      setShowInSpotlight(true);
      setTextHighlightsMode("auto");
      setSaving(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!captureData?.blob || !extractId) return;
    setSaving(true);

    // Upload snapshot PNG
    const file = new File(
      [captureData.blob],
      `ann_snap_p${pageNumber}_${Date.now()}.png`,
      { type: "image/png" }
    );
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const textHighlights =
      textHighlightsMode === "auto" && captureData.hasTextLayer
        ? captureData.textHighlights
        : [];

    const record = await base44.entities.ExhibitAnnotations.create({
      extract_id: extractId,
      page_number: pageNumber,
      kind: "highlight",
      label: label.trim() || `p.${pageNumber} highlight`,
      label_text: label.trim() || `p.${pageNumber} highlight`,
      color: color || "yellow",
      opacity: opacity ?? 0.35,
      quote_text: quoteText.trim(),
      anchor_text: anchorText.trim(),
      jury_safe: jurySafe,
      show_in_spotlight: showInSpotlight,
      show_quote_in_present: showInSpotlight,
      snapshot_file: file_url,
      snapshot_w: captureData.snapshotW,
      snapshot_h: captureData.snapshotH,
      snapshot_page: pageNumber,
      snapshot_source: "pdfcanvas",
      crop_rect_canvas: captureData.cropRectCanvas,
      text_highlights: textHighlights,
      text_highlights_mode: textHighlightsMode,
      has_text_layer: captureData.hasTextLayer,
      sort_index: 0,
    });

    setSaving(false);
    onSaved(record);
    onClose();
  };

  const hasText = captureData?.hasTextLayer && (captureData?.textHighlights?.length > 0);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
      <DialogContent className="bg-[#0f1629] border border-[#1e2a45] text-slate-200 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-300 text-sm">
            <Highlighter className="w-4 h-4" /> Save Highlight Annotation
          </DialogTitle>
        </DialogHeader>

        {/* Snapshot preview */}
        {previewUrl && (
          <div className="rounded-lg overflow-hidden border border-[#1e2a45] bg-[#050809]">
            <img src={previewUrl} alt="Snapshot preview" className="w-full object-contain max-h-40" />
          </div>
        )}

        <div className="space-y-3">
          {/* Label */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Short Label</label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={`p.${pageNumber} highlight`}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 h-8 text-xs"
              autoFocus
            />
          </div>

          {/* Quote text */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Quote Text <span className="text-slate-500">(shown in Spotlight)</span>
            </label>
            <Textarea
              value={quoteText}
              onChange={e => setQuoteText(e.target.value)}
              placeholder="Paste the exact excerpt to show in Present spotlight…"
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs"
              rows={2}
            />
          </div>

          {/* Anchor text */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Anchor Text <span className="text-slate-500">(optional context)</span>
            </label>
            <Textarea
              value={anchorText}
              onChange={e => setAnchorText(e.target.value)}
              placeholder="Surrounding passage for search context…"
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs"
              rows={2}
            />
          </div>

          {/* Text highlights mode */}
          {hasText && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={textHighlightsMode === "auto"}
                onChange={e => setTextHighlightsMode(e.target.checked ? "auto" : "none")}
                className="accent-yellow-400 w-3.5 h-3.5"
              />
              <span className="text-xs text-slate-300">
                Auto-highlight text inside crop ({captureData.textHighlights?.length} line{captureData.textHighlights?.length !== 1 ? "s" : ""} detected)
              </span>
            </label>
          )}
          {captureData && !captureData.hasTextLayer && (
            <p className="text-[10px] text-slate-500 italic">No selectable text detected — snapshot only.</p>
          )}

          {/* Jury safe */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={jurySafe}
              onChange={e => setJurySafe(e.target.checked)}
              className="accent-green-500 w-3.5 h-3.5"
            />
            <span className="text-xs text-slate-300">Jury-safe (visible in Present mode)</span>
          </label>

          {/* Show in spotlight */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInSpotlight}
              onChange={e => setShowInSpotlight(e.target.checked)}
              className="accent-yellow-400 w-3.5 h-3.5"
            />
            <span className="text-xs text-slate-300">Show in Present Spotlight overlay</span>
          </label>

          <p className="text-[10px] text-slate-500">p.{pageNumber} · Snapshot PNG will be saved.</p>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}
            className="border-[#1e2a45] text-slate-400 hover:text-slate-200 text-xs h-8">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !captureData?.blob}
            className="bg-yellow-600 hover:bg-yellow-700 text-black text-xs h-8">
            {saving ? "Saving…" : "Save Annotation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}