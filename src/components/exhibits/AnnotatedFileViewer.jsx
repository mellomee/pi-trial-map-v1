import React, { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Eye, EyeOff,
  MousePointer, Highlighter, Square, ArrowUpRight
} from "lucide-react";
import AnnotationOverlayLayer from "@/components/exhibits/AnnotationOverlayLayer";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

function isPdf(url) { return url?.toLowerCase().includes(".pdf"); }
function isImage(url) { return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url || ""); }

const TOOLS = [
  { id: "select", icon: MousePointer, label: "Select" },
  { id: "highlight", icon: Highlighter, label: "Highlight" },
  { id: "redaction", icon: Square, label: "Redact" },
  { id: "callout", icon: ArrowUpRight, label: "Callout" },
];

const COLORS = ["yellow", "red", "green", "blue"];
const COLOR_CLASS = { yellow: "bg-yellow-400", red: "bg-red-500", green: "bg-green-500", blue: "bg-blue-500" };

export default function AnnotatedFileViewer({
  fileUrl,
  annotations = [],
  presentMode = false,
  flashAnnotationId = null,
  selectedAnnotationId = null,
  onDrawComplete,   // (geometry_json, page_number) => void
  onSelectAnnotation, // (id) => void
  // Present-mode step nav
  onPrevAnnotation,
  onNextAnnotation,
  currentPresentStep,
  totalPresentSteps,
}) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [showOverlays, setShowOverlays] = useState(true);
  const [activeTool, setActiveTool] = useState("select");
  const [activeColor, setActiveColor] = useState("yellow");
  const [activeOpacity, setActiveOpacity] = useState(0.35);
  const scrollRef = useRef(null);

  useEffect(() => { setCurrentPage(1); }, [fileUrl]);

  // Navigate to flash target page
  useEffect(() => {
    if (!flashAnnotationId) return;
    const ann = annotations.find(a => a.id === flashAnnotationId);
    if (!ann) return;
    const pg = ann.page_number ?? ann.extract_page_number ?? (ann.highlight_boxes?.[0]?.page);
    if (pg && pg !== currentPage) setCurrentPage(pg);
  }, [flashAnnotationId]);

  // Navigate to selected annotation page
  useEffect(() => {
    if (!selectedAnnotationId) return;
    const ann = annotations.find(a => a.id === selectedAnnotationId);
    if (!ann) return;
    const pg = ann.page_number ?? ann.extract_page_number;
    if (pg && pg !== currentPage) setCurrentPage(pg);
  }, [selectedAnnotationId]);

  const handleDrawComplete = useCallback((geometry, page) => {
    if (onDrawComplete) onDrawComplete(geometry, page, activeColor, activeOpacity);
    setActiveTool("select");
  }, [onDrawComplete, activeColor, activeOpacity]);

  if (!fileUrl) return (
    <div className="flex items-center justify-center h-40 text-slate-600 text-sm italic">
      No file attached to this extract.
    </div>
  );

  const isPdfFile = isPdf(fileUrl);
  const isImgFile = isImage(fileUrl);

  return (
    <div className="flex flex-col bg-[#0a0f1e] rounded-xl border border-[#1e2a45] overflow-hidden">
      <style>{`
        @keyframes ann-flash-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(251,191,36,0.8); }
          50%  { box-shadow: 0 0 0 8px rgba(251,191,36,0); }
          100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
        }
      `}</style>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      {!presentMode && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-[#1e2a45] bg-[#0f1629]">
          {/* Page nav for PDF */}
          {isPdfFile && (
            <>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] text-slate-400 w-10 text-center">{currentPage}/{numPages || "…"}</span>
              <button onClick={() => setCurrentPage(p => Math.min(numPages || p, p + 1))} disabled={currentPage >= (numPages || 1)}
                className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-[#1e2a45]" />
            </>
          )}

          {/* Zoom */}
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 text-slate-400 hover:text-slate-200">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-slate-500 w-8 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-1 text-slate-400 hover:text-slate-200">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setScale(1.0)} className="p-1 text-slate-500 hover:text-slate-200" title="Fit to width">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-[#1e2a45]" />

          {/* Tools */}
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              title={t.label}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                activeTool === t.id
                  ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}>
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
          <div className="w-px h-4 bg-[#1e2a45]" />

          {/* Color picker */}
          {activeTool !== "select" && activeTool !== "redaction" && (
            <>
              {COLORS.map(c => (
                <button key={c} onClick={() => setActiveColor(c)}
                  className={`w-4 h-4 rounded border-2 transition-all ${COLOR_CLASS[c]} ${
                    activeColor === c ? "border-white scale-110" : "border-transparent opacity-50"
                  }`} />
              ))}
              <div className="w-px h-4 bg-[#1e2a45]" />
            </>
          )}

          {/* Opacity slider */}
          {activeTool !== "select" && activeTool !== "redaction" && (
            <>
              <input type="range" min="10" max="80" step="5"
                value={Math.round(activeOpacity * 100)}
                onChange={e => setActiveOpacity(Number(e.target.value) / 100)}
                className="w-20 accent-yellow-400" title={`Opacity: ${Math.round(activeOpacity * 100)}%`}
              />
              <div className="w-px h-4 bg-[#1e2a45]" />
            </>
          )}

          {/* Toggle overlays */}
          <button onClick={() => setShowOverlays(v => !v)}
            className={`p-1 ${showOverlays ? "text-yellow-400" : "text-slate-600"} hover:text-yellow-300`}
            title={showOverlays ? "Hide overlays" : "Show overlays"}>
            {showOverlays ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* ── Document canvas ───────────────────────────────────────────────── */}
      <div ref={scrollRef} className="overflow-auto flex justify-center bg-[#080d1a] p-4"
        style={{ maxHeight: presentMode ? "80vh" : "65vh" }}>
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
              <AnnotationOverlayLayer
                annotations={annotations}
                currentPage={currentPage}
                activeTool={presentMode ? "select" : activeTool}
                activeColor={activeColor}
                activeOpacity={activeOpacity}
                flashId={flashAnnotationId}
                selectedId={selectedAnnotationId}
                presentMode={presentMode}
                onDrawComplete={handleDrawComplete}
                onSelect={onSelectAnnotation}
              />
            )}
          </div>
        )}

        {isImgFile && (
          <div className="relative inline-block" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <img src={fileUrl} alt="Extract" style={{ display: "block", maxWidth: "100%" }} draggable={false} />
            {showOverlays && (
              <AnnotationOverlayLayer
                annotations={annotations}
                currentPage={1}
                activeTool={presentMode ? "select" : activeTool}
                activeColor={activeColor}
                activeOpacity={activeOpacity}
                flashId={flashAnnotationId}
                selectedId={selectedAnnotationId}
                presentMode={presentMode}
                onDrawComplete={handleDrawComplete}
                onSelect={onSelectAnnotation}
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

      {/* ── Present mode nav ─────────────────────────────────────────────── */}
      {presentMode && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#1e2a45] bg-[#0f1629]">
          <div className="flex items-center gap-2">
            {isPdfFile && (
              <>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                  className="p-1 text-slate-400 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs text-slate-400">p.{currentPage}/{numPages || "…"}</span>
                <button onClick={() => setCurrentPage(p => Math.min(numPages || p, p + 1))} disabled={currentPage >= (numPages || 1)}
                  className="p-1 text-slate-400 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </>
            )}
          </div>
          {totalPresentSteps > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={onPrevAnnotation} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 border border-[#1e2a45] rounded">← Prev</button>
              <span className="text-[10px] text-slate-600">{(currentPresentStep || 0) + 1}/{totalPresentSteps}</span>
              <button onClick={onNextAnnotation} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 border border-[#1e2a45] rounded">Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}