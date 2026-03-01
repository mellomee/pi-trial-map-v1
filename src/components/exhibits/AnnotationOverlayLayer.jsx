import React, { useRef, useState } from "react";

// Color map
const COLOR_MAP = {
  yellow: { fill: "rgba(251,191,36,VAR)", stroke: "rgba(251,191,36,0.8)" },
  red:    { fill: "rgba(239,68,68,VAR)",  stroke: "rgba(239,68,68,0.8)" },
  green:  { fill: "rgba(34,197,94,VAR)",  stroke: "rgba(34,197,94,0.8)" },
  blue:   { fill: "rgba(59,130,246,VAR)", stroke: "rgba(59,130,246,0.8)" },
  none:   { fill: "rgba(251,191,36,VAR)", stroke: "rgba(251,191,36,0.8)" },
};

function resolveColor(color, opacity) {
  const c = COLOR_MAP[color] || COLOR_MAP.yellow;
  return { fill: c.fill.replace("VAR", opacity ?? 0.35), stroke: c.stroke };
}

/**
 * Get the normalized rect (0-100%) for an annotation.
 * geometry_json.x/y/w/h are ALWAYS stored as % of page dimensions (0-100).
 * rect_norm.x/y/w/h are fractional (0-1), converted here to %.
 */
export function getAnnRectPct(a) {
  const g = a.geometry_json;
  if (!g || g.type !== "rect") return null;

  // If rect_norm exists (0-1 range), use it
  if (a.rect_norm) {
    return {
      x: a.rect_norm.x * 100,
      y: a.rect_norm.y * 100,
      w: a.rect_norm.w * 100,
      h: a.rect_norm.h * 100,
    };
  }

  // geometry_json x/y/w/h are already stored as % (0-100)
  return { x: g.x, y: g.y, w: g.w, h: g.h };
}

