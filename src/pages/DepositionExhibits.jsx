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
import { Search, Plus, Pencil, Trash2, Tag, X, ChevronRight, ChevronDown, History, Paperclip, ExternalLink, Upload, ChevronsUpDown, ChevronUp, FileX, Link2, Layers, ArrowRight } from "lucide-react";
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
  const [extracts, setExtracts] = useState([]); // all extracts for this case

  // UI
  const [search, setSearch] = useState("");
  const [filterSide, setFilterSide] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterMarked, setFilterMarked] = useState("all"); // all | marked | unmarked
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [viewMode, setViewMode] = useState("flat"); // flat | group

  const [selectedIds, setSelectedIds] = useState(new Set());

  // Dialogs
  const [editDialog, setEditDialog] = useState(null);
  const [renameDialog, setRenameDialog] = useState(null);
  const [tagDialog, setTagDialog] = useState(false);
  const [tagForm, setTagForm] = useState({ group_name: "", tags: "" });

  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ depo_exhibit_no: "", depo_exhibit_title: "", provided_by_side: "Unknown", deponent_name: "", referenced_page: "", notes: "" });
  const [filterDeponent, setFilterDeponent] = useState("all");
  const [viewFile, setViewFile] = useState(null); // { url, title }
  const [uploadQueue, setUploadQueue] = useState([]); // [{ id, name, status, progress, error }]
  const [sortCol, setSortCol] = useState(null); // "no" | "deponent" | "title" | "side"
  const [sortDir, setSortDir] = useState("asc");

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

  // Helper: get extracts for a given depo exhibit id
  const extractsForExhibit = (depoExhibitId) =>
    extracts.filter(e =>
      e.source_depo_exhibit_id === depoExhibitId ||
      (e.source_depo_exhibit_ids || []).includes(depoExhibitId)
    );

  // Navigate to Extracts page to create a new extract pre-seeded with this exhibit
  const goCreateExtract = (ex) => {
    navigate(createPageUrl(`Extracts?newExtractFromDepo=${ex.id}`));
  };

  useEffect(() => { load(); }, [activeCase]);

  const jointIds = useMemo(() => new Set(exhibits.filter(e => e.joint_exhibit_id).map(e => e.joint_exhibit_id)), [exhibits]);
  const markedCount = useMemo(() => {
    // Count exhibits that have an extract which is linked to a joint exhibit
    const jointExtractIds = new Set(joints.map(j => j.exhibit_extract_id).filter(Boolean));
    return exhibits.filter(ex => {
      const exts = extracts.filter(e =>
        e.source_depo_exhibit_id === ex.id ||
        (e.source_depo_exhibit_ids || []).includes(ex.id)
      );
      return exts.some(e => jointExtractIds.has(e.id));
    }).length;
  }, [exhibits, extracts, joints]);

  const allGroups = useMemo(() => {
    const groups = new Set(exhibits.map(e => e.group_name).filter(Boolean));
    return [...groups];
  }, [exhibits]);

  const depoById = useMemo(() => {
    const m = {};
    exhibits.forEach(e => { m[e.id] = e; });
    return m;
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
    const matchGroup = filterGroup === "all" || ex.group_name === filterGroup || (filterGroup === "__none__" && !ex.group_name);
    const isMarked = !!ex.joint_exhibit_id;
    const matchMarked = filterMarked === "all" || (filterMarked === "marked" && isMarked) || (filterMarked === "unmarked" && !isMarked);
    const matchDeponent = filterDeponent === "all" || ex.deponent_name === filterDeponent || (filterDeponent === "__none__" && !ex.deponent_name);
    return matchSearch && matchSide && matchGroup && matchMarked && matchDeponent;
  }), [exhibits, search, filterSide, filterGroup, filterMarked, filterDeponent]);

  // Grouping
  const grouped = useMemo(() => {
    if (viewMode === "flat") return null;
    const map = {};
    filtered.forEach(ex => {
      const key = ex.group_name || "__ungrouped__";
      if (!map[key]) map[key] = [];
      map[key].push(ex);
    });
    return map;
  }, [filtered, viewMode]);

  // Selection
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => selectedIds.size === filtered.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(e => e.id)));
  const clearSel = () => setSelectedIds(new Set());

  // Save edit
  const saveEdit = async () => {
    await base44.entities.DepositionExhibits.update(editDialog.id, editDialog);
    setEditDialog(null);
    load();
  };

  // Add new
  const saveAdd = async () => {
    await base44.entities.DepositionExhibits.create({ ...addForm, case_id: activeCase.id, original_title: addForm.depo_exhibit_title });
    setAddDialog(false);
    setAddForm({ depo_exhibit_no: "", depo_exhibit_title: "", provided_by_side: "Unknown", referenced_page: "", notes: "" });
    load();
  };

  // Rename
  const saveRename = async () => {
    const prev = renameDialog;
    await base44.entities.DepositionExhibits.update(prev.id, {
      display_title: renameDialog.newTitle,
      original_title: prev.original_title || prev.depo_exhibit_title,
    });
    setRenameDialog(null);
    load();
  };

  const revertName = async (ex) => {
    if (!confirm("Revert to original title?")) return;
    await base44.entities.DepositionExhibits.update(ex.id, { display_title: "", original_title: ex.original_title });
    load();
  };

  // Tag/group selected
  const saveTags = async () => {
    const tags = tagForm.tags ? tagForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    for (const id of selectedIds) {
      const ex = exhibits.find(e => e.id === id);
      const mergedTags = [...new Set([...(ex.tags || []), ...tags])];
      await base44.entities.DepositionExhibits.update(id, {
        group_name: tagForm.group_name || ex.group_name,
        tags: mergedTags,
      });
    }
    setTagDialog(false);
    clearSel();
    load();
  };



  const del = async (id) => {
    if (!confirm("Delete this exhibit?")) return;
    await base44.entities.DepositionExhibits.delete(id);
    setExhibits(prev => prev.filter(e => e.id !== id));
  };

  const getParty = (pid) => { const p = parties.find(x => x.id === pid); return p ? `${p.first_name || ""} ${p.last_name}`.trim() : ""; };

  const MAX_FILE_SIZE_MB = 50;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const uploadFile = async (exhibitId, file) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      alert(`File "${file.name}" is ${sizeMB} MB. The maximum supported upload size is ${MAX_FILE_SIZE_MB} MB. Please compress the file or split it before uploading.`);
      return;
    }

    const uid = `${exhibitId}-${Date.now()}`;
    setUploadQueue(q => [...q, { id: uid, name: file.name, status: "uploading", progress: 0 }]);

    // Simulate progress while uploading (real XHR progress not available via SDK)
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
    if (!confirm("Remove attached file from this exhibit?")) return;
    await base44.entities.DepositionExhibits.update(exhibitId, { file_url: "" });
    setExhibits(prev => prev.map(e => e.id === exhibitId ? { ...e, file_url: "" } : e));
  };

  const allDeponents = useMemo(() => {
    const names = new Set(exhibits.map(e => e.deponent_name).filter(Boolean));
    return [...names].sort();
  }, [exhibits]);

  const ExhibitRow = ({ ex }) => {
    const isSelected = selectedIds.has(ex.id);
    const isMarked = !!ex.joint_exhibit_id;
    const displayTitle = ex.display_title || ex.depo_exhibit_title;
    const wasRenamed = ex.display_title && ex.display_title !== ex.depo_exhibit_title;
    const joint = joints.find(j => j.id === ex.joint_exhibit_id);

    return (
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-[#1e2a45] last:border-0 transition-colors ${isSelected ? "bg-cyan-500/5" : "hover:bg-white/[0.02]"}`}>
        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(ex.id)} className="border-slate-400 flex-shrink-0" />

        {/* Exhibit # */}
        <span className="text-xs font-mono text-slate-300 w-14 flex-shrink-0">{ex.depo_exhibit_no}</span>

        {/* Deponent */}
        <span className="text-xs text-slate-300 w-28 flex-shrink-0 truncate" title={ex.deponent_name || "—"}>
          {ex.deponent_name || <span className="text-slate-500 italic">—</span>}
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white">{displayTitle}</span>
            {wasRenamed && (
              <span className="text-[10px] text-slate-400 italic">orig: {ex.depo_exhibit_title}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Badge className={`text-[10px] ${sideColors[ex.provided_by_side]}`}>{ex.provided_by_side}</Badge>
            {ex.group_name && <Badge variant="outline" className="text-[10px] text-indigo-400 border-indigo-500/30">{ex.group_name}</Badge>}
            {(ex.tags || []).map(t => <Badge key={t} variant="outline" className="text-[10px] text-slate-300 border-slate-600">{t}</Badge>)}
            {ex.referenced_page && <span className="text-[10px] text-slate-400">p.{ex.referenced_page}</span>}
          </div>
        </div>

        {/* Joint status + extract count */}
        <div className="flex-shrink-0 text-right min-w-[110px]">
          {(() => {
            const exts = extractsForExhibit(ex.id);
            // Find joint via extract linkage
            const linkedJoint = exts.length > 0
              ? joints.find(j => exts.some(e => e.id === j.exhibit_extract_id))
              : isMarked ? joint : null;
            return linkedJoint ? (
              <div>
                <span className="text-[10px] text-cyan-400 font-semibold">Joint #{linkedJoint.marked_no}</span>
                <span className="text-[10px] text-slate-300 block">{linkedJoint.status}</span>
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 italic">Not in joint list</span>
            );
          })()}
          {(() => {
            const exts = extractsForExhibit(ex.id);
            return exts.length > 0 ? (
              <span className="text-[10px] text-emerald-500 block">{exts.length} extract{exts.length > 1 ? "s" : ""}</span>
            ) : null;
          })()}
        </div>

        {/* File attachment */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {ex.file_url ? (
            <>
              <button title="View attached file" onClick={() => setViewFile({ url: ex.file_url, title: ex.display_title || ex.depo_exhibit_title })} className="p-1 text-green-400 hover:text-green-300">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button title="Remove attached file" onClick={() => deleteFile(ex.id)} className="p-1 text-slate-500 hover:text-red-400">
                <FileX className="w-3.5 h-3.5" />
              </button>
            </>
          ) : null}
          {ex.external_link ? (
            <a href={ex.external_link} target="_blank" rel="noopener noreferrer" title="Open external link (Dropbox, etc.)" className="p-1 text-blue-400 hover:text-blue-300">
              <Link2 className="w-3.5 h-3.5" />
            </a>
          ) : null}
          <label title="Attach file" className="p-1 text-slate-400 hover:text-cyan-400 cursor-pointer">
            <Paperclip className="w-3.5 h-3.5" />
            <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.tiff,.bmp,.webp,.mp4,.mov,.avi,.webm" className="hidden"
              onClick={e => { e.target.value = null; }}
              onChange={e => { if (e.target.files[0]) uploadFile(ex.id, e.target.files[0]); }} />
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button title="Edit deponent / details" onClick={() => setEditDialog({ ...ex })} className="p-1 text-slate-400 hover:text-cyan-400"><Pencil className="w-3.5 h-3.5" /></button>
          {wasRenamed && <button title="Revert name" onClick={() => revertName(ex)} className="p-1 text-slate-400 hover:text-amber-400"><History className="w-3.5 h-3.5" /></button>}
          <button title="Create Extract → go to Extracts page" onClick={() => goCreateExtract(ex)} className="p-1 text-slate-400 hover:text-emerald-400"><Layers className="w-3.5 h-3.5" /></button>
          <button title="Delete" onClick={() => del(ex.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    );
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case selected.</div>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Deposition Exhibits</h1>
          <div className="flex gap-3 mt-1 text-xs text-slate-300">
            <span>{exhibits.length} total</span>
            <span className="text-slate-400">·</span>
            <span className="text-emerald-400">{extracts.length} extracts</span>
            <span className="text-slate-400">·</span>
            <span className="text-cyan-400">{markedCount} on joint list</span>
          </div>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Exhibit
        </Button>
      </div>

      {/* Workflow hint */}
      <div className="mb-4 px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center gap-3 text-xs text-slate-400">
        <span className="font-semibold text-emerald-400 flex-shrink-0">Workflow:</span>
        <span>1. <strong className="text-slate-300">Organize</strong> here (group, rename, upload files)</span>
        <ArrowRight className="w-3 h-3 flex-shrink-0 text-slate-600" />
        <span>2. Click <strong className="text-slate-300"><Layers className="w-3 h-3 inline mb-0.5" /> Create Extract</strong> to go to Extracts & Joint List</span>
        <ArrowRight className="w-3 h-3 flex-shrink-0 text-slate-600" />
        <span>3. Add callouts/highlights, then mark as Joint Exhibit</span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Search exhibits, tags..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
        </div>

        <Select value={filterSide} onValueChange={setFilterSide}>
          <SelectTrigger className="w-36 bg-[#131a2e] border-[#1e2a45] text-slate-200 h-9"><SelectValue placeholder="Side" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sides</SelectItem>
            {SIDES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterGroup} onValueChange={setFilterGroup}>
          <SelectTrigger className="w-40 bg-[#131a2e] border-[#1e2a45] text-slate-200 h-9"><SelectValue placeholder="Group" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            <SelectItem value="__none__">No Group</SelectItem>
            {allGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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

        <div className="flex gap-1">
          {[{ v: "all", l: "All" }, { v: "unmarked", l: "Unmarked" }, { v: "marked", l: "Marked" }].map(f => (
            <button key={f.v} onClick={() => setFilterMarked(f.v)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filterMarked === f.v ? "bg-cyan-600 text-white" : "bg-[#131a2e] text-slate-400 hover:text-white border border-[#1e2a45]"}`}>
              {f.l}
            </button>
          ))}
        </div>

        <div className="flex gap-1 ml-auto">
          {[{ v: "flat", l: "Flat" }, { v: "group", l: "Groups" }].map(m => (
            <button key={m.v} onClick={() => setViewMode(m.v)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === m.v ? "bg-slate-700 text-white" : "bg-[#131a2e] text-slate-500 border border-[#1e2a45]"}`}>
              {m.l}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
          <span className="text-xs text-cyan-300 font-medium">{selectedIds.size} selected</span>
          <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={() => { setTagForm({ group_name: "", tags: "" }); setTagDialog(true); }}>
            <Tag className="w-3 h-3 mr-1" /> Tag / Group
          </Button>
          <Button size="sm" className="h-7 text-xs bg-emerald-700 hover:bg-emerald-600" onClick={() => {
            // Navigate to Extracts to create an extract — if single selection use that exhibit, else just go to page
            const firstId = [...selectedIds][0];
            if (firstId) {
              navigate(createPageUrl(`Extracts?newExtractFromDepo=${firstId}`));
            } else {
              navigate(createPageUrl("Extracts"));
            }
          }}>
            <ArrowRight className="w-3 h-3 mr-1" /> Create Extract →
          </Button>
          <button onClick={clearSel} className="ml-auto text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e2a45] bg-[#0f1629]">
          <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} className="border-slate-400" />
          <button onClick={() => handleSort("no")} className="text-[10px] font-semibold text-slate-300 uppercase w-14 text-left hover:text-white flex items-center">No.<SortIcon col="no" /></button>
          <button onClick={() => handleSort("deponent")} className="text-[10px] font-semibold text-slate-300 uppercase w-28 text-left hover:text-white flex items-center">Deponent<SortIcon col="deponent" /></button>
          <button onClick={() => handleSort("title")} className="text-[10px] font-semibold text-slate-300 uppercase flex-1 text-left hover:text-white flex items-center">Title / Tags<SortIcon col="title" /></button>
          <button onClick={() => handleSort("side")} className="text-[10px] font-semibold text-slate-300 uppercase w-28 text-right hover:text-white flex items-center justify-end">Side<SortIcon col="side" /></button>
          <span className="text-[10px] font-semibold text-slate-300 uppercase w-24 text-right">Actions</span>
        </div>

        {/* Rows */}
        {viewMode === "flat" ? (
          filtered.length === 0
            ? <p className="text-sm text-slate-400 text-center py-10">No exhibits found.</p>
            : filtered.map(ex => <ExhibitRow key={ex.id} ex={ex} />)
        ) : (
          Object.entries(grouped || {}).map(([grp, items]) => {
            const isOpen = expandedGroups.has(grp);
            const jointExtractIds = new Set(joints.map(j => j.exhibit_extract_id).filter(Boolean));
            const hasExtractOnJointList = (ex) => {
              const exts = extracts.filter(e =>
                e.source_depo_exhibit_id === ex.id ||
                (e.source_depo_exhibit_ids || []).includes(ex.id)
              );
              return exts.some(e => jointExtractIds.has(e.id));
            };
            const unmarkedInGroup = items.filter(ex => !hasExtractOnJointList(ex));
            const allMarked = unmarkedInGroup.length === 0;
            // Find any extract that covers this group
            const groupExtract = extracts.find(e =>
              (e.source_depo_exhibit_ids || []).some(id => items.some(it => it.id === id)) ||
              items.some(it => it.id === e.source_depo_exhibit_id)
            );
            return (
              <div key={grp}>
                <div className="flex items-center bg-[#0f1629] border-b border-[#1e2a45]">
                  <button
                    className="flex-1 flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:text-white transition-colors text-left"
                    onClick={() => {
                      const n = new Set(expandedGroups);
                      n.has(grp) ? n.delete(grp) : n.add(grp);
                      setExpandedGroups(n);
                    }}
                  >
                    {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {grp === "__ungrouped__" ? "Ungrouped" : grp}
                    <span className="text-slate-400 font-normal ml-1">({items.length})</span>
                    {allMarked && <span className="text-[10px] text-cyan-500 font-normal ml-1">✓ all marked</span>}
                  </button>
                  {/* Group-level actions */}
                  <div className="flex items-center gap-2 pr-3">
                    {groupExtract && (
                      <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                        ✓ Extract: {groupExtract.extract_title_official || "—"}
                        {groupExtract.primary_depo_exhibit_id && (
                          <span className="text-slate-500 font-normal ml-1">
                            · primary: {(depoById[groupExtract.primary_depo_exhibit_id]?.display_title || depoById[groupExtract.primary_depo_exhibit_id]?.depo_exhibit_title || "")}
                          </span>
                        )}
                      </span>
                    )}
                    <button
                      className="text-[10px] px-2 py-1 rounded border border-slate-500 text-slate-300 hover:text-white hover:border-slate-400 transition-colors"
                      title="Select all in this group"
                      onClick={() => {
                        setSelectedIds(prev => {
                          const n = new Set(prev);
                          items.forEach(e => n.add(e.id));
                          return n;
                        });
                      }}
                    >
                      Select all
                    </button>
                    {grp !== "__ungrouped__" && (
                      <button
                        className="text-[10px] px-2 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1"
                        title="Ungroup — removes group assignment from all exhibits in this group"
                        onClick={async () => {
                          if (!confirm(`Ungroup all ${items.length} exhibits in "${grp}"?`)) return;
                          for (const ex of items) {
                            await base44.entities.DepositionExhibits.update(ex.id, { group_name: "" });
                          }
                          load();
                        }}
                      >
                        <X className="w-3 h-3" /> Ungroup
                      </button>
                    )}
                    <button
                      className={`text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                        groupExtract
                          ? "border-slate-500/40 text-slate-400 hover:bg-slate-500/10"
                          : "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                      }`}
                      title={groupExtract ? "Edit extract for this group" : "Go to Extracts page to create extract for this group"}
                      onClick={() => {
                        const first = items[0];
                        if (first) navigate(createPageUrl(`Extracts?newExtractFromDepo=${first.id}`));
                      }}
                    >
                      <ArrowRight className="w-3 h-3" /> {groupExtract ? "Edit Extract →" : "Create Extract →"}
                    </button>
                  </div>
                </div>
                {isOpen && items.map(ex => <ExhibitRow key={ex.id} ex={ex} />)}
              </div>
            );
          })
        )}
      </div>

      {/* ── Edit Exhibit Dialog ── */}
      <Dialog open={!!editDialog} onOpenChange={v => !v && setEditDialog(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
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
              <div><Label className="text-slate-400 text-xs">Title</Label>
                <Input value={editDialog.depo_exhibit_title} onChange={e => setEditDialog({ ...editDialog, depo_exhibit_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div><Label className="text-slate-400 text-xs">Display Title (rename)</Label>
                <Input value={editDialog.display_title || ""} onChange={e => setEditDialog({ ...editDialog, display_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="Leave blank to use original title" />
              </div>
              <div><Label className="text-slate-400 text-xs">Deponent Name</Label>
                <Input value={editDialog.deponent_name || ""} onChange={e => setEditDialog({ ...editDialog, deponent_name: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="e.g. Dr. Smith" />
              </div>
              <div><Label className="text-slate-400 text-xs">Referenced Page</Label>
                <Input value={editDialog.referenced_page || ""} onChange={e => setEditDialog({ ...editDialog, referenced_page: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="e.g. 42" />
              </div>
              <div><Label className="text-slate-400 text-xs">External Link <span className="text-slate-600">(Dropbox, Google Drive, etc.)</span></Label>
                <Input value={editDialog.external_link || ""} onChange={e => setEditDialog({ ...editDialog, external_link: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="https://www.dropbox.com/..." />
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
              <Input value={addForm.deponent_name} onChange={e => setAddForm({ ...addForm, deponent_name: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="e.g. Dr. Smith" />
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

      {/* ── Rename Dialog ── */}
      <Dialog open={!!renameDialog} onOpenChange={v => !v && setRenameDialog(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>Rename Exhibit</DialogTitle></DialogHeader>
          {renameDialog && (
            <div className="space-y-3">
              <div>
                <Label className="text-slate-400 text-xs">Original Title</Label>
                <p className="text-sm text-slate-500 mt-1">{renameDialog.original_title || renameDialog.depo_exhibit_title}</p>
              </div>
              <div><Label className="text-slate-400 text-xs">New Display Title</Label>
                <Input value={renameDialog.newTitle} onChange={e => setRenameDialog({ ...renameDialog, newTitle: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveRename}>Save</Button>
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
            <div><Label className="text-slate-400 text-xs">Group Name</Label>
              <Input placeholder="e.g. Medical Records" value={tagForm.group_name} onChange={e => setTagForm({ ...tagForm, group_name: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div><Label className="text-slate-400 text-xs">Tags (comma separated)</Label>
              <Input placeholder="e.g. billing, imaging, key" value={tagForm.tags} onChange={e => setTagForm({ ...tagForm, tags: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <p className="text-xs text-slate-500">Tags will be added (merged) to the selected exhibits.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialog(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveTags}>Apply</Button>
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