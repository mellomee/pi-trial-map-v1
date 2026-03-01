import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, StickyNote, PanelLeftClose, PanelLeftOpen, Maximize2, Minimize2, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AnnotatedFileViewer from "@/components/exhibits/AnnotatedFileViewer";
import AnnotationList from "@/components/exhibits/AnnotationList";
import AnnotationEditorModal from "@/components/exhibits/AnnotationEditorModal";

const EMPTY_ANN = {
  kind: "highlight",
  color: "yellow",
  opacity: 0.35,
  label_text: "",
  note_text: "",
  quote_text: "",
  anchor_text: "",
  show_quote_in_present: true,
  page_number: null,
  geometry_json: null,
  group_id: null,
  jury_safe: false,
  sort_index: 0,
};

export default function AnnotationsSection({ extractId, extractFileUrl, presentMode = false }) {
  const [annotations, setAnnotations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [flashId, setFlashId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [filterKind, setFilterKind] = useState("all");
  const [filterGroupId, setFilterGroupId] = useState("all");
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  // Present step index
  const [presentStep, setPresentStep] = useState(0);

  // Annotations visible in present mode (sorted)
  const presentAnns = annotations
    .filter(a => {
      if (!presentMode) return true;
      const grp = groups.find(g => g.id === a.group_id);
      if (grp && grp.audience !== "JurySafe") return false;
      if (!grp && !a.jury_safe) return false;
      return true;
    })
    .sort((a, b) => {
      const pa = a.page_number ?? 0, pb = b.page_number ?? 0;
      if (pa !== pb) return pa - pb;
      return (a.sort_index ?? 0) - (b.sort_index ?? 0);
    });

  useEffect(() => {
    if (!extractId) return;
    Promise.all([
      base44.entities.ExhibitAnnotations.filter({ extract_id: extractId }),
      base44.entities.ExhibitAnnotationGroups.filter({ extract_id: extractId }),
    ]).then(([anns, grps]) => {
      setAnnotations(anns);
      setGroups(grps);
    }).finally(() => setLoading(false));
  }, [extractId]);

  // Navigate to annotation
  const flashAnnotation = useCallback((a) => {
    setSelectedId(a.id);
    setFlashId(a.id);
    setTimeout(() => setFlashId(null), 900);
  }, []);

  // Called after user draws on canvas
  const handleDrawComplete = useCallback((geometry, pageNumber, color, opacity) => {
    setEditing({
      ...EMPTY_ANN,
      kind: geometry.type === "arrow" ? "callout" : "highlight",
      color: color || "yellow",
      opacity: opacity ?? 0.35,
      page_number: pageNumber,
      geometry_json: geometry,
    });
  }, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const pg = editing.page_number ?? editing.extract_page_number;
    const payload = {
      extract_id: extractId,
      kind: editing.kind || "highlight",
      color: editing.color || "yellow",
      opacity: editing.opacity ?? 0.35,
      label_text: editing.label_text || null,
      note_text: editing.note_text || null,
      quote_text: editing.quote_text || null,
      anchor_text: editing.anchor_text || null,
      show_quote_in_present: editing.show_quote_in_present !== false,
      page_number: pg ? Number(pg) : 1,
      geometry_json: editing.geometry_json || null,
      group_id: editing.group_id || null,
      jury_safe: !!editing.jury_safe,
      sort_index: editing.sort_index ?? 0,
      // legacy compat
      extract_page_number: pg ? Number(pg) : 1,
      label: editing.label_text || null,
    };
    let result;
    if (editing.id) {
      result = await base44.entities.ExhibitAnnotations.update(editing.id, payload);
      setAnnotations(prev => prev.map(a => a.id === result.id ? result : a));
    } else {
      result = await base44.entities.ExhibitAnnotations.create(payload);
      setAnnotations(prev => [...prev, result]);
    }
    setEditing(null);
    setSaving(false);
    setTimeout(() => { flashAnnotation(result); }, 150);
  };

  const remove = async (a) => {
    if (!confirm("Delete this annotation?")) return;
    await base44.entities.ExhibitAnnotations.delete(a.id);
    setAnnotations(prev => prev.filter(x => x.id !== a.id));
    if (selectedId === a.id) setSelectedId(null);
  };

  const handleReorder = async (srcIndex, destIndex, draggableId) => {
    const sorted = [...annotations].sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0));
    const moved = sorted.splice(srcIndex, 1)[0];
    sorted.splice(destIndex, 0, moved);
    const updated = sorted.map((a, i) => ({ ...a, sort_index: i }));
    setAnnotations(updated);
    await Promise.all(
      updated
        .filter((a, i) => a.sort_index !== annotations.find(x => x.id === a.id)?.sort_index)
        .map(a => base44.entities.ExhibitAnnotations.update(a.id, { sort_index: a.sort_index }))
    );
  };

  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    const g = await base44.entities.ExhibitAnnotationGroups.create({
      extract_id: extractId,
      name: newGroupName.trim(),
      purpose: "Support",
      audience: "Internal",
      sort_index: groups.length,
    });
    setGroups(prev => [...prev, g]);
    setNewGroupName("");
    setShowNewGroup(false);
  };

  // Present step nav
  const goToStep = useCallback((idx) => {
    const clipped = Math.max(0, Math.min(presentAnns.length - 1, idx));
    setPresentStep(clipped);
    if (presentAnns[clipped]) flashAnnotation(presentAnns[clipped]);
  }, [presentAnns, flashAnnotation]);

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-[#0a0f1e] flex flex-col"
    : "mt-3 pt-3 border-t border-[#1e2a45]";

  return (
    <div className={containerClass}>
      {/* Fullscreen / section header */}
      <div className="flex items-center justify-between px-1 pb-2">
        {!presentMode && (
          <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-1">
            <StickyNote className="w-3 h-3" /> Annotations {annotations.length > 0 && `(${annotations.length})`}
          </p>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {!presentMode && (
            <>
              <button onClick={() => setFullscreen(v => !v)} className="p-1 text-slate-500 hover:text-slate-200" title="Toggle fullscreen">
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button onClick={() => setPanelOpen(v => !v)} className="p-1 text-slate-500 hover:text-slate-200" title="Toggle annotation panel">
                {panelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main two-column layout */}
      <div className={`flex gap-3 ${fullscreen ? "flex-1 overflow-hidden" : ""}`}>
        {/* Left panel: annotation list */}
        {(!presentMode && panelOpen) && (
          <div className={`flex flex-col gap-2 border border-[#1e2a45] rounded-xl bg-[#080d1a] ${fullscreen ? "w-64 overflow-y-auto flex-shrink-0" : "w-56 flex-shrink-0"}`}>
            {/* Panel header + filters */}
            <div className="p-2 border-b border-[#1e2a45] space-y-1.5">
              <div className="flex items-center gap-1">
                <Select value={filterKind} onValueChange={setFilterKind}>
                  <SelectTrigger className="h-6 text-[10px] bg-transparent border-[#1e2a45] text-slate-400 flex-1">
                    <SelectValue placeholder="Kind" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All kinds</SelectItem>
                    <SelectItem value="highlight">Highlight</SelectItem>
                    <SelectItem value="redaction">Redaction</SelectItem>
                    <SelectItem value="callout">Callout</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterGroupId} onValueChange={setFilterGroupId}>
                  <SelectTrigger className="h-6 text-[10px] bg-transparent border-[#1e2a45] text-slate-400 flex-1">
                    <SelectValue placeholder="Group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All groups</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => setEditing({ ...EMPTY_ANN })}
                  className="h-6 flex-1 px-1 text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 gap-0.5">
                  <Plus className="w-3 h-3" /> Add
                </Button>
                <Button size="sm" onClick={() => setShowNewGroup(v => !v)}
                  className="h-6 px-1 text-[10px] bg-slate-700/30 text-slate-400 border border-slate-700/40 hover:bg-slate-700/50">
                  + Group
                </Button>
              </div>
              {showNewGroup && (
                <div className="flex gap-1">
                  <Input
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    placeholder="Group name…"
                    className="h-6 text-[10px] bg-[#0a0f1e] border-[#1e2a45] text-slate-200 flex-1"
                    onKeyDown={e => e.key === "Enter" && addGroup()}
                  />
                  <Button size="sm" onClick={addGroup} className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700">OK</Button>
                </div>
              )}
            </div>
            {/* Annotation rows */}
            <div className="flex-1 overflow-y-auto p-1">
              {loading ? (
                <p className="text-[10px] text-slate-600 px-2 py-3">Loading…</p>
              ) : (
                <AnnotationList
                  annotations={annotations}
                  groups={groups}
                  selectedId={selectedId}
                  filterKind={filterKind}
                  filterGroupId={filterGroupId}
                  onSelect={flashAnnotation}
                  onEdit={a => setEditing({ ...a })}
                  onDelete={remove}
                  onReorder={handleReorder}
                  presentMode={false}
                />
              )}
            </div>
          </div>
        )}

        {/* Right: document viewer */}
        <div className={`flex-1 min-w-0 ${fullscreen ? "overflow-hidden" : ""}`}>
          {extractFileUrl ? (
            <AnnotatedFileViewer
              fileUrl={extractFileUrl}
              annotations={annotations}
              presentMode={presentMode}
              flashAnnotationId={flashId}
              selectedAnnotationId={selectedId}
              onDrawComplete={handleDrawComplete}
              onSelectAnnotation={(id) => {
                setSelectedId(id);
                const a = annotations.find(x => x.id === id);
                if (a) setFlashId(id);
                setTimeout(() => setFlashId(null), 900);
              }}
              onPrevAnnotation={() => goToStep(presentStep - 1)}
              onNextAnnotation={() => goToStep(presentStep + 1)}
              currentPresentStep={presentStep}
              totalPresentSteps={presentAnns.length}
            />
          ) : (
            <div className="flex items-center justify-center h-40 text-slate-600 text-sm italic border border-dashed border-[#1e2a45] rounded-xl">
              No file attached.
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      <AnnotationEditorModal
        editing={editing}
        setEditing={setEditing}
        onSave={save}
        saving={saving}
        groups={groups}
      />
    </div>
  );
}