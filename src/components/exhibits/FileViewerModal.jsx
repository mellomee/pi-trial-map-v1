import React, { useState } from "react";
import { X, ExternalLink, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function FileViewerModal({ url, title, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [pdfError, setPdfError] = useState(false);

  if (!url) return null;

  const cleanUrl = url.split("?")[0].toLowerCase();
  const ext = cleanUrl.split(".").pop();
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext);
  const isPdf = ext === "pdf";
  const isVideo = ["mp4", "webm", "mov", "avi", "mkv", "m4v"].includes(ext);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <div
        className="relative bg-[#0f1629] border border-[#1e2a45] rounded-xl shadow-2xl flex flex-col"
        style={{ width: "92vw", height: "92vh", maxWidth: 1300 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a45] flex-shrink-0">
          <span className="text-sm font-medium text-slate-200 truncate max-w-[50%]">{title || "File Viewer"}</span>
          <div className="flex items-center gap-2">
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
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded px-2 py-1"
            >
              <ExternalLink className="w-3 h-3" /> New tab
            </a>
            <a
              href={url}
              download
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-600 rounded px-2 py-1"
            >
              <Download className="w-3 h-3" /> Download
            </a>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-start justify-center bg-[#080d1a] rounded-b-xl">
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
                  <span className="text-xs text-slate-300">Page {pageNumber} of {numPages}</span>
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
              <video
                src={url}
                controls
                className="max-w-full max-h-full rounded"
                style={{ maxHeight: "calc(92vh - 64px)" }}
              >
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
  );
}