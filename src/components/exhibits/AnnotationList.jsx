import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Edit2, Trash2, GripVertical, ChevronDown, ChevronRight, Plus, StickyNote } from "lucide-react";
import { base44 } from "@/api/base44Client";

const KIND_ICON = { highlight: "🟡", redaction: "⬛", callout: "➡️" };
const KIND_COLOR = { highlight: "text-yellow-400", redaction: "text-slate-400", callout: "text-blue-400" };
const COLOR_DOT = { yellow: "bg-yellow-400", red: "bg-red-400", green: "bg-green-400", blue: "bg-blue-400", none: "bg-slate-400" };

export default function AnnotationList({
  annotations,
  groups,
  selectedId,
  filterKind,
  filterGroupId,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
  onAddGroup,
  presentMode,
}) {
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroup = (gid) => setCollapsedGroups(p => ({ ...p, [gid]: !p[gid] }));

  // Sort and group
  const sorted = [...annotations].sort((a, b) => {
    const pa = a.page_number ?? a.extract_page_number ?? 0;
    const pb = b.page_number ?? b.extract_page_number ?? 0;
    if (pa !== pb) return pa - pb;
    return (a.sort_index ?? 0) - (b.sort_index ?? 0);
  });

  // Apply filters
  const visible = sorted.filter(a => {
    if (filterKind && filterKind !== "all" && a.kind !== filterKind) return false;
    if (filterGroupId && filterGroupId !== "all" && a.group_id !== filterGroupId) return false;
    if (presentMode) {
      const grp = groups.find(g => g.id === a.group_id);
      if (grp && grp.audience !== "JurySafe") return false;
      if (!grp && !a.jury_safe) return false;
    }
    return true;
  });

  // Group by group_id
  const ungrouped = visible.filter(a => !a.group_id);
  const grouped = {};
  groups.forEach(g => {
    grouped[g.id] = visible.filter(a => a.group_id === g.id);
  });

  const onDragEnd = (result) => {
    if (!result.destination) return;
    onReorder && onReorder(result.source.index, result.destination.index, result.draggableId);
  };

  const AnnRow = ({ a, index, draggable }) => {
    const isSelected = selectedId === a.id;
    const page = a.page_number ?? a.extract_page_number;
    const label = a.label_text || a.label;
    const note = a.note_text;
    const kind = a.kind || "highlight";
    const color = a.color || "yellow";

    const inner = (
      <div
        className={`group flex items-start gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors
          ${isSelected ? "bg-yellow-500/15 border border-yellow-500/40" : "hover:bg-[#0f1629] border border-transparent"}`}
        onClick={() => onSelect && onSelect(a)}
      >
        {draggable && (
          <span className="mt-0.5 text-slate-700 group-hover:text-slate-500 flex-shrink-0 cursor-grab">
            <GripVertical className="w-3 h-3" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {page && (
              <span className="text-[9px] font-bold text-slate-500 bg-slate-800 rounded px-1">p.{page}</span>
            )}
            <span className="text-[10px]">{KIND_ICON[kind]}</span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${COLOR_DOT[color] || "bg-yellow-400"}`} />
            {label && <span className={`text-[10px] font-medium ${KIND_COLOR[kind]}`}>{label}</span>}
          </div>
          {note && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{note}</p>}
        </div>
        {!presentMode && (
          <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <button onClick={() => onEdit(a)} className="p-0.5 text-slate-600 hover:text-slate-200"><Edit2 className="w-3 h-3" /></button>
            <button onClick={() => onDelete(a)} className="p-0.5 text-slate-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    );
    return inner;
  };

  if (visible.length === 0) return (
    <div className="px-3 py-4 text-center text-[10px] text-slate-600 italic">
      {presentMode ? "No visible annotations." : "No annotations yet. Draw on the document to add."}
    </div>
  );

  return (
    <div className="space-y-1">
      {/* Ungrouped */}
      {ungrouped.length > 0 && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="ungrouped">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {ungrouped.map((a, i) => (
                  <Draggable key={a.id} draggableId={a.id} index={i} isDragDisabled={presentMode}>
                    {(prov) => (
                      <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                        <AnnRow a={a} index={i} draggable={!presentMode} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Groups */}
      {groups.map(g => {
        const anns = grouped[g.id] || [];
        if (anns.length === 0 && presentMode) return null;
        const collapsed = collapsedGroups[g.id];
        const audienceBadge = g.audience === "JurySafe" ? "🟢" : "🔒";
        return (
          <div key={g.id} className="border border-[#1e2a45] rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 bg-[#0f1629] hover:bg-[#111b30] text-left"
              onClick={() => toggleGroup(g.id)}
            >
              {collapsed ? <ChevronRight className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
              <span className="text-[10px] font-semibold text-slate-300 flex-1 truncate">{g.name}</span>
              <span className="text-[10px]">{audienceBadge}</span>
              <span className="text-[9px] text-slate-600">{anns.length}</span>
            </button>
            {!collapsed && (
              <div className="py-0.5 bg-[#0a0f1e]">
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId={`group-${g.id}`}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {anns.map((a, i) => (
                          <Draggable key={a.id} draggableId={a.id} index={i} isDragDisabled={presentMode}>
                            {(prov) => (
                              <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                                <AnnRow a={a} index={i} draggable={!presentMode} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}