import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Bookmark, X, ChevronLeft, ChevronRight, Film, ArrowRight } from "lucide-react";
import DepoClipsViewer from "@/components/transcripts/DepoClipsViewer";
import { debounce } from "lodash";

const PAGE_SIZE = 100;

const HELPS_COLORS = [
  "bg-green-900/20 border-l-2 border-green-600/60",
  "bg-emerald-900/20 border-l-2 border-emerald-600/60",
  "bg-teal-900/20 border-l-2 border-teal-600/60",
  "bg-green-900/15 border-l-2 border-green-500/50",
  "bg-emerald-900/15 border-l-2 border-emerald-500/50",
];
const HURTS_COLORS = [
  "bg-red-900/20 border-l-2 border-red-600/60",
  "bg-rose-900/20 border-l-2 border-rose-600/60",
  "bg-red-900/15 border-l-2 border-red-500/50",
  "bg-rose-900/15 border-l-2 border-rose-500/50",
  "bg-red-800/15 border-l-2 border-red-400/50",
];

const CLIP_TAG_COLORS = {
  Scene: "bg-purple-900/70 text-purple-200",
  Scope: "bg-blue-900/70 text-blue-200",
  Credibility: "bg-orange-900/70 text-orange-200",
  Opinion: "bg-pink-900/70 text-pink-200",
};

const SESSION_DEPO_KEY = "transcript_last_depo";
const SESSION_POS_KEY = (depoId) => `transcript_pos_${depoId}`;

