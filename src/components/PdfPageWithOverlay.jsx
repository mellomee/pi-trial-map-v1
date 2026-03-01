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
function getColor(c) { return COLOR_MAP[c] || COLOR_MAP.yellow; }
function isPdf(url) { return url?.toLowerCase().includes(".pdf"); }

/**
 * PdfPageWithOverlay
 *
 * The key invariant:
 *   `renderedState` is an atomic { viewport, pageIndex, width, height } object
 *   set in a SINGLE setState call after render completes.
 *   The overlay is only shown when renderedState.pageIndex === pageIndex prop,
 *   guaranteeing the viewport used for coordinate conversion always matches the
 *   page currently painted on the canvas — eliminating drift completely.
 */
export default function PdfPageWithOverlay({
  fileUrl,
  pageIndex = 1,
  scale = 1.25,
  highlights = [],
  mode = "view",
  activeId = null,
  onCreateAnnotation,
  onCreateRect,
  onSelect,
  onNumPages,
  onPageRender,
  debug = false,
}) {
  const canvasRef  = useRef(null);
  const overlayRef = useRef(null);

  // ATOMIC rendered state — viewport + page index + CSS size all in one object.
  // The overlay only renders when renderedState.pageIndex === pageIndex prop.
  const [renderedState, setRenderedState] = useState(null);

  // Cached PDF doc to avoid re-downloading on page/scale changes
  const pdfDocRef = useRef(null);
  const pdfUrlRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Image support
  const [imgVpSize, setImgVpSize]   = useState(null);
  const imgRef = useRef(null);

  // Drag state for annotate mode
  const dragRef    = useRef(null);
  const [dragging, setDragging] = useState(null);

  const isImageFile = !isPdf(fileUrl);

  // ── Load / cache PDF document ─────────────────────────────────────────────
  useEffect(() => {
    if (!fileUrl || isImageFile) return;
    if (pdfUrlRef.current === fileUrl && pdfDocRef.current) return;
    pdfUrlRef.current = fileUrl;
    pdfDocRef.current = null;
    pdfjs.getDocument(fileUrl).promise.then(pdf => {
      pdfDocRef.current = pdf;
      if (onNumPages) onNumPages(pdf.numPages);
    });
  }, [fileUrl, isImageFile]);

  // ── Render page ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fileUrl || isImageFile) return;
    let cancelled = false;

    // Immediately wipe old rendered state so overlay disappears while loading
    setRenderedState(null);
    setLoading(true);
    setError(null);

    const doRender = (pdf) => {
      pdf.getPage(pageIndex).then(page => {
        if (cancelled) return;

        const vp  = page.getViewport({ scale, rotation: 0 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.style.width  = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;
        canvas.width  = Math.round(vp.width  * dpr);
        canvas.height = Math.round(vp.height * dpr);

        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        page.render({ canvasContext: ctx, viewport: vp }).promise.then(() => {
          if (cancelled) return;

          // Set all three together so React never renders the overlay with
          // a viewport that belongs to a different page.
          const rs = { viewport: vp, pageIndex, width: vp.width, height: vp.height };
          setRenderedState(rs);
          setLoading(false);

          if (debug) console.log("[PdfPageWithOverlay] rendered", { pageIndex, w: vp.width, h: vp.height, dpr });
          if (onPageRender) onPageRender({ canvas, viewport: vp, vpSize: { width: vp.width, height: vp.height } });
        });
      }).catch(err => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });
    };

    const run = () => {
      if (pdfDocRef.current) { doRender(pdfDocRef.current); return; }
      pdfjs.getDocument(fileUrl).promise.then(pdf => {
        if (!pdfDocRef.current) { pdfDocRef.current = pdf; pdfUrlRef.current = fileUrl; if (onNumPages) onNumPages(pdf.numPages); }
        if (!cancelled) doRender(pdfDocRef.current);
      }).catch(err => { if (!cancelled) { setError(err.message); setLoading(false); } });
    };

    run();
    return () => { cancelled = true; };
  }, [fileUrl, pageIndex, scale, isImageFile]);

  // ── Coordinate resolution ─────────────────────────────────────────────────
  // renderedState is only non-null when its .pageIndex === current pageIndex prop,
  // so there's no page-mismatch possible here.
  const resolvePixels = useCallback((h) => {
    const cm = coordMode(h);

    if (cm === "pdf") {
      if (!renderedState) return null;
      return pdfRectToPixels(h.rect_pdf, renderedState.viewport);
    }

    if (cm === "norm") {
      const W = renderedState?.width  || imgVpSize?.width  || 1;
      const H = renderedState?.height || imgVpSize?.height || 1;
      return normRectToPixels(h.rect_norm, W, H);
    }

    // Legacy flat fields
    const W = renderedState?.width  || imgVpSize?.width;
    const H = renderedState?.height || imgVpSize?.height;
    if (!W || !H) return null;

    if (h.rect_norm_x != null) {
      return { left: h.rect_norm_x * W, top: h.rect_norm_y * H, width: h.rect_norm_w * W, height: h.rect_norm_h * H };
    }
    if (h.geometry_json?.type === "rect") {
      return { left: (h.geometry_json.x / 100) * W, top: (h.geometry_json.y / 100) * H,
               width: (h.geometry_json.w / 100) * W, height: (h.geometry_json.h / 100) * H };
    }
    return null;
  }, [renderedState, imgVpSize]);

  // ── Drag helpers ──────────────────────────────────────────────────────────
  const getRelPx = useCallback((e) => {
    const r = overlayRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
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
    const { startX, startY } = dragRef.current;
    const pos = getRelPx(e);
    setDragging({ x: Math.min(pos.x, startX), y: Math.min(pos.y, startY),
                  w: Math.abs(pos.x - startX), h: Math.abs(pos.y - startY) });
  }, [getRelPx]);

  const onMouseUp = useCallback((e) => {
    if (!dragRef.current) return;
    const { startX, startY } = dragRef.current;
    const pos = getRelPx(e);
    dragRef.current = null;
    setDragging(null);

    const left = Math.min(pos.x, startX), top = Math.min(pos.y, startY);
    const width = Math.abs(pos.x - startX), height = Math.abs(pos.y - startY);
    if (width < 5 || height < 5) return;

    if (!isImageFile && renderedState) {
      const vp = renderedState.viewport;
      const rect_pdf = domRectToPdf({ left, top, width, height }, vp);
      const payload = {
        source_type: "pdf", page_number: pageIndex, page_rotation: 0, rect_pdf,
        pdf_page_w: vp.width / scale, pdf_page_h: vp.height / scale,
        created_from: "annotate",
        viewport_meta: { scale, renderW: vp.width, renderH: vp.height },
      };
      if (onCreateAnnotation) onCreateAnnotation(payload);
      else if (onCreateRect) onCreateRect({ x: left/vp.width, y: top/vp.height, w: width/vp.width, h: height/vp.height }, vp.width, vp.height, scale);

    } else if (isImageFile && imgRef.current) {
      const el = imgRef.current;
      const rect_norm = domRectToNorm(left, top, width, height, el.clientWidth, el.clientHeight);
      const payload = { source_type: "image", page_number: 1, page_rotation: 0, rect_norm,
                        viewport_meta: { scale: 1, renderW: el.clientWidth, renderH: el.clientHeight } };
      if (onCreateAnnotation) onCreateAnnotation(payload);
      else if (onCreateRect) onCreateRect(rect_norm, el.clientWidth, el.clientHeight, 1);
    }
  }, [pageIndex, scale, isImageFile, renderedState, getRelPx, onCreateAnnotation, onCreateRect]);

  // ── Click-to-select ───────────────────────────────────────────────────────
  const handleOverlayClick = useCallback((e) => {
    if (mode !== "view" || !onSelect) return;
    const r = overlayRef.current.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const pageAnns = highlights.filter(h => (h.page_number ?? h.extract_page_number ?? 1) === pageIndex);
    const hit = [...pageAnns].reverse().find(h => {
      const px = resolvePixels(h);
      return px && cx >= px.left && cx <= px.left + px.width && cy >= px.top && cy <= px.top + px.height;
    });
    if (hit) { e.stopPropagation(); onSelect(hit.id); }
  }, [mode, onSelect, highlights, pageIndex, resolvePixels]);

  // ── Overlay dimensions — from renderedState (PDF) or imgVpSize (image) ────
  const overlayW = renderedState?.width  || imgVpSize?.width  || 0;
  const overlayH = renderedState?.height || imgVpSize?.height || 0;

  // Annotations for this page only
  const pageHighlights = highlights.filter(h => (h.page_number ?? h.extract_page_number ?? 1) === pageIndex);

  // Only show overlay when renderedState is for the current page (PDF) or image is loaded
  const overlayReady = isImageFile ? !!imgVpSize : (renderedState?.pageIndex === pageIndex);

  return (
    <div style={{ position: "relative", display: "inline-block", lineHeight: 0,
                  width: overlayW || undefined, height: overlayH || undefined,
                  outline: debug ? "2px solid lime" : "none" }}>

      {/* PDF canvas */}
      {!isImageFile && <canvas ref={canvasRef} style={{ display: "block" }} />}

      {/* Image */}
      {isImageFile && (
        <img ref={imgRef} src={fileUrl} alt="Extract"
          style={{ display: "block", maxWidth: "100%" }} draggable={false}
          onLoad={e => {
            const el = e.currentTarget;
            setImgVpSize({ width: el.clientWidth, height: el.clientHeight });
            setLoading(false);
            if (onNumPages) onNumPages(1);
          }} />
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

      {/* Overlay — only rendered when viewport matches the painted page */}
      {overlayReady && overlayW > 0 && (
        <div ref={overlayRef}
          style={{ position: "absolute", top: 0, left: 0, width: overlayW, height: overlayH,
                   cursor: mode === "annotate" ? "crosshair" : "default", userSelect: "none",
                   outline: debug ? "2px solid red" : "none" }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
          onMouseLeave={() => { dragRef.current = null; setDragging(null); }}
          onClick={handleOverlayClick}>

          {pageHighlights.map(h => {
            const cm  = coordMode(h);
            const px  = resolvePixels(h);
            if (!px) return null;
            const isActive    = activeId === h.id;
            const { fill, stroke } = getColor(h.color || "yellow");
            const isRedaction = h.kind === "redaction";
            const isLegacy    = cm === "legacy";
            return (
              <React.Fragment key={h.id}>
                <div title={h.label_text || h.label || ""} style={{
                  position: "absolute", left: px.left, top: px.top, width: px.width, height: px.height,
                  backgroundColor: isRedaction ? "rgba(0,0,0,0.92)" : fill,
                  border: isRedaction ? "1px solid #333" : `1.5px solid ${isActive ? stroke : stroke.replace("0.85","0.45")}`,
                  borderRadius: 2,
                  boxShadow: isActive ? `0 0 0 2.5px ${stroke}` : "none",
                  transition: "box-shadow 0.15s",
                  pointerEvents: mode === "annotate" ? "none" : "auto",
                  cursor: mode === "view" ? "pointer" : "crosshair",
                  outline: isLegacy ? "1.5px dashed rgba(234,179,8,0.7)" : "none",
                }} />
                {isLegacy && (
                  <div style={{ position: "absolute", left: px.left, top: px.top - 14,
                                fontSize: 9, color: "#ca8a04", background: "rgba(0,0,0,0.7)",
                                padding: "0 3px", borderRadius: 2, pointerEvents: "none", whiteSpace: "nowrap" }}>
                    Legacy — re-save to fix
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {dragging && dragging.w > 2 && (
            <div style={{ position: "absolute", left: dragging.x, top: dragging.y,
                          width: dragging.w, height: dragging.h,
                          backgroundColor: "rgba(251,146,60,0.22)", border: "2px dashed rgba(251,146,60,0.85)",
                          borderRadius: 2, pointerEvents: "none" }} />
          )}
        </div>
      )}
    </div>
  );
}