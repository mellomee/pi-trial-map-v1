import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Film, FileText, Video, Trash2, Edit2, ChevronRight,
  Check, Zap, Plus
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import useActiveCase from "@/components/hooks/useActiveCase";

const DIRECTION_COLORS = {
  HelpsUs: "bg-green-500/15 text-green-400 border-green-600/30",
  HurtsUs: "bg-red-500/15 text-red-400 border-red-600/30",
};

export default function DepoClips() {
  const { activeCase } = useActiveCase();
  const [clips, setClips] = useState([]);
  const [depositions, setDepositions] = useState([]);
  const [parties, setParties] = useState([]);
  const [videoLinkCounts, setVideoLinkCounts] = useState({});
  const [segCounts, setSegCounts] = useState({});
  const [search, setSearch] = useState("");
  const [filterDepo, setFilterDepo] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [editClip, setEditClip] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeCase) return;
    Promise.all([
      base44.entities.DepoClips.filter({ case_id: activeCase.id }),
      base44.entities.Depositions.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
      base44.entities.DepoClipVideoLinks.filter({ case_id: activeCase.id }),
      base44.entities.DepoClipTranscriptSegments.filter({ case_id: activeCase.id }),
    ]).then(([cls, deps, pts, vlinks, segs]) => {
      setClips(cls);
      setDepositions(deps);
      setParties(pts);
      const vc = {}; vlinks.forEach(l => { vc[l.depo_clip_id] = (vc[l.depo_clip_id] || 0) + 1; });
      setVideoLinkCounts(vc);
      const sc = {}; segs.forEach(s => { sc[s.depo_clip_id] = (sc[s.depo_clip_id] || 0) + 1; });
      setSegCounts(sc);
    });
  }, [activeCase]);

  const getDepoName = (depoId) => {
    const d = depositions.find(x => x.id === depoId);
    if (!d) return "—";
    const p = parties.find(x => x.id === d.party_id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : d.sheet_name;
  };

  const filtered = useMemo(() => {
    return clips.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !search || [c.clip_title, c.topic_tag, c.start_cite, c.clip_text]
        .some(v => v?.toLowerCase().includes(q));
      const matchDepo = filterDepo === "all" || c.deposition_id === filterDepo;
      const matchDir = filterDirection === "all" || c.direction === filterDirection;
      return matchSearch && matchDepo && matchDir;
    });
  }, [clips, search, filterDepo, filterDirection]);

  const saveEdit = async () => {
    if (!editClip) return;
    setSaving(true);
    const updated = await base44.entities.DepoClips.update(editClip.id, {
      clip_title: editClip.clip_title,
      topic_tag: editClip.topic_tag,
      direction: editClip.direction,
      impeachment_ready: editClip.impeachment_ready,
      is_video_ready: editClip.is_video_ready,
      notes: editClip.notes,
    });
    setClips(prev => prev.map(c => c.id === updated.id ? updated : c));
    setEditClip(null);
    setSaving(false);
  };

  const deleteClip = async (clip) => {
    if (!confirm(`Delete clip "${clip.clip_title || clip.topic_tag || clip.start_cite}"?`)) return;
    await base44.entities.DepoClips.delete(clip.id);
    setClips(prev => prev.filter(c => c.id !== clip.id));
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f1629] border-b border-[#1e2a45] px-6 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-400" /> Depo Clips
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} of {clips.length} clips</p>
          </div>
          <div className="flex gap-2">
            <Link to={createPageUrl("Transcripts")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 border border-violet-600/40 text-xs">
              <Plus className="w-3.5 h-3.5" /> Create from Transcript
            </Link>
            <Link to={createPageUrl("VideoHub")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 border border-cyan-600/40 text-xs">
              <Video className="w-3.5 h-3.5" /> Video Hub
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search clips…"
              className="pl-8 h-8 w-56 bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs" />
          </div>
          <Select value={filterDepo} onValueChange={setFilterDepo}>
            <SelectTrigger className="h-8 w-48 bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs">
              <SelectValue placeholder="All deponents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Deponents</SelectItem>
              {depositions.map(d => {
                const p = parties.find(x => x.id === d.party_id);
                const label = p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : d.sheet_name;
                return <SelectItem key={d.id} value={d.id}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Select value={filterDirection} onValueChange={setFilterDirection}>
            <SelectTrigger className="h-8 w-36 bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="HelpsUs">Helps Us</SelectItem>
              <SelectItem value="HurtsUs">Hurts Us</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Clips list */}
      <div className="px-6 py-4 space-y-2 max-w-4xl">
        {filtered.length === 0 ? (
          <div className="bg-[#0f1629] border border-dashed border-[#1e2a45] rounded-xl p-12 text-center text-slate-600">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No clips found. Create clips from the Transcript screen.</p>
            <a href={createPageUrl("Transcripts")} className="mt-3 inline-flex items-center gap-1 text-violet-400 text-sm hover:underline">
              → Go to Transcripts
            </a>
          </div>
        ) : filtered.map(clip => {
          const isExpanded = expandedId === clip.id;
          const hasVideo = videoLinkCounts[clip.id] > 0;
          const hasSeg = segCounts[clip.id] > 0;
          return (
            <div key={clip.id}
              className="bg-[#0f1629] border border-[#1e2a45] hover:border-[#2e3a55] rounded-xl overflow-hidden transition-colors">
              {/* Row */}
              <div className="flex items-start gap-3 p-4">
                <button onClick={() => setExpandedId(isExpanded ? null : clip.id)} className="mt-0.5 text-slate-600 hover:text-slate-300">
                  <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-100">
                      {clip.clip_title || clip.topic_tag || clip.start_cite}
                    </p>
                    {clip.direction && (
                      <Badge className={`text-[10px] ${DIRECTION_COLORS[clip.direction]}`}>{clip.direction}</Badge>
                    )}
                    {clip.impeachment_ready && (
                      <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-600/30">
                        <Zap className="w-2.5 h-2.5 mr-0.5" /> Impeachment
                      </Badge>
                    )}
                    {clip.is_video_ready && (
                      <Badge className="text-[10px] bg-green-500/15 text-green-400 border-green-600/30">
                        <Check className="w-2.5 h-2.5 mr-0.5" /> Video Ready
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {clip.start_cite}{clip.end_cite ? ` → ${clip.end_cite}` : ""}
                    </span>
                    <span className="text-[11px] text-slate-600">{getDepoName(clip.deposition_id)}</span>
                    {hasVideo && <span className="text-[10px] text-cyan-600">▶ {videoLinkCounts[clip.id]} video</span>}
                    {hasSeg && <span className="text-[10px] text-violet-600">§ {segCounts[clip.id]} seg</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link to={`${createPageUrl("VideoClipEditor")}?id=${clip.id}`}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-600/15 text-cyan-400 hover:bg-cyan-600/25 text-[10px]">
                    <Film className="w-3 h-3" /> Video Editor
                  </Link>
                  <button onClick={() => setEditClip({ ...clip })} className="p-1.5 text-slate-500 hover:text-slate-200">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteClip(clip)} className="p-1.5 text-slate-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded: transcript text */}
              {isExpanded && (
                <div className="border-t border-[#1e2a45] bg-[#080d1a] px-6 py-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Transcript Text</p>
                  {clip.clip_text ? (
                    <div className="space-y-0.5">
                      {clip.clip_text.split("\n").map((line, i) => {
                        const tabIdx = line.indexOf("\t");
                        const cite = tabIdx >= 0 ? line.substring(0, tabIdx) : "";
                        const text = tabIdx >= 0 ? line.substring(tabIdx + 1) : line;
                        return (
                          <div key={i} className="flex gap-4">
                            <span className="text-[10px] font-mono text-slate-600 w-28 flex-shrink-0">{cite}</span>
                            <span className="text-sm text-slate-300 leading-relaxed">{text}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-600 text-sm italic">No transcript text stored.</p>
                  )}
                  {clip.notes && (
                    <p className="mt-3 text-xs text-slate-500 italic border-t border-[#1e2a45] pt-2">{clip.notes}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editClip} onOpenChange={() => setEditClip(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> Edit Clip
            </DialogTitle>
          </DialogHeader>
          {editClip && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Clip Title</label>
                <Input value={editClip.clip_title || ""} onChange={e => setEditClip(p => ({ ...p, clip_title: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="Officer can't recall timing…" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Topic Tag</label>
                <Input value={editClip.topic_tag || ""} onChange={e => setEditClip(p => ({ ...p, topic_tag: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Direction</label>
                <Select value={editClip.direction || "HelpsUs"} onValueChange={v => setEditClip(p => ({ ...p, direction: v }))}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HelpsUs">Helps Us</SelectItem>
                    <SelectItem value="HurtsUs">Hurts Us</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!editClip.impeachment_ready}
                    onChange={e => setEditClip(p => ({ ...p, impeachment_ready: e.target.checked }))}
                    className="accent-amber-500" />
                  <span className="text-xs text-slate-400">Impeachment Ready</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!editClip.is_video_ready}
                    onChange={e => setEditClip(p => ({ ...p, is_video_ready: e.target.checked }))}
                    className="accent-green-500" />
                  <span className="text-xs text-slate-400">Video Ready</span>
                </label>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes</label>
                <Textarea value={editClip.notes || ""} onChange={e => setEditClip(p => ({ ...p, notes: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditClip(null)} className="border-[#1e2a45]">Cancel</Button>
                <Button onClick={saveEdit} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}