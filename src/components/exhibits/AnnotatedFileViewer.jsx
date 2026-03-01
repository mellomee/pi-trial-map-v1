import React, { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Highlighter, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Eye, EyeOff } from "lucide-react";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

function isPdf(url) { return url?.toLowerCase().includes(".pdf"); }
function isImage(url) { return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url || ""); }

// ── Highlight overlays for a single page ────────────────────────────────────
function HighlightLayer({ annotations, currentPage, flashId, drawMode, onDrawComplete, presentMode }) {
  const containerRef = useRef(null);
  const [drawing, setDrawing] = useState(null); // {startX, startY, x, y, w, h}

  const pageAnnotations = annotations.filter(a => {
    const boxes = a.highlight_boxes || [];
    return boxes.some(b => b.page === currentPage);
  });

  const getRelPos = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const onMouseDown = (e) => {
    if (!drawMode) return;
    e.preventDefault();
    const pos = getRelPos(e);
    setDrawing({ startX: pos.x, startY: pos.y, x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const onMouseMove = (e) => {
    if (!drawing) return;
    const pos = getRelPos(e);
    const x = Math.min(pos.x, drawing.startX);
    const y = Math.min(pos.y, drawing.startY);
    const w = Math.abs(pos.x - drawing.startX);
    const h = Math.abs(pos.y - drawing.startY);
    setDrawing(prev => ({ ...prev, x, y, w, h }));
  };

  const onMouseUp = () => {
    if (!drawing || drawing.w < 1 || drawing.h < 1) { setDrawing(null); return; }
    onDrawComplete({ page: currentPage, x: drawing.x, y: drawing.y, width: drawing.w, height: drawing.h });
    setDrawing(null);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: drawMode ? "crosshair" : "default", userSelect: drawMode ? "none" : "auto" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Existing highlights */}
      {pageAnnotations.map(a => {
        const boxes = (a.highlight_boxes || []).filter(b => b.page === currentPage);
        return boxes.map((box, i) => {
          const isFlashing = flashId === a.id;
          return (
            <div
              key={`${a.id}-${i}`}
              title={!presentMode ? `${a.label ? a.label + ": " : ""}${a.note_text}` : ""}
              style={{
                position: "absolute",
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.width}%`,
                height: `${box.height}%`,
                backgroundColor: isFlashing ? "rgba(251,191,36,0.55)" : "rgba(251,191,36,0.28)",
                border: isFlashing ? "2px solid rgba(251,191,36,0.9)" : "1.5px solid rgba(251,191,36,0.45)",
                borderRadius: "2px",
                pointerEvents: presentMode ? "none" : "auto",
                transition: "background-color 0.3s, border-color 0.3s",
                animation: isFlashing ? "ann-flash 0.6s ease-in-out 3" : "none",
              }}
            />
          );
        });
      })}

      {/* In-progress draw rect */}
      {drawing && drawing.w > 0 && (
        <div style={{
          position: "absolute",
          left: `${drawing.x}%`,
          top: `${drawing.y}%`,
          width: `${drawing.w}%`,
          height: `${drawing.h}%`,
          backgroundColor: "rgba(251,191,36,0.3)",
          border: "2px dashed rgba(251,191,36,0.8)",
          borderRadius: "2px",
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
}

// ── Main annotated viewer ─────────────────────────────────────────────────────
export default function AnnotatedFileViewer({
  fileUrl,
  annotations = [],
  onDrawComplete, // (box) => void  – called with a new box for the NEW annotation flow
  presentMode = false,
  flashAnnotationId = null,
  activeDrawAnnotationId = null, // which annotation are we drawing for?
}) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [drawMode, setDrawMode] = useState(false);
  const [showOverlays, setShowOverlays] = useState(true);

  // Reset page when URL changes
  useEffect(() => { setCurrentPage(1); }, [fileUrl]);

  // When a flash target changes page, navigate to it
  useEffect(() => {
    if (!flashAnnotationId) return;
    const ann = annotations.find(a => a.id === flashAnnotationId);
    if (!ann) return;
    const page = ann.extract_page_number || (ann.highlight_boxes?.[0]?.page);
    if (page) setCurrentPage(page);
  }, [flashAnnotationId]);

  const handleDrawComplete = useCallback((box) => {
    if (onDrawComplete) onDrawComplete(box);
    setDrawMode(false);
  }, [onDrawComplete]);

  if (!fileUrl) return (
    <div className="flex items-center justify-center h-40 text-slate-600 text-sm italic">No file attached to this extract.</div>
  );

  const isPdfFile = isPdf(fileUrl);
  const isImgFile = isImage(fileUrl);

  return (
    <div className="flex flex-col gap-0 bg-[#0a0f1e] rounded-xl border border-[#1e2a45] overflow-hidden">
      <style>{`@keyframes ann-flash { 0%,100%{background-color:rgba(251,191,36,0.28)} 50%{background-color:rgba(251,191,36,0.7)} }`}</style>

      {/* Toolbar */}
      {!presentMode && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e2a45] bg-[#0f1629]">
          {isPdfFile && (
            <>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                {currentPage} / {numPages || "…"}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(numPages || p, p + 1))}
                disabled={currentPage >= (numPages || 1)}
                className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-[#1e2a45] mx-1" />
            </>
          )}
          <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-1 text-slate-400 hover:text-slate-200">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 text-slate-400 hover:text-slate-200">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-slate-600">{Math.round(scale * 100)}%</span>
          <div className="w-px h-4 bg-[#1e2a45] mx-1" />
          <button
            onClick={() => setShowOverlays(v => !v)}
            className={`p-1 ${showOverlays ? "text-yellow-400" : "text-slate-500"} hover:text-yellow-300`}
            title={showOverlays ? "Hide highlights" : "Show highlights"}>
            {showOverlays ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setDrawMode(v => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              drawMode
                ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40"
                : "bg-slate-700/30 text-slate-400 border border-slate-700/50 hover:text-slate-200"
            }`}
            title="Draw a highlight box on the document">
            <Highlighter className="w-3.5 h-3.5" />
            {drawMode ? "Drawing…" : "Highlight"}
          </button>
        </div>
      )}

      {/* Document area */}
      <div className="overflow-auto max-h-[70vh] flex justify-center bg-[#080d1a] p-4">
        {isPdfFile && (
          <div className="relative inline-block">
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={<div className="text-slate-500 text-sm p-8">Loading PDF…</div>}
              error={<div className="text-red-400 text-sm p-8">Failed to load PDF.</div>}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
            </Document>
            {showOverlays && (
              <HighlightLayer
                annotations={annotations}
                currentPage={currentPage}
                flashId={flashAnnotationId}
                drawMode={drawMode}
                onDrawComplete={handleDrawComplete}
                presentMode={presentMode}
              />
            )}
          </div>
        )}

        {isImgFile && (
          <div className="relative inline-block">
            <img
              src={fileUrl}
              alt="Extract"
              style={{ transform: `scale(${scale})`, transformOrigin: "top left", display: "block" }}
              draggable={false}
            />
            {showOverlays && (
              <HighlightLayer
                annotations={annotations}
                currentPage={1}
                flashId={flashAnnotationId}
                drawMode={drawMode}
                onDrawComplete={handleDrawComplete}
                presentMode={presentMode}
              />
            )}
          </div>
        )}

        {!isPdfFile && !isImgFile && (
          <div className="text-slate-500 text-sm p-8">
            Unsupported file type.{" "}
            <a href={fileUrl} target="_blank" rel="noreferrer" className="text-cyan-400 underline">Open file</a>
          </div>
        )}
      </div>

      {/* Present-mode page nav */}
      {presentMode && isPdfFile && (
        <div className="flex items-center justify-center gap-3 py-2 border-t border-[#1e2a45]">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
            className="p-1 text-slate-400 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs text-slate-400">{currentPage} / {numPages || "…"}</span>
          <button onClick={() => setCurrentPage(p => Math.min(numPages || p, p + 1))} disabled={currentPage >= (numPages || 1)}
            className="p-1 text-slate-400 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}