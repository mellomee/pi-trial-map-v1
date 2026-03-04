import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Pencil, Trash2, ExternalLink } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";
import ProofViewerModal from "@/components/proofLibrary/ProofViewerModal";

export default function ChildrenQuestionsModal({
  isOpen,
  onClose,
  parent,
  proofItemsMap,
  calloutNames,
  calloutWitnesses,
  getPartyName,
  onEdit,
  onDelete,
  onReordered,
}) {
  const [localChildren, setLocalChildren] = useState([]);
  const [saving, setSaving] = useState(false);
  const [linkedProofsByQuestion, setLinkedProofsByQuestion] = useState({});
  const [selectedProofItem, setSelectedProofItem] = useState(null);
  const [showProofViewer, setShowProofViewer] = useState(false);

  useEffect(() => {
    if (parent?.children) {
      setLocalChildren([...parent.children].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
    }
  }, [parent]);

  useEffect(() => {
    if (isOpen && localChildren.length > 0) {
      loadLinkedProofs();
    }
  }, [isOpen, localChildren]);

  const loadLinkedProofs = async () => {
    // Load QuestionProofItems links for all children
    const childIds = localChildren.map(c => c.id);
    const proofMap = {};
    await Promise.all(childIds.map(async (qId) => {
      const links = await base44.entities.QuestionProofItems.filter({ question_id: qId });
      if (links.length > 0) {
        proofMap[qId] = links.map(l => l.proof_item_id);
      }
    }));
    setLinkedProofsByQuestion(proofMap);
  };

  const onDragEnd = async (result) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;

    const reordered = Array.from(localChildren);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);
    const withIndex = reordered.map((c, i) => ({ ...c, order_index: i }));
    setLocalChildren(withIndex);

    setSaving(true);
    try {
      for (let i = 0; i < withIndex.length; i++) {
        if (withIndex[i].order_index !== localChildren[i]?.order_index) {
          await base44.entities.Questions.update(withIndex[i].id, { order_index: i });
        }
      }
      onReordered?.();
    } finally {
      setSaving(false);
    }
  };

  if (!parent) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f1629] border-[#1e2a45] text-slate-200 max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-cyan-300 text-sm font-semibold">
            Child Questions — "{parent.question_text?.slice(0, 60)}{parent.question_text?.length > 60 ? '…' : ''}"
          </DialogTitle>
        </DialogHeader>

        {localChildren.length === 0 ? (
          <p className="text-slate-500 text-sm py-6 text-center">No child questions.</p>
        ) : (
          <div className="overflow-y-auto flex-1 pr-1">
            {saving && <p className="text-xs text-cyan-400 mb-2">Saving order…</p>}
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="children">
                {(provided) => (
                  <div className="space-y-2" {...provided.droppableProps} ref={provided.innerRef}>
                    {localChildren.map((child, idx) => {
                      const linkedProofIds = linkedProofsByQuestion[child.id] || [];

                      return (
                        <Draggable key={child.id} draggableId={child.id} index={idx}>
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={snapshot.isDragging ? "opacity-60" : ""}
                            >
                              <Card className="bg-[#131a2e] border-[#1e2a45]">
                                <CardContent className="py-3">
                                  <div className="flex items-start gap-2">
                                    <button
                                      {...dragProvided.dragHandleProps}
                                      className="text-slate-500 hover:text-slate-300 flex-shrink-0 mt-0.5"
                                    >
                                      <GripVertical className="w-3 h-3" />
                                    </button>
                                    <span className="text-xs text-slate-500 flex-shrink-0 mt-0.5">{idx + 1}.</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-white">{child.question_text}</p>
                                      <div className="flex gap-2 mt-1.5 flex-wrap">
                                        <Badge className={child.exam_type === "Direct" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                                          {child.exam_type}
                                        </Badge>
                                        <Badge variant="outline" className="text-slate-400 border-slate-600">
                                          {getPartyName(child.party_id)}
                                        </Badge>
                                        {child.question_type && (
                                          <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                                            {child.question_type}
                                          </Badge>
                                        )}
                                        <Badge variant="outline" className="text-slate-500 border-slate-600 text-xs">
                                          {child.status}
                                        </Badge>
                                      </div>
                                      {child.goal && <p className="text-xs text-slate-500 mt-1">Goal: {child.goal}</p>}

                                      {/* Linked proof from Proof Library */}
                                      {linkedProofIds.length > 0 && (
                                        <div className="mt-2 border-t border-slate-700 pt-2 space-y-1">
                                          <p className="text-[10px] font-semibold text-slate-500 uppercase">Linked Proof:</p>
                                          {linkedProofIds.map(proofId => {
                                            const proof = proofItemsMap?.[proofId];
                                            if (!proof) return (
                                              <p key={proofId} className="text-xs text-slate-500 italic">Proof #{proofId.slice(0,8)}…</p>
                                            );
                                            return (
                                              <div key={proofId} className="text-xs bg-slate-700/30 rounded p-2 flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-slate-100 font-medium">{proof.label}</p>
                                                  {proof.type === 'extract' && proof.callout_id && calloutNames?.[proof.callout_id] && (
                                                    <p className="text-slate-400">↳ {calloutNames[proof.callout_id]}</p>
                                                  )}
                                                  <p className="text-slate-500 text-[10px]">{proof.type === 'depoClip' ? 'Deposition Clip' : 'Exhibit Extract'}</p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-slate-500 hover:text-cyan-400 flex-shrink-0"
                                                  onClick={() => { setSelectedProofItem(proof); setShowProofViewer(true); }}>
                                                  <ExternalLink className="w-3 h-3" />
                                                </Button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-slate-400 hover:text-cyan-400"
                                        onClick={() => onEdit(child)}
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-slate-400 hover:text-red-400"
                                        onClick={() => {
                                          onDelete(child.id);
                                          setLocalChildren(prev => prev.filter(c => c.id !== child.id));
                                        }}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-[#1e2a45]">
          <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <ProofViewerModal
      proofItem={selectedProofItem}
      isOpen={showProofViewer}
      onClose={() => setShowProofViewer(false)}
    />
  );
}