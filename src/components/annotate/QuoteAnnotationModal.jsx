import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Clipboard, MousePointer2 } from "lucide-react";

/**
 * Modal for creating/editing a QUOTE_SPOTLIGHT annotation.
 * No coordinate storage — just text and metadata.
 */
export default function QuoteAnnotationModal({ open, onClose, onSave, defaultPage, groups = [] }) {
  const [pageNumber, setPageNumber] = useState(defaultPage || 1);
  const [quoteText, setQuoteText] = useState("");
  const [anchorText, setAnchorText] = useState("");
  const [labelText, setLabelText] = useState("");
  const [jurySafe, setJurySafe] = useState(true);
  const [groupId, setGroupId] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setPageNumber(defaultPage || 1);
      setQuoteText("");
      setAnchorText("");
      setLabelText("");
      setJurySafe(true);
      setGroupId("");
    }
  }, [open, defaultPage]);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setAnchorText(text.trim());
    } catch {
      alert("Clipboard access denied. Please paste manually.");
    }
  };

  const autoCaptureSelection = () => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    if (text) {
      setAnchorText(text);
    } else {
      alert("No text selected in the PDF. Select text first, then click this button. (Scanned PDFs may not support text selection — use Paste from Clipboard instead.)");
    }
  };

  const handleSave = async () => {
    if (!quoteText.trim()) return;
    setSaving(true);
    const quoteTrimmed = quoteText.trim();
    const anchorTrimmed = anchorText.trim() || quoteTrimmed; // fallback to quote
    await onSave({
      kind: "QUOTE_SPOTLIGHT",
      page_number: Number(pageNumber),
      quote_text: quoteTrimmed,
      anchor_text: anchorTrimmed,
      anchor_prefix: anchorTrimmed.slice(0, 40),
      anchor_suffix: anchorTrimmed.slice(-40),
      label_text: labelText.trim() || quoteTrimmed.slice(0, 60),
      jury_safe: jurySafe,
      group_id: groupId || null,
    });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-orange-400 flex items-center gap-2">
            ✦ New Spotlight Quote
          </DialogTitle>
          <p className="text-xs text-slate-500">Text-anchored — works perfectly regardless of zoom or scale.</p>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Page number */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Page number</label>
            <Input
              type="number" min={1} value={pageNumber}
              onChange={e => setPageNumber(e.target.value)}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 w-24"
            />
          </div>

          {/* Quote text */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Quote Text <span className="text-orange-400">*</span>
              <span className="text-slate-600 ml-1">— shown to jury in spotlight</span>
            </label>
            <Textarea
              value={quoteText}
              onChange={e => setQuoteText(e.target.value)}
              placeholder="Type or paste the exact quote…"
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-sm"
              rows={3}
            />
          </div>

          {/* Anchor text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">
                Anchor Text
                <span className="text-slate-600 ml-1">— for text-search (defaults to quote)</span>
              </label>
              {quoteText.trim() && (
                <button
                  type="button"
                  onClick={() => setAnchorText(quoteText)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded px-1.5 py-0.5"
                >
                  Use Quote
                </button>
              )}
            </div>
            <Textarea
              value={anchorText}
              onChange={e => setAnchorText(e.target.value)}
              placeholder="Paste a longer surrounding passage for better text-search accuracy…"
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-sm"
              rows={2}
            />
            {/* Search Assist buttons */}
            <div className="flex gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={autoCaptureSelection}
                className="flex items-center gap-1 text-[10px] text-violet-400 border border-violet-500/30 rounded px-2 py-0.5 hover:bg-violet-500/10"
              >
                <MousePointer2 className="w-3 h-3" />
                Auto-capture PDF selection
              </button>
              <button
                type="button"
                onClick={pasteFromClipboard}
                className="flex items-center gap-1 text-[10px] text-slate-400 border border-[#1e2a45] rounded px-2 py-0.5 hover:bg-white/5"
              >
                <Clipboard className="w-3 h-3" />
                Paste from Clipboard
              </button>
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Short label <span className="text-slate-600">(auto-filled if blank)</span></label>
            <Input
              value={labelText}
              onChange={e => setLabelText(e.target.value)}
              placeholder="e.g. Sightlines blocked"
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
            />
          </div>

          {/* Group */}
          {groups.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Group (optional)</label>
              <select
                value={groupId}
                onChange={e => setGroupId(e.target.value)}
                className="w-full h-9 rounded-md bg-[#0a0f1e] border border-[#1e2a45] text-slate-200 text-sm px-2"
              >
                <option value="">— No group —</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Jury safe */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={jurySafe}
              onChange={e => setJurySafe(e.target.checked)}
              className="accent-green-500"
            />
            <span className="text-sm text-slate-300">Jury-safe <span className="text-xs text-slate-500">(show in Present mode)</span></span>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="border-[#1e2a45] text-slate-300">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !quoteText.trim()}
            className="bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Quote"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}