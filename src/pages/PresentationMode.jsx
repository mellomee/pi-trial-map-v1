import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  ChevronLeft, ChevronRight, Play, Pause, Square, SkipBack, SkipForward,
  Maximize2, PanelLeftClose, PanelLeftOpen, Check, Film, FileText, ChevronDown
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

// ── Video Player ──────────────────────────────────────────────
function VideoPlayer({ videoLinks, videoClips }) {
  const videoRef = useRef(null);
  const [currentLinkIdx, setCurrentLinkIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const sortedLinks = [...videoLinks].sort((a, b) => (a.link_order || 0) - (b.link_order || 0));
  const currentLink = sortedLinks[currentLinkIdx];
  const currentVideoClip = videoClips.find(v => v.id === currentLink?.video_clip_id);

  // When clip changes, seek to start_time
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !currentLink) return;
    v.load();
    v.onloadedmetadata = () => {
      if (currentLink.start_time_seconds != null) {
        v.currentTime = currentLink.start_time_seconds;
      }
      setDuration(v.duration || 0);
    };
  }, [currentLinkIdx, currentLink]);

  // End-time guard
  useEffect(() => {
    const v = videoRef.current;
    if (!v || currentLink?.end_time_seconds == null) return;
    if (currentTime >= currentLink.end_time_seconds) {
      v.pause();
      setPlaying(false);
    }
  }, [currentTime, currentLink]);

  const fmt = (s) => {
    if (!s && s !== 0) return "--:--";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play(); setPlaying(true); }
  };

  const stop = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = currentLink?.start_time_seconds ?? 0;
    setPlaying(false);
  };

  const jump = (delta) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  };

  const goFullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  const playSegment = () => {
    const v = videoRef.current;
    if (!v || !currentLink) return;
    if (currentLink.start_time_seconds != null) v.currentTime = currentLink.start_time_seconds;
    v.play();
    setPlaying(true);
  };

  if (!currentVideoClip) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-slate-600">
        <div className="text-center">
          <Film className="w-12 h-12 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No video linked to this clip</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Multi-video selector */}
      {sortedLinks.length > 1 && (
        <div className="flex gap-1 px-3 pt-2 pb-1">
          {sortedLinks.map((link, idx) => {
            const vc = videoClips.find(v => v.id === link.video_clip_id);
            return (
              <button key={link.id} onClick={() => { setCurrentLinkIdx(idx); setPlaying(false); }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  idx === currentLinkIdx
                    ? "bg-cyan-600 text-white"
                    : "bg-[#1e2a45] text-slate-400 hover:text-white"
                }`}>
                {link.label || vc?.title || `Video ${idx + 1}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Video element */}
      <div className="flex-1 min-h-0">
        <video
          ref={videoRef}
          src={currentVideoClip.file_url}
          className="w-full h-full object-contain"
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onLoadedMetadata={() => { setDuration(videoRef.current?.duration || 0); }}
          onEnded={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      </div>

      {/* Controls */}
      <div className="px-4 py-2 space-y-1.5 bg-black/80 border-t border-[#1e2a45]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500 w-12">{fmt(currentTime)}</span>
          <input
            type="range"
            min={currentLink?.start_time_seconds ?? 0}
            max={currentLink?.end_time_seconds ?? duration ?? 100}
            value={currentTime}
            onChange={e => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value); }}
            className="flex-1 accent-cyan-500 h-1"
          />
          <span className="text-[10px] font-mono text-slate-500 w-12 text-right">
            {fmt(currentLink?.end_time_seconds ?? duration)}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-center">
          <button onClick={() => jump(-10)} className="px-2 py-1 rounded bg-[#1e2a45] text-slate-400 hover:text-white text-[10px]">-10s</button>
          <button onClick={() => jump(-5)} className="px-2 py-1 rounded bg-[#1e2a45] text-slate-400 hover:text-white text-[10px]">-5s</button>
          <button onClick={stop} className="p-1.5 rounded bg-[#1e2a45] text-slate-400 hover:text-white">
            <Square className="w-3.5 h-3.5" />
          </button>
          <button onClick={toggle} className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-700 text-white font-medium text-xs flex items-center gap-1">
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {playing ? "Pause" : "Play"}
          </button>
          {currentLink?.start_time_seconds != null && (
            <button onClick={playSegment} className="px-2 py-1.5 rounded bg-violet-600/30 text-violet-400 hover:bg-violet-600/50 text-[10px]">
              ▶ Segment
            </button>
          )}
          <button onClick={() => jump(5)} className="px-2 py-1 rounded bg-[#1e2a45] text-slate-400 hover:text-white text-[10px]">+5s</button>
          <button onClick={() => jump(10)} className="px-2 py-1 rounded bg-[#1e2a45] text-slate-400 hover:text-white text-[10px]">+10s</button>
          <button onClick={goFullscreen} className="p-1.5 rounded bg-[#1e2a45] text-slate-400 hover:text-white ml-1">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Transcript Pane ───────────────────────────────────────────
function TranscriptPane({ depoClip, segments }) {
  if (!depoClip) return (
    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
      Select a clip from the playlist
    </div>
  );

  return (
    <div className="h-full overflow-y-auto px-6 py-4 space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b border-[#1e2a45]">
        <FileText className="w-4 h-4 text-violet-400" />
        <div>
          <p className="text-sm font-semibold text-white">
            {depoClip.clip_title || depoClip.topic_tag || depoClip.start_cite}
          </p>
          <p className="text-[10px] text-slate-500">
            {depoClip.start_cite}{depoClip.end_cite ? ` – ${depoClip.end_cite}` : ""}
          </p>
        </div>
      </div>

      {segments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-600 text-sm">No transcript segments defined.</p>
          <p className="text-slate-700 text-xs mt-1">
            Add segments in the Clip Editor to show transcript text here.
          </p>
        </div>
      ) : (
        segments.map((seg, idx) => (
          <div key={seg.id} className="space-y-1">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              {seg.start_cite}{seg.end_cite ? ` → ${seg.end_cite}` : ""}
            </p>
            <p className="text-base text-slate-100 leading-relaxed whitespace-pre-line font-serif">
              {seg.segment_text}
            </p>
            {seg.notes && (
              <p className="text-[10px] text-slate-600 italic">{seg.notes}</p>
            )}
            {idx < segments.length - 1 && (
              <div className="border-b border-[#1e2a45] pt-2" />
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Playlist sidebar ──────────────────────────────────────────
function PlaylistSidebar({ items, clipMeta, currentIdx, onSelect, playedSet, onMarkPlayed }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`flex-shrink-0 flex flex-col bg-[#0f1629] border-r border-[#1e2a45] transition-all duration-300 ${collapsed ? "w-10" : "w-64"}`}>
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-2 py-3 border-b border-[#1e2a45]`}>
        {!collapsed && <span className="text-[10px] text-slate-500 uppercase tracking-wider">Playlist</span>}
        <button onClick={() => setCollapsed(!collapsed)} className="text-slate-500 hover:text-white p-1">
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto divide-y divide-[#1e2a45]">
          {items.map((item, idx) => {
            const meta = clipMeta[item.depo_clip_id] || {};
            const isActive = idx === currentIdx;
            const isPlayed = playedSet.has(item.id);
            return (
              <button key={item.id} onClick={() => onSelect(idx)}
                className={`w-full text-left px-3 py-2.5 transition-colors ${
                  isActive
                    ? "bg-cyan-600/15 border-l-2 border-cyan-500"
                    : "hover:bg-white/5 border-l-2 border-transparent"
                }`}>
                <div className="flex items-start gap-2">
                  <span className={`text-[10px] font-mono mt-0.5 flex-shrink-0 ${isPlayed ? "text-green-500" : "text-slate-600"}`}>
                    {isPlayed ? <Check className="w-3 h-3" /> : String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-tight line-clamp-2 ${isActive ? "text-white" : "text-slate-400"}`}>
                      {item.display_title || meta.clip?.clip_title || meta.clip?.topic_tag || meta.clip?.start_cite}
                    </p>
                    {meta.depoName && (
                      <p className="text-[10px] text-slate-600 truncate mt-0.5">{meta.depoName}</p>
                    )}
                    <div className="flex gap-1 mt-0.5">
                      {meta.videoCount > 0 && <span className="text-[9px] text-cyan-700">▶{meta.videoCount}</span>}
                      {meta.segCount > 0 && <span className="text-[9px] text-violet-700">§{meta.segCount}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main PresentationMode Page ────────────────────────────────
export default function PresentationMode() {
  const playlistId = new URLSearchParams(window.location.search).get("playlist");

  const [playlist, setPlaylist] = useState(null);
  const [items, setItems] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playedSet, setPlayedSet] = useState(new Set());

  // Per-clip data
  const [clipMap, setClipMap] = useState({});   // depo_clip_id → clip
  const [segMap, setSegMap] = useState({});      // depo_clip_id → segments[]
  const [linkMap, setLinkMap] = useState({});    // depo_clip_id → links[]
  const [videoClips, setVideoClips] = useState([]); // all VideoClips

  // Deponent info
  const [depositions, setDepositions] = useState([]);
  const [parties, setParties] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playlistId) return;
    const load = async () => {
      const [pls, its] = await Promise.all([
        base44.entities.PresentationPlaylists.filter({ id: playlistId }),
        base44.entities.PlaylistItems.filter({ playlist_id: playlistId }),
      ]);
      setPlaylist(pls[0] || null);
      const sorted = its.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setItems(sorted);

      if (sorted.length === 0) { setLoading(false); return; }

      const depoClipIds = [...new Set(sorted.map(i => i.depo_clip_id))];

      const [clips, segs, links, vids] = await Promise.all([
        base44.entities.DepoClips.list("-created_date", 500),
        base44.entities.DepoClipTranscriptSegments.list("-segment_order", 500),
        base44.entities.DepoClipVideoLinks.list("-link_order", 500),
        base44.entities.VideoClips.list("-created_date", 200),
      ]);

      const cm = {}; clips.forEach(c => { cm[c.id] = c; });
      const sm = {}; segs.forEach(s => { if (!sm[s.depo_clip_id]) sm[s.depo_clip_id] = []; sm[s.depo_clip_id].push(s); });
      const lm = {}; links.forEach(l => { if (!lm[l.depo_clip_id]) lm[l.depo_clip_id] = []; lm[l.depo_clip_id].push(l); });

      setClipMap(cm);
      setSegMap(sm);
      setLinkMap(lm);
      setVideoClips(vids);

      // Load depo info for sidebar
      if (clips.length > 0) {
        const caseId = clips[0]?.case_id;
        if (caseId) {
          const [deps, parts] = await Promise.all([
            base44.entities.Depositions.filter({ case_id: caseId }),
            base44.entities.Parties.filter({ case_id: caseId }),
          ]);
          setDepositions(deps);
          setParties(parts);
        }
      }
      setLoading(false);
    };
    load();
  }, [playlistId]);

  const getDepoName = (depoId) => {
    const d = depositions.find(x => x.id === depoId);
    if (!d) return "";
    const p = parties.find(x => x.id === d.party_id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : d.sheet_name;
  };

  const currentItem = items[currentIdx];
  const currentClip = currentItem ? clipMap[currentItem.depo_clip_id] : null;
  const currentSegs = currentItem
    ? (segMap[currentItem.depo_clip_id] || []).sort((a, b) => (a.segment_order || 0) - (b.segment_order || 0))
    : [];
  const currentLinks = currentItem ? (linkMap[currentItem.depo_clip_id] || []) : [];

  const clipMeta = {};
  items.forEach(item => {
    clipMeta[item.depo_clip_id] = {
      clip: clipMap[item.depo_clip_id],
      depoName: clipMap[item.depo_clip_id] ? getDepoName(clipMap[item.depo_clip_id].deposition_id) : "",
      videoCount: (linkMap[item.depo_clip_id] || []).length,
      segCount: (segMap[item.depo_clip_id] || []).length,
    };
  });

  const markPlayed = () => {
    if (!currentItem) return;
    setPlayedSet(prev => new Set([...prev, currentItem.id]));
  };

  const prev = () => setCurrentIdx(i => Math.max(0, i - 1));
  const next = () => {
    markPlayed();
    setCurrentIdx(i => Math.min(items.length - 1, i + 1));
  };

  if (!playlistId) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center text-slate-400">
      No playlist specified.
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center text-slate-400">
      Loading presentation…
    </div>
  );

  return (
    <div className="h-screen bg-[#0a0f1e] text-slate-200 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0f1629] border-b border-[#1e2a45] flex-shrink-0">
        <div className="flex items-center gap-3">
          <a href={createPageUrl("VideoHub")} className="text-slate-500 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </a>
          <div>
            <span className="text-sm font-bold text-white">{playlist?.name}</span>
            {currentClip && (
              <span className="text-xs text-slate-500 ml-2">
                {currentClip.clip_title || currentClip.topic_tag || currentClip.start_cite}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{currentIdx + 1} / {items.length}</span>
          <button onClick={prev} disabled={currentIdx === 0}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e2a45] text-slate-300 hover:text-white disabled:opacity-30 text-xs">
            <SkipBack className="w-3.5 h-3.5" /> Prev
          </button>
          <button onClick={markPlayed}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              currentItem && playedSet.has(currentItem?.id)
                ? "bg-green-600/20 text-green-400"
                : "bg-[#1e2a45] text-slate-300 hover:text-white"
            }`}>
            <Check className="w-3.5 h-3.5" /> Played
          </button>
          <button onClick={next} disabled={currentIdx === items.length - 1}
            className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-30 text-xs">
            Next <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar: playlist */}
        <PlaylistSidebar
          items={items}
          clipMeta={clipMeta}
          currentIdx={currentIdx}
          onSelect={setCurrentIdx}
          playedSet={playedSet}
          onMarkPlayed={markPlayed}
        />

        {/* Center: split panes */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top 60%: video */}
          <div className="flex-[3] min-h-0 border-b border-[#1e2a45]">
            <VideoPlayer videoLinks={currentLinks} videoClips={videoClips} />
          </div>

          {/* Bottom 40%: transcript */}
          <div className="flex-[2] min-h-0 bg-[#080d1a] overflow-hidden">
            <TranscriptPane depoClip={currentClip} segments={currentSegs} />
          </div>
        </div>
      </div>
    </div>
  );
}