// Arrow SVG callout (coords are always 0-100 %)
function CalloutArrow({ ann, presentMode }) {
  const g = ann.geometry_json;
  if (!g || g.type !== "arrow") return null;
  const { from, to, textBox, text } = g;
  const { fill, stroke } = resolveColor(ann.color || "yellow", ann.opacity ?? 0.6);

  return (
    <>
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <marker id={`arrowhead-${ann.id}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill={stroke} />
          </marker>
        </defs>
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
          stroke={stroke} strokeWidth="0.8"
          markerEnd={`url(#arrowhead-${ann.id})`} />
      </svg>
      {textBox && (
        <div style={{
          position: "absolute",
          left: `${textBox.x}%`, top: `${textBox.y}%`,
          width: `${textBox.w}%`, minHeight: `${textBox.h}%`,
          backgroundColor: fill,
          border: `1.5px solid ${stroke}`,
          borderRadius: "3px", padding: "1px 4px",
          fontSize: "clamp(8px, 1.2vw, 12px)", color: "#fff",
          pointerEvents: presentMode ? "none" : "auto",
          wordBreak: "break-word",
        }} title={!presentMode ? ann.note_text : ""}>
          {text || ann.label_text || ann.label || ""}
        </div>
      )}
    </>
  );
}

// ── Main overlay layer ────────────────────────────────────────────────────────
export default function AnnotationOverlayLayer({
  annotations = [],
  currentPage = 1,
  activeTool = "select",
  activeColor = "yellow",
  activeOpacity = 0.35,
  flashId = null,
  selectedId = null,
  presentMode = false,
  onDrawComplete,   // (geometry_json, page) => void  — coords are 0-100%
  onSelect,
}) {
  const containerRef = useRef(null);
  const [drawing, setDrawing] = useState(null);
  const [arrowStart, setArrowStart] = useState(null);

  const pageAnns = annotations.filter(a => {
    const pg = a.page_number ?? a.extract_page_number;
    return pg === currentPage;
  });

  const getRelPos = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const isDrawing = activeTool === "highlight" || activeTool === "redaction" || activeTool === "callout";

  const onMouseDown = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getRelPos(e);
    if (activeTool === "callout") {
      if (!arrowStart) setArrowStart(pos);
      return;
    }
    setDrawing({ startX: pos.x, startY: pos.y, x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const onMouseMove = (e) => {
    if (!drawing) return;
    const pos = getRelPos(e);
    setDrawing(prev => ({
      ...prev,
      x: Math.min(pos.x, prev.startX),
      y: Math.min(pos.y, prev.startY),
      w: Math.abs(pos.x - prev.startX),
      h: Math.abs(pos.y - prev.startY),
    }));
  };

  const onMouseUp = (e) => {
    if (activeTool === "callout" && arrowStart) {
      const pos = getRelPos(e);
      const geometry = {
        type: "arrow",
        from: arrowStart, to: pos,
        textBox: { x: pos.x + 1, y: pos.y - 8, w: 20, h: 8 },
        text: "",
      };
      onDrawComplete && onDrawComplete(geometry, currentPage);
      setArrowStart(null);
      return;
    }
    if (!drawing || drawing.w < 1 || drawing.h < 1) { setDrawing(null); return; }
    // geometry stored as % of overlay container (= % of rendered page)
    const geometry = { type: "rect", x: drawing.x, y: drawing.y, w: drawing.w, h: drawing.h };
    onDrawComplete && onDrawComplete(geometry, currentPage);
    setDrawing(null);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: isDrawing ? "crosshair" : "default", userSelect: isDrawing ? "none" : "auto" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => { setDrawing(null); setArrowStart(null); }}
    >
      {pageAnns.map(a => {
        const isFlash = flashId === a.id;
        const isSel = selectedId === a.id;
        const kind = a.kind || "highlight";

        if (kind === "callout") {
          return <CalloutArrow key={a.id} ann={a} presentMode={presentMode} />;
        }

        const rect = getAnnRectPct(a);
        if (!rect) return null;
        const isRedaction = kind === "redaction";
        const { fill, stroke } = resolveColor(a.color || "yellow", isRedaction ? 1 : (a.opacity ?? 0.35));

        return (
          <div key={a.id}
            title={!presentMode ? `${a.label_text || a.label || ""}${a.note_text ? ": " + a.note_text : ""}` : ""}
            onClick={(e) => { e.stopPropagation(); onSelect && onSelect(a.id); }}
            style={{
              position: "absolute",
              left: `${rect.x}%`, top: `${rect.y}%`,
              width: `${rect.w}%`, height: `${rect.h}%`,
              backgroundColor: isRedaction ? "#000" : fill,
              border: isRedaction
                ? (presentMode ? "none" : "1px solid #333")
                : `1.5px solid ${isSel || isFlash ? stroke : stroke.replace("0.8", "0.45")}`,
              borderRadius: "2px",
              pointerEvents: presentMode ? "none" : "auto",
              cursor: activeTool === "select" ? "pointer" : "crosshair",
              boxShadow: isFlash ? `0 0 0 3px ${stroke}` : isSel ? `0 0 0 2px ${stroke}` : "none",
              animation: isFlash ? "ann-flash-pulse 0.8s ease-in-out 1" : "none",
              transition: "box-shadow 0.2s",
            }}
          />
        );
      })}

      {/* In-progress rect */}
      {drawing && drawing.w > 0 && (
        <div style={{
          position: "absolute",
          left: `${drawing.x}%`, top: `${drawing.y}%`,
          width: `${drawing.w}%`, height: `${drawing.h}%`,
          backgroundColor: activeTool === "redaction" ? "rgba(0,0,0,0.7)" : "rgba(251,191,36,0.3)",
          border: `2px dashed ${activeTool === "redaction" ? "#666" : "rgba(251,191,36,0.8)"}`,
          borderRadius: "2px", pointerEvents: "none",
        }} />
      )}

      {arrowStart && (
        <div style={{
          position: "absolute",
          left: `${arrowStart.x}%`, top: `${arrowStart.y}%`,
          width: "10px", height: "10px",
          marginLeft: "-5px", marginTop: "-5px",
          backgroundColor: "rgba(251,191,36,0.9)",
          borderRadius: "50%", pointerEvents: "none",
        }} />
      )}
    </div>
  );
}