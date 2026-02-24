import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Search, GripVertical, X, Printer, ChevronUp } from "lucide-react";

const ELEMENT_OPTIONS = ["Duty", "Breach", "Causation", "Damages", "Comparable Fault"];

const ELEMENT_COLORS = {
  Duty: "bg-blue-900/40 text-blue-300 border-blue-700/40",
  Breach: "bg-orange-900/40 text-orange-300 border-orange-700/40",
  Causation: "bg-purple-900/40 text-purple-300 border-purple-700/40",
  Damages: "bg-green-900/40 text-green-300 border-green-700/40",
  "Comparable Fault": "bg-red-900/40 text-red-300 border-red-700/40",
};

const proofColors = {
  Missing: "border-red-500/40 text-red-400",
  Proven: "border-green-500/40 text-green-400",
  Contested: "border-amber-500/40 text-amber-400",
  Weak: "border-purple-500/40 text-purple-400",
};

const EMPTY = { point_text: "", priority: "Med", status: "Missing", notes: "", category_id: "", parent_point_id: "", elements: [], order_index: 0 };

// Reorder helper
function reorder(list, startIndex, endIndex) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

export default function TrialPoints() {
  const { activeCase } = useActiveCase();
  const [points, setPoints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [filterProof, setFilterProof] = useState("all");
  const [filterElement, setFilterElement] = useState("all");
  const [filterCategories, setFilterCategories] = useState([]); // empty = all
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [dragOverParentId, setDragOverParentId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const load = async () => {
    if (!activeCase) return;
    const [pts, cats] = await Promise.all([
      base44.entities.TrialPoints.filter({ case_id: activeCase.id }),
      base44.entities.TrialPointCategories.filter({ case_id: activeCase.id }),
    ]);
    // Sort by order_index
    pts.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    setPoints(pts);
    setCategories(cats);
  };

  useEffect(() => { load(); }, [activeCase]);

  const save = async () => {
    const data = { ...editing, case_id: activeCase.id };
    if (!data.parent_point_id) data.parent_point_id = "";
    if (!data.category_id) data.category_id = "";
    if (!data.elements) data.elements = [];
    if (data.id) await base44.entities.TrialPoints.update(data.id, data);
    else {
      // Assign order_index at end
      const siblings = points.filter(p => !p.parent_point_id && p.category_id === (data.category_id || ""));
      data.order_index = siblings.length;
      await base44.entities.TrialPoints.create(data);
    }
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

  const expandAll = () => {
    const parentIds = points.filter(p => !p.parent_point_id).map(p => p.id);
    setExpanded(new Set(parentIds));
    return parentIds;
  };

  const toggleCategoryFilter = (catId) => {
    setFilterCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const toggleElement = (el) => {
    setEditing(prev => {
      const els = prev.elements || [];
      return { ...prev, elements: els.includes(el) ? els.filter(e => e !== el) : [...els, el] };
    });
  };

  // Persist new order after reorder
  const persistOrder = useCallback(async (reorderedIds) => {
    await Promise.all(
      reorderedIds.map((id, idx) => base44.entities.TrialPoints.update(id, { order_index: idx }))
    );
  }, []);

  // Move a parent point up or down within its category
  const moveParent = async (pointId, direction) => {
    const pt = points.find(p => p.id === pointId);
    if (!pt) return;
    const catKey = pt.category_id || "";
    const siblings = points
      .filter(p => !p.parent_point_id && (p.category_id || "") === catKey)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    const idx = siblings.findIndex(p => p.id === pointId);
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const reorderedIds = reordered.map(p => p.id);
    setPoints(prev => {
      const others = prev.filter(p => !reorderedIds.includes(p.id));
      const updated = reordered.map((p, i) => ({ ...p, order_index: i }));
      return [...others, ...updated];
    });
    await persistOrder(reorderedIds);
  };

  const onNativeDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const onNativeDragEnd = () => {
    setDraggingId(null);
    setDragOverParentId(null);
  };

  const onNativeDragOver = (e, parentId) => {
    if (draggingId === parentId) return; // can't drop on itself
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverParentId(parentId);
  };

  const onNativeDragLeave = () => {
    setDragOverParentId(null);
  };

  const onNativeDrop = async (e, parentId) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData("text/plain");
    if (!droppedId || droppedId === parentId) return;
    setDragOverParentId(null);
    setDraggingId(null);
    // Make droppedId a subpoint of parentId
    const droppedPt = points.find(p => p.id === droppedId);
    if (!droppedPt) return;
    // Get children of target parent to assign order_index
    const existingChildren = points.filter(p => p.parent_point_id === parentId);
    await base44.entities.TrialPoints.update(droppedId, {
      parent_point_id: parentId,
      order_index: existingChildren.length,
    });
    load();
  };

  // Move any point up or down among its siblings (works for any depth)
  const movePoint = async (pointId, direction) => {
    const pt = points.find(p => p.id === pointId);
    if (!pt) return;
    const siblings = points
      .filter(p => (p.parent_point_id || "") === (pt.parent_point_id || "") && (!pt.parent_point_id ? !(p.parent_point_id) : true))
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    const idx = siblings.findIndex(p => p.id === pointId);
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const reorderedIds = reordered.map(p => p.id);
    setPoints(prev => {
      const others = prev.filter(p => !reorderedIds.includes(p.id));
      const updated = reordered.map((p, i) => ({ ...p, order_index: i }));
      return [...others, ...updated];
    });
    await persistOrder(reorderedIds);
  };

  const filtered = useMemo(() => points.filter(p => {
    const matchSearch = !search || p.point_text?.toLowerCase().includes(search.toLowerCase());
    const matchProof = filterProof === "all" || p.status === filterProof;
    const matchElement = filterElement === "all" || (p.elements || []).includes(filterElement);
    return matchSearch && matchProof && matchElement;
  }), [points, search, filterProof, filterElement]);

  const childrenOf = useMemo(() => {
    const map = {};
    points.forEach(p => {
      if (p.parent_point_id) {
        if (!map[p.parent_point_id]) map[p.parent_point_id] = [];
        map[p.parent_point_id].push(p);
      }
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
    return map;
  }, [points]);

  const topLevelFiltered = useMemo(() =>
    filtered.filter(p => !p.parent_point_id)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
    [filtered]);

  const grouped = useMemo(() => {
    const uncategorized = { id: "__none__", name: "Uncategorized", points: [] };
    const catMap = {};
    categories
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      .forEach(c => { catMap[c.id] = { ...c, points: [] }; });
    topLevelFiltered.forEach(p => {
      if (p.category_id && catMap[p.category_id]) catMap[p.category_id].points.push(p);
      else uncategorized.points.push(p);
    });
    let result = Object.values(catMap).filter(c => c.points.length > 0);
    if (uncategorized.points.length > 0) result.push(uncategorized);
    // Apply category visibility filter
    if (filterCategories.length > 0) {
      result = result.filter(c => filterCategories.includes(c.id));
    }
    return result;
  }, [topLevelFiltered, categories, filterCategories]);

  const handlePrint = () => {
    // Build full HTML for print in a new window so the entire list renders, not just viewport
    const allParents = points
      .filter(p => !p.parent_point_id)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    // Apply category filter
    const visibleParents = filterCategories.length > 0
      ? allParents.filter(p => filterCategories.includes(p.category_id || "__none__"))
      : allParents;

    // Build category groups
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c.name; });

    const grouped = [];
    const catGroupMap = {};
    visibleParents.forEach(p => {
      const catId = p.category_id || "__none__";
      const catName = catMap[p.category_id] || "Uncategorized";
      if (!catGroupMap[catId]) { catGroupMap[catId] = { name: catName, points: [] }; grouped.push(catGroupMap[catId]); }
      catGroupMap[catId].points.push(p);
    });

    const childMap = {};
    points.forEach(p => {
      if (p.parent_point_id) {
        if (!childMap[p.parent_point_id]) childMap[p.parent_point_id] = [];
        childMap[p.parent_point_id].push(p);
      }
    });
    Object.values(childMap).forEach(arr => arr.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));

    const renderPoint = (p, indent = false) => {
      const children = childMap[p.id] || [];
      const childrenHtml = children.map(c => renderPoint(c, true)).join("");
      const els = (p.elements || []).join(", ");
      return `
        <div style="padding: ${indent ? "5px 0 5px 28px" : "8px 0"}; border-bottom: 1px solid #ddd; break-inside: avoid;">
          <div style="font-size: 13px; font-weight: ${indent ? "normal" : "600"}; margin-bottom: 3px;">${p.point_text}</div>
          <div style="font-size: 10px; color: #555;">
            ${p.status} · ${p.priority}${els ? " · " + els : ""}${p.notes ? " — " + p.notes : ""}
          </div>
        </div>
        ${childrenHtml}
      `;
    };

    const bodyHtml = grouped.map(cat => `
      <div style="margin-bottom: 20px; break-inside: avoid;">
        <div style="background: #eee; padding: 6px 10px; font-size: 11px; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; border-radius: 4px 4px 0 0; border: 1px solid #ccc;">
          ${cat.name}
        </div>
        <div style="border: 1px solid #ccc; border-top: none; border-radius: 0 0 4px 4px; padding: 0 12px;">
          ${cat.points.map(p => renderPoint(p)).join("")}
        </div>
      </div>
    `).join("");

    const html = `<!DOCTYPE html><html><head><title>${activeCase.name} — Trial Points</title>
      <style>body{font-family:sans-serif;padding:20px;color:#111;} @media print{@page{margin:1cm;}}</style>
    </head><body>
      <h2 style="margin-bottom:4px;">${activeCase.name}</h2>
      <h3 style="margin-top:0;margin-bottom:16px;color:#444;">Trial Points</h3>
      ${bodyHtml}
    </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-area { color: black !important; background: white !important; }
          .print-row { border-bottom: 1px solid #ccc; padding: 6px 0; break-inside: avoid; }
          .print-child { padding-left: 24px; }
          .print-badge { border: 1px solid #999; border-radius: 4px; padding: 1px 5px; font-size: 10px; margin-right: 4px; }
        }
      `}</style>

      <div className="p-6 print-area">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 no-print">
          <div>
            <h1 className="text-2xl font-bold text-white">Trial Points</h1>
            <p className="text-sm text-slate-500">Use ↑↓ arrows to reorder • Drag the grip handle onto another point to make it a subpoint</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setEditing({ ...EMPTY }); setOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Add Point
            </Button>
          </div>
        </div>

        {/* Print title */}
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold">{activeCase.name} — Trial Points</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-5 no-print">
          {/* Row 1: search + proof + element */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <Input placeholder="Search points..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
            </div>
            <div className="flex gap-1 flex-wrap items-center">
              {["all", "Proven", "Contested", "Missing", "Weak"].map(v => (
                <button key={v}
                  onClick={() => setFilterProof(v)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filterProof === v ? "bg-cyan-600 text-white" : "bg-[#131a2e] text-slate-400 hover:text-white border border-[#1e2a45]"}`}>
                  {v === "all" ? "All Proof" : v}
                </button>
              ))}
              <span className="text-slate-600 text-xs">|</span>
              <Select value={filterElement} onValueChange={setFilterElement}>
                <SelectTrigger className="bg-[#131a2e] border-[#1e2a45] text-slate-300 text-xs h-8 w-44">
                  <SelectValue placeholder="Filter by Element" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Elements</SelectItem>
                  {ELEMENT_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Row 2: Category filter */}
          {categories.length > 0 && (
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-xs text-slate-500 font-medium">Categories:</span>
              <button
                onClick={() => setFilterCategories([])}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filterCategories.length === 0 ? "bg-cyan-600 text-white" : "bg-[#131a2e] text-slate-400 hover:text-white border border-[#1e2a45]"}`}>
                All
              </button>
              {categories.sort((a,b)=>(a.order_index||0)-(b.order_index||0)).map(c => (
                <button key={c.id}
                  onClick={() => toggleCategoryFilter(c.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filterCategories.includes(c.id) ? "bg-indigo-600 text-white" : "bg-[#131a2e] text-slate-400 hover:text-white border border-[#1e2a45]"}`}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
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
              <div>
                {cat.points.map((p, idx) => (
                  <ParentRow
                    key={p.id}
                    p={p}
                    idx={idx}
                    total={cat.points.length}
                    children={childrenOf[p.id] || []}
                    expanded={expanded}
                    toggleExpand={toggleExpand}
                    onEdit={() => { setEditing({ ...p, elements: p.elements || [] }); setOpen(true); }}
                    onRemove={() => remove(p.id)}
                    onMoveUp={() => moveParent(p.id, "up")}
                    onMoveDown={() => moveParent(p.id, "down")}
                    onDragStart={onNativeDragStart}
                    onDragEnd={onNativeDragEnd}
                    onDragOver={onNativeDragOver}
                    onDragLeave={onNativeDragLeave}
                    onDrop={onNativeDrop}
                    isDragOver={dragOverParentId === p.id}
                    isDragging={draggingId === p.id}
                    onEditChild={(child) => { setEditing({ ...child, elements: child.elements || [] }); setOpen(true); }}
                    onRemoveChild={(id) => remove(id)}
                    onMoveChildUp={(id) => moveChild(id, "up")}
                    onMoveChildDown={(id) => moveChild(id, "down")}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Edit/Add Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-h-[90vh] overflow-y-auto">
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
                  <Label className="text-slate-400 text-xs mb-1 block">Elements</Label>
                  <div className="flex flex-wrap gap-2">
                    {ELEMENT_OPTIONS.map(el => {
                      const selected = (editing.elements || []).includes(el);
                      return (
                        <button
                          key={el}
                          type="button"
                          onClick={() => toggleElement(el)}
                          className={`px-2.5 py-1 rounded text-xs border transition-colors ${selected ? ELEMENT_COLORS[el] + " border-opacity-100" : "border-slate-700 text-slate-500 hover:text-slate-300"}`}
                        >
                          {el}
                        </button>
                      );
                    })}
                  </div>
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
    </>
  );
}

function ParentRow({
  p, idx, total, children, expanded, toggleExpand,
  onEdit, onRemove, onMoveUp, onMoveDown,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  isDragOver, isDragging,
  onEditChild, onRemoveChild, onMoveChildUp, onMoveChildDown,
}) {
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(p.id);

  return (
    <div
      className={`border-b border-[#1e2a45] last:border-0 transition-colors ${isDragging ? "opacity-50" : ""} ${isDragOver ? "bg-cyan-900/30 border-cyan-500/50" : ""}`}
      draggable={false}
      onDragOver={(e) => onDragOver(e, p.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, p.id)}
    >
      <div className="flex items-start gap-2 px-4 py-3 hover:bg-white/[0.02]">
        {/* Drag handle — dragging this point to make it a subpoint of another */}
        <div
          draggable
          onDragStart={(e) => onDragStart(e, p.id)}
          onDragEnd={onDragEnd}
          className="w-4 flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400"
          title="Drag onto another point to make it a subpoint"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Up/Down arrows for reordering */}
        <div className="flex flex-col flex-shrink-0 gap-0.5 no-print">
          <button
            onClick={onMoveUp}
            disabled={idx === 0}
            className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={idx === total - 1}
            className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
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
          <p className="text-sm text-white font-medium">{p.point_text}</p>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${proofColors[p.status] || "text-slate-400 border-slate-600"}`}>{p.status}</Badge>
            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600">{p.priority}</Badge>
            {(p.elements || []).map(el => (
              <span key={el} className={`text-[10px] px-1.5 py-0.5 rounded border ${ELEMENT_COLORS[el] || "text-slate-400 border-slate-600"}`}>{el}</span>
            ))}
            {hasChildren && (
              <span className="text-[10px] text-slate-500 italic">{children.length} subpoint{children.length !== 1 ? "s" : ""}</span>
            )}
          </div>
          {p.notes && <p className="text-xs text-slate-500 mt-1">{p.notes}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0 no-print">
          <button onClick={onEdit} className="p-1 text-slate-400 hover:text-cyan-400"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onRemove} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Drop hint */}
      {isDragOver && (
        <div className="text-xs text-cyan-400 text-center pb-2 italic">Drop to make a subpoint</div>
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {children.map((child, cidx) => (
            <div
              key={child.id}
              className="flex items-start gap-2 pl-12 pr-4 py-2.5 border-t border-[#1e2a45] bg-[#0a0f1e]/40 hover:bg-white/[0.02]"
            >
              {/* Up/Down for children */}
              <div className="flex flex-col flex-shrink-0 gap-0.5 no-print">
                <button
                  onClick={() => onMoveChildUp(child.id)}
                  disabled={cidx === 0}
                  className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onMoveChildDown(child.id)}
                  disabled={cidx === children.length - 1}
                  className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <div className="w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{child.point_text}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${proofColors[child.status] || "text-slate-400 border-slate-600"}`}>{child.status}</Badge>
                  <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-600">{child.priority}</Badge>
                  {(child.elements || []).map(el => (
                    <span key={el} className={`text-[10px] px-1.5 py-0.5 rounded border ${ELEMENT_COLORS[el] || "text-slate-400 border-slate-600"}`}>{el}</span>
                  ))}
                </div>
                {child.notes && <p className="text-xs text-slate-500 mt-1">{child.notes}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0 no-print">
                <button onClick={() => onEditChild(child)} className="p-1 text-slate-400 hover:text-cyan-400"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => onRemoveChild(child.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}