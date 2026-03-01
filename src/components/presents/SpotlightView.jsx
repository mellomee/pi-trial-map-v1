import React, { useEffect, useRef, useState } from "react";

/**
 * SpotlightView: Takes the page canvas element and crops + scales
 * the annotation region using drawImage, TrialDirector-style.
 *
 * Props:
 *   pageCanvasEl  – the HTMLCanvasElement of the rendered PDF page
 *   annotation    – annotation object with geometry_json {type:'rect', x,y,w,h} (0-100 %)
 *   zoomFactor    – 2 | 3 | 4
 *   padding       – fractional padding around the crop (0.3 = 30% expansion)
 *   visible       – boolean
 */
export default function SpotlightView({ pageCanvasEl, annotation, zoomFactor = 3, padding = 0.4, visible }) {
  const canvasRef = useRef(null);
  const [cropInfo, setCropInfo] = useState(null);

  useEffect(() => {
    if (!visible || !pageCanvasEl || !annotation) return;
    const g = annotation.geometry_json;
    if (!g || g.type !== "rect") return;

    const srcW = pageCanvasEl.width;
    const srcH = pageCanvasEl.height;

    // Convert % coords to canvas pixels
    const rx = (g.x / 100) * srcW;
    const ry = (g.y / 100) * srcH;
    const rw = (g.w / 100) * srcW;
    const rh = (g.h / 100) * srcH;

    // Expand by padding
    const padX = rw * padding;
    const padY = rh * padding;
    let sx = rx - padX;
    let sy = ry - padY;
    let sw = rw + padX * 2;
    let sh = rh + padY * 2;

    // Clamp to canvas bounds
    sx = Math.max(0, sx);
    sy = Math.max(0, sy);
    if (sx + sw > srcW) sw = srcW - sx;
    if (sy + sh > srcH) sh = srcH - sy;

    // Output size: maintain aspect ratio scaled to target width
    const targetW = Math.min(900, window.innerWidth * 0.75);
    const aspect = sh / sw;
    const targetH = targetW * aspect;

    setCropInfo({ sx, sy, sw, sh, targetW, targetH });
  }, [visible, pageCanvasEl, annotation, zoomFactor, padding]);

  useEffect(() => {
    if (!cropInfo || !canvasRef.current || !pageCanvasEl) return;
    const { sx, sy, sw, sh, targetW, targetH } = cropInfo;
    const out = canvasRef.current;
    out.width = targetW;
    out.height = targetH;
    const ctx = out.getContext("2d");
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(pageCanvasEl, sx, sy, sw, sh, 0, 0, targetW, targetH);

    // Draw highlight outline on crop
    if (annotation?.geometry_json) {
      const g = annotation.geometry_json;
      const srcW = pageCanvasEl.width;
      const srcH = pageCanvasEl.height;
      const rx = ((g.x / 100) * srcW - sx) * (targetW / sw);
      const ry = ((g.y / 100) * srcH - sy) * (targetH / sh);
      const rw = (g.w / 100) * srcW * (targetW / sw);
      const rh = (g.h / 100) * srcH * (targetH / sh);
      ctx.strokeStyle = "rgba(251,191,36,0.95)";
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(251,191,36,0.6)";
      ctx.shadowBlur = 8;
      ctx.strokeRect(rx, ry, rw, rh);
    }
  }, [cropInfo, pageCanvasEl, annotation]);

  if (!visible || !cropInfo) return null;

  return (
    <div
      className="pointer-events-none"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
      }}
    >
      {/* Dim overlay behind spotlight */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        zIndex: 0,
      }} />

      {/* Spotlight crop canvas */}
      <div style={{
        position: "relative",
        zIndex: 1,
        borderRadius: "6px",
        overflow: "hidden",
        boxShadow: "0 0 0 2px rgba(251,191,36,0.5), 0 12px 60px rgba(0,0,0,0.8)",
        maxWidth: "90%",
      }}>
        <canvas ref={canvasRef} style={{ display: "block", maxWidth: "100%" }} />
      </div>
    </div>
  );
}