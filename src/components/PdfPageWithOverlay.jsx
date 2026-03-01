import React, { useEffect, useRef, useState, useCallback } from "react";
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const COLOR_MAP = {
  yellow: { fill: "rgba(251,146,60,0.32)", stroke: "rgba(251,146,60,0.85)" }, // orange/peach
  red:    { fill: "rgba(239,68,68,0.28)",  stroke: "rgba(239,68,68,0.85)" },
  green:  { fill: "rgba(34,197,94,0.28)",  stroke: "rgba(34,197,94,0.85)" },
  blue:   { fill: "rgba(59,130,246,0.28)", stroke: "rgba(59,130,246,0.85)" },
  none:   { fill: "rgba(251,146,60,0.32)", stroke: "rgba(251,146,60,0.85)" },
};

function getColor(color) {
  return COLOR_MAP[color] || COLOR_MAP.yellow;
}

/**
 * PdfPageWithOverlay
 *
 * Renders a single PDF page into a canvas and draws highlight overlays
 * using fully normalized coordinates (0..1) so highlights are viewport-independent.
 *
 * Props:
 *   fileUrl      – URL to the PDF
 *   pageIndex    – 1-based page number (default 1)
 *   scale        – pdf.js render scale (default 1.25)
 *   highlights   – array of annotation objects with rect_norm_x/y/w/h and optional color, label_text
 *   mode         – "view" | "annotate"
 *   activeId     – id of currently selected highlight (for ring highlight)
 *   onCreateRect – callback(rectNorm, viewportW, viewportH, scale) called after user draws a rect in annotate mode
 *                  rectNorm = { x, y, w, h } all 0..1
 *   onSelect     – callback(id) when a highlight is clicked in view mode
 */
