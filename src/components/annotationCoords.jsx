/**
 * annotationCoords.js
 * Stable coordinate helpers for annotation storage and rendering.
 *
 * PDFs  → store rect_pdf { x1, y1, x2, y2 } in PDF page units (via pdf.js viewport)
 * Images → store rect_norm { x, y, w, h } normalized 0..1 against natural image size
 */

// ─── Utility ────────────────────────────────────────────────────────────────

export function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

// ─── IMAGE helpers ───────────────────────────────────────────────────────────

/**
 * Convert a DOM-pixel selection (relative to the displayed <img>) into
 * normalized coordinates saved as rect_norm.
 */
export function domRectToNorm(leftPx, topPx, widthPx, heightPx, imgClientWidth, imgClientHeight) {
  return {
    x: clamp01(leftPx   / imgClientWidth),
    y: clamp01(topPx    / imgClientHeight),
    w: clamp01(widthPx  / imgClientWidth),
    h: clamp01(heightPx / imgClientHeight),
  };
}

/**
 * Convert stored rect_norm back to pixel position for rendering over an <img>.
 */
export function normRectToPixels(rectNorm, imgClientWidth, imgClientHeight) {
  return {
    left:   rectNorm.x * imgClientWidth,
    top:    rectNorm.y * imgClientHeight,
    width:  rectNorm.w * imgClientWidth,
    height: rectNorm.h * imgClientHeight,
  };
}

// ─── PDF helpers (pdf.js) ────────────────────────────────────────────────────

/**
 * Convert a DOM-pixel drag rect (relative to the page canvas/container)
 * into PDF page coordinates using a pdf.js PageViewport.
 *
 * @param {{ left, top, width, height }} domRect - pixels relative to page element
 * @param {object} viewport - pdf.js PageViewport (from page.getViewport({scale, rotation}))
 * @returns {{ x1, y1, x2, y2 }} in PDF user units
 */
export function domRectToPdf(domRect, viewport) {
  const [px1, py1] = viewport.convertToPdfPoint(domRect.left, domRect.top);
  const [px2, py2] = viewport.convertToPdfPoint(
    domRect.left + domRect.width,
    domRect.top  + domRect.height
  );
  return {
    x1: Math.min(px1, px2),
    y1: Math.min(py1, py2),
    x2: Math.max(px1, px2),
    y2: Math.max(py1, py2),
  };
}

/**
 * Convert stored rect_pdf back to pixel position for rendering over a page element.
 *
 * @param {{ x1, y1, x2, y2 }} rectPdf
 * @param {object} viewport - pdf.js PageViewport
 * @returns {{ left, top, width, height }} in pixels
 */
export function pdfRectToPixels(rectPdf, viewport) {
  const v1 = viewport.convertToViewportPoint(rectPdf.x1, rectPdf.y1);
  const v2 = viewport.convertToViewportPoint(rectPdf.x2, rectPdf.y2);
  return {
    left:   Math.min(v1[0], v2[0]),
    top:    Math.min(v1[1], v2[1]),
    width:  Math.abs(v2[0] - v1[0]),
    height: Math.abs(v2[1] - v1[1]),
  };
}

/**
 * Detect what coordinate system an annotation uses.
 * Returns "pdf" | "norm" | "legacy"
 */
export function coordMode(ann) {
  if (ann.rect_pdf && ann.rect_pdf.x1 != null) return "pdf";
  if (ann.rect_norm && ann.rect_norm.x != null) return "norm";
  return "legacy";
}