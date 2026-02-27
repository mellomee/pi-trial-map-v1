import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Play, Trash2, Search, Clock, Film, X } from "lucide-react";

function formatDuration(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function VideoPlayerModal({ clip, onClose }) {
  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    playing ? v.pause() : v.play();
    setPlaying(!playing);
  };

  const stop = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setPlaying(false);
  };

  const jump = (delta) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0f1629] border-[#1e2a45] text-slate-200 max-w-3xl p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a45]">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-cyan-400" /> {clip.title}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="bg-black">
          <video
            ref={videoRef}
            src={clip.file_url}
            className="w-full max-h-[60vh]"
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
            onEnded={() => setPlaying(false)}
          />
        </div>
        <div className="px-4 py-3 space-y-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={e => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value); }}
            className="w-full accent-cyan-500"
          />
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">{fmt(currentTime)} / {fmt(duration)}</span>
            <div className="flex gap-2 ml-2">
              <button onClick={() => jump(-5)} className="px-2 py-1 rounded bg-[#1e2a45] text-slate-300 text-xs hover:bg-[#263450]">-5s</button>
              <button onClick={toggle} className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium">
                {playing ? "Pause" : "Play"}
              </button>
              <button onClick={stop} className="px-2 py-1 rounded bg-[#1e2a45] text-slate-300 text-xs hover:bg-[#263450]">Stop</button>
              <button onClick={() => jump(5)} className="px-2 py-1 rounded bg-[#1e2a45] text-slate-300 text-xs hover:bg-[#263450]">+5s</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function VideoLibrary() {
  const [clips, setClips] = useState([]);
  const [search, setSearch] = useState("");
  const [previewClip, setPreviewClip] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    base44.entities.VideoClips.list("-created_date", 200).then(setClips);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile || !uploadTitle.trim()) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
    const newClip = await base44.entities.VideoClips.create({
      title: uploadTitle.trim(),
      file_url,
      duration_seconds: null,
    });
    setClips(prev => [newClip, ...prev]);
    setShowUpload(false);
    setUploadTitle("");
    setSelectedFile(null);
    setUploading(false);
  };

  const handleDelete = async (clip) => {
    if (!confirm(`Delete "${clip.title}"?`)) return;
    await base44.entities.VideoClips.delete(clip.id);
    setClips(prev => prev.filter(c => c.id !== clip.id));
  };

  const filtered = clips.filter(c =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Film className="w-6 h-6 text-cyan-400" /> Video Library
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{clips.length} video{clips.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={() => setShowUpload(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
            <Upload className="w-4 h-4" /> Upload Video
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search videos…"
            className="pl-9 bg-[#0f1629] border-[#1e2a45] text-slate-200"
          />
        </div>

        <div className="bg-[#0f1629] border border-[#1e2a45] rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Film className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No videos yet. Upload your first clip.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e2a45] text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-left">Uploaded</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a45]">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{c.title}</div>
                      {c.description && <div className="text-xs text-slate-500 mt-0.5">{c.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" /> {formatDuration(c.duration_seconds)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {c.created_date ? new Date(c.created_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setPreviewClip(c)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 text-xs"
                        >
                          <Play className="w-3 h-3" /> Preview
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 text-xs"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload Video
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Title *</label>
              <Input
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                placeholder="e.g., Hanson Depo – Liability Segment"
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Video File (mp4, mov, webm)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#1e2a45] rounded-lg p-6 text-center cursor-pointer hover:border-cyan-600/50 transition-colors"
              >
                {selectedFile ? (
                  <p className="text-sm text-cyan-400">{selectedFile.name}</p>
                ) : (
                  <p className="text-sm text-slate-500">Click to select video file</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowUpload(false)} className="border-[#1e2a45]">Cancel</Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !uploadTitle.trim()}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {previewClip && <VideoPlayerModal clip={previewClip} onClose={() => setPreviewClip(null)} />}
    </div>
  );
}