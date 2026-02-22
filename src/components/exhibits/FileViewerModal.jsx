import React, { useState } from "react";
import { X, ExternalLink, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

export default function FileViewerModal({ url, title, onClose }) {
  const [zoom, setZoom] = useState(1);

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
            {isImage && (
              <>
                <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Zoom out">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Zoom in">
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
        <div className="flex-1 overflow-auto flex items-center justify-center bg-[#080d1a] rounded-b-xl">
          {isPdf && (
            <object
              data={url}
              type="application/pdf"
              className="w-full h-full rounded-b-xl"
              aria-label={title}
            >
              <div className="flex flex-col items-center gap-4 text-slate-400 p-8 text-center">
                <p className="text-sm">Your browser cannot display this PDF inline.</p>
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cyan-400 border border-cyan-500/30 rounded-lg px-4 py-2 text-sm hover:text-cyan-300">
                  <ExternalLink className="w-4 h-4" /> Open PDF
                </a>
              </div>
            </object>
          )}

          {isImage && (
            <div className="overflow-auto w-full h-full flex items-center justify-center p-4">
              <img
                src={url}
                alt={title}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s" }}
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            </div>
          )}

          {isVideo && (
            <video
              src={url}
              controls
              autoPlay={false}
              className="max-w-full max-h-full rounded"
              style={{ maxHeight: "calc(92vh - 60px)" }}
            >
              Your browser does not support this video format.
            </video>
          )}

          {!isPdf && !isImage && !isVideo && (
            <div className="flex flex-col items-center gap-4 text-slate-400 p-8 text-center">
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