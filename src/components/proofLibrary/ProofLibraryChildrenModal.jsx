import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Pencil, Trash2, Link2, ExternalLink } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";
import ProofViewerModal from "@/components/proofLibrary/ProofViewerModal";
import AddQuestionProofModal from "@/components/proofLibrary/AddQuestionProofModal.jsx";

export default function ProofLibraryChildrenModal({
  isOpen,
  onClose,
  parent,
  allQuestions,
  evidenceGroupId,
  caseId,
  allWitnesses,
  proofItems,
  calloutNames,
  calloutWitnesses,
  onEdit,
  onDelete,
  onReordered,
}) {
  const [localChildren, setLocalChildren] = useState([]);
  const [saving, setSaving] = useState(false);
  const [linkedProofsByQuestion, setLinkedProofsByQuestion] = useState({});
  const [selectedProofItem, setSelectedProofItem] = useState(null);
  const [showProofDetails, setShowProofDetails] = useState(false);
  const [showAddProofModal, setShowAddProofModal] = useState(false);
  const [selectedQuestionForProof, setSelectedQuestionForProof] = useState(null);
  const [proofItemsCache, setProofItemsCache] = useState({});

  useEffect(() => {
    const cache = {};
    proofItems.forEach(p => { cache[p.id] = p; });
    setProofItemsCache(cache);
  }, [proofItems]);

  useEffect(() => {
    if (parent && allQuestions) {
      const children = allQuestions
        .filter(q => q.parent_id === parent.id)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setLocalChildren(children);
    }
  }, [parent, allQuestions]);

  useEffect(() => {
    if (isOpen && evidenceGroupId) loadLinkedProofs();
  }, [isOpen, evidenceGroupId, localChildren]);

  const loadLinkedProofs = async () => {
    if (!evidenceGroupId) return;
    const links = await base44.entities.QuestionProofItems.filter({ evidence_group_id: evidenceGroupId });
    const proofMap = {};
    links.forEach(link => {
      if (!proofMap[link.question_id]) proofMap[link.question_id] = [];
      proofMap[link.question_id].push(link.proof_item_id);
    });
    setLinkedProofsByQuestion(proofMap);
  };

  const getWitnessName = (partyId) => {
    const p = allWitnesses.find(w => w.id === partyId);
    return p ? (p.display_name || `${p.first_name} ${p.last_name}`.trim()) : '';
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
    await Promise.all(withIndex.map((c, i) => base44.entities.Questions.update(c.id, { order_index: i })));
    setSaving(false);
    onReordered?.();
  };

  const handleUnlinkProof = async (questionId, proofId) => {
    // Find the QuestionProofItems link
    const links = await base44.entities.QuestionProofItems.filter({ question_id: questionId, proof_item_id: proofId });
    for (const link of links) {
      await base44.entities.QuestionProofItems.delete(link.id);
    }
    setLinkedProofsByQuestion(prev => ({
      ...prev,
      [questionId]: (prev[questionId] || []).filter(id => id !== proofId),
    }));
  };

  if (!parent) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-[#0f1629] border-[#1e2a45] text-slate-200 max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-cyan-300 text-sm font-semibold">
              Child Questions — "{parent.question_text?.slice(0, 60)}{parent.question_text?.length > 60 ? '…' : ''}"
            </DialogTitle>
          </DialogHeader>

          {localChildren.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">No child questions yet.</p>
          ) : (
            <div className="overflow-y-auto flex-1 pr-1">
              {saving && <p className="text-xs text-cyan-400 mb-2">Saving order…</p>}
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="pl-children">
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
                                          <Badge className={child.exam_type === "Direct" ? "bg-green-500/20 text-green-400 text-xs" : "bg-red-500/20 text-red-400 text-xs"}>
                                            {child.exam_type}
                                          </Badge>
                                          {child.question_type && (
                                            <Badge className="bg-purple-500/20 text-purple-400 text-xs">{child.question_type}</Badge>
                                          )}
                                          <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">
                                            {getWitnessName(child.party_id)}
                                          </Badge>
                                        </div>
                                        {child.goal && <p className="text-xs text-slate-500 mt-1">Goal: {child.goal}</p>}

                                        {/* Linked proof */}
                                        {linkedProofIds.length > 0 && (
                                          <div className="mt-2 border-t border-slate-700 pt-2 space-y-1">
                                            <p className="text-[10px] font-semibold text-slate-500 uppercase">Linked Proof:</p>
                                            {linkedProofIds.map(proofId => {
                                              const proof = proofItemsCache[proofId] || proofItems.find(p => p.id === proofId);
                                              if (!proof) return null;
                                              return (
                                                <div key={proofId} className="flex items-start justify-between gap-2 bg-slate-700/30 rounded p-2 text-xs">
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-slate-100 font-medium truncate">{proof.label}</p>
                                                    {proof.type === 'extract' && proof.callout_id && calloutNames?.[proof.callout_id] && (
                                                      <p className="text-slate-400">↳ {calloutNames[proof.callout_id]}</p>
                                                    )}
                                                  </div>
                                                  <div className="flex gap-1 flex-shrink-0">
                                                    <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-slate-500 hover:text-cyan-400"
                                                      onClick={() => { setSelectedProofItem(proof); setShowProofDetails(true); }}>
                                                      <ExternalLink className="w-3 h-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-slate-500 hover:text-red-400"
                                                      onClick={() => handleUnlinkProof(child.id, proofId)}>
                                                      <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex gap-1 flex-shrink-0">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-cyan-400"
                                          title="Link proof"
                                          onClick={() => { setSelectedQuestionForProof(child); setShowAddProofModal(true); }}>
                                          <Link2 className="w-3 h-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-cyan-400"
                                          onClick={() => onEdit(child)}>
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400"
                                          onClick={() => {
                                            onDelete(child.id);
                                            setLocalChildren(prev => prev.filter(c => c.id !== child.id));
                                          }}>
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
            <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProofViewerModal proofItem={selectedProofItem} isOpen={showProofDetails} onClose={() => setShowProofDetails(false)} />

      {selectedQuestionForProof && (
        <AddQuestionProofModal
          isOpen={showAddProofModal}
          onClose={() => { setShowAddProofModal(false); setSelectedQuestionForProof(null); }}
          question={selectedQuestionForProof}
          evidenceGroupId={evidenceGroupId}
          caseId={caseId}
          onProofLinked={async () => {
            setShowAddProofModal(false);
            setSelectedQuestionForProof(null);
            await loadLinkedProofs();
          }}
        />
      )}
    </>
  );
}