import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Highlighter, Trash2, Plus } from "lucide-react";

const COLOR_CSS = {
  yellow: "rgba(255,220,0,0.42)",
  red:    "rgba(239,68,68,0.40)",
  green:  "rgba(34,197,94,0.40)",
  blue:   "rgba(59,130,246,0.40)",
};

/**
 * After a callout is created, this modal lets the user draw highlight rectangles
 * ON TOP of the callout snapshot image. Each rect is saved as an ExhibitAnnotations
 * record with callout_id and rect_norm (0..1 relative to snapshot image).
 *
 * Props:
 *   open, onClose
 *   callout        – ExhibitCallouts record (just created)
 *   extractId
 *   pageNumber
 *   onSaved(annotations[]) – called when user clicks Done
 */
export default function CalloutHighlightModal({ open, onClose, callout, extractId, pageNumber, onSaved }) {
  const [highlights, setHighlights] = useState([]); // local list of drawn rects
  const [color, setColor] = useState("yellow");
  const [label, setLabel] = useState("");
  const [jurySafe, setJurySafe] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragRect, setDragRect] = useState(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (open) {
      setHighlights([]);
      setLabel("");
      setJurySafe(true);
      setSaving(false);
      setDragging(false);
      setDragRect(null);
    }
  }, [open]);

  const getRelativePos = useCallback((e) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const onMouseDown = (e) => {
    e.preventDefault();
    const pos = getRelativePos(e);
    setDragStart(pos);
    setDragRect(null);
    setDragging(true);
  };

  const onMouseMove = (e) => {
    if (!dragging || !dragStart) return;
    const pos = getRelativePos(e);
    setDragRect({
      x: Math.min(dragStart.x, pos.x),
      y: Math.min(dragStart.y, pos.y),
      w: Math.abs(pos.x - dragStart.x),
      h: Math.abs(pos.y - dragStart.y),
    });
  };

  const onMouseUp = (e) => {
    if (!dragging || !dragStart) return;
    setDragging(false);
    const pos = getRelativePos(e);
    const rect = {
      x: Math.min(dragStart.x, pos.x),
      y: Math.min(dragStart.y, pos.y),
      w: Math.abs(pos.x - dragStart.x),
      h: Math.abs(pos.y - dragStart.y),
    };
    setDragRect(null);
    if (rect.w < 0.01 || rect.h < 0.005) return; // too small
    setHighlights(prev => [...prev, { ...rect, color }]);
  };

  const removeHighlight = (i) => {
    setHighlights(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (!callout || !extractId) return;
    setSaving(true);
    const imageUrl = callout.callout_image || callout.snapshot_image_url;
    const savedAnns = await Promise.all(
      highlights.map((rect, i) =>
        base44.entities.ExhibitAnnotations.create({
          extract_id: extractId,
          page_number: pageNumber,
          kind: "highlight",
          callout_id: callout.id,
          rect_norm: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
          color: rect.color || color,
          opacity: 0.42,
          label: label.trim() || `${callout.label || `p.${pageNumber}`} highlight ${i + 1}`,
          label_text: label.trim() || `${callout.label || `p.${pageNumber}`} highlight ${i + 1}`,
          jury_safe: jurySafe,
          show_in_spotlight: true,
          snapshot_file: imageUrl,
          sort_index: i,
        })
      )
    );
    setSaving(false);
    onSaved(savedAnns);
    onClose();
  };

  const imageUrl = callout?.callout_image || callout?.snapshot_image_url;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
      <DialogContent className="bg-[#0f1629] border border-[#1e2a45] text-slate-200 max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-300 text-sm">
            <Highlighter className="w-4 h-4" /> Draw Highlights on Callout Snapshot
          </DialogTitle>
        </DialogHeader>

        <p className="text-[11px] text-slate-400">
          Drag rectangles on the snapshot below. Highlights are saved relative to the image — <strong className="text-white">no drift ever</strong>.
        </p>

        {/* Color picker */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Color:</span>
          {["yellow","red","green","blue"].map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-5 h-5 rounded border-2 transition-all ${color === c ? "border-white scale-110" : "border-transparent opacity-50"} ${
                c==="yellow"?"bg-yellow-400":c==="red"?"bg-red-500":c==="green"?"bg-green-500":"bg-blue-500"
              }`}
            />
          ))}
          {highlights.length > 0 && (
            <span className="text-[10px] text-slate-500 ml-auto">{highlights.length} highlight{highlights.length !== 1 ? "s" : ""} drawn</span>
          )}
        </div>

        {/* Snapshot with overlay */}
        {imageUrl ? (
          <div
            ref={containerRef}
            className="relative rounded-lg overflow-hidden border border-[#1e2a45] bg-[#050809] select-none"
            style={{ cursor: "crosshair" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Callout snapshot"
              className="w-full object-contain block pointer-events-none"
              draggable={false}
            />
            {/* Existing highlight rects */}
            {highlights.map((rect, i) => (
              <div key={i}
                style={{
                  position: "absolute",
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                  background: COLOR_CSS[rect.color] || COLOR_CSS.yellow,
                  border: "1px solid rgba(255,220,0,0.5)",
                  borderRadius: "2px",
                  pointerEvents: "none",
                }}
              />
            ))}
            {/* Live drag preview */}
            {dragging && dragRect && (
              <div style={{
                position: "absolute",
                left: `${dragRect.x * 100}%`,
                top: `${dragRect.y * 100}%`,
                width: `${dragRect.w * 100}%`,
                height: `${dragRect.h * 100}%`,
                background: COLOR_CSS[color] || COLOR_CSS.yellow,
                border: "2px dashed rgba(255,220,0,0.8)",
                borderRadius: "2px",
                pointerEvents: "none",
              }} />
            )}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-slate-500 text-sm bg-[#050809] rounded border border-[#1e2a45]">
            No snapshot image found.
          </div>
        )}

        {/* Highlights list for deletion */}
        {highlights.length > 0 && (
          <div className="space-y-1">
            {highlights.map((rect, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 bg-[#0a0f1e] rounded border border-[#1e2a45]">
                <div className={`w-3 h-3 rounded flex-shrink-0 ${
                  rect.color==="yellow"?"bg-yellow-400":rect.color==="red"?"bg-red-500":rect.color==="green"?"bg-green-500":"bg-blue-500"
                }`} />
                <span className="text-[10px] text-slate-400 flex-1">
                  Highlight {i+1}: x={Math.round(rect.x*100)}% y={Math.round(rect.y*100)}% w={Math.round(rect.w*100)}% h={Math.round(rect.h*100)}%
                </span>
                <button onClick={() => removeHighlight(i)} className="p-0.5 text-slate-600 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 pt-1 border-t border-[#1e2a45]">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Label (shared for all highlights)</label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={`${callout?.label || `p.${pageNumber}`} highlight`}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 h-8 text-xs"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={jurySafe} onChange={e => setJurySafe(e.target.checked)}
              className="accent-green-500 w-3.5 h-3.5" />
            <span className="text-xs text-slate-300">Jury-safe (visible in Present mode)</span>
          </label>
        </div>

        <div className="flex justify-between items-center mt-2">
          <p className="text-[10px] text-slate-500">
            {highlights.length === 0 ? "Draw highlights above, or skip to save callout only." : `${highlights.length} highlight(s) will be saved.`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}
              className="border-[#1e2a45] text-slate-400 hover:text-slate-200 text-xs h-8">
              {highlights.length === 0 ? "Skip" : "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={saving || highlights.length === 0}
              className="bg-yellow-600 hover:bg-yellow-700 text-black text-xs h-8">
              {saving ? "Saving…" : `Save ${highlights.length} Highlight${highlights.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}