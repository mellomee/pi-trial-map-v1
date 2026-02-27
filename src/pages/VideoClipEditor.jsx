import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Plus, Trash2, GripVertical, Play, Film, FileText, X, Save } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import useActiveCase from "@/components/hooks/useActiveCase";

// ── Mini inline video player ──────────────────────────────────
function InlinePlayer({ url, startSec, endSec, onClose }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const fmt = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;

  useEffect(() => {
    if (ref.current && startSec != null) {
      ref.current.currentTime = startSec;
    }
  }, [startSec]);

  const playSegment = () => {
    const v = ref.current;
    if (!v) return;
    if (startSec != null) v.currentTime = startSec;
    v.play();
    setPlaying(true);
    if (endSec != null) {
      const check = setInterval(() => {
        if (v.currentTime >= endSec) { v.pause(); setPlaying(false); clearInterval(check); }
      }, 200);
    }
  };

  return (
    <div className="bg-black rounded-lg overflow-hidden border border-[#1e2a45]">
      <video ref={ref} src={url} className="w-full max-h-48" onEnded={() => setPlaying(false)} />
      <div className="flex items-center gap-2 p-2">
        {startSec != null && endSec != null && (
          <button onClick={playSegment} className="px-2 py-1 rounded bg-cyan-600/30 text-cyan-400 text-xs">
            ▶ {fmt(startSec)}–{fmt(endSec)}
          </button>
        )}
        <button onClick={() => { ref.current?.play(); setPlaying(true); }} className="px-2 py-1 rounded bg-[#1e2a45] text-slate-300 text-xs">Play All</button>
        <button onClick={() => { ref.current?.pause(); setPlaying(false); }} className="px-2 py-1 rounded bg-[#1e2a45] text-slate-300 text-xs">Pause</button>
        {onClose && <button onClick={onClose} className="ml-auto text-slate-500 hover:text-white"><X className="w-3 h-3" /></button>}
      </div>
    </div>
  );
}

// ── Segment row ───────────────────────────────────────────────
function SegmentRow({ seg, idx, onEdit, onDelete }) {
  return (
    <div className="bg-[#0f1629] border border-[#1e2a45] rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <GripVertical className="w-3 h-3 text-slate-600 cursor-grab" />
          <span className="text-[10px] text-slate-500">#{idx + 1}</span>
        </div>
        <div className="flex-1">
          <p className="text-xs font-mono text-slate-400">
            {seg.start_cite}{seg.end_cite ? ` → ${seg.end_cite}` : ""}
          </p>
          <p className="text-sm text-slate-200 mt-1 leading-snug line-clamp-3">{seg.segment_text}</p>
          {seg.notes && <p className="text-[10px] text-slate-500 italic mt-0.5">{seg.notes}</p>}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onEdit(seg)} className="p-1 text-slate-500 hover:text-cyan-400"><Plus className="w-3.5 h-3.5" style={{transform:"rotate(45deg)"}}/></button>
          <button onClick={() => onDelete(seg)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
        </div>
      </div>
    </div>
  );
}

