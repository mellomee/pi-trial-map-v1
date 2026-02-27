import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, Search, Play, Film, List, ChevronRight, GripVertical,
  ExternalLink, Check, X, Edit2
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import useActiveCase from "@/components/hooks/useActiveCase";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const STATUS_COLORS = {
  DRAFT: "bg-slate-500/20 text-slate-400 border-slate-600/40",
  READY: "bg-green-500/20 text-green-400 border-green-600/40",
  ARCHIVED: "bg-slate-700/20 text-slate-500 border-slate-700/40",
};

// ── Playlist Editor Panel ─────────────────────────────────────
function PlaylistEditor({ playlist, activeCase, onClose, depositions, parties }) {
  const [items, setItems] = useState([]);
  const [allClips, setAllClips] = useState([]);
  const [videoLinkCounts, setVideoLinkCounts] = useState({});
  const [segmentCounts, setSegmentCounts] = useState({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!playlist?.id || !activeCase) return;
    Promise.all([
      base44.entities.PlaylistItems.filter({ playlist_id: playlist.id }),
      base44.entities.DepoClips.filter({ case_id: activeCase.id }),
      base44.entities.DepoClipVideoLinks.filter({ case_id: activeCase.id }),
      base44.entities.DepoClipTranscriptSegments.filter({ case_id: activeCase.id }),
    ]).then(([its, clips, vlinks, segs]) => {
      setItems(its.sort((a, b) => (a.order_index||0) - (b.order_index||0)));
      setAllClips(clips);
      const vc = {}; vlinks.forEach(l => { vc[l.depo_clip_id] = (vc[l.depo_clip_id]||0)+1; });
      setVideoLinkCounts(vc);
      const sc = {}; segs.forEach(s => { sc[s.depo_clip_id] = (sc[s.depo_clip_id]||0)+1; });
      setSegmentCounts(sc);
    });
  }, [playlist?.id, activeCase]);

  const addClip = async (clip) => {
    const created = await base44.entities.PlaylistItems.create({
      case_id: activeCase.id,
      playlist_id: playlist.id,
      depo_clip_id: clip.id,
      order_index: items.length,
    });
    setItems(prev => [...prev, created]);
  };

  const removeItem = async (item) => {
    await base44.entities.PlaylistItems.delete(item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = [...items];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const updated = reordered.map((item, idx) => ({ ...item, order_index: idx }));
    setItems(updated);
    await Promise.all(updated.map(i => base44.entities.PlaylistItems.update(i.id, { order_index: i.order_index })));
  };

  const getDepoName = (depoId) => {
    const d = depositions.find(x => x.id === depoId);
    if (!d) return "";
    const p = parties.find(x => x.id === d.party_id);
    return p ? (p.display_name || `${p.first_name||""} ${p.last_name||""}`.trim()) : d.sheet_name;
  };

  const inPlaylistIds = new Set(items.map(i => i.depo_clip_id));
  const available = allClips.filter(c =>
    !inPlaylistIds.has(c.id) &&
    (!search || (c.clip_title || c.topic_tag || c.start_cite || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-4xl bg-[#0a0f1e] border-l border-[#1e2a45] flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2a45]">
          <div>
            <h2 className="text-base font-bold text-white">{playlist.name}</h2>
            <Badge className={`mt-0.5 text-[10px] ${STATUS_COLORS[playlist.status]}`}>{playlist.status}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`${createPageUrl("PresentationMode")}?playlist=${playlist.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium"
            >
              <Play className="w-3.5 h-3.5" /> Present
            </Link>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4"/></button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: clip picker */}
          <div className="w-80 flex-shrink-0 border-r border-[#1e2a45] flex flex-col">
            <div className="p-3 border-b border-[#1e2a45]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Add Depo Clips</p>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-7 h-7 text-xs bg-[#0f1629] border-[#1e2a45]" placeholder="Search clips…" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[#1e2a45]">
              {available.map(c => (
                <button key={c.id} onClick={() => addClip(c)}
                  className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors group">
                  <div className="flex items-start gap-2">
                    <Plus className="w-3.5 h-3.5 mt-0.5 text-slate-600 group-hover:text-cyan-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 line-clamp-2">{c.clip_title || c.topic_tag || c.start_cite}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{getDepoName(c.deposition_id)}</p>
                      <div className="flex gap-1 mt-0.5">
                        {videoLinkCounts[c.id] > 0 && (
                          <span className="text-[9px] text-cyan-600">▶ {videoLinkCounts[c.id]} vid</span>
                        )}
                        {segmentCounts[c.id] > 0 && (
                          <span className="text-[9px] text-violet-600">📄 {segmentCounts[c.id]} seg</span>
                        )}
                        {c.impeachment_ready && <span className="text-[9px] text-amber-600">⚡ Imp</span>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {available.length === 0 && (
                <p className="text-xs text-slate-600 text-center py-6">
                  {search ? "No matching clips" : "All clips already added"}
                </p>
              )}
            </div>
          </div>

          {/* Right: playlist items */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-[#1e2a45]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                Playlist ({items.length} clips)
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {items.length === 0 ? (
                <div className="text-center text-slate-600 text-sm py-10">Add clips from the left panel</div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="playlist">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {items.map((item, idx) => {
                          const c = allClips.find(x => x.id === item.depo_clip_id);
                          return (
                            <Draggable key={item.id} draggableId={item.id} index={idx}>
                              {(prov) => (
                                <div ref={prov.innerRef} {...prov.draggableProps}
                                  className="bg-[#0f1629] border border-[#1e2a45] rounded-lg p-3 flex items-start gap-2">
                                  <div {...prov.dragHandleProps} className="mt-0.5">
                                    <GripVertical className="w-3.5 h-3.5 text-slate-600" />
                                  </div>
                                  <span className="text-[10px] text-slate-600 mt-0.5">{idx+1}.</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-200">{item.display_title || c?.clip_title || c?.topic_tag || c?.start_cite}</p>
                                    {c && <p className="text-[10px] text-slate-500 mt-0.5">{getDepoName(c.deposition_id)}</p>}
                                    <div className="flex gap-1 mt-0.5">
                                      {videoLinkCounts[item.depo_clip_id] > 0 && (
                                        <span className="text-[9px] text-cyan-600">▶ {videoLinkCounts[item.depo_clip_id]} video</span>
                                      )}
                                      {segmentCounts[item.depo_clip_id] > 0 && (
                                        <span className="text-[9px] text-violet-600">📄 {segmentCounts[item.depo_clip_id]} seg</span>
                                      )}
                                    </div>
                                  </div>
                                  <button onClick={() => removeItem(item)} className="text-slate-600 hover:text-red-400 flex-shrink-0">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Video Hub ────────────────────────────────────────────
export default function VideoHub() {
  const { activeCase } = useActiveCase();
  const [playlists, setPlaylists] = useState([]);
  const [depositions, setDepositions] = useState([]);
  const [parties, setParties] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!activeCase) return;
    base44.entities.PresentationPlaylists.filter({ case_id: activeCase.id }).then(setPlaylists);
    base44.entities.Depositions.filter({ case_id: activeCase.id }).then(setDepositions);
    base44.entities.Parties.filter({ case_id: activeCase.id }).then(setParties);
  }, [activeCase]);

  const createPlaylist = async () => {
    if (!newName.trim() || !activeCase) return;
    const created = await base44.entities.PresentationPlaylists.create({
      case_id: activeCase.id,
      name: newName.trim(),
      status: "DRAFT",
    });
    setPlaylists(prev => [...prev, created]);
    setNewName("");
    setCreating(false);
    setSelectedPlaylist(created);
  };

  const deletePlaylist = async (pl) => {
    if (!confirm(`Delete "${pl.name}"?`)) return;
    await base44.entities.PresentationPlaylists.delete(pl.id);
    setPlaylists(prev => prev.filter(p => p.id !== pl.id));
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Play className="w-6 h-6 text-cyan-400" /> Video Hub
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Playlists · Video Library · Presentation Mode</p>
          </div>
          <Link to={createPageUrl("VideoLibrary")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e2a45] hover:bg-[#263450] text-slate-300 text-sm border border-[#2e3a55]">
            <Film className="w-4 h-4 text-cyan-400" /> Video Library
          </Link>
        </div>

        <Tabs defaultValue="playlists">
          <TabsList className="bg-[#0f1629] border border-[#1e2a45] mb-6">
            <TabsTrigger value="playlists" className="data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-400">
              <List className="w-3.5 h-3.5 mr-1" /> Playlists
            </TabsTrigger>
            <TabsTrigger value="library" className="data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-400">
              <Film className="w-3.5 h-3.5 mr-1" /> Video Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playlists">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500">{playlists.length} playlist{playlists.length !== 1?"s":""}</p>
              {!creating ? (
                <Button size="sm" onClick={() => setCreating(true)}
                  className="bg-cyan-600/20 text-cyan-400 border border-cyan-600/40 hover:bg-cyan-600/30 gap-1">
                  <Plus className="w-3.5 h-3.5" /> New Playlist
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && createPlaylist()}
                    placeholder="Playlist name…"
                    className="h-8 w-64 bg-[#0f1629] border-[#1e2a45] text-slate-200 text-xs" />
                  <Button size="sm" onClick={createPlaylist} disabled={!newName.trim()} className="bg-cyan-600 hover:bg-cyan-700 h-8">
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewName(""); }} className="h-8 text-slate-500">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {playlists.length === 0 ? (
                <div className="bg-[#0f1629] border border-dashed border-[#1e2a45] rounded-xl p-12 text-center text-slate-600">
                  No playlists yet. Create one to start building your jury presentation.
                </div>
              ) : playlists.map(pl => (
                <div key={pl.id}
                  className="bg-[#0f1629] border border-[#1e2a45] hover:border-cyan-600/40 rounded-xl p-4 flex items-center gap-4 transition-colors">
                  <div className="flex-1 cursor-pointer" onClick={() => setSelectedPlaylist(pl)}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-200">{pl.name}</p>
                      <Badge className={`text-[10px] ${STATUS_COLORS[pl.status]}`}>{pl.status}</Badge>
                    </div>
                    {pl.description && <p className="text-xs text-slate-500 mt-0.5">{pl.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`${createPageUrl("PresentationMode")}?playlist=${pl.id}`}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 text-xs">
                      <Play className="w-3 h-3" /> Present
                    </Link>
                    <button onClick={() => setSelectedPlaylist(pl)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e2a45] hover:bg-[#263450] text-slate-300 text-xs">
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => deletePlaylist(pl)} className="p-1.5 text-slate-600 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="library">
            <div className="bg-[#0f1629] border border-[#1e2a45] rounded-xl p-8 text-center">
              <Film className="w-10 h-10 mx-auto mb-3 text-cyan-400 opacity-50" />
              <p className="text-slate-400 mb-3">Manage your uploaded video files</p>
              <a href={createPageUrl("VideoLibrary")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-white text-sm">
                <ExternalLink className="w-4 h-4" /> Open Video Library
              </a>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {selectedPlaylist && (
        <PlaylistEditor
          playlist={selectedPlaylist}
          activeCase={activeCase}
          onClose={() => setSelectedPlaylist(null)}
          depositions={depositions}
          parties={parties}
        />
      )}
    </div>
  );
}