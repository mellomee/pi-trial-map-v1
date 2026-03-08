import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Trash2 } from "lucide-react";

const COLOR_OPTS = ["yellow", "red", "green", "blue"];
const COLOR_RGB = {
  yellow: "255,220,0",
  red:    "239,68,68",
  green:  "34,197,94",
  blue:   "59,130,246",
};
const colorCss = (color, opacity) => `rgba(${COLOR_RGB[color] || COLOR_RGB.yellow},${opacity ?? 0.4})`;

export default function HighlightEditorModal({ callout, highlights, onHighlightsChange, onClose }) {
  const imgRef = useRef(null);
  const [color, setColor] = useState("yellow");
  const [opacity, setOpacity] = useState(0.4);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [saving, setSaving] = useState(false);
  // Selected highlight for editing
  const [selectedHlId, setSelectedHlId] = useState(null);
  const [editColor, setEditColor] = useState("yellow");
  const [editOpacity, setEditOpacity] = useState(0.4);

  const toNorm = (clientX, clientY) => {
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const onMouseDown = e => {
    // Don't start drag if clicking on a highlight rect
    e.preventDefault();
    const p = toNorm(e.clientX, e.clientY);
    setDragStart(p); setDragCurrent(p); setDragging(true);
  };
  const onMouseMove = e => {
    if (!dragging) return;
    setDragCurrent(toNorm(e.clientX, e.clientY));
  };
  const onMouseUp = async e => {
    if (!dragging || !dragStart) return;
    const end = toNorm(e.clientX, e.clientY);
    const x = Math.min(dragStart.x, end.x);
    const y = Math.min(dragStart.y, end.y);
    const w = Math.abs(end.x - dragStart.x);
    const h = Math.abs(end.y - dragStart.y);
    setDragging(false); setDragStart(null); setDragCurrent(null);
    if (w < 0.01 || h < 0.01) return;
    setSaving(true);
    const hl = await base44.entities.Highlights.create({
      callout_id: callout.id,
      kind: "highlight",
      color,
      opacity,
      rects_norm: [{ x, y, w, h }],
    });
    onHighlightsChange(prev => [...prev, hl]);
    setSaving(false);
  };

  const deleteHl = async (id) => {
    await base44.entities.Highlights.delete(id);
    onHighlightsChange(prev => prev.filter(h => h.id !== id));
    if (selectedHlId === id) setSelectedHlId(null);
  };

  const selectHighlight = (hl) => {
    setSelectedHlId(hl.id);
    setEditColor(hl.color || "yellow");
    setEditOpacity(hl.opacity ?? 0.4);
  };

  const saveEditedHighlight = async () => {
    const updated = await base44.entities.Highlights.update(selectedHlId, {
      color: editColor,
      opacity: editOpacity,
    });
    onHighlightsChange(prev => prev.map(h => h.id === selectedHlId ? updated : h));
  };

  const draftRect = dragging && dragStart && dragCurrent ? {
    x: Math.min(dragStart.x, dragCurrent.x),
    y: Math.min(dragStart.y, dragCurrent.y),
    w: Math.abs(dragCurrent.x - dragStart.x),
    h: Math.abs(dragCurrent.y - dragStart.y),
  } : null;

  const selectedHl = highlights.find(h => h.id === selectedHlId);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}>
      <div className="relative flex flex-col bg-[#0f1629] border border-[#1e2a45] rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: 900, maxWidth: "96vw", height: 650, maxHeight: "96vh" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2a45] flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Add Highlights</span>
            <span className="text-xs text-slate-500">{callout.name || `p.${callout.page_number}`} · drag rectangles on the snapshot</span>
          </div>
          {/* Color picker + opacity */}
          <div className="flex items-center gap-2">
            {COLOR_OPTS.map(col => (
              <button key={col} onClick={() => setColor(col)}
                style={{ background: colorCss(col, 0.75) }}
                className={`w-6 h-6 rounded-full border-2 transition-all ${color === col ? "border-white scale-110" : "border-transparent opacity-70 hover:opacity-100"}`} />
            ))}
            <div className="w-px h-5 bg-[#1e2a45] mx-1" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">Opacity</span>
              <input
                type="range" min="0.05" max="0.95" step="0.05"
                value={opacity}
                onChange={e => setOpacity(parseFloat(e.target.value))}
                className="w-20 accent-yellow-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 w-7">{Math.round(opacity * 100)}%</span>
            </div>
            <div className="w-px h-5 bg-[#1e2a45] mx-1" />
            {saving && <span className="text-[10px] text-slate-500">Saving…</span>}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Snapshot canvas area */}
          <div className="flex-1 overflow-auto bg-[#050809] flex items-center justify-center p-4"
            style={{ cursor: dragging ? "crosshair" : "crosshair" }}>
            {callout.snapshot_image_url ? (
              <div className="relative select-none"
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                onMouseLeave={() => { if (dragging) { setDragging(false); setDragStart(null); setDragCurrent(null); } }}>
                <img ref={imgRef} src={callout.snapshot_image_url} alt="Callout"
                  draggable={false}
                  style={{ display: "block", maxHeight: 480, maxWidth: "100%", cursor: "crosshair", userSelect: "none" }} />
                {/* Existing highlights */}
                {highlights.map((hl) =>
                  (hl.rects_norm || []).map((r, ri) => (
                    <div key={`${hl.id}-${ri}`}
                      onClick={(e) => { e.stopPropagation(); selectHighlight(hl); }}
                      style={{
                        position: "absolute",
                        left: `${r.x * 100}%`, top: `${r.y * 100}%`,
                        width: `${r.w * 100}%`, height: `${r.h * 100}%`,
                        background: colorCss(hl.color, hl.opacity ?? 0.4),
                        cursor: "pointer",
                        outline: selectedHlId === hl.id ? "2px solid white" : "none",
                        zIndex: 2,
                      }} />
                  ))
                )}
                {/* Draft rect */}
                {draftRect && (
                  <div style={{
                    position: "absolute",
                    left: `${draftRect.x * 100}%`, top: `${draftRect.y * 100}%`,
                    width: `${draftRect.w * 100}%`, height: `${draftRect.h * 100}%`,
                    background: colorCss(color, opacity),
                    border: `2px dashed ${colorCss(color, 0.9)}`,
                    pointerEvents: "none",
                    zIndex: 3,
                  }} />
                )}
              </div>
            ) : (
              <p className="text-slate-600 text-sm">No snapshot image for this callout.</p>
            )}
          </div>

          {/* Right panel: highlight list */}
          <div className="w-52 flex-shrink-0 border-l border-[#1e2a45] flex flex-col bg-[#0a0f1e]">
            <div className="px-3 py-2 border-b border-[#1e2a45]">
              <p className="text-[10px] font-bold text-yellow-400/80 uppercase tracking-widest">
                Highlights ({highlights.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {highlights.length === 0 && (
                <p className="text-[10px] text-slate-600 italic text-center py-4">Drag on the image to add highlights.</p>
              )}
              {highlights.map((hl, i) => (
                <button key={hl.id}
                  onClick={() => selectHighlight(hl)}
                  className={`w-full flex items-center gap-1.5 rounded px-2 py-1.5 border transition-colors ${selectedHlId === hl.id ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-[#0f1629] border-[#1e2a45] hover:border-cyan-500/30'}`}>
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: colorCss(hl.color, hl.opacity ?? 0.4) }} />
                  <span className="text-[10px] text-slate-400 flex-1 text-left">{hl.color} · {Math.round((hl.opacity ?? 0.4) * 100)}%</span>
                  <div onClick={(e) => { e.stopPropagation(); deleteHl(hl.id); }} className="p-0.5 text-slate-600 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>

            {/* Edit panel for selected highlight */}
            {selectedHl && (
              <div className="border-t border-[#1e2a45] p-3 space-y-2 flex-shrink-0">
                <p className="text-[10px] font-bold text-cyan-400/80 uppercase tracking-widest">Edit Selected</p>
                <div className="flex gap-1 flex-wrap">
                  {COLOR_OPTS.map(col => (
                    <button key={col} onClick={() => setEditColor(col)}
                      style={{ background: colorCss(col, 0.75) }}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${editColor === col ? "border-white scale-110" : "border-transparent opacity-70 hover:opacity-100"}`} />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Opacity</span>
                  <input type="range" min="0.05" max="0.95" step="0.05"
                    value={editOpacity}
                    onChange={e => setEditOpacity(parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-400 cursor-pointer" />
                  <span className="text-[10px] text-slate-400 w-7">{Math.round(editOpacity * 100)}%</span>
                </div>
                <Button onClick={saveEditedHighlight}
                  className="w-full h-6 text-[10px] bg-cyan-700 hover:bg-cyan-600 text-white">
                  Apply
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#1e2a45] flex-shrink-0 bg-[#0a0f1e]">
          <span className="text-[10px] text-slate-600 flex-1">Drag to draw · Click a highlight to edit its color/opacity.</span>
          <Button onClick={onClose} className="bg-yellow-600/20 text-yellow-300 border border-yellow-600/40 hover:bg-yellow-600/30 text-xs h-8">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}