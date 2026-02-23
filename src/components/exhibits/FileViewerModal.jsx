import React, { useState, useRef } from "react";
import { X, ExternalLink, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function FileViewerModal({ url, title, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [pdfError, setPdfError] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [jumpInput, setJumpInput] = useState("");

  if (!url) return null;

  const cleanUrl = url.split("?")[0].toLowerCase();
  const ext = cleanUrl.split(".").pop();
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext);
  const isPdf = ext === "pdf";
  const isVideo = ["mp4", "webm", "mov", "avi", "mkv", "m4v"].includes(ext);

  const handleJump = (e) => {
    e.preventDefault();
    const p = parseInt(jumpInput, 10);
    if (!isNaN(p) && p >= 1 && p <= numPages) {
      setPageNumber(p);
      setJumpInput("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <div
        className="relative bg-[#0f1629] border border-[#1e2a45] rounded-xl shadow-2xl flex flex-col"
        style={{ width: "92vw", height: "92vh", maxWidth: 1400 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a45] flex-shrink-0">
          <span className="text-sm font-medium text-slate-200 truncate max-w-[40%]">{title || "File Viewer"}</span>
          <div className="flex items-center gap-2">
            {isPdf && numPages > 1 && (
              <button
                onClick={() => setShowThumbnails(s => !s)}
                className={`flex items-center gap-1 text-xs border rounded px-2 py-1 ${showThumbnails ? "text-cyan-400 border-cyan-500/50 bg-cyan-500/10" : "text-slate-400 hover:text-white border-slate-600"}`}
                title="Toggle thumbnail panel"
              >
                <LayoutGrid className="w-3 h-3" /> Thumbnails
              </button>
            )}
            {(isPdf || isImage) && (
              <>
                <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Zoom out">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Zoom in">
                  <ZoomIn className="w-4 h-4" />
                </button>
              </>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded px-2 py-1">
              <ExternalLink className="w-3 h-3" /> New tab
            </a>
            <a href={url} download
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-600 rounded px-2 py-1">
              <Download className="w-3 h-3" /> Download
            </a>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden rounded-b-xl">

          {/* Thumbnail sidebar */}
          {isPdf && showThumbnails && numPages && (
            <div className="w-36 flex-shrink-0 bg-[#080d1a] border-r border-[#1e2a45] overflow-y-auto flex flex-col gap-2 p-2">
              <Document file={url} loading={null}>
                {Array.from({ length: numPages }, (_, i) => i + 1).map(pg => (
                  <button
                    key={pg}
                    onClick={() => setPageNumber(pg)}
                    className={`flex flex-col items-center gap-1 w-full rounded p-1 border transition-colors ${pageNumber === pg ? "border-cyan-500 bg-cyan-500/10" : "border-transparent hover:border-slate-600"}`}
                  >
                    <Page
                      pageNumber={pg}
                      scale={0.18}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="pointer-events-none"
                    />
                    <span className="text-[10px] text-slate-400">{pg}</span>
                  </button>
                ))}
              </Document>
            </div>
          )}

          {/* Main content area */}
          <div className="flex-1 overflow-auto flex items-start justify-center bg-[#080d1a]">
            {isPdf && !pdfError && (
              <div className="flex flex-col items-center py-4 w-full">
                <Document
                  file={url}
                  onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPageNumber(1); }}
                  onLoadError={() => setPdfError(true)}
                  loading={<div className="text-slate-400 text-sm mt-8">Loading PDF…</div>}
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={zoom}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>

                {numPages && numPages > 1 && (
                  <div className="flex items-center gap-3 mt-4 mb-2 bg-[#0f1629] border border-[#1e2a45] rounded-lg px-4 py-2">
                    <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1} className="text-slate-400 hover:text-white disabled:opacity-30">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-400">Page</span>
                    <form onSubmit={handleJump} className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={numPages}
                        value={jumpInput !== "" ? jumpInput : pageNumber}
                        onChange={e => setJumpInput(e.target.value)}
                        onBlur={handleJump}
                        className="w-12 text-center text-xs bg-[#0a0f1e] border border-[#1e2a45] rounded text-slate-200 py-0.5 focus:outline-none focus:border-cyan-500"
                      />
                    </form>
                    <span className="text-xs text-slate-400">of {numPages}</span>
                    <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages} className="text-slate-400 hover:text-white disabled:opacity-30">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {isPdf && pdfError && (
              <div className="flex flex-col items-center gap-4 text-slate-400 p-8 text-center mt-8">
                <p className="text-sm">Could not render PDF inline.</p>
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cyan-400 border border-cyan-500/30 rounded-lg px-4 py-2 text-sm hover:text-cyan-300">
                  <ExternalLink className="w-4 h-4" /> Open PDF in new tab
                </a>
              </div>
            )}

            {isImage && (
              <div className="overflow-auto w-full h-full flex items-center justify-center p-4">
                <img
                  src={url}
                  alt={title}
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s" }}
                  className="max-w-full object-contain"
                  draggable={false}
                />
              </div>
            )}

            {isVideo && (
              <div className="flex items-center justify-center w-full h-full p-4">
                <video src={url} controls className="max-w-full max-h-full rounded" style={{ maxHeight: "calc(92vh - 64px)" }}>
                  Your browser does not support this video format.
                </video>
              </div>
            )}

            {!isPdf && !isImage && !isVideo && (
              <div className="flex flex-col items-center gap-4 text-slate-400 p-8 text-center mt-8">
                <p className="text-sm">This file type cannot be previewed in the browser.</p>
                <div className="flex gap-3">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded-lg px-4 py-2 text-sm">
                    <ExternalLink className="w-4 h-4" /> Open File
                  </a>
                  <a href={url} download className="flex items-center gap-2 text-slate-400 hover:text-slate-200 border border-slate-600 rounded-lg px-4 py-2 text-sm">
                    <Download className="w-4 h-4" /> Download
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}