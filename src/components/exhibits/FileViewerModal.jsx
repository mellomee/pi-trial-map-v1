import React from "react";
import { X, ExternalLink, Download } from "lucide-react";

export default function FileViewerModal({ url, title, onClose }) {
  if (!url) return null;

  const ext = url.split("?")[0].split(".").pop().toLowerCase();
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "svg"].includes(ext);
  const isPdf = ext === "pdf";
  const isVideo = ["mp4", "webm", "mov", "avi", "mkv"].includes(ext);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="relative bg-[#0f1629] border border-[#1e2a45] rounded-xl shadow-2xl flex flex-col"
        style={{ width: "90vw", height: "90vh", maxWidth: 1200 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a45] flex-shrink-0">
          <span className="text-sm font-medium text-slate-200 truncate max-w-[70%]">{title || "File Viewer"}</span>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded px-2 py-1"
            >
              <ExternalLink className="w-3 h-3" /> Open in new tab
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
            <iframe
              src={url}
              className="w-full h-full rounded-b-xl"
              title={title}
            />
          )}
          {isImage && (
            <img
              src={url}
              alt={title}
              className="max-w-full max-h-full object-contain p-4"
            />
          )}
          {isVideo && (
            <video
              src={url}
              controls
              autoPlay
              className="max-w-full max-h-full rounded"
            />
          )}
          {!isPdf && !isImage && !isVideo && (
            <div className="flex flex-col items-center gap-4 text-slate-400 p-8 text-center">
              <p className="text-sm">This file type cannot be previewed in the browser.</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded-lg px-4 py-2 text-sm"
              >
                <ExternalLink className="w-4 h-4" /> Open File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}