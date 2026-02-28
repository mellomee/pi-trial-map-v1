import React, { useState } from "react";
import { exhibitDisplayNo } from "@/components/exhibitHelpers";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, EyeOff, Eye,
  List, X, Check, Image as ImageIcon
} from "lucide-react";

// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

function isPdf(url) {
  if (!url) return false;
  return url.match(/\.pdf(\?|$)/i) || url.includes("/pdf") || url.includes("application%2Fpdf");
}

function isImage(url) {
  if (!url) return false;
  return url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i);
}

// ── PDF Viewer ─────────────────────────────────────────────────
function PdfViewer({ fileUrl, zoom }) {
  const [numPages, setNumPages] = useState(null);
  const [pageInput, setPageInput] = useState("1");
  const [currentPage, setCurrentPage] = useState(1);

  const goToPage = (p) => {
    const n = Math.max(1, Math.min(numPages || 1, p));
    setCurrentPage(n);
    setPageInput(String(n));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page nav bar */}
      {numPages && numPages > 1 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-[#1e2a45] bg-[#0a0f1e] flex-shrink-0">
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
            className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <input
            type="number"
            value={pageInput}
            onChange={e => setPageInput(e.target.value)}
            onBlur={() => goToPage(parseInt(pageInput) || 1)}
            onKeyDown={e => e.key === "Enter" && goToPage(parseInt(pageInput) || 1)}
            className="w-10 text-center text-[10px] bg-[#1e2a45] border border-[#2e3a55] rounded text-slate-300 py-0.5"
          />
          <span className="text-[10px] text-slate-500">/ {numPages}</span>
          <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}
            className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-30">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto flex justify-center p-2">
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => { setNumPages(numPages); setCurrentPage(1); setPageInput("1"); }}
          loading={<div className="text-slate-500 text-xs pt-8">Loading PDF…</div>}
          error={<div className="text-red-400 text-xs pt-8 px-3">Failed to load PDF.</div>}
        >
          <Page
            pageNumber={currentPage}
            scale={zoom}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>
    </div>
  );
}

// ── Main ExhibitViewer ─────────────────────────────────────────
export default function ExhibitViewer({
  exhibit,           // current JointExhibit object
  fileUrl,           // resolved file URL
  allExhibits,       // all JointExhibits for picker
  onSelectExhibit,   // (joint) => void
  onHide,            // () => void — hides entire pane
}) {
  const [zoom, setZoom] = useState(1.0);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const zoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const zoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));

  if (!exhibit) {
    return (
      <div className="h-full flex flex-col">
        {/* Header — still show picker even with no exhibit */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1e2a45] flex-shrink-0">
          <ImageIcon className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <div className="relative flex-1 min-w-0">
            <button onClick={() => setShowPicker(p => !p)}
              className="text-[10px] text-amber-400 hover:text-amber-300 uppercase tracking-wider font-medium flex items-center gap-1">
              Select Exhibit <ChevronLeft className="w-3 h-3 rotate-[-90deg]" />
            </button>
            {showPicker && (
              <ExhibitPicker
                allExhibits={allExhibits}
                currentExhibit={null}
                onSelect={(j) => { onSelectExhibit(j); setShowPicker(false); }}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>
          <button onClick={onHide} className="text-slate-600 hover:text-slate-300" title="Hide exhibit pane">
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-600 text-xs">
          No exhibit selected.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#1e2a45] flex-shrink-0 bg-[#0f1629]">
        <ImageIcon className="w-3 h-3 text-amber-400 flex-shrink-0" />

        {/* Exhibit picker trigger */}
        <div className="relative flex-1 min-w-0">
          <button onClick={() => setShowPicker(p => !p)}
            className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-medium uppercase tracking-wider max-w-full truncate">
            <span className="truncate">
              {exhibitDisplayNo(exhibit)}{exhibit.marked_title ? ` – ${exhibit.marked_title}` : ""}
            </span>
            <List className="w-3 h-3 flex-shrink-0" />
          </button>
          {showPicker && (
            <ExhibitPicker
              allExhibits={allExhibits}
              currentExhibit={exhibit}
              onSelect={(j) => { onSelectExhibit(j); setShowPicker(false); }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>

        {/* Toolbar toggle */}
        <button onClick={() => setShowToolbar(t => !t)}
          className="text-slate-600 hover:text-slate-300 flex-shrink-0" title="Toggle toolbar">
          {showToolbar ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>

        {/* Hide pane */}
        <button onClick={onHide} className="text-slate-600 hover:text-slate-300 flex-shrink-0" title="Hide exhibit pane">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Zoom toolbar */}
      {showToolbar && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-[#1e2a45] bg-[#0a0f1e] flex-shrink-0">
          <button onClick={zoomOut} className="p-1 rounded bg-[#1e2a45] text-slate-400 hover:text-white" title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} className="p-1 rounded bg-[#1e2a45] text-slate-400 hover:text-white" title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(1)} className="px-1.5 py-0.5 rounded bg-[#1e2a45] text-slate-500 hover:text-white text-[9px] ml-1">
            Reset
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {!fileUrl ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
            No file attached to this exhibit.
          </div>
        ) : isImage(fileUrl) ? (
          <div className="h-full overflow-auto flex justify-center items-start p-2">
            <img
              src={fileUrl}
              alt="Exhibit"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.15s" }}
              className="max-w-full"
              draggable={false}
            />
          </div>
        ) : (
          <PdfViewer fileUrl={fileUrl} zoom={zoom} />
        )}
      </div>
    </div>
  );
}

// ── Exhibit Picker Dropdown ────────────────────────────────────
function ExhibitPicker({ allExhibits, currentExhibit, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const filtered = allExhibits.filter(j =>
    !search || (j.marked_no + " " + (j.marked_title || "")).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="absolute top-full left-0 z-50 w-72 bg-[#131a2e] border border-[#1e2a45] rounded-lg shadow-xl">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#1e2a45]">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exhibits…"
          className="flex-1 bg-transparent text-[10px] text-slate-300 placeholder-slate-600 outline-none"
        />
        <button onClick={onClose} className="text-slate-600 hover:text-white flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="max-h-56 overflow-y-auto divide-y divide-[#1e2a45]">
        {filtered.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-4">No exhibits found.</p>
        )}
        {filtered.map(j => {
          const isActive = currentExhibit?.id === j.id;
          return (
            <button key={j.id} onClick={() => onSelect(j)}
              className={`w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 ${isActive ? "bg-amber-600/10" : ""}`}>
              {isActive && <Check className="w-3 h-3 text-amber-400 flex-shrink-0" />}
              <span className="text-[10px] font-mono text-amber-400 flex-shrink-0">{j.marked_no}</span>
              {j.marked_title && <span className="text-xs text-slate-300 truncate">{j.marked_title}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}