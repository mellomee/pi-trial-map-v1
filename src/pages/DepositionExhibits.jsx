import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Plus, Pencil, Trash2, Tag, X, ChevronRight, ChevronDown,
  History, Paperclip, ExternalLink, Upload, ChevronsUpDown, ChevronUp,
  FileX, Link2, Layers, ArrowRight, Users, Settings2, UserMinus
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import FileViewerModal from "@/components/exhibits/FileViewerModal";
import UploadProgressPanel from "@/components/exhibits/UploadProgressPanel";

const sideColors = {
  Plaintiff: "bg-amber-500/20 text-amber-400",
  Defense: "bg-red-500/20 text-red-400",
  Independent: "bg-purple-500/20 text-purple-400",
  Unknown: "bg-slate-500/20 text-slate-400",
};

const SIDES = ["Plaintiff", "Defense", "Independent", "Unknown"];

export default function DepositionExhibits() {
  const { activeCase } = useActiveCase();
  const navigate = useNavigate();
  const [exhibits, setExhibits] = useState([]);
  const [parties, setParties] = useState([]);
  const [joints, setJoints] = useState([]);
  const [extracts, setExtracts] = useState([]);

  // UI state
  const [search, setSearch] = useState("");
  const [filterSide, setFilterSide] = useState("all");
  const [filterDeponent, setFilterDeponent] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  // Dialogs
  const [editDialog, setEditDialog] = useState(null);
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ depo_exhibit_no: "", depo_exhibit_title: "", provided_by_side: "Unknown", deponent_name: "", referenced_page: "", notes: "" });
  const [tagDialog, setTagDialog] = useState(false);
  const [tagForm, setTagForm] = useState({ group_name: "", tags: "" });
  const [editGroupDialog, setEditGroupDialog] = useState(null); // { oldName, newName }
  const [viewFile, setViewFile] = useState(null);
  const [uploadQueue, setUploadQueue] = useState([]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 text-slate-500 inline" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1 text-cyan-400 inline" />
      : <ChevronDown className="w-3 h-3 ml-1 text-cyan-400 inline" />;
  };

  const load = async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [ex, pa, jo, exts] = await Promise.all([
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.ExhibitExtracts.filter({ case_id: cid }),
    ]);
    setExhibits(ex);
    setParties(pa);
    setJoints(jo);
    setExtracts(exts);
  };

  useEffect(() => { load(); }, [activeCase]);

  const extractsForExhibit = (depoExhibitId) =>
    extracts.filter(e =>
      e.source_depo_exhibit_id === depoExhibitId ||
      (e.source_depo_exhibit_ids || []).includes(depoExhibitId)
    );

  const depoById = useMemo(() => {
    const m = {};
    exhibits.forEach(e => { m[e.id] = e; });
    return m;
  }, [exhibits]);

  const markedCount = useMemo(() => {
    const jointExtractIds = new Set(joints.map(j => j.exhibit_extract_id).filter(Boolean));
    return exhibits.filter(ex => {
      const exts = extractsForExhibit(ex.id);
      return exts.some(e => jointExtractIds.has(e.id));
    }).length;
  }, [exhibits, extracts, joints]);

  const allGroups = useMemo(() => {
    const groups = new Set(exhibits.map(e => e.group_name).filter(Boolean));
    return [...groups].sort();
  }, [exhibits]);

  const allDeponents = useMemo(() => {
    const names = new Set(exhibits.map(e => e.deponent_name).filter(Boolean));
    return [...names].sort();
  }, [exhibits]);

  const sorted = useMemo(() => {
    if (!sortCol) return exhibits;
    return [...exhibits].sort((a, b) => {
      let av, bv;
      if (sortCol === "no") { av = a.depo_exhibit_no || ""; bv = b.depo_exhibit_no || ""; }
      else if (sortCol === "deponent") { av = a.deponent_name || ""; bv = b.deponent_name || ""; }
      else if (sortCol === "title") { av = a.display_title || a.depo_exhibit_title || ""; bv = b.display_title || b.depo_exhibit_title || ""; }
      else if (sortCol === "side") { av = a.provided_by_side || ""; bv = b.provided_by_side || ""; }
      else { av = ""; bv = ""; }
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [exhibits, sortCol, sortDir]);

  const filtered = useMemo(() => sorted.filter(ex => {
    const title = ex.display_title || ex.depo_exhibit_title || "";
    const matchSearch = !search || title.toLowerCase().includes(search.toLowerCase()) ||
      ex.depo_exhibit_no?.toLowerCase().includes(search.toLowerCase()) ||
      (ex.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchSide = filterSide === "all" || ex.provided_by_side === filterSide;
    const matchDeponent = filterDeponent === "all" || ex.deponent_name === filterDeponent || (filterDeponent === "__none__" && !ex.deponent_name);
    return matchSearch && matchSide && matchDeponent;
  }), [sorted, search, filterSide, filterDeponent]);

  // Always grouped view: named groups first (collapsible), then ungrouped flat
  const { groupedMap, ungrouped } = useMemo(() => {
    const map = {};
    const ung = [];
    filtered.forEach(ex => {
      if (ex.group_name) {
        if (!map[ex.group_name]) map[ex.group_name] = [];
        map[ex.group_name].push(ex);
      } else {
        ung.push(ex);
      }
    });
    return { groupedMap: map, ungrouped: ung };
  }, [filtered]);

  // Selection helpers
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => selectedIds.size === filtered.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(e => e.id)));
  const clearSel = () => setSelectedIds(new Set());

  // CRUD
  const saveEdit = async () => {
    await base44.entities.DepositionExhibits.update(editDialog.id, editDialog);
    setEditDialog(null);
    load();
  };

  const saveAdd = async () => {
    await base44.entities.DepositionExhibits.create({ ...addForm, case_id: activeCase.id, original_title: addForm.depo_exhibit_title });
    setAddDialog(false);
    setAddForm({ depo_exhibit_no: "", depo_exhibit_title: "", provided_by_side: "Unknown", deponent_name: "", referenced_page: "", notes: "" });
    load();
  };

  const revertName = async (ex) => {
    if (!confirm("Revert to original title?")) return;
    await base44.entities.DepositionExhibits.update(ex.id, { display_title: "", original_title: ex.original_title });
    load();
  };

  const saveTags = async () => {
    const tags = tagForm.tags ? tagForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const ids = [...selectedIds];
    // Sequential with small delay to avoid rate limits
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const ex = exhibits.find(e => e.id === id);
      const mergedTags = [...new Set([...(ex.tags || []), ...tags])];
      await base44.entities.DepositionExhibits.update(id, {
        group_name: tagForm.group_name || ex.group_name,
        tags: mergedTags,
      });
      if (i < ids.length - 1) await new Promise(r => setTimeout(r, 150));
    }
    setTagDialog(false);
    clearSel();
    load();
  };

  const removeFromGroup = async (ex) => {
    await base44.entities.DepositionExhibits.update(ex.id, { group_name: "" });
    load();
  };

  const renameGroup = async () => {
    if (!editGroupDialog?.newName?.trim()) return;
    const members = exhibits.filter(e => e.group_name === editGroupDialog.oldName);
    for (let i = 0; i < members.length; i++) {
      await base44.entities.DepositionExhibits.update(members[i].id, { group_name: editGroupDialog.newName.trim() });
      if (i < members.length - 1) await new Promise(r => setTimeout(r, 150));
    }
    setEditGroupDialog(null);
    load();
  };

  const ungroupAll = async (grpName, items) => {
    if (!confirm(`Remove all ${items.length} exhibits from group "${grpName}"?`)) return;
    for (let i = 0; i < items.length; i++) {
      await base44.entities.DepositionExhibits.update(items[i].id, { group_name: "" });
      if (i < items.length - 1) await new Promise(r => setTimeout(r, 150));
    }
    load();
  };

  const del = async (id) => {
    if (!confirm("Delete this exhibit?")) return;
    await base44.entities.DepositionExhibits.delete(id);
    setExhibits(prev => prev.filter(e => e.id !== id));
  };

  const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

  const uploadFile = async (exhibitId, file) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      alert(`File "${file.name}" is ${sizeMB} MB. Maximum is 50 MB.`);
      return;
    }
    const uid = `${exhibitId}-${Date.now()}`;
    setUploadQueue(q => [...q, { id: uid, name: file.name, status: "uploading", progress: 0 }]);
    let fakeProgress = 0;
    const ticker = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 12, 90);
      setUploadQueue(q => q.map(u => u.id === uid ? { ...u, progress: Math.round(fakeProgress) } : u));
    }, 400);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      clearInterval(ticker);
      setUploadQueue(q => q.map(u => u.id === uid ? { ...u, status: "done", progress: 100 } : u));
      await base44.entities.DepositionExhibits.update(exhibitId, { file_url });
      setExhibits(prev => prev.map(e => e.id === exhibitId ? { ...e, file_url } : e));
    } catch (err) {
      clearInterval(ticker);
      setUploadQueue(q => q.map(u => u.id === uid ? { ...u, status: "error", error: err?.message || "Upload failed" } : u));
    }
  };

  const deleteFile = async (exhibitId) => {
    if (!confirm("Remove attached file?")) return;
    await base44.entities.DepositionExhibits.update(exhibitId, { file_url: "" });
    setExhibits(prev => prev.map(e => e.id === exhibitId ? { ...e, file_url: "" } : e));
  };

  // Navigate to Extracts to create a NEW extract for this exhibit
  const goCreateExtract = (ex) => {
    navigate(createPageUrl(`Extracts?newExtractFromDepo=${ex.id}`));
  };

  // ── Exhibit Row ──────────────────────────────────────────────────────────────
  const ExhibitRow = ({ ex, inGroup }) => {
    const isSelected = selectedIds.has(ex.id);
    const displayTitle = ex.display_title || ex.depo_exhibit_title;
    const wasRenamed = ex.display_title && ex.display_title !== ex.depo_exhibit_title;
    const exts = extractsForExhibit(ex.id);
    const linkedJoint = exts.length > 0
      ? joints.find(j => exts.some(e => e.id === j.exhibit_extract_id))
      : null;

    return (
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-[#1e2a45] last:border-0 transition-colors ${isSelected ? "bg-cyan-500/5" : "hover:bg-white/[0.02]"} ${inGroup ? "pl-8" : ""}`}>
        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(ex.id)} className="border-slate-400 flex-shrink-0" />

        {/* Exhibit # */}
        <span className="text-xs font-mono text-slate-300 w-14 flex-shrink-0">{ex.depo_exhibit_no}</span>

        {/* Deponent */}
        <span className="text-xs text-slate-400 w-28 flex-shrink-0 truncate" title={ex.deponent_name || "—"}>
          {ex.deponent_name || <span className="text-slate-600 italic">—</span>}
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white">{displayTitle}</span>
            {wasRenamed && (
              <span className="text-[10px] text-slate-500 italic">orig: {ex.depo_exhibit_title}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Badge className={`text-[10px] ${sideColors[ex.provided_by_side]}`}>{ex.provided_by_side}</Badge>
            {(ex.tags || []).map(t => <Badge key={t} variant="outline" className="text-[10px] text-slate-300 border-slate-600">{t}</Badge>)}
            {ex.referenced_page && <span className="text-[10px] text-slate-500">p.{ex.referenced_page}</span>}
            {/* Extract badges */}
            {exts.length > 0 && (
              <span className="text-[10px] text-emerald-400 font-medium">
                {exts.length} extract{exts.length > 1 ? "s" : ""}
              </span>
            )}
            {linkedJoint && (
              <span className="text-[10px] text-cyan-400 font-semibold">Joint #{linkedJoint.marked_no}</span>
            )}
          </div>
          {/* Extract page ranges */}
          {exts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {exts.map(ext => (
                <span key={ext.id} className="inline-flex items-center gap-1 text-[10px] bg-emerald-900/20 border border-emerald-700/20 text-emerald-300/80 px-1.5 py-0.5 rounded">
                  {ext.extract_title_official || "Extract"}
                  {(ext.extract_page_start || ext.extract_page_end) && (
                    <span className="text-slate-500"> · pp.{ext.extract_page_start}{ext.extract_page_end ? `–${ext.extract_page_end}` : "+"}</span>
                  )}
                  {ext.extract_file_url && <span className="text-amber-400/70"> · shortened</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* File */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {ex.file_url ? (
            <>
              <button title="View file" onClick={() => setViewFile({ url: ex.file_url, title: displayTitle })} className="p-1 text-green-400 hover:text-green-300">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button title="Remove file" onClick={() => deleteFile(ex.id)} className="p-1 text-slate-500 hover:text-red-400">
                <FileX className="w-3.5 h-3.5" />
              </button>
            </>
          ) : null}
          {ex.external_link ? (
            <a href={ex.external_link} target="_blank" rel="noopener noreferrer" title="External link" className="p-1 text-blue-400 hover:text-blue-300">
              <Link2 className="w-3.5 h-3.5" />
            </a>
          ) : null}
          <label title="Upload/replace file" className="p-1 text-slate-400 hover:text-cyan-400 cursor-pointer">
            <Paperclip className="w-3.5 h-3.5" />
            <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.tiff,.bmp,.webp,.mp4,.mov,.avi,.webm" className="hidden"
              onClick={e => { e.target.value = null; }}
              onChange={e => { if (e.target.files[0]) uploadFile(ex.id, e.target.files[0]); }} />
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button title="Edit exhibit details" onClick={() => setEditDialog({ ...ex })} className="p-1 text-slate-400 hover:text-cyan-400">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {wasRenamed && (
            <button title="Revert to original name" onClick={() => revertName(ex)} className="p-1 text-slate-400 hover:text-amber-400">
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          {inGroup && (
            <button title="Remove from group" onClick={() => removeFromGroup(ex)} className="p-1 text-slate-400 hover:text-orange-400">
              <UserMinus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            title="Add as Extract (creates new extract on Extracts page)"
            onClick={() => goCreateExtract(ex)}
            className="p-1 text-slate-400 hover:text-emerald-400 flex items-center gap-0.5"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button title="Delete" onClick={() => del(ex.id)} className="p-1 text-slate-400 hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // ── Group Header ─────────────────────────────────────────────────────────────
  const GroupHeader = ({ grpName, items }) => {
    const isOpen = expandedGroups.has(grpName);
    const groupExtracts = extracts.filter(e =>
      (e.source_depo_exhibit_ids || []).some(id => items.some(it => it.id === id)) ||
      items.some(it => it.id === e.source_depo_exhibit_id)
    );

    return (
      <div className="border-b border-[#1e2a45]">
        {/* Group header row */}
        <div className="flex items-center bg-[#0d1526] hover:bg-[#111b30] transition-colors">
          <button
            className="flex-1 flex items-center gap-2.5 px-4 py-3 text-left"
            onClick={() => {
              const n = new Set(expandedGroups);
              n.has(grpName) ? n.delete(grpName) : n.add(grpName);
              setExpandedGroups(n);
            }}
          >
            {isOpen
              ? <ChevronDown className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              : <ChevronRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            }
            <Users className="w-4 h-4 text-indigo-400/60 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-100">{grpName}</span>
                <span className="text-xs text-slate-500">{items.length} exhibits</span>
                {groupExtracts.length > 0 && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-900/20 border border-emerald-700/20 px-1.5 py-0.5 rounded">
                    {groupExtracts.length} extract{groupExtracts.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {/* Show extract names for this group */}
              {groupExtracts.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {groupExtracts.map(e => (
                    <span key={e.id} className="text-[10px] text-slate-500 italic">
                      "{e.extract_title_official}"
                      {(e.extract_page_start || e.extract_page_end) && ` pp.${e.extract_page_start}–${e.extract_page_end}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>

          {/* Group actions */}
          <div className="flex items-center gap-1.5 pr-4">
            <button
              title="Select all in group"
              onClick={() => setSelectedIds(prev => { const n = new Set(prev); items.forEach(e => n.add(e.id)); return n; })}
              className="text-[10px] px-2 py-1 rounded border border-slate-600/40 text-slate-400 hover:text-white hover:border-slate-400 transition-colors"
            >
              Select all
            </button>
            <button
              title="Rename/edit this group"
              onClick={() => setEditGroupDialog({ oldName: grpName, newName: grpName })}
              className="p-1.5 text-slate-500 hover:text-cyan-400 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            <button
              title="Ungroup all exhibits"
              onClick={() => ungroupAll(grpName, items)}
              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expanded items */}
        {isOpen && items.map(ex => <ExhibitRow key={ex.id} ex={ex} inGroup={true} />)}
      </div>
    );
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case selected.</div>;

  const groupNames = Object.keys(groupedMap).sort();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Deposition Exhibits</h1>
          <div className="flex gap-3 mt-1 text-xs text-slate-400">
            <span>{exhibits.length} total</span>
            <span>·</span>
            <span className="text-emerald-400">{extracts.length} extracts</span>
            <span>·</span>
            <span className="text-cyan-400">{markedCount} on joint list</span>
            {allGroups.length > 0 && <><span>·</span><span className="text-indigo-400">{allGroups.length} groups</span></>}
          </div>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Exhibit
        </Button>
      </div>

      {/* Workflow hint */}
      <div className="mb-4 px-4 py-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-lg flex items-center gap-3 text-xs text-slate-400 flex-wrap">
        <span className="font-semibold text-indigo-400 flex-shrink-0">Workflow:</span>
        <span>1. <strong className="text-slate-300">Select</strong> exhibits → <strong className="text-slate-300">Tag/Group</strong> them together</span>
        <ArrowRight className="w-3 h-3 flex-shrink-0 text-slate-600" />
        <span>2. Click <strong className="text-slate-300"><Layers className="w-3 h-3 inline mb-0.5" /></strong> on any exhibit to add it as an Extract (can add multiple)</span>
        <ArrowRight className="w-3 h-3 flex-shrink-0 text-slate-600" />
        <span>3. Go to <strong className="text-slate-300">Extracts & Joint List</strong> to annotate and mark</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Search exhibits, tags…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
        </div>

        <Select value={filterSide} onValueChange={setFilterSide}>
          <SelectTrigger className="w-36 bg-[#131a2e] border-[#1e2a45] text-slate-200 h-9"><SelectValue placeholder="Side" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sides</SelectItem>
            {SIDES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterDeponent} onValueChange={setFilterDeponent}>
          <SelectTrigger className="w-44 bg-[#131a2e] border-[#1e2a45] text-slate-200 h-9"><SelectValue placeholder="Deponent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deponents</SelectItem>
            <SelectItem value="__none__">No Deponent</SelectItem>
            {allDeponents.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>

        <button
          onClick={() => setExpandedGroups(new Set(groupNames))}
          className="text-xs px-3 py-1.5 rounded bg-[#131a2e] text-slate-400 border border-[#1e2a45] hover:text-white transition-colors"
        >Expand All</button>
        <button
          onClick={() => setExpandedGroups(new Set())}
          className="text-xs px-3 py-1.5 rounded bg-[#131a2e] text-slate-400 border border-[#1e2a45] hover:text-white transition-colors"
        >Collapse All</button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg flex-wrap">
          <span className="text-xs text-cyan-300 font-medium">{selectedIds.size} selected</span>
          <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={() => { setTagForm({ group_name: "", tags: "" }); setTagDialog(true); }}>
            <Tag className="w-3 h-3 mr-1" /> Tag / Group
          </Button>
          <Button size="sm" className="h-7 text-xs bg-emerald-700 hover:bg-emerald-600" onClick={() => {
            const firstId = [...selectedIds][0];
            if (firstId) navigate(createPageUrl(`Extracts?newExtractFromDepo=${firstId}`));
          }}>
            <Layers className="w-3 h-3 mr-1" /> Add as Extract →
          </Button>
          <button onClick={clearSel} className="ml-auto text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e2a45] bg-[#0f1629]">
          <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} className="border-slate-400" />
          <button onClick={() => handleSort("no")} className="text-[10px] font-semibold text-slate-400 uppercase w-14 text-left hover:text-white flex items-center">No.<SortIcon col="no" /></button>
          <button onClick={() => handleSort("deponent")} className="text-[10px] font-semibold text-slate-400 uppercase w-28 text-left hover:text-white flex items-center">Deponent<SortIcon col="deponent" /></button>
          <button onClick={() => handleSort("title")} className="text-[10px] font-semibold text-slate-400 uppercase flex-1 text-left hover:text-white flex items-center">Title / Extracts<SortIcon col="title" /></button>
          <span className="text-[10px] font-semibold text-slate-400 uppercase w-20 text-right">File</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase w-24 text-right">Actions</span>
        </div>

        {/* Named groups */}
        {groupNames.map(grpName => (
          <GroupHeader key={grpName} grpName={grpName} items={groupedMap[grpName]} />
        ))}

        {/* Ungrouped exhibits (flat, no separator if no groups exist) */}
        {ungrouped.length > 0 && (
          <div>
            {groupNames.length > 0 && (
              <div className="px-4 py-1.5 bg-[#0f1629] border-b border-[#1e2a45]">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Ungrouped ({ungrouped.length})</span>
              </div>
            )}
            {ungrouped.map(ex => <ExhibitRow key={ex.id} ex={ex} inGroup={false} />)}
          </div>
        )}

        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-10">No exhibits found.</p>
        )}
      </div>

      {/* ── Edit Exhibit Dialog ── */}
      <Dialog open={!!editDialog} onOpenChange={v => !v && setEditDialog(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
          <DialogHeader><DialogTitle>Edit Exhibit</DialogTitle></DialogHeader>
          {editDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-slate-400 text-xs">Exhibit No.</Label>
                  <Input value={editDialog.depo_exhibit_no} onChange={e => setEditDialog({ ...editDialog, depo_exhibit_no: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
                <div><Label className="text-slate-400 text-xs">Side</Label>
                  <Select value={editDialog.provided_by_side} onValueChange={v => setEditDialog({ ...editDialog, provided_by_side: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{SIDES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-slate-400 text-xs">Original Title <span className="text-slate-600">(imported — do not change)</span></Label>
                <p className="text-sm text-slate-500 mt-1 px-2 py-1.5 bg-[#0a0f1e] rounded border border-[#1e2a45]">{editDialog.depo_exhibit_title}</p>
              </div>
              <div><Label className="text-slate-400 text-xs">Display Title <span className="text-slate-600">(your internal name — leave blank to use original)</span></Label>
                <Input value={editDialog.display_title || ""} onChange={e => setEditDialog({ ...editDialog, display_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="e.g. TCR – Intersection A" />
              </div>
              <div><Label className="text-slate-400 text-xs">Deponent Name</Label>
                <Input value={editDialog.deponent_name || ""} onChange={e => setEditDialog({ ...editDialog, deponent_name: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div><Label className="text-slate-400 text-xs">Referenced Page</Label>
                <Input value={editDialog.referenced_page || ""} onChange={e => setEditDialog({ ...editDialog, referenced_page: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="e.g. 42" />
              </div>
              <div><Label className="text-slate-400 text-xs">External Link <span className="text-slate-600">(Dropbox, Drive…)</span></Label>
                <Input value={editDialog.external_link || ""} onChange={e => setEditDialog({ ...editDialog, external_link: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="https://…" />
              </div>
              <div><Label className="text-slate-400 text-xs">Notes</Label>
                <Textarea value={editDialog.notes || ""} onChange={e => setEditDialog({ ...editDialog, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Exhibit Dialog ── */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>Add Exhibit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-slate-400 text-xs">Exhibit No.</Label>
                <Input value={addForm.depo_exhibit_no} onChange={e => setAddForm({ ...addForm, depo_exhibit_no: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div><Label className="text-slate-400 text-xs">Side</Label>
                <Select value={addForm.provided_by_side} onValueChange={v => setAddForm({ ...addForm, provided_by_side: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{SIDES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-slate-400 text-xs">Title</Label>
              <Input value={addForm.depo_exhibit_title} onChange={e => setAddForm({ ...addForm, depo_exhibit_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div><Label className="text-slate-400 text-xs">Deponent Name</Label>
              <Input value={addForm.deponent_name} onChange={e => setAddForm({ ...addForm, deponent_name: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div><Label className="text-slate-400 text-xs">Referenced Page</Label>
              <Input value={addForm.referenced_page} onChange={e => setAddForm({ ...addForm, referenced_page: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="e.g. 42" />
            </div>
            <div><Label className="text-slate-400 text-xs">Notes</Label>
              <Textarea value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Tag/Group Dialog ── */}
      <Dialog open={tagDialog} onOpenChange={setTagDialog}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader>
            <DialogTitle>Tag / Group Exhibits</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">{selectedIds.size} exhibit(s) selected</p>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-slate-400 text-xs">Group Name <span className="text-slate-600">(assigns to a collapsible group)</span></Label>
              <div className="flex gap-2 mt-1">
                <Input placeholder="e.g. Traffic Collision Report" value={tagForm.group_name} onChange={e => setTagForm({ ...tagForm, group_name: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              {allGroups.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="text-[10px] text-slate-600">Existing:</span>
                  {allGroups.map(g => (
                    <button key={g} onClick={() => setTagForm(f => ({ ...f, group_name: g }))}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Tags <span className="text-slate-600">(comma separated)</span></Label>
              <Input placeholder="e.g. billing, imaging, key" value={tagForm.tags} onChange={e => setTagForm({ ...tagForm, tags: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1" />
            </div>
            <p className="text-xs text-slate-600">Tags will be merged with existing tags.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialog(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={saveTags}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Group Dialog ── */}
      <Dialog open={!!editGroupDialog} onOpenChange={v => !v && setEditGroupDialog(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="w-4 h-4 text-indigo-400" /> Edit Group</DialogTitle></DialogHeader>
          {editGroupDialog && (
            <div className="space-y-3">
              <div>
                <Label className="text-slate-400 text-xs">Group Name</Label>
                <Input value={editGroupDialog.newName} onChange={e => setEditGroupDialog({ ...editGroupDialog, newName: e.target.value })}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1" />
              </div>
              <p className="text-xs text-slate-500">
                {(exhibits.filter(e => e.group_name === editGroupDialog.oldName)).length} exhibits in this group.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupDialog(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={renameGroup} disabled={!editGroupDialog?.newName?.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewFile && <FileViewerModal url={viewFile.url} title={viewFile.title} onClose={() => setViewFile(null)} />}

      <UploadProgressPanel
        uploads={uploadQueue}
        onClose={() => setUploadQueue([])}
        onRemove={id => setUploadQueue(q => q.filter(u => u.id !== id))}
      />
    </div>
  );
}