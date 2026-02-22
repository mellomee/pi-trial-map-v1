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
import { Search, Plus, Pencil, Trash2, Tag, X, ChevronRight, ChevronDown, History } from "lucide-react";

const sideColors = {
  Plaintiff: "bg-amber-500/20 text-amber-400",
  Defense: "bg-red-500/20 text-red-400",
  Independent: "bg-purple-500/20 text-purple-400",
  Unknown: "bg-slate-500/20 text-slate-400",
};

const SIDES = ["Plaintiff", "Defense", "Independent", "Unknown"];

export default function DepositionExhibits() {
  const { activeCase } = useActiveCase();
  const [exhibits, setExhibits] = useState([]);
  const [parties, setParties] = useState([]);
  const [joints, setJoints] = useState([]);

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
  const [markDialog, setMarkDialog] = useState(false);
  const [markForm, setMarkForm] = useState({ marked_no: "", marked_title: "", marked_by_side: "Plaintiff", pages: "", primary_depo_exhibit_id: "", notes: "" });
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ depo_exhibit_no: "", depo_exhibit_title: "", provided_by_side: "Unknown", deponent_name: "", referenced_page: "", notes: "" });

  const load = async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [ex, pa, jo] = await Promise.all([
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
    ]);
    setExhibits(ex);
    setParties(pa);
    setJoints(jo);
  };

  useEffect(() => { load(); }, [activeCase]);

  const jointIds = useMemo(() => new Set(exhibits.filter(e => e.joint_exhibit_id).map(e => e.joint_exhibit_id)), [exhibits]);

  const allGroups = useMemo(() => {
    const groups = new Set(exhibits.map(e => e.group_name).filter(Boolean));
    return [...groups];
  }, [exhibits]);

  const filtered = useMemo(() => exhibits.filter(ex => {
    const title = ex.display_title || ex.depo_exhibit_title || "";
    const matchSearch = !search || title.toLowerCase().includes(search.toLowerCase()) ||
      ex.depo_exhibit_no?.toLowerCase().includes(search.toLowerCase()) ||
      (ex.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchSide = filterSide === "all" || ex.provided_by_side === filterSide;
    const matchGroup = filterGroup === "all" || ex.group_name === filterGroup || (filterGroup === "__none__" && !ex.group_name);
    const isMarked = !!ex.joint_exhibit_id;
    const matchMarked = filterMarked === "all" || (filterMarked === "marked" && isMarked) || (filterMarked === "unmarked" && !isMarked);
    return matchSearch && matchSide && matchGroup && matchMarked;
  }), [exhibits, search, filterSide, filterGroup, filterMarked]);

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

  // Mark as joint — creates ONE joint exhibit for all selected, linking them as a group
  const saveMark = async () => {
    const selectedExhibits = [...selectedIds].map(id => exhibits.find(e => e.id === id)).filter(Boolean);
    const primaryId = markForm.primary_depo_exhibit_id || selectedExhibits[0]?.id || "";
    const primaryEx = selectedExhibits.find(e => e.id === primaryId) || selectedExhibits[0];
    const joint = await base44.entities.JointExhibits.create({
      case_id: activeCase.id,
      master_exhibit_id: primaryId,
      primary_depo_exhibit_id: primaryId,
      source_depo_exhibit_ids: selectedExhibits.map(e => e.id),
      marked_no: markForm.marked_no,
      marked_title: markForm.marked_title || primaryEx?.display_title || primaryEx?.depo_exhibit_title || "",
      marked_by_side: markForm.marked_by_side,
      pages: markForm.pages,
      status: "Marked",
      notes: markForm.notes,
    });
    for (const ex of selectedExhibits) {
      await base44.entities.DepositionExhibits.update(ex.id, { joint_exhibit_id: joint.id });
    }
    setMarkDialog(false);
    clearSel();
    load();
  };

  // Remove mark
  const removeMark = async (ex) => {
    if (!confirm("Remove this exhibit from the Joint List?")) return;
    await base44.entities.JointExhibits.delete(ex.joint_exhibit_id);
    await base44.entities.DepositionExhibits.update(ex.id, { joint_exhibit_id: "" });
    load();
  };

  const del = async (id) => {
    if (!confirm("Delete this exhibit?")) return;
    await base44.entities.DepositionExhibits.delete(id);
    load();
  };

  const getParty = (pid) => { const p = parties.find(x => x.id === pid); return p ? `${p.first_name || ""} ${p.last_name}`.trim() : ""; };

  const ExhibitRow = ({ ex }) => {
    const isSelected = selectedIds.has(ex.id);
    const isMarked = !!ex.joint_exhibit_id;
    const displayTitle = ex.display_title || ex.depo_exhibit_title;
    const wasRenamed = ex.display_title && ex.display_title !== ex.depo_exhibit_title;
    const joint = joints.find(j => j.id === ex.joint_exhibit_id);

    return (
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-[#1e2a45] last:border-0 transition-colors ${isSelected ? "bg-cyan-500/5" : "hover:bg-white/[0.02]"}`}>
        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(ex.id)} className="border-slate-600 flex-shrink-0" />

        {/* Exhibit # */}
        <span className="text-xs font-mono text-slate-500 w-14 flex-shrink-0">{ex.depo_exhibit_no}</span>

        {/* Deponent */}
        <span className="text-xs text-slate-500 w-28 flex-shrink-0 truncate" title={ex.deponent_name || "—"}>
          {ex.deponent_name || <span className="text-slate-700 italic">—</span>}
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white">{displayTitle}</span>
            {wasRenamed && (
              <span className="text-[10px] text-slate-600 italic">orig: {ex.depo_exhibit_title}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Badge className={`text-[10px] ${sideColors[ex.provided_by_side]}`}>{ex.provided_by_side}</Badge>
            {ex.group_name && <Badge variant="outline" className="text-[10px] text-indigo-400 border-indigo-500/30">{ex.group_name}</Badge>}
            {(ex.tags || []).map(t => <Badge key={t} variant="outline" className="text-[10px] text-slate-500 border-slate-700">{t}</Badge>)}
            {ex.referenced_page && <span className="text-[10px] text-slate-600">p.{ex.referenced_page}</span>}
          </div>
        </div>

        {/* Joint status */}
        <div className="flex-shrink-0 text-right min-w-[110px]">
          {isMarked && joint ? (
            <div>
              <span className="text-[10px] text-cyan-400 font-semibold">Exhibit {joint.marked_no}</span>
              <span className="text-[10px] text-slate-500 block">{joint.status}</span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-700 italic">Unmarked</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button title="Edit deponent / details" onClick={() => setEditDialog({ ...ex })} className="p-1 text-slate-500 hover:text-cyan-400"><Pencil className="w-3.5 h-3.5" /></button>
          {wasRenamed && <button title="Revert name" onClick={() => revertName(ex)} className="p-1 text-slate-500 hover:text-amber-400"><History className="w-3.5 h-3.5" /></button>}
          {isMarked
            ? <button title="Remove from Joint List" onClick={() => removeMark(ex)} className="p-1 text-cyan-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
            : null
          }
          <button title="Add to Joint List (new entry)" onClick={() => { setSelectedIds(new Set([ex.id])); setMarkForm({ marked_no: "", marked_title: ex.display_title || ex.depo_exhibit_title, marked_by_side: "Plaintiff", pages: "", primary_depo_exhibit_id: ex.id, notes: "" }); setMarkDialog(true); }} className="p-1 text-slate-500 hover:text-cyan-400"><Tag className="w-3.5 h-3.5" /></button>
          <button title="Delete" onClick={() => del(ex.id)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    );
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case selected.</div>;

  const markedCount = exhibits.filter(e => e.joint_exhibit_id).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Deposition Exhibits</h1>
          <div className="flex gap-3 mt-1 text-xs text-slate-500">
            <span>{exhibits.length} total</span>
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400">{markedCount} marked</span>
          </div>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Exhibit
        </Button>
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
          <Button size="sm" className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700" onClick={() => {
            const firstId = [...selectedIds][0];
            const ex = exhibits.find(e => e.id === firstId);
            setMarkForm({ marked_no: "", marked_title: ex?.display_title || ex?.depo_exhibit_title || "", marked_by_side: "Plaintiff", notes: "" });
            setMarkDialog(true);
          }}>
            Mark as Joint Exhibit
          </Button>
          <button onClick={clearSel} className="ml-auto text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e2a45] bg-[#0f1629]">
          <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} className="border-slate-600" />
          <span className="text-[10px] font-semibold text-slate-500 uppercase w-14">No.</span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase w-28">Deponent</span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase flex-1">Title / Tags</span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase w-28 text-right">Joint Status</span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase w-24 text-right">Actions</span>
        </div>

        {/* Rows */}
        {viewMode === "flat" ? (
          filtered.length === 0
            ? <p className="text-sm text-slate-500 text-center py-10">No exhibits found.</p>
            : filtered.map(ex => <ExhibitRow key={ex.id} ex={ex} />)
        ) : (
          Object.entries(grouped || {}).map(([grp, items]) => {
            const isOpen = expandedGroups.has(grp);
            const unmarkedInGroup = items.filter(ex => !ex.joint_exhibit_id);
            const allMarked = unmarkedInGroup.length === 0;
            return (
              <div key={grp}>
                <div className="flex items-center bg-[#0f1629] border-b border-[#1e2a45]">
                  <button
                    className="flex-1 flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors text-left"
                    onClick={() => {
                      const n = new Set(expandedGroups);
                      n.has(grp) ? n.delete(grp) : n.add(grp);
                      setExpandedGroups(n);
                    }}
                  >
                    {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {grp === "__ungrouped__" ? "Ungrouped" : grp}
                    <span className="text-slate-600 font-normal ml-1">({items.length})</span>
                    {allMarked && <span className="text-[10px] text-cyan-500 font-normal ml-1">✓ all marked</span>}
                  </button>
                  {/* Group-level actions */}
                  <div className="flex items-center gap-2 pr-3">
                    <button
                      className="text-[10px] px-2 py-1 rounded border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                      title="Select all in this group"
                      onClick={() => {
                        const groupIds = new Set(items.map(e => e.id));
                        setSelectedIds(prev => {
                          const n = new Set(prev);
                          items.forEach(e => n.add(e.id));
                          return n;
                        });
                      }}
                    >
                      Select all
                    </button>
                    {!allMarked && (
                      <button
                        className="text-[10px] px-2 py-1 rounded border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 transition-colors flex items-center gap-1"
                        title="Mark entire group as Joint Exhibit"
                        onClick={() => {
                          const ids = new Set(unmarkedInGroup.map(e => e.id));
                          setSelectedIds(ids);
                          const first = unmarkedInGroup[0];
                          setMarkForm({
                            marked_no: "",
                            marked_title: grp === "__ungrouped__" ? (first?.display_title || first?.depo_exhibit_title || "") : grp,
                            marked_by_side: "Plaintiff",
                            notes: grp !== "__ungrouped__" ? `Group: ${grp}` : "",
                          });
                          setMarkDialog(true);
                        }}
                      >
                        <Tag className="w-3 h-3" /> Mark group
                      </button>
                    )}
                  </div>
                </div>
                {isOpen && items.map(ex => <ExhibitRow key={ex.id} ex={ex} />)}
              </div>
            );
          })
        )}
      </div>

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

      {/* ── Mark as Joint Dialog ── */}
      <Dialog open={markDialog} onOpenChange={setMarkDialog}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle>Add to Joint List</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              {selectedIds.size} exhibit(s) will be grouped as one joint exhibit
            </p>
          </DialogHeader>
          <div className="space-y-3">
            {/* Selected exhibits summary */}
            {selectedIds.size > 0 && (
              <div className="bg-[#0a0f1e] rounded-lg p-3 border border-[#1e2a45]">
                <p className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Source Exhibits</p>
                <div className="space-y-1">
                  {[...selectedIds].map(id => {
                    const ex = exhibits.find(e => e.id === id);
                    if (!ex) return null;
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="primary_exhibit"
                          value={id}
                          checked={markForm.primary_depo_exhibit_id === id}
                          onChange={() => setMarkForm({ ...markForm, primary_depo_exhibit_id: id })}
                          className="accent-cyan-500"
                        />
                        <span className="text-xs text-slate-300">
                          <span className="font-mono text-slate-500 mr-1">{ex.depo_exhibit_no}</span>
                          {ex.display_title || ex.depo_exhibit_title}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-600 mt-2">Select the primary exhibit whose file will be used in the joint list.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-slate-400 text-xs">Joint Exhibit Number</Label>
                <Input placeholder="e.g. 10" value={markForm.marked_no} onChange={e => setMarkForm({ ...markForm, marked_no: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div><Label className="text-slate-400 text-xs">Marked By</Label>
                <Select value={markForm.marked_by_side} onValueChange={v => setMarkForm({ ...markForm, marked_by_side: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-slate-400 text-xs">Pages to Use <span className="text-slate-600">(e.g. "3" or "1-5" or "1,3,7")</span></Label>
              <Input placeholder="Leave blank for all pages" value={markForm.pages} onChange={e => setMarkForm({ ...markForm, pages: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div><Label className="text-slate-400 text-xs">Trial Title (optional)</Label>
              <Input placeholder="Leave blank to use exhibit title" value={markForm.marked_title} onChange={e => setMarkForm({ ...markForm, marked_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div><Label className="text-slate-400 text-xs">Notes</Label>
              <Textarea value={markForm.notes} onChange={e => setMarkForm({ ...markForm, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkDialog(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveMark}>Add to Joint List</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}