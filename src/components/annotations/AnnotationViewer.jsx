import React, { useRef, useState, useEffect, useCallback } from "react";

/**
 * AnnotationViewer
 * Renders a PDF page (or image) inside a container.
 * Overlays highlight rects for annotations.
 * Supports "draw mode" to capture a new rect via mouse drag.
 *
 * Props:
 *   fileUrl       – extract file URL (PDF or image)
 *   page          – 1-based page number (PDF only)
 *   annotations   – array of ExhibitAnnotations for this page
 *   selectedId    – currently selected annotation id (highlights in yellow)
 *   drawMode      – bool: if true, user can drag to draw a highlight rect
 *   onRectDrawn   – (rectJson) => void  called when draw ends
 *   displayNo     – string, e.g. "Exh. 3" shown as overlay if showNumberOverlay
 *   showNumberOverlay – bool
 */
export default function AnnotationViewer({
  fileUrl,
  page = 1,
  annotations = [],
  selectedId = null,
  drawMode = false,
  onRectDrawn,
  displayNo = "",
  showNumberOverlay = false,
}) {
  const containerRef = useRef(null);
  const [drawing, setDrawing] = useState(null); // { startX, startY, x, y, w, h } in pixels
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Track container dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    observer.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  const isPdf = fileUrl?.toLowerCase().includes(".pdf") || fileUrl?.includes("application/pdf");

  // --- Mouse handlers for drawing ---
  const getRelPos = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onMouseDown = (e) => {
    if (!drawMode) return;
    e.preventDefault();
    const { x, y } = getRelPos(e);
    setDrawing({ startX: x, startY: y, x, y, w: 0, h: 0 });
  };

  const onMouseMove = (e) => {
    if (!drawing || !drawMode) return;
    const { x, y } = getRelPos(e);
    setDrawing(prev => ({
      ...prev,
      x: Math.min(prev.startX, x),
      y: Math.min(prev.startY, y),
      w: Math.abs(x - prev.startX),
      h: Math.abs(y - prev.startY),
    }));
  };

  const onMouseUp = (e) => {
    if (!drawing || !drawMode) return;
    const { x, y } = getRelPos(e);
    const rect = {
      x: parseFloat(Math.min(drawing.startX, x).toFixed(4)),
      y: parseFloat(Math.min(drawing.startY, y).toFixed(4)),
      w: parseFloat(Math.abs(x - drawing.startX).toFixed(4)),
      h: parseFloat(Math.abs(y - drawing.startY).toFixed(4)),
    };
    setDrawing(null);
    if (rect.w > 0.01 && rect.h > 0.01 && onRectDrawn) {
      onRectDrawn(JSON.stringify(rect));
    }
  };

  // Parse a highlight rect from annotation
  const parseRect = (ann) => {
    if (!ann.highlight_rect_json) return null;
    try { return JSON.parse(ann.highlight_rect_json); } catch { return null; }
  };

  const renderAnnotations = () =>
    annotations.map(ann => {
      const r = parseRect(ann);
      if (!r) return null;
      const isSelected = ann.id === selectedId;
      return (
        <div
          key={ann.id}
          style={{
            position: "absolute",
            left: `${r.x * 100}%`,
            top: `${r.y * 100}%`,
            width: `${r.w * 100}%`,
            height: `${r.h * 100}%`,
            backgroundColor: isSelected ? "rgba(250,204,21,0.35)" : "rgba(250,204,21,0.18)",
            border: isSelected ? "2px solid rgba(250,204,21,0.9)" : "1.5px solid rgba(250,204,21,0.5)",
            borderRadius: "2px",
            pointerEvents: "none",
          }}
          title={ann.label_internal}
        />
      );
    });

  const renderDrawPreview = () => {
    if (!drawing) return null;
    return (
      <div
        style={{
          position: "absolute",
          left: `${drawing.x * 100}%`,
          top: `${drawing.y * 100}%`,
          width: `${drawing.w * 100}%`,
          height: `${drawing.h * 100}%`,
          backgroundColor: "rgba(6,182,212,0.25)",
          border: "2px dashed rgba(6,182,212,0.8)",
          borderRadius: "2px",
          pointerEvents: "none",
        }}
      />
    );
  };

  const pdfSrc = isPdf && fileUrl
    ? `${fileUrl}#page=${page}&toolbar=0&navpanes=0&scrollbar=0`
    : null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-lg overflow-hidden border border-[#1e2a45] bg-[#080d18] select-none ${drawMode ? "cursor-crosshair" : ""}`}
      style={{ minHeight: 400 }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {fileUrl ? (
        isPdf ? (
          <iframe
            key={`${fileUrl}#${page}`}
            src={pdfSrc}
            className="w-full"
            style={{ height: 600, border: "none", pointerEvents: drawMode ? "none" : "auto" }}
            title="Extract PDF"
          />
        ) : (
          <img
            src={fileUrl}
            alt="Extract"
            className="w-full h-auto"
            style={{ pointerEvents: drawMode ? "none" : "auto" }}
            draggable={false}
          />
        )
      ) : (
        <div className="flex items-center justify-center h-64 text-slate-600 text-sm">
          No extract file attached to this exhibit.
        </div>
      )}

      {/* Annotation overlay layer */}
      <div className="absolute inset-0 pointer-events-none">
        {renderAnnotations()}
        {renderDrawPreview()}
      </div>

      {/* Exhibit number overlay */}
      {showNumberOverlay && displayNo && (
        <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-bold border border-white/20 pointer-events-none">
          {displayNo}
        </div>
      )}

      {/* Draw mode hint */}
      {drawMode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded bg-cyan-900/80 text-cyan-300 text-xs font-medium border border-cyan-600/40 pointer-events-none">
          Click and drag to draw highlight rectangle
        </div>
      )}
    </div>
  );
}