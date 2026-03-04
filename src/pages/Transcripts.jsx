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
import { Search, Bookmark, X, ChevronLeft, ChevronRight } from "lucide-react";
import { debounce } from "lodash";

const PAGE_SIZE = 100;

export default function Transcripts() {
  const { activeCase } = useActiveCase();
  const [depositions, setDepositions] = useState([]);
  const [parties, setParties] = useState([]);
  const [selectedDepoId, setSelectedDepoId] = useState("");
  const [lines, setLines] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [clips, setClips] = useState([]);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [clipDialog, setClipDialog] = useState(false);
  const [clipForm, setClipForm] = useState({ topic_tag: "", direction: "HelpsUs", impeachment_ready: false, notes: "" });
  const [page, setPage] = useState(0);
  const lastClickedIdx = useRef(null);

  useEffect(() => {
    if (!activeCase) return;
    Promise.all([
      base44.entities.Depositions.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
    ]).then(([d, p]) => { setDepositions(d); setParties(p); });
  }, [activeCase]);

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
      setPage(0);
      setSelectedRows(new Set());
    });
    base44.entities.DepoClips.filter({ deposition_id: selectedDepoId }).then(setClips);
  }, [selectedDepoId, activeCase]);

  const debouncedSetSearch = useMemo(() => debounce(v => setDebouncedSearch(v), 250), []);
  useEffect(() => { debouncedSetSearch(searchTerm); }, [searchTerm, debouncedSetSearch]);

  const flaggedCites = useMemo(() => {
    const s = new Set();
    clips.forEach(c => {
      const start = c.start_cite;
      const end = c.end_cite || start;
      let inRange = false;
      lines.forEach(l => {
        if (l.cite === start) inRange = true;
        if (inRange) s.add(l.cite);
        if (l.cite === end) inRange = false;
      });
    });
    return s;
  }, [clips, lines]);

  const filteredLines = useMemo(() => {
    let result = lines;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(l => l.text.toLowerCase().includes(q) || l.cite.toLowerCase().includes(q));
    }
    if (showFlaggedOnly) {
      result = result.filter(l => flaggedCites.has(l.cite));
    }
    return result;
  }, [lines, debouncedSearch, showFlaggedOnly, flaggedCites]);

  const totalPages = Math.ceil(filteredLines.length / PAGE_SIZE);
  const pageLines = filteredLines.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
        if (next.size === 1 && next.has(globalIdx)) {
          next.clear();
        } else {
          next.clear();
          next.add(globalIdx);
        }
      }
      lastClickedIdx.current = globalIdx;
      return next;
    });
  }, []);

  const createClip = async () => {
    const sorted = Array.from(selectedRows).sort((a, b) => a - b);
    const selectedLines = sorted.map(i => filteredLines[i]);
    if (selectedLines.length === 0) return;
    await base44.entities.DepoClips.create({
      case_id: activeCase.id,
      deposition_id: selectedDepoId,
      start_cite: selectedLines[0].cite,
      end_cite: selectedLines[selectedLines.length - 1].cite,
      clip_text: selectedLines.map(l => `${l.cite}\t${l.text}`).join("\n"),
      topic_tag: clipForm.topic_tag,
      direction: clipForm.direction,
      impeachment_ready: clipForm.impeachment_ready,
      notes: clipForm.notes,
    });
    setClipDialog(false);
    setClipForm({ topic_tag: "", direction: "HelpsUs", impeachment_ready: false, notes: "" });
    setSelectedRows(new Set());
    base44.entities.DepoClips.filter({ deposition_id: selectedDepoId }).then(setClips);
  };

  const getDepoLabel = (d) => {
    const party = parties.find(p => p.id === d.party_id);
    const name = party ? `${party.first_name} ${party.last_name}` : d.sheet_name;
    return d.volume_label ? `${name} - ${d.volume_label}` : name;
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-[#0f1629] border-b border-[#1e2a45] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Transcripts</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-cyan-600 text-cyan-400 hover:bg-cyan-600/20"
              disabled={selectedRows.size === 0}
              onClick={() => setClipDialog(true)}
            >
              <Bookmark className="w-3 h-3 mr-1" /> Clip Selected ({selectedRows.size})
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => setSelectedRows(new Set())}>
              <X className="w-3 h-3 mr-1" /> Clear
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
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search transcript..."
              className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showFlaggedOnly} onCheckedChange={setShowFlaggedOnly} />
            <Label className="text-xs text-slate-400">Flagged only</Label>
          </div>
          <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">
            {filteredLines.length} lines · {clips.length} clips
          </Badge>
        </div>
      </div>

      {/* Transcript content */}
      <div className="flex-1 overflow-y-auto">
        {selectedDepoId && pageLines.length > 0 ? (
          <>
            <table className="w-full">
              <thead className="sticky top-0 bg-[#0f1629]">
                <tr className="border-b border-[#1e2a45]">
                  <th className="text-left text-[10px] font-medium text-slate-500 px-4 py-2 w-40">CITE</th>
                  <th className="text-left text-[10px] font-medium text-slate-500 px-4 py-2">TEXT</th>
                </tr>
              </thead>
              <tbody>
                {pageLines.map((line, i) => {
                  const globalIdx = page * PAGE_SIZE + i;
                  const isSelected = selectedRows.has(globalIdx);
                  const isFlagged = flaggedCites.has(line.cite);
                  return (
                    <tr
                      key={globalIdx}
                      onClick={e => handleRowClick(globalIdx, e)}
                      className={`cursor-pointer border-b border-[#1e2a45]/50 transition-colors ${
                        isSelected
                          ? "bg-cyan-500/20"
                          : isFlagged
                          ? "bg-amber-500/10"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <td className="px-4 py-1.5 text-xs font-mono text-slate-500 whitespace-nowrap select-none">{line.cite}</td>
                      <td className="px-4 py-1.5 text-sm text-slate-200 select-none">{line.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 py-4 border-t border-[#1e2a45]">
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} className="text-slate-400">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="text-slate-400">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-500">
            {selectedDepoId ? "No transcript lines found." : "Select a deposition above to view the transcript."}
          </div>
        )}
      </div>

      {/* Clip dialog */}
      <Dialog open={clipDialog} onOpenChange={setClipDialog}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader>
            <DialogTitle>Create Clip</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-[#0a0f1e] rounded p-3 max-h-32 overflow-y-auto text-xs font-mono text-slate-400">
              {Array.from(selectedRows).sort((a, b) => a - b).map(i => filteredLines[i]).filter(Boolean).map((l, i) => (
                <div key={i}>{l.cite} — {l.text}</div>
              ))}
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Title</Label>
              <Input value={clipForm.topic_tag} onChange={e => setClipForm({ ...clipForm, topic_tag: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="e.g. Light was green" />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Direction</Label>
              <Select value={clipForm.direction} onValueChange={v => setClipForm({ ...clipForm, direction: v })}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HelpsUs">Helps Us</SelectItem>
                  <SelectItem value="HurtsUs">Hurts Us</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={clipForm.impeachment_ready} onCheckedChange={v => setClipForm({ ...clipForm, impeachment_ready: v })} />
              <Label className="text-xs text-slate-400">Impeachment Ready</Label>
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Notes</Label>
              <Textarea value={clipForm.notes} onChange={e => setClipForm({ ...clipForm, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
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