// ── Linked video row ──────────────────────────────────────────
function VideoLinkRow({ link, videoClip, idx, onChange, onDelete }) {
  const [testOpen, setTestOpen] = useState(false);
  return (
    <div className="bg-[#0f1629] border border-[#1e2a45] rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GripVertical className="w-3 h-3 text-slate-600" />
          <Film className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-sm text-slate-200">{videoClip?.title || link.video_clip_id}</span>
        </div>
        <div className="flex gap-1">
          {videoClip?.file_url && (
            <button onClick={() => setTestOpen(!testOpen)} className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-600/20 text-cyan-400 text-xs">
              <Play className="w-3 h-3" /> Test
            </button>
          )}
          <button onClick={() => onDelete(link)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 block mb-0.5">Label</label>
          <Input value={link.label || ""} onChange={e => onChange(link.id, "label", e.target.value)}
            className="h-7 text-xs bg-[#0a0f1e] border-[#1e2a45]" placeholder="Angle 1…" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-0.5">Start (sec)</label>
          <Input type="number" value={link.start_time_seconds ?? ""} onChange={e => onChange(link.id, "start_time_seconds", e.target.value ? Number(e.target.value) : null)}
            className="h-7 text-xs bg-[#0a0f1e] border-[#1e2a45]" placeholder="0" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-0.5">End (sec)</label>
          <Input type="number" value={link.end_time_seconds ?? ""} onChange={e => onChange(link.id, "end_time_seconds", e.target.value ? Number(e.target.value) : null)}
            className="h-7 text-xs bg-[#0a0f1e] border-[#1e2a45]" placeholder="—" />
        </div>
      </div>
      {testOpen && videoClip?.file_url && (
        <InlinePlayer
          url={videoClip.file_url}
          startSec={link.start_time_seconds}
          endSec={link.end_time_seconds}
          onClose={() => setTestOpen(false)}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function VideoClipEditor() {
  const { activeCase } = useActiveCase();
  const depoClipId = new URLSearchParams(window.location.search).get("id");

  const [clip, setClip] = useState(null);
  const [depositions, setDepositions] = useState([]);
  const [parties, setParties] = useState([]);
  const [segments, setSegments] = useState([]);
  const [videoLinks, setVideoLinks] = useState([]);
  const [videoLibrary, setVideoLibrary] = useState([]);

  const [segModal, setSegModal] = useState(null); // null | { seg } (null seg = new)
  const [attachModal, setAttachModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!depoClipId) return;
    Promise.all([
      base44.entities.DepoClips.filter({ id: depoClipId }),
      base44.entities.DepoClipTranscriptSegments.filter({ depo_clip_id: depoClipId }),
      base44.entities.DepoClipVideoLinks.filter({ depo_clip_id: depoClipId }),
      base44.entities.VideoClips.list("-created_date", 200),
    ]).then(([clips, segs, links, vids]) => {
      setClip(clips[0] || null);
      setSegments(segs.sort((a,b) => (a.segment_order||0)-(b.segment_order||0)));
      setVideoLinks(links.sort((a,b) => (a.link_order||0)-(b.link_order||0)));
      setVideoLibrary(vids);
    });
    if (activeCase) {
      base44.entities.Depositions.filter({ case_id: activeCase.id }).then(setDepositions);
      base44.entities.Parties.filter({ case_id: activeCase.id }).then(setParties);
    }
  }, [depoClipId, activeCase]);

  const getDepoName = (depoId) => {
    const d = depositions.find(x => x.id === depoId);
    if (!d) return depoId;
    const p = parties.find(x => x.id === d.party_id);
    return p ? (p.display_name || `${p.first_name||""} ${p.last_name||""}`.trim()) : d.sheet_name;
  };

  // ── Segments CRUD ─────────────────────────
  const saveSeg = async (form) => {
    setSaving(true);
    if (form.id) {
      const updated = await base44.entities.DepoClipTranscriptSegments.update(form.id, form);
      setSegments(prev => prev.map(s => s.id === form.id ? updated : s));
    } else {
      const created = await base44.entities.DepoClipTranscriptSegments.create({
        case_id: activeCase?.id,
        depo_clip_id: depoClipId,
        segment_order: segments.length + 1,
        ...form,
      });
      setSegments(prev => [...prev, created]);
    }
    setSegModal(null);
    setSaving(false);
  };

  const deleteSeg = async (seg) => {
    if (!confirm("Delete this segment?")) return;
    await base44.entities.DepoClipTranscriptSegments.delete(seg.id);
    setSegments(prev => prev.filter(s => s.id !== seg.id));
  };

  // ── Video links CRUD ──────────────────────
  const attachVideo = async (videoClipId) => {
    const created = await base44.entities.DepoClipVideoLinks.create({
      case_id: activeCase?.id,
      depo_clip_id: depoClipId,
      video_clip_id: videoClipId,
      link_order: videoLinks.length + 1,
    });
    setVideoLinks(prev => [...prev, created]);
    setAttachModal(false);
  };

  const updateVideoLink = async (linkId, field, value) => {
    setVideoLinks(prev => prev.map(l => l.id === linkId ? { ...l, [field]: value } : l));
    await base44.entities.DepoClipVideoLinks.update(linkId, { [field]: value });
  };

  const deleteVideoLink = async (link) => {
    if (!confirm("Remove this video link?")) return;
    await base44.entities.DepoClipVideoLinks.delete(link.id);
    setVideoLinks(prev => prev.filter(l => l.id !== link.id));
  };

  if (!depoClipId) return <div className="p-8 text-slate-400">No clip ID in URL.</div>;
  if (!clip) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("DepoClips")} className="text-slate-500 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">{clip.clip_title || clip.topic_tag || clip.start_cite}</h1>
            <p className="text-xs text-slate-500">
              {clip.start_cite}{clip.end_cite ? ` – ${clip.end_cite}` : ""}{" · "}
              {getDepoName(clip.deposition_id)}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            {clip.impeachment_ready && <Badge className="bg-amber-500/20 text-amber-400">Impeachment</Badge>}
            {clip.is_video_ready && <Badge className="bg-green-500/20 text-green-400">Video Ready</Badge>}
          </div>
        </div>

        {/* Clip text preview */}
        <div className="bg-[#0f1629] border border-[#1e2a45] rounded-xl p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Original Clip Text</p>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{clip.clip_text}</p>
        </div>

        {/* ── Transcript Segments ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-400" /> Transcript Segments
            </h2>
            <Button size="sm" onClick={() => setSegModal({ seg: null })}
              className="bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 border border-violet-600/40 h-7 text-xs gap-1">
              <Plus className="w-3 h-3" /> Add Segment
            </Button>
          </div>
          <div className="space-y-2">
            {segments.length === 0 ? (
              <div className="bg-[#0f1629] border border-dashed border-[#1e2a45] rounded-xl p-6 text-center text-slate-600 text-sm">
                No segments yet. Add one to define what displays under the video.
              </div>
            ) : segments.map((seg, idx) => (
              <SegmentRow key={seg.id} seg={seg} idx={idx}
                onEdit={(s) => setSegModal({ seg: s })}
                onDelete={deleteSeg}
              />
            ))}
          </div>
        </section>

        {/* ── Linked Videos ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-cyan-400" /> Linked Video Clips
            </h2>
            <Button size="sm" onClick={() => setAttachModal(true)}
              className="bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 border border-cyan-600/40 h-7 text-xs gap-1">
              <Plus className="w-3 h-3" /> Attach Video
            </Button>
          </div>
          <div className="space-y-2">
            {videoLinks.length === 0 ? (
              <div className="bg-[#0f1629] border border-dashed border-[#1e2a45] rounded-xl p-6 text-center text-slate-600 text-sm">
                No videos linked. Attach a video from your library.
              </div>
            ) : videoLinks.map((link, idx) => {
              const vc = videoLibrary.find(v => v.id === link.video_clip_id);
              return (
                <VideoLinkRow key={link.id} link={link} videoClip={vc} idx={idx}
                  onChange={updateVideoLink}
                  onDelete={deleteVideoLink}
                />
              );
            })}
          </div>
        </section>
      </div>

      {/* Segment Modal */}
      <Dialog open={!!segModal} onOpenChange={() => setSegModal(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-violet-400">
              {segModal?.seg?.id ? "Edit Segment" : "Add Segment"}
            </DialogTitle>
          </DialogHeader>
          <SegmentForm
            initial={segModal?.seg}
            clipText={clip?.clip_text}
            onSave={saveSeg}
            onCancel={() => setSegModal(null)}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Attach Video Modal */}
      <Dialog open={attachModal} onOpenChange={setAttachModal}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2">
              <Film className="w-4 h-4" /> Attach Video from Library
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {videoLibrary.filter(v => !videoLinks.find(l => l.video_clip_id === v.id)).map(v => (
              <button key={v.id} onClick={() => attachVideo(v.id)}
                className="w-full text-left p-3 rounded-lg bg-[#0f1629] border border-[#1e2a45] hover:border-cyan-600/50 transition-colors">
                <p className="text-sm text-slate-200">{v.title}</p>
                {v.description && <p className="text-xs text-slate-500">{v.description}</p>}
              </button>
            ))}
            {videoLibrary.filter(v => !videoLinks.find(l => l.video_clip_id === v.id)).length === 0 && (
              <p className="text-center text-slate-500 py-4 text-sm">All library videos already linked.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Segment form sub-component ────────────────────────────────
function SegmentForm({ initial, clipText, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    start_cite: initial?.start_cite || "",
    end_cite: initial?.end_cite || "",
    segment_text: initial?.segment_text || "",
    notes: initial?.notes || "",
    ...(initial?.id ? { id: initial.id } : {}),
  });
  const [selectedLines, setSelectedLines] = useState(new Set());

  // Parse clip_text into lines: [{cite, text}]
  const clipLines = React.useMemo(() => {
    if (!clipText) return [];
    return clipText.split("\n").filter(Boolean).map(line => {
      const idx = line.indexOf("\t");
      return idx >= 0
        ? { cite: line.substring(0, idx), text: line.substring(idx + 1) }
        : { cite: "", text: line };
    });
  }, [clipText]);

  const toggleLine = (idx) => {
    setSelectedLines(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const selectAll = () => setSelectedLines(new Set(clipLines.map((_, i) => i)));
  const clearAll = () => setSelectedLines(new Set());

  // Derive form values from selected lines whenever selection changes
  const derived = React.useMemo(() => {
    if (selectedLines.size === 0) return null;
    const sorted = [...selectedLines].sort((a, b) => a - b);
    const chosen = sorted.map(i => clipLines[i]);
    return {
      start_cite: chosen[0].cite,
      end_cite: chosen[chosen.length - 1].cite,
      segment_text: chosen.map(l => l.text).join("\n"),
    };
  }, [selectedLines, clipLines]);

  const saveData = derived
    ? { ...form, ...derived }
    : form;

  return (
    <div className="space-y-3">
      {/* Line picker */}
      {clipLines.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400">Click lines to select for this segment</label>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-[10px] text-cyan-400 hover:underline">All</button>
              <button onClick={clearAll} className="text-[10px] text-slate-500 hover:underline">Clear</button>
            </div>
          </div>
          <div className="bg-[#0a0f1e] border border-[#1e2a45] rounded-lg max-h-56 overflow-y-auto divide-y divide-[#1e2a45]/50">
            {clipLines.map((line, i) => (
              <div
                key={i}
                onClick={() => toggleLine(i)}
                className={`flex gap-3 px-3 py-1.5 cursor-pointer transition-colors select-none ${
                  selectedLines.has(i) ? "bg-violet-600/20" : "hover:bg-white/5"
                }`}
              >
                <span className="text-[10px] font-mono text-slate-500 w-24 flex-shrink-0 pt-0.5">{line.cite}</span>
                <span className="text-xs text-slate-300">{line.text}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 mt-1">{selectedLines.size} line{selectedLines.size !== 1 ? "s" : ""} selected</p>
          {derived && (
            <div className="mt-2 bg-[#0a0f1e] border border-violet-600/30 rounded-lg px-3 py-2 text-[11px] text-slate-400">
              <span className="font-mono text-violet-400">{derived.start_cite}</span>
              {derived.end_cite !== derived.start_cite && <> → <span className="font-mono text-violet-400">{derived.end_cite}</span></>}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">No clip text available to select from.</p>
      )}

      <div>
        <label className="text-xs text-slate-400 mb-1 block">Notes</label>
        <Input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))}
          className="bg-[#0a0f1e] border-[#1e2a45]" placeholder="Optional" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} className="border-[#1e2a45]">Cancel</Button>
        <Button onClick={() => onSave(saveData)} disabled={saving || !saveData.start_cite || !saveData.segment_text}
          className="bg-violet-600 hover:bg-violet-700">
          <Save className="w-3 h-3 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}