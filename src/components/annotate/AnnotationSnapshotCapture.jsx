/**
 * Utility: given a pdfjs page, a canvas element, and a drag rect in client pixels,
 * captures a snapshot PNG and optionally auto-generates text highlight rects inside the crop.
 *
 * Returns: { blob, snapshotW, snapshotH, cropRectCanvas, textHighlights, hasTextLayer }
 */

const COLOR_RGBA = {
  yellow: "rgba(255,220,0,0.28)",
  red:    "rgba(239,68,68,0.28)",
  green:  "rgba(34,197,94,0.28)",
  blue:   "rgba(59,130,246,0.28)",
};

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.displayCanvas  - the visible pdf canvas
 * @param {object}            opts.pdfPage        - pdfjs page object
 * @param {number}            opts.renderScale    - scale used to render pdfPage onto displayCanvas
 * @param {{x,y,w,h}}         opts.dragRect       - drag rect in CLIENT (CSS) pixels relative to canvas BoundingClientRect
 * @param {string}            opts.color          - highlight color key
 * @param {boolean}           opts.bakeHighlight  - whether to bake color overlay onto snapshot
 * @returns {Promise<{blob, snapshotW, snapshotH, cropRectCanvas, textHighlights, hasTextLayer}>}
 */
export async function captureAnnotationSnapshot({
  displayCanvas,
  pdfPage,
  renderScale,
  dragRect,
  color = "yellow",
  bakeHighlight = true,
}) {
  const canvasRect = displayCanvas.getBoundingClientRect();
  const scaleX = displayCanvas.width / canvasRect.width;
  const scaleY = displayCanvas.height / canvasRect.height;

  // Convert drag rect from CSS px to canvas px
  const cx = dragRect.x * scaleX;
  const cy = dragRect.y * scaleY;
  const cw = dragRect.w * scaleX;
  const ch = dragRect.h * scaleY;
  const cropRectCanvas = { x: cx, y: cy, w: cw, h: ch };

  // Crop onto a new canvas
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width  = Math.round(cw);
  cropCanvas.height = Math.round(ch);
  const ctx = cropCanvas.getContext("2d");
  ctx.drawImage(displayCanvas, cx, cy, cw, ch, 0, 0, cw, ch);

  // Bake highlight overlay
  if (bakeHighlight) {
    ctx.fillStyle = COLOR_RGBA[color] || COLOR_RGBA.yellow;
    ctx.fillRect(0, 0, cw, ch);
  }

  // ── Auto text-highlight extraction ──────────────────────────────────────
  let textHighlights = [];
  let hasTextLayer = false;
  if (pdfPage) {
    try {
      const textContent = await pdfPage.getTextContent();
      const items = textContent.items || [];
      const hasText = items.some(it => it.str && it.str.trim().length > 0);
      hasTextLayer = hasText;

      if (hasText) {
        // viewport at renderScale (same as the displayed canvas)
        const vp = pdfPage.getViewport({ scale: renderScale });
        // Each text item has a transform [a,b,c,d,e,f] where e,f = origin in viewport coords
        // item.height and item.width are in viewport units
        for (const item of items) {
          if (!item.str || !item.str.trim()) continue;
          const [a, , , d, e, f] = item.transform;
          const itemW = item.width  ?? Math.abs(a) * item.str.length * 0.6;
          const itemH = item.height ?? Math.abs(d);
          // PDF Y axis is bottom-up; viewport is top-down
          const itemX = e;
          const itemY = vp.height - f - itemH;

          // Check if this item overlaps the crop rect (in canvas px)
          if (itemX + itemW < cx) continue;
          if (itemX > cx + cw) continue;
          if (itemY + itemH < cy) continue;
          if (itemY > cy + ch) continue;

          // Clip to crop bounds, convert to normalized crop coords
          const ox = Math.max(itemX, cx) - cx;
          const oy = Math.max(itemY, cy) - cy;
          const ow = Math.min(itemX + itemW, cx + cw) - Math.max(itemX, cx);
          const oh = Math.min(itemY + itemH, cy + ch) - Math.max(itemY, cy);

          if (ow < 2 || oh < 2) continue;

          textHighlights.push({
            x: ox / cw,
            y: oy / ch,
            w: ow / cw,
            h: oh / ch,
          });
        }

        // Merge overlapping/adjacent horizontal lines into single rects (reduces clutter)
        textHighlights = mergeLines(textHighlights);
      }
    } catch (e) {
      // Text layer unavailable — silently skip
      hasTextLayer = false;
      textHighlights = [];
    }
  }

  const blob = await new Promise(res => cropCanvas.toBlob(res, "image/png"));

  return {
    blob,
    snapshotW: cropCanvas.width,
    snapshotH: cropCanvas.height,
    cropRectCanvas,
    textHighlights,
    hasTextLayer,
  };
}

/**
 * Merge highlight rects that are on the same "line" (similar Y) into wider combined rects.
 */
function mergeLines(rects) {
  if (!rects.length) return rects;
  // Sort by y then x
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(r.y - last.y) < 0.02 && Math.abs(r.h - last.h) < 0.015) {
      // Same line — extend
      const x1 = Math.min(last.x, r.x);
      const x2 = Math.max(last.x + last.w, r.x + r.w);
      last.x = x1;
      last.w = x2 - x1;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}