import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Film, FileText, Maximize2,
  Menu, X, Play, Pause, SkipBack, SkipForward, Check
} from "lucide-react";
import { createPageUrl } from "@/utils";

function fmt(sec) {
  if (!sec && sec !== 0) return "0:00";
  return `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,"0")}`;
}

export default function PresentationMode() {
  const playlistId = new URLSearchParams(window.location.search).get("playlist");
  const videoRef = useRef(null);

  const [playlist, setPlaylist] = useState(null);
  const [items, setItems] = useState([]);
  const [allClips, setAllClips] = useState([]);
  const [depositions, setDepositions] = useState([]);
  const [parties, setParties] = useState([]);
  const [segmentsByClip, setSegmentsByClip] = useState({});
  const [videoLinksByClip, setVideoLinksByClip] = useState({});
  const [videoLibrary, setVideoLibrary] = useState([]);

  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(true);
  const [playedSet, setPlayedSet] = useState(new Set());

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!playlistId) return;
    Promise.all([
      base44.entities.PresentationPlaylists.filter({ id: playlistId }),
      base44.entities.PlaylistItems.filter({ playlist_id: playlistId }),
    ]).then(([pls, its]) => {
      setPlaylist(pls[0] || null);
      const sorted = its.sort((a,b) => (a.order_index||0)-(b.order_index||0));
      setItems(sorted);
      if (sorted.length > 0) {
        const caseId = pls[0]?.case_id;
        if (!caseId) return;
        const clipIds = sorted.map(i => i.depo_clip_id);
        Promise.all([
          base44.entities.DepoClips.filter({ case_id: caseId }),
          base44.entities.DepoClipTranscriptSegments.filter({ case_id: caseId }),
          base44.entities.DepoClipVideoLinks.filter({ case_id: caseId }),
          base44.entities.VideoClips.list("-created_date", 200),
          base44.entities.Depositions.filter({ case_id: caseId }),
          base44.entities.Parties.filter({ case_id: caseId }),
        ]).then(([clips, segs, vlinks, vids, deps, parts]) => {
          setAllClips(clips);
          const sbC = {};
          segs.forEach(s => {
            if (!sbC[s.depo_clip_id]) sbC[s.depo_clip_id] = [];
            sbC[s.depo_clip_id].push(s);
          });
          Object.keys(sbC).forEach(k => sbC[k].sort((a,b) => (a.segment_order||0)-(b.segment_order||0)));
          setSegmentsByClip(sbC);
          const vlC = {};
          vlinks.forEach(l => {
            if (!vlC[l.depo_clip_id]) vlC[l.depo_clip_id] = [];
            vlC[l.depo_clip_id].push(l);
          });
          Object.keys(vlC).forEach(k => vlC[k].sort((a,b) => (a.link_order||0)-(b.link_order||0)));
          setVideoLinksByClip(vlC);
          setVideoLibrary(vids);
          setDepositions(deps);
          setParties(parts);
        });
      }
    });
  }, [playlistId]);

  const currentItem = items[currentItemIdx] || null;
  const currentClip = allClips.find(c => c.id === currentItem?.depo_clip_id) || null;
  const currentSegments = (currentClip ? segmentsByClip[currentClip.id] : null) || [];
  const currentVideoLinks = (currentClip ? videoLinksByClip[currentClip.id] : null) || [];
  const currentVideoLink = currentVideoLinks[currentVideoIdx] || null;
  const currentVideo = currentVideoLink ? videoLibrary.find(v => v.id === currentVideoLink.video_clip_id) : null;

  const getDepoName = (depoId) => {
    const d = depositions.find(x => x.id === depoId);
    if (!d) return "";
    const p = parties.find(x => x.id === d.party_id);
    return p ? (p.display_name || `${p.first_name||""} ${p.last_name||""}`.trim()) : d.sheet_name;
  };

  // Reset video index when switching clips
  useEffect(() => {
    setCurrentVideoIdx(0);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.load();
    }
  }, [currentItemIdx]);

  // Seek to start_time when video source changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handleLoaded = () => {
      if (currentVideoLink?.start_time_seconds != null) {
        v.currentTime = currentVideoLink.start_time_seconds;
      }
      setDuration(v.duration || 0);
    };
    v.addEventListener("loadedmetadata", handleLoaded);
    return () => v.removeEventListener("loadedmetadata", handleLoaded);
  }, [currentVideoLink]);

  // Auto-pause at end_time
  useEffect(() => {
    const v = videoRef.current;
    if (!v || currentVideoLink?.end_time_seconds == null) return;
    const check = setInterval(() => {
      if (v.currentTime >= currentVideoLink.end_time_seconds) {
        v.pause();
        setPlaying(false);
      }
    }, 200);
    return () => clearInterval(check);
  }, [currentVideoLink, playing]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play(); setPlaying(true); }
  };

  const jump = (delta) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  };

  const goToItem = (idx) => {
    setCurrentItemIdx(idx);
    setPlayedSet(prev => new Set([...prev, currentItem?.id].filter(Boolean)));
  };

  const nextItem = () => {
    if (currentItemIdx < items.length - 1) goToItem(currentItemIdx + 1);
  };
  const prevItem = () => {
    if (currentItemIdx > 0) goToItem(currentItemIdx - 1);
  };

  const fullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
    else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
  };

  if (!playlistId) return <div className="p-8 text-slate-400">No playlist ID.</div>;
  if (!playlist) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="flex h-screen bg-[#050810] text-slate-200 overflow-hidden">
      {/* ── Left Presentation Menu ── */}
      <div className={`${menuOpen ? "w-64" : "w-0"} flex-shrink-0 border-r border-[#1e2a45] transition-all duration-200 overflow-hidden flex flex-col bg-[#0a0f1e]`}>
        <div className="flex items-center justify-between px-3 py-3 border-b border-[#1e2a45]">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Playlist</p>
            <p className="text-xs font-semibold text-white truncate">{playlist.name}</p>
          </div>
          <button onClick={() => setMenuOpen(false)} className="text-slate-600 hover:text-white flex-shrink-0 ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[#1e2a45]">
          {items.map((item, idx) => {
            const c = allClips.find(x => x.id === item.depo_clip_id);
            const isActive = idx === currentItemIdx;
            const isPlayed = playedSet.has(item.id);
            return (
              <button key={item.id} onClick={() => setCurrentItemIdx(idx)}
                className={`w-full text-left px-3 py-2.5 transition-colors ${
                  isActive ? "bg-cyan-600/15 border-l-2 border-l-cyan-400" : "hover:bg-white/5 border-l-2 border-l-transparent"
                }`}>
                <div className="flex items-start gap-2">
                  <span className="text-[9px] text-slate-600 mt-0.5 flex-shrink-0">{idx+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 line-clamp-2">{item.display_title || c?.clip_title || c?.topic_tag || c?.start_cite}</p>
                    {c && <p className="text-[10px] text-slate-600">{getDepoName(c.deposition_id)}</p>}
                  </div>
                  {isPlayed && <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />}
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-2 border-t border-[#1e2a45]">
          <a href={createPageUrl("VideoHub")} className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-slate-500 hover:text-slate-300">
            <ChevronLeft className="w-3 h-3" /> Back to Hub
          </a>
        </div>
      </div>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e2a45] bg-[#0a0f1e] flex-shrink-0">
          {!menuOpen && (
            <button onClick={() => setMenuOpen(true)} className="text-slate-500 hover:text-white">
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <button onClick={prevItem} disabled={currentItemIdx === 0}
              className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
            <span className="text-xs text-slate-400">{currentItemIdx+1} / {items.length}</span>
            <button onClick={nextItem} disabled={currentItemIdx >= items.length-1}
              className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {currentItem?.display_title || currentClip?.clip_title || currentClip?.topic_tag || currentClip?.start_cite || "—"}
            </p>
            {currentClip && <p className="text-[10px] text-slate-500">{getDepoName(currentClip.deposition_id)}</p>}
          </div>
          {/* Video selector if multiple */}
          {currentVideoLinks.length > 1 && (
            <div className="flex items-center gap-1">
              {currentVideoLinks.map((vl, idx) => (
                <button key={vl.id} onClick={() => setCurrentVideoIdx(idx)}
                  className={`px-2 py-1 rounded text-[10px] ${currentVideoIdx === idx ? "bg-cyan-600 text-white" : "bg-[#1e2a45] text-slate-400 hover:bg-[#263450]"}`}>
                  {vl.label || `Video ${idx+1}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Video pane (60%) */}
        <div className="flex-shrink-0 bg-black" style={{ height: "60%" }}>
          {currentVideo?.file_url ? (
            <div className="h-full flex flex-col">
              <video
                ref={videoRef}
                key={`${currentVideo.id}-${currentVideoIdx}`}
                src={currentVideo.file_url}
                className="flex-1 w-full object-contain"
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                onEnded={() => setPlaying(false)}
              />
              {/* Controls */}
              <div className="bg-[#0a0f1e] border-t border-[#1e2a45] px-4 py-2 flex items-center gap-3">
                <button onClick={togglePlay} className="p-1.5 rounded bg-cyan-600 hover:bg-cyan-700 text-white">
                  {playing ? <Pause className="w-3.5 h-3.5"/> : <Play className="w-3.5 h-3.5"/>}
                </button>
                <button onClick={() => jump(-5)} className="p-1.5 rounded bg-[#1e2a45] text-slate-300 hover:bg-[#263450] text-xs">-5s</button>
                <button onClick={() => jump(5)} className="p-1.5 rounded bg-[#1e2a45] text-slate-300 hover:bg-[#263450] text-xs">+5s</button>
                <span className="text-xs font-mono text-slate-400">{fmt(currentTime)} / {fmt(duration)}</span>
                <input type="range" min={0} max={duration||100} value={currentTime}
                  onChange={e => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value); }}
                  className="flex-1 accent-cyan-500" />
                {currentVideoLink?.start_time_seconds != null && currentVideoLink?.end_time_seconds != null && (
                  <button
                    onClick={() => {
                      const v = videoRef.current;
                      if (!v) return;
                      v.currentTime = currentVideoLink.start_time_seconds;
                      v.play();
                      setPlaying(true);
                    }}
                    className="px-2 py-1 rounded bg-violet-600/30 text-violet-400 text-xs">
                    ▶ Segment
                  </button>
                )}
                <button onClick={fullscreen} className="p-1.5 text-slate-500 hover:text-white">
                  <Maximize2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600">
              <div className="text-center">
                <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  {currentClip ? "No video linked to this clip" : "Select a clip from the menu"}
                </p>
                {currentClip && (
                  <a href={`${createPageUrl("VideoClipEditor")}?id=${currentClip.id}`}
                    className="text-xs text-cyan-600 hover:text-cyan-400 mt-1 inline-block">
                    Link a video →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Transcript pane (40%) */}
        <div className="flex-1 overflow-y-auto border-t border-[#1e2a45] bg-[#050810] min-h-0" style={{ height: "40%" }}>
          {currentClip ? (
            <div className="p-4 space-y-4">
              {currentSegments.length > 0 ? (
                currentSegments.map((seg, idx) => (
                  <div key={seg.id} className="space-y-1">
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      {seg.start_cite}{seg.end_cite ? ` → ${seg.end_cite}` : ""}
                    </p>
                    <p className="text-base text-slate-100 leading-relaxed whitespace-pre-line">{seg.segment_text}</p>
                    {idx < currentSegments.length - 1 && (
                      <div className="border-t border-[#1e2a45] pt-2" />
                    )}
                  </div>
                ))
              ) : (
                <div>
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">
                    {currentClip.start_cite}{currentClip.end_cite ? ` – ${currentClip.end_cite}` : ""}
                  </p>
                  <p className="text-base text-slate-100 leading-relaxed whitespace-pre-line">{currentClip.clip_text}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600 text-sm">
              <FileText className="w-6 h-6 mr-2 opacity-40" /> No clip selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}