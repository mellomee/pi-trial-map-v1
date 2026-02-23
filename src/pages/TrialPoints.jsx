import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Search, GripVertical, X } from "lucide-react";

const proofColors = {
  Missing: "border-red-500/40 text-red-400",
  Proven: "border-green-500/40 text-green-400",
  Contested: "border-amber-500/40 text-amber-400",
  Weak: "border-purple-500/40 text-purple-400",
};

const priorityOrder = { High: 0, Med: 1, Low: 2 };
const EMPTY = { point_text: "", priority: "Med", status: "Missing", notes: "", category_id: "", parent_point_id: "" };

export default function TrialPoints() {
  const { activeCase } = useActiveCase();
  const [points, setPoints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [filterProof, setFilterProof] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(new Set());

  // Drag state
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null); // parent to drop onto
  const dragOverTimer = useRef(null);

  const load = async () => {
    if (!activeCase) return;
    const [pts, cats] = await Promise.all([
      base44.entities.TrialPoints.filter({ case_id: activeCase.id }),
      base44.entities.TrialPointCategories.filter({ case_id: activeCase.id }),
    ]);
    setPoints(pts);
    setCategories(cats);
  };
  useEffect(() => { load(); }, [activeCase]);

  const save = async () => {
    const data = { ...editing, case_id: activeCase.id };
    if (!data.parent_point_id) data.parent_point_id = "";
    if (!data.category_id) data.category_id = "";
    if (data.id) await base44.entities.TrialPoints.update(data.id, data);
    else await base44.entities.TrialPoints.create(data);
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this trial point?")) return;
    await base44.entities.TrialPoints.delete(id);
    load();
  };

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // Drag handlers
  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    if (targetId === draggingId) return;
    // Don't allow dropping onto a child of the dragged item
    const dragged = points.find(p => p.id === draggingId);
    if (dragged && dragged.parent_point_id === targetId) return;
    e.dataTransfer.dropEffect = "move";
    if (dropTargetId !== targetId) {
      setDropTargetId(targetId);
      // Auto-expand if hovering over a collapsed parent
      if (dragOverTimer.current) clearTimeout(dragOverTimer.current);
      dragOverTimer.current = setTimeout(() => {
        setExpanded(prev => new Set([...prev, targetId]));
      }, 600);
    }
  };

  const handleDragLeave = () => {
    if (dragOverTimer.current) clearTimeout(dragOverTimer.current);
    setDropTargetId(null);
  };

  const handleDrop = async (e, newParentId) => {
    e.preventDefault();
    if (dragOverTimer.current) clearTimeout(dragOverTimer.current);
    setDropTargetId(null);
    if (!draggingId || draggingId === newParentId) { setDraggingId(null); return; }
    // Prevent dropping a parent onto its own child
    const isDescendant = (checkId, ancestorId) => {
      const p = points.find(x => x.id === checkId);
      if (!p || !p.parent_point_id) return false;
      if (p.parent_point_id === ancestorId) return true;
      return isDescendant(p.parent_point_id, ancestorId);
    };
    if (newParentId && isDescendant(newParentId, draggingId)) { setDraggingId(null); return; }

    await base44.entities.TrialPoints.update(draggingId, { parent_point_id: newParentId || "" });
    setDraggingId(null);
    load();
  };

  const handleDragEnd = () => {
    if (dragOverTimer.current) clearTimeout(dragOverTimer.current);
    setDraggingId(null);
    setDropTargetId(null);
  };

  const filtered = useMemo(() => points.filter(p => {
    const matchSearch = !search || p.point_text?.toLowerCase().includes(search.toLowerCase());
    const matchProof = filterProof === "all" || p.status === filterProof;
    const matchPriority = filterPriority === "all" || p.priority === filterPriority;
    return matchSearch && matchProof && matchPriority;
  }), [points, search, filterProof, filterPriority]);

  const topLevel = useMemo(() =>
    filtered.filter(p => !p.parent_point_id)
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    [filtered]);

  const childrenOf = useMemo(() => {
    const map = {};
    filtered.forEach(p => {
      if (p.parent_point_id) {
        if (!map[p.parent_point_id]) map[p.parent_point_id] = [];
        map[p.parent_point_id].push(p);
      }
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]));
    return map;
  }, [filtered]);

  const grouped = useMemo(() => {
    const uncategorized = { id: "__none__", name: "Uncategorized", points: [] };
    const catMap = {};
    categories
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      .forEach(c => { catMap[c.id] = { ...c, points: [] }; });
    topLevel.forEach(p => {
      if (p.category_id && catMap[p.category_id]) catMap[p.category_id].points.push(p);
      else uncategorized.points.push(p);
    });
    const result = Object.values(catMap).filter(c => c.points.length > 0);
    if (uncategorized.points.length > 0) result.push(uncategorized);
    return result;
  }, [topLevel, categories]);

  const PointRow = ({ p, indent = false }) => {
    const children = childrenOf[p.id] || [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(p.id);
    const isDragging = draggingId === p.id;
    const isDropTarget = dropTargetId === p.id;

    return (
      <>
        <div
          draggable
          onDragStart={e => handleDragStart(e, p.id)}
          onDragOver={e => handleDragOver(e, p.id)}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, p.id)}
          onDragEnd={handleDragEnd}
          className={`flex items-start gap-3 px-4 py-3 border-b border-[#1e2a45] last:border-0 transition-all cursor-default
            ${indent ? "pl-12 bg-[#0a0f1e]/40" : ""}
            ${isDragging ? "opacity-40" : ""}
            ${isDropTarget && !isDragging ? "bg-cyan-500/10 border-l-2 border-l-cyan-400" : "hover:bg-white/[0.02]"}
          `}
        >
          {/* Drag handle */}
          <div className="w-4 flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400">
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {/* Expand toggle */}
          <div className="w-4 flex-shrink-0 mt-0.5">
            {hasChildren ? (
              <button onClick={() => toggleExpand(p.id)} className="text-slate-500 hover:text-cyan-400">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : null}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm text-white ${indent ? "font-normal" : "font-medium"}`}>{p.point_text}</p>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${proofColors[p.status] || "text-slate-400 border-slate-600"}`}>{p.status}</Badge>
              <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600">{p.priority}</Badge>
              {hasChildren && (
                <span className="text-[10px] text-slate-500 italic">{children.length} subpoint{children.length !== 1 ? "s" : ""}</span>
              )}
              {isDropTarget && !isDragging && (
                <span className="text-[10px] text-cyan-400">Drop to make subpoint →</span>
              )}
            </div>
            {p.notes && <p className="text-xs text-slate-500 mt-1">{p.notes}</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-1 flex-shrink-0">
            {indent && (
              <button title="Promote to top-level" onClick={() => handleDrop({ preventDefault: () => {} }, "")} className="p-1 text-slate-500 hover:text-amber-400" onPointerDown={e => e.stopPropagation()}>
                <X className="w-3 h-3" />
              </button>
            )}
            <button onClick={() => { setEditing({ ...p }); setOpen(true); }} className="p-1 text-slate-400 hover:text-cyan-400">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => remove(p.id)} className="p-1 text-slate-400 hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && children.map(child => (
          <PointRow key={child.id} p={child} indent />
        ))}
      </>
    );
  };

  // Drop zone to promote a point back to top-level
  const TopLevelDropZone = () => (
    <div
      onDragOver={e => { e.preventDefault(); setDropTargetId("__root__"); }}
      onDragLeave={() => setDropTargetId(null)}
      onDrop={e => handleDrop(e, "")}
      className={`mt-2 border-2 border-dashed rounded-lg py-3 text-center text-xs transition-colors
        ${draggingId ? "border-slate-600 text-slate-600 hover:border-cyan-500 hover:text-cyan-400" : "border-transparent text-transparent"}
        ${dropTargetId === "__root__" ? "border-cyan-500 text-cyan-400 bg-cyan-500/5" : ""}
      `}
    >
      Drop here to make top-level
    </div>
  );

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Trial Points</h1>
          <p className="text-sm text-slate-500">Drag points onto each other to create subpoints</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setEditing({ ...EMPTY }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Point
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Search points..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[
            { v: "all", l: "All", type: "all" },
            { v: "High", l: "High Priority", type: "priority" },
            { v: "Proven", l: "Proven", type: "proof" },
            { v: "Contested", l: "Contested", type: "proof" },
          ].map(f => {
            const isActive = f.type === "all"
              ? filterProof === "all" && filterPriority === "all"
              : f.type === "priority" ? filterPriority === f.v
              : filterProof === f.v;
            return (
              <button key={f.v}
                onClick={() => {
                  if (f.type === "all") { setFilterProof("all"); setFilterPriority("all"); }
                  else if (f.type === "priority") { setFilterPriority(isActive ? "all" : f.v); setFilterProof("all"); }
                  else { setFilterProof(isActive ? "all" : f.v); setFilterPriority("all"); }
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${isActive ? "bg-cyan-600 text-white" : "bg-[#131a2e] text-slate-400 hover:text-white border border-[#1e2a45]"}`}>
                {f.l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grouped list */}
      <div className="space-y-4">
        {grouped.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-10">No trial points found.</p>
        )}
        {grouped.map(cat => (
          <div key={cat.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-[#0f1629] border-b border-[#1e2a45] flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{cat.name}</span>
              <span className="text-xs text-slate-500">{cat.points.length} point{cat.points.length !== 1 ? "s" : ""}</span>
            </div>
            {cat.points.map(p => (
              <PointRow key={p.id} p={p} />
            ))}
          </div>
        ))}
      </div>

      {/* Top-level drop zone — only visible while dragging a subpoint */}
      {draggingId && points.find(p => p.id === draggingId)?.parent_point_id && (
        <TopLevelDropZone />
      )}

      {/* Edit/Add Dialog — no "Sub-point of" dropdown anymore */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} Trial Point</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-slate-400 text-xs">Point</Label>
                <Textarea value={editing.point_text} onChange={e => setEditing({ ...editing, point_text: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Proof</Label>
                  <Select value={editing.status || "Missing"} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Missing", "Proven", "Contested", "Weak"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Priority</Label>
                  <Select value={editing.priority || "Med"} onValueChange={v => setEditing({ ...editing, priority: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{["High", "Med", "Low"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Category</Label>
                <Select value={editing.category_id || "__none__"} onValueChange={v => setEditing({ ...editing, category_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Notes</Label>
                <Textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
              {editing.parent_point_id && (
                <p className="text-xs text-slate-500 italic">
                  Subpoint of: "{points.find(p => p.id === editing.parent_point_id)?.point_text?.slice(0, 60)}…"
                  <button className="ml-2 text-red-400 hover:text-red-300" onClick={() => setEditing({ ...editing, parent_point_id: "" })}>Remove parent</button>
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}