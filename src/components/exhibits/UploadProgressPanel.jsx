import React, { useState } from "react";
import { X, Minus, CheckCircle2, AlertCircle, Loader2, ChevronUp } from "lucide-react";

// uploads: [{ id, name, status: "uploading"|"done"|"error", progress: 0-100, error? }]
export default function UploadProgressPanel({ uploads, onClose, onRemove }) {
  const [minimized, setMinimized] = useState(false);

  if (uploads.length === 0) return null;

  const inProgress = uploads.filter(u => u.status === "uploading").length;
  const done = uploads.filter(u => u.status === "done").length;
  const errors = uploads.filter(u => u.status === "error").length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-[#131a2e] border border-[#1e2a45] rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f1629] border-b border-[#1e2a45]">
        <span className="text-xs font-semibold text-slate-200">
          {inProgress > 0 ? `Uploading ${inProgress} file${inProgress > 1 ? "s" : ""}…` : `${done} uploaded${errors > 0 ? `, ${errors} failed` : ""}`}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(m => !m)} className="p-1 text-slate-400 hover:text-white rounded">
            {minimized ? <ChevronUp className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Upload list */}
      {!minimized && (
        <div className="max-h-56 overflow-y-auto divide-y divide-[#1e2a45]">
          {uploads.map(u => (
            <div key={u.id} className="px-4 py-2.5 flex items-center gap-3">
              {/* Icon */}
              <div className="flex-shrink-0">
                {u.status === "uploading" && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
                {u.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                {u.status === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-200 truncate">{u.name}</p>
                {u.status === "uploading" && (
                  <div className="mt-1 h-1.5 bg-[#1e2a45] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                )}
                {u.status === "error" && (
                  <p className="text-[10px] text-red-400 mt-0.5">{u.error}</p>
                )}
                {u.status === "done" && (
                  <p className="text-[10px] text-green-400 mt-0.5">Upload complete</p>
                )}
              </div>

              {/* Dismiss finished */}
              {u.status !== "uploading" && (
                <button onClick={() => onRemove(u.id)} className="flex-shrink-0 text-slate-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}