export default function PdfPageWithOverlay({
  fileUrl,
  pageIndex = 1,
  scale = 1.25,
  highlights = [],
  mode = "view",
  activeId = null,
  onCreateRect,
  onSelect,
  onNumPages,
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const [viewport, setViewport] = useState(null); // { width, height }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Drag state for annotate mode
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { x, y, w, h } in px

  // ── Render PDF page to canvas ──────────────────────────────────────────────
  useEffect(() => {
    if (!fileUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    pdfjs.getDocument(fileUrl).promise
      .then(pdf => pdf.getPage(pageIndex))
      .then(page => {
        if (cancelled) return;
        const vp = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d");
        return page.render({ canvasContext: ctx, viewport: vp }).promise.then(() => {
          if (!cancelled) {
            setViewport({ width: vp.width, height: vp.height });
            setLoading(false);
          }
        });
      })
      .catch(err => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [fileUrl, pageIndex, scale]);

  // ── Drag to annotate ───────────────────────────────────────────────────────
  const getRelPx = useCallback((e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const onMouseDown = useCallback((e) => {
    if (mode !== "annotate") return;
    e.preventDefault();
    const pos = getRelPx(e);
    dragRef.current = { startX: pos.x, startY: pos.y };
    setDragging({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }, [mode, getRelPx]);

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const pos = getRelPx(e);
    const { startX, startY } = dragRef.current;
    setDragging({
      x: Math.min(pos.x, startX),
      y: Math.min(pos.y, startY),
      w: Math.abs(pos.x - startX),
      h: Math.abs(pos.y - startY),
    });
  }, [getRelPx]);

  const onMouseUp = useCallback((e) => {
    if (!dragRef.current || !viewport) return;
    const pos = getRelPx(e);
    const { startX, startY } = dragRef.current;
    dragRef.current = null;

    const xPx = Math.min(pos.x, startX);
    const yPx = Math.min(pos.y, startY);
    const wPx = Math.abs(pos.x - startX);
    const hPx = Math.abs(pos.y - startY);

    setDragging(null);

    if (wPx < 5 || hPx < 5) return; // too small, ignore

    const rectNorm = {
      x: xPx / viewport.width,
      y: yPx / viewport.height,
      w: wPx / viewport.width,
      h: hPx / viewport.height,
    };

    onCreateRect && onCreateRect(rectNorm, viewport.width, viewport.height, scale);
  }, [viewport, scale, getRelPx, onCreateRect]);

  // ── Highlight click (view mode) ────────────────────────────────────────────
  const handleOverlayClick = useCallback((e) => {
    if (mode !== "view" || !viewport || !onSelect) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Find topmost highlight that contains click
    const hit = [...highlights].reverse().find(h => {
      const xPx = h.rect_norm_x * viewport.width;
      const yPx = h.rect_norm_y * viewport.height;
      const wPx = h.rect_norm_w * viewport.width;
      const hPx = h.rect_norm_h * viewport.height;
      return cx >= xPx && cx <= xPx + wPx && cy >= yPx && cy <= yPx + hPx;
    });
    if (hit) { e.stopPropagation(); onSelect(hit.id); }
  }, [mode, viewport, highlights, onSelect]);

  // ── Page annotations for current page ──────────────────────────────────────
  const pageHighlights = highlights.filter(h => {
    const pg = h.page_number ?? h.extract_page_number ?? 1;
    return pg === pageIndex;
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  const vpW = viewport?.width ?? 0;
  const vpH = viewport?.height ?? 0;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        lineHeight: 0,
        width: vpW || undefined,
        height: vpH || undefined,
      }}
    >
      {/* PDF canvas */}
      <canvas ref={canvasRef} style={{ display: "block" }} />

      {/* Loading / error states */}
      {loading && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#0a0f1e", color: "#64748b", fontSize: 13,
        }}>
          Loading page {pageIndex}…
        </div>
      )}
      {error && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#0a0f1e", color: "#f87171", fontSize: 13,
        }}>
          Failed to load PDF
        </div>
      )}

      {/* Overlay — sits exactly on top of canvas */}
      {!loading && viewport && (
        <div
          ref={overlayRef}
          style={{
            position: "absolute",
            top: 0, left: 0,
            width: vpW, height: vpH,
            cursor: mode === "annotate" ? "crosshair" : "default",
            userSelect: "none",
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { dragRef.current = null; setDragging(null); }}
          onClick={handleOverlayClick}
        >
          {/* Existing highlights */}
          {pageHighlights.map(h => {
            // Support both new rect_norm_* fields and legacy geometry_json fallback
            let rx, ry, rw, rh;
            if (h.rect_norm_x != null) {
              rx = h.rect_norm_x * vpW;
              ry = h.rect_norm_y * vpH;
              rw = h.rect_norm_w * vpW;
              rh = h.rect_norm_h * vpH;
            } else if (h.geometry_json?.type === "rect") {
              // geometry_json stores 0-100% — convert
              rx = (h.geometry_json.x / 100) * vpW;
              ry = (h.geometry_json.y / 100) * vpH;
              rw = (h.geometry_json.w / 100) * vpW;
              rh = (h.geometry_json.h / 100) * vpH;
            } else {
              return null;
            }

            const isActive = activeId === h.id;
            const { fill, stroke } = getColor(h.color || "yellow");
            const isRedaction = h.kind === "redaction";

            return (
              <div
                key={h.id}
                title={h.label_text || h.label || ""}
                style={{
                  position: "absolute",
                  left: rx, top: ry,
                  width: rw, height: rh,
                  backgroundColor: isRedaction ? "rgba(0,0,0,0.92)" : fill,
                  border: isRedaction
                    ? "1px solid #333"
                    : `1.5px solid ${isActive ? stroke : stroke.replace("0.85", "0.45")}`,
                  borderRadius: 2,
                  boxShadow: isActive ? `0 0 0 2.5px ${stroke}` : "none",
                  transition: "box-shadow 0.15s",
                  pointerEvents: mode === "annotate" ? "none" : "auto",
                  cursor: mode === "view" ? "pointer" : "crosshair",
                }}
              />
            );
          })}

          {/* In-progress drag rect */}
          {dragging && dragging.w > 2 && (
            <div style={{
              position: "absolute",
              left: dragging.x, top: dragging.y,
              width: dragging.w, height: dragging.h,
              backgroundColor: "rgba(251,146,60,0.22)",
              border: "2px dashed rgba(251,146,60,0.85)",
              borderRadius: 2,
              pointerEvents: "none",
            }} />
          )}
        </div>
      )}
    </div>
  );
}