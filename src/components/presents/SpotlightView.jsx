import React, { useEffect, useRef, useState } from "react";
import { pdfRectToPixels, normRectToPixels, coordMode } from "@/components/annotationCoords";

/**
 * SpotlightView
 * Crops and magnifies the annotation region from the rendered page canvas.
 *
 * Props:
 *   pageCanvasEl   – HTMLCanvasElement of the rendered PDF page
 *   annotation     – ExhibitAnnotations object (uses rect_pdf, rect_norm, or geometry_json)
 *   pdfViewport    – pdf.js PageViewport (required for rect_pdf annotations)
 *   canvasPixelW   – width of the canvas in display pixels (canvas.width / devicePixelRatio ≈ viewport.width)
 *   canvasPixelH   – same for height
 *   padding        – fractional padding around crop (default 0.4)
 *   visible        – boolean
 */
export default function SpotlightView({
  pageCanvasEl,
  annotation,
  pdfViewport,
  canvasPixelW,
  canvasPixelH,
  padding = 0.4,
  visible,
}) {
  const canvasRef = useRef(null);
  const [cropInfo, setCropInfo] = useState(null);

  useEffect(() => {
    if (!visible || !pageCanvasEl || !annotation) { setCropInfo(null); return; }

    // Resolve pixel rect in viewport (CSS) pixel space, then scale to physical canvas pixels.
    const vpW = canvasPixelW || pageCanvasEl.offsetWidth || pageCanvasEl.width;
    const vpH = canvasPixelH || pageCanvasEl.offsetHeight || pageCanvasEl.height;
    // Physical canvas size may be larger than CSS size due to devicePixelRatio
    const scaleToCanvas = pageCanvasEl.width / vpW;

    let px = null;
    const cm = coordMode(annotation);

    if (cm === "pdf" && pdfViewport) {
      px = pdfRectToPixels(annotation.rect_pdf, pdfViewport);
    } else if (cm === "norm") {
      px = normRectToPixels(annotation.rect_norm, vpW, vpH);
    } else {
      // legacy geometry_json (0-100%)
      const g = annotation.geometry_json;
      if (g?.type === "rect") {
        px = { left: (g.x / 100) * vpW, top: (g.y / 100) * vpH,
               width: (g.w / 100) * vpW, height: (g.h / 100) * vpH };
      } else if (annotation.rect_norm_x != null) {
        px = { left: annotation.rect_norm_x * vpW, top: annotation.rect_norm_y * vpH,
               width: annotation.rect_norm_w * vpW, height: annotation.rect_norm_h * vpH };
      }
    }

    if (!px) { setCropInfo(null); return; }

    // Scale to canvas pixel space
    const rx = px.left   * scaleToCanvas;
    const ry = px.top    * scaleToCanvas;
    const rw = px.width  * scaleToCanvas;
    const rh = px.height * scaleToCanvas;

    const srcW = pageCanvasEl.width;
    const srcH = pageCanvasEl.height;

    const padX = rw * padding;
    const padY = rh * padding;
    let sx = Math.max(0, rx - padX);
    let sy = Math.max(0, ry - padY);
    let sw = rw + padX * 2;
    let sh = rh + padY * 2;
    if (sx + sw > srcW) sw = srcW - sx;
    if (sy + sh > srcH) sh = srcH - sy;

    const targetW = Math.min(900, window.innerWidth * 0.75);
    const targetH = targetW * (sh / sw);

    setCropInfo({ sx, sy, sw, sh, targetW, targetH, rx, ry, rw, rh });
  }, [visible, pageCanvasEl, annotation, pdfViewport, canvasPixelW, canvasPixelH, padding]);

  useEffect(() => {
    if (!cropInfo || !canvasRef.current || !pageCanvasEl) return;
    const { sx, sy, sw, sh, targetW, targetH, rx, ry, rw, rh } = cropInfo;
    const out = canvasRef.current;
    out.width = targetW;
    out.height = targetH;
    const ctx = out.getContext("2d");
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(pageCanvasEl, sx, sy, sw, sh, 0, 0, targetW, targetH);

    // Draw highlight outline
    const scaleX = targetW / sw;
    const scaleY = targetH / sh;
    const outRx = (rx - sx) * scaleX;
    const outRy = (ry - sy) * scaleY;
    const outRw = rw * scaleX;
    const outRh = rh * scaleY;
    ctx.strokeStyle = "rgba(251,191,36,0.95)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(251,191,36,0.6)";
    ctx.shadowBlur = 8;
    ctx.strokeRect(outRx, outRy, outRw, outRh);
  }, [cropInfo, pageCanvasEl]);

  if (!visible || !cropInfo) return null;

  return (
    <div
      className="pointer-events-none"
      style={{ position: "absolute", inset: 0, display: "flex",
               alignItems: "center", justifyContent: "center", zIndex: 20 }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 0 }} />
      <div style={{
        position: "relative", zIndex: 1, borderRadius: "6px", overflow: "hidden",
        boxShadow: "0 0 0 2px rgba(251,191,36,0.5), 0 12px 60px rgba(0,0,0,0.8)",
        maxWidth: "90%",
      }}>
        <canvas ref={canvasRef} style={{ display: "block", maxWidth: "100%" }} />
      </div>
    </div>
  );
}