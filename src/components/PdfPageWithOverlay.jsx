import React, { useEffect, useRef, useState, useCallback } from "react";
import { pdfjs } from "react-pdf";
import { domRectToPdf, pdfRectToPixels, domRectToNorm, normRectToPixels, coordMode } from "@/components/annotationCoords";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const COLOR_MAP = {
  yellow: { fill: "rgba(251,146,60,0.32)", stroke: "rgba(251,146,60,0.85)" },
  red:    { fill: "rgba(239,68,68,0.28)",  stroke: "rgba(239,68,68,0.85)" },
  green:  { fill: "rgba(34,197,94,0.28)",  stroke: "rgba(34,197,94,0.85)" },
  blue:   { fill: "rgba(59,130,246,0.28)", stroke: "rgba(59,130,246,0.85)" },
  none:   { fill: "rgba(251,146,60,0.32)", stroke: "rgba(251,146,60,0.85)" },
};

function getColor(color) {
  return COLOR_MAP[color] || COLOR_MAP.yellow;
}

function isPdf(url) { return url?.toLowerCase().includes(".pdf"); }

/**
 * PdfPageWithOverlay
 *
 * Renders a single PDF page (or image) with annotation overlays.
 * SAVE:   uses pdf.js viewport.convertToPdfPoint  → stores rect_pdf (PDF user units)
 * RENDER: uses pdf.js viewport.convertToViewportPoint → correct pixel position at any scale
 * Legacy fallback: annotations with only rect_norm_x/y/w/h render via normalized-to-pixel mapping.
 *
 * Props:
 *   fileUrl      – URL to PDF or image
 *   pageIndex    – 1-based page number (default 1)
 *   scale        – pdf.js render scale (default 1.25)
 *   highlights   – annotation objects (ExhibitAnnotations)
 *   mode         – "view" | "annotate"
 *   activeId     – selected annotation id (for ring highlight)
 *   onCreateAnnotation – callback({ rect_pdf, rect_norm, source_type, page_number, page_rotation, viewport_meta })
 *   onSelect     – callback(id) when a highlight is clicked
 *   onNumPages   – callback(n) with total page count
 */