export default function Transcripts() {
  const { activeCase } = useActiveCase();
  const [depositions, setDepositions] = useState([]);
  const [parties, setParties] = useState([]);
  const [selectedDepoId, setSelectedDepoId] = useState(() => sessionStorage.getItem(SESSION_DEPO_KEY) || "");
  const [lines, setLines] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [clips, setClips] = useState([]);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [clipDialog, setClipDialog] = useState(false);
  const [clipsViewerOpen, setClipsViewerOpen] = useState(false);
  const [clipForm, setClipForm] = useState({ topic_tag: "", clip_tag: "", direction: "HelpsUs", impeachment_ready: false, notes: "" });
  const [page, setPage] = useState(0);
  const [pageInputVal, setPageInputVal] = useState("1");
  const [searchResults, setSearchResults] = useState(null);
  const [highlightedLineIdx, setHighlightedLineIdx] = useState(null);
  const lastClickedIdx = useRef(null);
  const scrollContainerRef = useRef(null);
  const rowRefs = useRef({});

  useEffect(() => {
    if (!activeCase) return;
    Promise.all([
      base44.entities.Depositions.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
    ]).then(([d, p]) => { setDepositions(d); setParties(p); });
  }, [activeCase]);

  // Save position on page change or scroll
  const saveScrollPos = useCallback(() => {
    if (!selectedDepoId || !scrollContainerRef.current) return;
    sessionStorage.setItem(SESSION_POS_KEY(selectedDepoId), JSON.stringify({
      page,
      scrollTop: scrollContainerRef.current.scrollTop,
    }));
  }, [selectedDepoId, page]);

  // Save on page change
  useEffect(() => {
    saveScrollPos();
    setPageInputVal(String(page + 1));
  }, [page]);

  // Save depo selection
  useEffect(() => {
    if (selectedDepoId) sessionStorage.setItem(SESSION_DEPO_KEY, selectedDepoId);
  }, [selectedDepoId]);

  // Save before navigating away
  useEffect(() => {
    window.addEventListener("beforeunload", saveScrollPos);
    return () => {
      saveScrollPos();
      window.removeEventListener("beforeunload", saveScrollPos);
    };
  }, [saveScrollPos]);

  useEffect(() => {
    if (!selectedDepoId || !activeCase) { setLines([]); return; }

    base44.entities.DepositionTranscripts.filter({ deposition_id: selectedDepoId }).then(async ts => {
      if (ts.length === 0) { setLines([]); return; }
      const t = ts[0];
      const url = t.transcript_url || "";
      if (!url) { setLines([]); return; }
      const resp = await fetch(url);
      const raw = await resp.text();
      const parsed = raw.split("\n").filter(Boolean).map(line => {
        const idx = line.indexOf("\t");
        return idx >= 0 ? { cite: line.substring(0, idx), text: line.substring(idx + 1) } : { cite: "", text: line };
      });
      setLines(parsed);
      setSelectedRows(new Set());
      setSearchTerm("");
      setDebouncedSearch("");
      setSearchResults(null);
      setHighlightedLineIdx(null);

      // Restore saved position
      const saved = sessionStorage.getItem(SESSION_POS_KEY(selectedDepoId));
      if (saved) {
        const { page: savedPage, scrollTop } = JSON.parse(saved);
        const restoredPage = savedPage || 0;
        setPage(restoredPage);
        setPageInputVal(String(restoredPage + 1));
        setTimeout(() => {
          if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollTop || 0;
        }, 150);
      } else {
        setPage(0);
        setPageInputVal("1");
      }
    });
    base44.entities.DepoClips.filter({ deposition_id: selectedDepoId }).then(setClips);
  }, [selectedDepoId, activeCase]);

  const debouncedSetSearch = useMemo(() => debounce(v => setDebouncedSearch(v), 300), []);
  useEffect(() => { debouncedSetSearch(searchTerm); }, [searchTerm, debouncedSetSearch]);

  const citeFlagMap = useMemo(() => {
    const map = new Map();
    clips.forEach((c, clipIdx) => {
      const start = c.start_cite;
      const end = c.end_cite || start;
      const palette = c.direction === "HurtsUs" ? HURTS_COLORS : HELPS_COLORS;
      const colorClass = palette[clipIdx % palette.length];
      let inRange = false;
      lines.forEach(l => {
        if (l.cite === start) inRange = true;
        if (inRange && !map.has(l.cite)) {
          map.set(l.cite, { colorClass, clip_tag: c.clip_tag || null, direction: c.direction });
        }
        if (l.cite === end) inRange = false;
      });
    });
    return map;
  }, [clips, lines]);

  const allSearchResults = useMemo(() => {
    if (!debouncedSearch) return null;
    const q = debouncedSearch.toLowerCase();
    const results = [];
    lines.forEach((l, i) => {
      if (l.text.toLowerCase().includes(q) || l.cite.toLowerCase().includes(q)) results.push(i);
    });
    return results;
  }, [lines, debouncedSearch]);

  useEffect(() => {
    setSearchResults(allSearchResults);
    setHighlightedLineIdx(null);
  }, [allSearchResults]);

  const displayLines = useMemo(() => {
    if (showFlaggedOnly) return lines.filter(l => citeFlagMap.has(l.cite));
    return lines;
  }, [lines, showFlaggedOnly, citeFlagMap]);

  const totalPages = Math.ceil(displayLines.length / PAGE_SIZE);
  const pageLines = displayLines.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const goToPage = (newPage) => {
    const clamped = Math.max(0, Math.min(newPage, totalPages - 1));
    setPage(clamped);
    setPageInputVal(String(clamped + 1));
    setTimeout(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    }, 50);
  };

  const commitPageInput = () => {
    const p = parseInt(pageInputVal) - 1;
    if (!isNaN(p) && p >= 0 && p < totalPages) {
      goToPage(p);
    } else {
      setPageInputVal(String(page + 1));
    }
  };

  // Jump to a search result: navigate to its page, scroll into view, hover-highlight without selecting
  const jumpToResult = (globalLineIdx) => {
    const targetPage = Math.floor(globalLineIdx / PAGE_SIZE);
    setHighlightedLineIdx(globalLineIdx);
    const scrollAndFocus = () => {
      const el = rowRefs.current[globalLineIdx];
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.classList.add("jump-hover");
        setTimeout(() => { el.classList.remove("jump-hover"); setHighlightedLineIdx(null); }, 2500);
      }
    };
    if (targetPage !== page) {
      setPage(targetPage);
      setPageInputVal(String(targetPage + 1));
      setTimeout(scrollAndFocus, 150);
    } else {
      scrollAndFocus();
    }
  };

  const handleRowClick = useCallback((globalIdx, e) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (e.shiftKey && lastClickedIdx.current !== null) {
        const start = Math.min(lastClickedIdx.current, globalIdx);
        const end = Math.max(lastClickedIdx.current, globalIdx);
        for (let i = start; i <= end; i++) next.add(i);
      } else if (e.ctrlKey || e.metaKey) {
        next.has(globalIdx) ? next.delete(globalIdx) : next.add(globalIdx);
      } else {
        if (next.size === 1 && next.has(globalIdx)) { next.clear(); }
        else { next.clear(); next.add(globalIdx); }
      }
      lastClickedIdx.current = globalIdx;
      return next;
    });
  }, []);

  const createClip = async () => {
    const sorted = Array.from(selectedRows).sort((a, b) => a - b);
    const selectedLines = sorted.map(i => displayLines[i]);
    if (selectedLines.length === 0) return;
    await base44.entities.DepoClips.create({
      case_id: activeCase.id,
      deposition_id: selectedDepoId,
      start_cite: selectedLines[0].cite,
      end_cite: selectedLines[selectedLines.length - 1].cite,
      clip_text: selectedLines.map(l => `${l.cite}\t${l.text}`).join("\n"),
      topic_tag: clipForm.topic_tag,
      clip_tag: clipForm.clip_tag || null,
      direction: clipForm.direction,
      impeachment_ready: clipForm.impeachment_ready,
      notes: clipForm.notes,
    });
    setClipDialog(false);
    setClipForm({ topic_tag: "", clip_tag: "", direction: "HelpsUs", impeachment_ready: false, notes: "" });
    setSelectedRows(new Set());
    // Reload clips immediately so View Clips shows the new one
    const updated = await base44.entities.DepoClips.filter({ deposition_id: selectedDepoId });
    setClips(updated);
  };

  const getDepoLabel = (d) => {
    const party = parties.find(p => p.id === d.party_id);
    const name = party ? `${party.first_name} ${party.last_name}` : d.sheet_name;
    return d.volume_label ? `${name} - ${d.volume_label}` : name;
  };

  const PaginationBar = ({ compact = false }) => (
    totalPages > 1 ? (
      <div className={`flex items-center gap-1 ${compact ? "" : "justify-center py-4 border-t border-[#1e2a45]"}`}>
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => goToPage(page - 1)} className="text-slate-400 h-7 px-2">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-slate-500">Page</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={pageInputVal}
          onChange={e => setPageInputVal(e.target.value)}
          onBlur={commitPageInput}
          onKeyDown={e => { if (e.key === "Enter") { e.target.blur(); } }}
          className="w-10 text-xs bg-[#1e2a45] border border-[#2a3a5a] text-slate-200 rounded px-1 py-0.5 text-center font-mono"
        />
        <span className="text-xs text-slate-500">of {totalPages}</span>
        <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => goToPage(page + 1)} className="text-slate-400 h-7 px-2">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    ) : null
  );

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-[#0f1629] border-b border-[#1e2a45] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Transcripts</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-cyan-600 text-cyan-400 hover:bg-cyan-600/20"
              disabled={selectedRows.size === 0} onClick={() => setClipDialog(true)}>
              <Bookmark className="w-3 h-3 mr-1" /> Clip Selected ({selectedRows.size})
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => setSelectedRows(new Set())}>
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-400 hover:bg-slate-700/30"
              onClick={() => setClipsViewerOpen(true)}>
              <Film className="w-3 h-3 mr-1" /> View Clips
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={selectedDepoId} onValueChange={setSelectedDepoId}>
            <SelectTrigger className="w-64 bg-[#131a2e] border-[#1e2a45] text-slate-200">
              <SelectValue placeholder="Select deposition..." />
            </SelectTrigger>
            <SelectContent>
              {depositions.map(d => (
                <SelectItem key={d.id} value={d.id}>{getDepoLabel(d)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search entire transcript..."
              className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showFlaggedOnly} onCheckedChange={setShowFlaggedOnly} />
            <Label className="text-xs text-slate-400">Flagged only</Label>
          </div>
          <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">
            {lines.length} lines · {clips.length} clips
          </Badge>
        </div>

        {/* Search results dropdown */}
        {searchResults !== null && (
          <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e2a45]">
              <span className="text-xs text-slate-400">{searchResults.length} results in full transcript</span>
              <button onClick={() => { setSearchTerm(""); setSearchResults(null); setHighlightedLineIdx(null); }} className="text-slate-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto">
                {searchResults.map((lineIdx, ri) => {
                  const l = lines[lineIdx];
                  const targetPage = Math.floor(lineIdx / PAGE_SIZE);
                  return (
                    <div key={ri} onClick={() => jumpToResult(lineIdx)}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-cyan-500/10 cursor-pointer border-b border-[#1e2a45]/40 group">
                      <ArrowRight className="w-3 h-3 text-cyan-500 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                      <span className="text-xs font-mono text-slate-500 w-16 flex-shrink-0">{l.cite}</span>
                      <span className="text-xs text-slate-300 truncate flex-1">{l.text}</span>
                      <span className="text-[10px] text-slate-600 flex-shrink-0">pg {targetPage + 1}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Top pagination */}
        {selectedDepoId && lines.length > 0 && <PaginationBar compact />}
      </div>

      {/* Transcript content */}
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
        {selectedDepoId && pageLines.length > 0 ? (
          <>
            <table className="w-full">
              <thead className="sticky top-0 bg-[#0f1629]">
                <tr className="border-b border-[#1e2a45]">
                  <th className="text-left text-[10px] font-medium text-slate-500 px-4 py-2 w-40">CITE</th>
                  <th className="text-left text-[10px] font-medium text-slate-500 px-4 py-2">TEXT</th>
                  <th className="text-left text-[10px] font-medium text-slate-500 px-2 py-2 w-24">TAG</th>
                </tr>
              </thead>
              <tbody>
                {pageLines.map((line, i) => {
                  const globalIdx = page * PAGE_SIZE + i;
                  const isSelected = selectedRows.has(globalIdx);
                  const isHighlighted = highlightedLineIdx === globalIdx;
                  const flagInfo = citeFlagMap.get(line.cite);
                  const rowClass = isSelected
                    ? "bg-cyan-500/15 border-l-2 border-cyan-400"
                    : flagInfo
                    ? flagInfo.colorClass
                    : "hover:bg-white/5";

                  return (
                    <tr
                      key={globalIdx}
                      ref={el => { rowRefs.current[globalIdx] = el; }}
                      onClick={e => handleRowClick(globalIdx, e)}
                      className={`cursor-pointer border-b border-[#1e2a45]/40 transition-colors ${rowClass}`}
                    >
                      <td className="px-4 py-1.5 text-xs font-mono text-slate-500 whitespace-nowrap select-none">{line.cite}</td>
                      <td className="px-4 py-1.5 text-sm text-slate-200 select-none">{line.text}</td>
                      <td className="px-2 py-1.5 select-none">
                        {flagInfo?.clip_tag && (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${CLIP_TAG_COLORS[flagInfo.clip_tag] || "bg-slate-700 text-slate-300"}`}>
                            {flagInfo.clip_tag}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationBar />
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-500">
            {selectedDepoId ? "No transcript lines found." : "Select a deposition above to view the transcript."}
          </div>
        )}
      </div>

      {/* Depo Clips Viewer */}
      <DepoClipsViewer
        isOpen={clipsViewerOpen}
        onClose={() => setClipsViewerOpen(false)}
        caseId={activeCase?.id}
        defaultDepositionId={selectedDepoId}
        depositions={depositions}
        parties={parties}
      />

      {/* Clip dialog */}
      <Dialog open={clipDialog} onOpenChange={setClipDialog}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>Create Clip</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-[#0a0f1e] rounded p-3 max-h-32 overflow-y-auto text-xs font-mono text-slate-400">
              {Array.from(selectedRows).sort((a, b) => a - b).map(i => displayLines[i]).filter(Boolean).map((l, i) => (
                <div key={i}>{l.cite} — {l.text}</div>
              ))}
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Title</Label>
              <Input value={clipForm.topic_tag} onChange={e => setClipForm({ ...clipForm, topic_tag: e.target.value })}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="e.g. Light was green" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-slate-400 text-xs">Direction</Label>
                <Select value={clipForm.direction} onValueChange={v => setClipForm({ ...clipForm, direction: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HelpsUs">Helps Us</SelectItem>
                    <SelectItem value="HurtsUs">Hurts Us</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-slate-400 text-xs">Clip Tag</Label>
                <Select value={clipForm.clip_tag || "__none__"} onValueChange={v => setClipForm({ ...clipForm, clip_tag: v === "__none__" ? "" : v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select tag..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="Scene">Scene</SelectItem>
                    <SelectItem value="Scope">Scope</SelectItem>
                    <SelectItem value="Credibility">Credibility</SelectItem>
                    <SelectItem value="Opinion">Opinion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={clipForm.impeachment_ready} onCheckedChange={v => setClipForm({ ...clipForm, impeachment_ready: v })} />
              <Label className="text-xs text-slate-400">Impeachment Ready</Label>
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Notes</Label>
              <Textarea value={clipForm.notes} onChange={e => setClipForm({ ...clipForm, notes: e.target.value })}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClipDialog(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={createClip}>Save Clip</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}