export default function PdfPageWithOverlay({
  fileUrl,
  pageIndex = 1,
  scale = 1.25,
  highlights = [],
  mode = "view",
  activeId = null,
  onCreateAnnotation,
  // legacy compat: old callers used onCreateRect(rectNorm, vpW, vpH, scale)
  onCreateRect,
  onSelect,
  onNumPages,
  // Called after each page render with { canvas, viewport, vpSize }
  onPageRender,
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  // viewport dimensions (pixels) after render
  const [vpSize, setVpSize] = useState(null); // { width, height }
  // pdf.js viewport object (kept for coordinate conversion)
  const pdfViewportRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For image source
  const [imgNaturalSize, setImgNaturalSize] = useState(null);
  const imgRef = useRef(null);

  // Drag state
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { x, y, w, h } in px (display)

  const isImageFile = !isPdf(fileUrl);

  // ── Render PDF page ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!fileUrl || isImageFile) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    pdfViewportRef.current = null;

    pdfjs.getDocument(fileUrl).promise
      .then(pdf => {
        if (!cancelled && onNumPages) onNumPages(pdf.numPages);
        return pdf.getPage(pageIndex);
      })
      .then(page => {
        if (cancelled) return;
        const vp = page.getViewport({ scale, rotation: 0 });
        pdfViewportRef.current = vp;
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Use devicePixelRatio for sharp rendering on hi-DPI screens.
        // The canvas physical size is vp.width*dpr but CSS size stays vp.width.
        const dpr = window.devicePixelRatio || 1;
        canvas.width  = Math.round(vp.width  * dpr);
        canvas.height = Math.round(vp.height * dpr);
        canvas.style.width  = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return page.render({ canvasContext: ctx, viewport: vp }).promise.then(() => {
          if (!cancelled) {
            // vpSize always tracks the CSS (layout) dimensions, not physical canvas pixels
            const vpSizeVal = { width: vp.width, height: vp.height };
            setVpSize(vpSizeVal);
            setLoading(false);
            if (onPageRender) {
              // Pass physical canvas, viewport, and CSS layout size
              onPageRender({ canvas: canvasRef.current, viewport: vp, vpSize: vpSizeVal });
            }
          }
        });
      })
      .catch(err => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [fileUrl, pageIndex, scale, isImageFile]);

  // ── Drag helpers ─────────────────────────────────────────────────────────
  const getRelPx = useCallback((e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
    if (!dragRef.current) return;
    const pos = getRelPx(e);
    const { startX, startY } = dragRef.current;
    dragRef.current = null;

    const left   = Math.min(pos.x, startX);
    const top    = Math.min(pos.y, startY);
    const width  = Math.abs(pos.x - startX);
    const height = Math.abs(pos.y - startY);

    setDragging(null);
    if (width < 5 || height < 5) return;

    const domRect = { left, top, width, height };

    if (!isImageFile && pdfViewportRef.current) {
      // ── PDF: convert to PDF page units ──────────────────────────────────
      const vp = pdfViewportRef.current;
      const rect_pdf = domRectToPdf(domRect, vp);

      const payload = {
        source_type: "pdf",
        page_number: pageIndex,
        page_rotation: 0,
        rect_pdf,
        viewport_meta: { scale, renderW: vp.width, renderH: vp.height },
      };

      if (onCreateAnnotation) {
        onCreateAnnotation(payload);
      } else if (onCreateRect) {
        // legacy compat: callers that still use onCreateRect(rectNorm, vpW, vpH, scale)
        const vpW = vp.width, vpH = vp.height;
        const rectNorm = { x: left/vpW, y: top/vpH, w: width/vpW, h: height/vpH };
        onCreateRect(rectNorm, vpW, vpH, scale);
      }
    } else if (isImageFile && imgRef.current) {
      // ── Image: convert to normalized 0..1 ─────────────────────────────
      const el = imgRef.current;
      const rect_norm = domRectToNorm(left, top, width, height, el.clientWidth, el.clientHeight);

      const payload = {
        source_type: "image",
        page_number: 1,
        page_rotation: 0,
        rect_norm,
        viewport_meta: { scale: 1, renderW: el.clientWidth, renderH: el.clientHeight },
      };

      if (onCreateAnnotation) {
        onCreateAnnotation(payload);
      } else if (onCreateRect) {
        onCreateRect(rect_norm, el.clientWidth, el.clientHeight, 1);
      }
    }
  }, [pageIndex, scale, isImageFile, getRelPx, onCreateAnnotation, onCreateRect]);

  // ── Click to select in view mode ──────────────────────────────────────────
  const handleOverlayClick = useCallback((e) => {
    if (mode !== "view" || !onSelect) return;
    const overlayRect = overlayRef.current.getBoundingClientRect();
    const cx = e.clientX - overlayRect.left;
    const cy = e.clientY - overlayRect.top;

    const hit = [...pageHighlightsForClick()].reverse().find(h => {
      const px = getHighlightPixels(h);
      if (!px) return false;
      return cx >= px.left && cx <= px.left + px.width && cy >= px.top && cy <= px.top + px.height;
    });
    if (hit) { e.stopPropagation(); onSelect(hit.id); }
  }, [mode, onSelect]); // eslint-disable-line

  // ── Coordinate resolution ────────────────────────────────────────────────
  const getHighlightPixels = useCallback((h) => {
    const cm = coordMode(h);

    if (cm === "pdf" && pdfViewportRef.current) {
      return pdfRectToPixels(h.rect_pdf, pdfViewportRef.current);
    }

    if (cm === "norm") {
      const { width: W, height: H } = vpSize || imgNaturalSize || { width: 1, height: 1 };
      return normRectToPixels(h.rect_norm, W, H);
    }

    // legacy: rect_norm_x/y/w/h fields
    if (h.rect_norm_x != null && vpSize) {
      return { left: h.rect_norm_x * vpSize.width, top: h.rect_norm_y * vpSize.height,
               width: h.rect_norm_w * vpSize.width, height: h.rect_norm_h * vpSize.height };
    }

    // legacy: geometry_json (0-100%)
    if (h.geometry_json?.type === "rect" && vpSize) {
      return { left: (h.geometry_json.x/100) * vpSize.width, top: (h.geometry_json.y/100) * vpSize.height,
               width: (h.geometry_json.w/100) * vpSize.width, height: (h.geometry_json.h/100) * vpSize.height };
    }

    return null;
  }, [vpSize, imgNaturalSize]);

  // Filter highlights for current page
  const pageHighlights = highlights.filter(h => {
    const pg = h.page_number ?? h.extract_page_number ?? 1;
    return pg === pageIndex;
  });

  // Stable ref for click handler closure
  const pageHighlightsForClick = () => pageHighlights;

  const overlayW = vpSize?.width ?? 0;
  const overlayH = vpSize?.height ?? 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", display: "inline-block", lineHeight: 0,
                  width: overlayW || undefined, height: overlayH || undefined }}>

      {/* PDF canvas */}
      {!isImageFile && <canvas ref={canvasRef} style={{ display: "block" }} />}

      {/* Image */}
      {isImageFile && (
        <img
          ref={imgRef}
          src={fileUrl}
          alt="Extract"
          style={{ display: "block", maxWidth: "100%" }}
          draggable={false}
          onLoad={e => {
            const el = e.currentTarget;
            setVpSize({ width: el.clientWidth, height: el.clientHeight });
            setImgNaturalSize({ width: el.naturalWidth, height: el.naturalHeight });
            setLoading(false);
            if (onNumPages) onNumPages(1);
          }}
        />
      )}

      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                      justifyContent: "center", background: "#0a0f1e", color: "#64748b", fontSize: 13 }}>
          Loading…
        </div>
      )}
      {error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                      justifyContent: "center", background: "#0a0f1e", color: "#f87171", fontSize: 13 }}>
          Failed to load
        </div>
      )}

      {/* Overlay — positioned exactly over canvas/image */}
      {!loading && vpSize && (
        <div
          ref={overlayRef}
          style={{ position: "absolute", top: 0, left: 0,
                   width: overlayW, height: overlayH,
                   cursor: mode === "annotate" ? "crosshair" : "default",
                   userSelect: "none" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { dragRef.current = null; setDragging(null); }}
          onClick={handleOverlayClick}
        >
          {/* Existing highlights */}
          {pageHighlights.map(h => {
            const cm = coordMode(h);
            const px = getHighlightPixels(h);
            if (!px) return null;

            const isActive = activeId === h.id;
            const { fill, stroke } = getColor(h.color || "yellow");
            const isRedaction = h.kind === "redaction";
            const isLegacy = cm === "legacy";

            return (
              <React.Fragment key={h.id}>
                <div
                  title={h.label_text || h.label || ""}
                  style={{
                    position: "absolute",
                    left: px.left, top: px.top,
                    width: px.width, height: px.height,
                    backgroundColor: isRedaction ? "rgba(0,0,0,0.92)" : fill,
                    border: isRedaction
                      ? "1px solid #333"
                      : `1.5px solid ${isActive ? stroke : stroke.replace("0.85","0.45")}`,
                    borderRadius: 2,
                    boxShadow: isActive ? `0 0 0 2.5px ${stroke}` : "none",
                    transition: "box-shadow 0.15s",
                    pointerEvents: mode === "annotate" ? "none" : "auto",
                    cursor: mode === "view" ? "pointer" : "crosshair",
                    outline: isLegacy ? "1.5px dashed rgba(234,179,8,0.7)" : "none",
                  }}
                />
                {/* Legacy warning badge */}
                {isLegacy && (
                  <div style={{
                    position: "absolute",
                    left: px.left, top: px.top - 14,
                    fontSize: 9, color: "#ca8a04", background: "rgba(0,0,0,0.7)",
                    padding: "0 3px", borderRadius: 2, pointerEvents: "none", whiteSpace: "nowrap",
                  }}>
                    Legacy — re-save to fix
                  </div>
                )}
              </React.Fragment>
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
              borderRadius: 2, pointerEvents: "none",
            }} />
          )}
        </div>
      )}
    </div>
  );
}