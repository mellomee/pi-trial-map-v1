import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Search, GripVertical, ExternalLink, Link2, X } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ProofViewerModal from "@/components/proofLibrary/ProofViewerModal";
import ProofLinkingModal from "@/components/questions/ProofLinkingModal";

const EMPTY = {
  party_id: "",
  evidence_group_id: "",
  exam_type: "Direct",
  question_text: "",
  goal: "",
  expected_answer: "",
  status: "NotAsked",
  answer_quality: "",
  admission_obtained: false,
  live_notes: "",
  is_branch_root: false,
  branch_prompt: "",
  importance: "Med",
  ask_if_time: true,
};

export default function Questions() {
  const { activeCase } = useActiveCase();
  const [questions, setQuestions] = useState([]);
  const [parties, setParties] = useState([]);
  const [evidenceGroups, setEvidenceGroups] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedBucketId, setSelectedBucketId] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [showProofModal, setShowProofModal] = useState(false);
  const [tempQuestionData, setTempQuestionData] = useState(null); // for proof linking in create modal
  const [questionProofs, setQuestionProofs] = useState({});
  const [calloutNames, setCalloutNames] = useState({});
  const [calloutWitnesses, setCalloutWitnesses] = useState({});
  const [proofItemsMap, setProofItemsMap] = useState({});
  const [selectedProofItem, setSelectedProofItem] = useState(null);
  const [showProofViewer, setShowProofViewer] = useState(false);
  const [newlyCreatedQuestionId, setNewlyCreatedQuestionId] = useState(null);
  const [showProofLinking, setShowProofLinking] = useState(false);
  const [proofLinkingQuestion, setProofLinkingQuestion] = useState(null);
  const [allProofItems, setAllProofItems] = useState([]);
  const scrollRef = useRef(null);

  const load = async () => {
    if (!activeCase) return;
    const [q, p, eg] = await Promise.all([
      base44.entities.Questions.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
      base44.entities.EvidenceGroups.filter({ case_id: activeCase.id }),
    ]);
    setQuestions(q);
    setParties(p);
    setEvidenceGroups(eg);

    // Load question-proof links
    const allQPLinks = await base44.entities.QuestionProofItems.filter({ case_id: activeCase.id });
    const qMap = {};
    const cnMap = {};
    const cwMap = {};
    const proofMap = {};

    allQPLinks.forEach(link => {
      if (!qMap[link.question_id]) qMap[link.question_id] = [];
      qMap[link.question_id].push(link.proof_item_id);
    });
    setQuestionProofs(qMap);

    const uniqueProofIds = [...new Set(allQPLinks.map(l => l.proof_item_id))];
    if (uniqueProofIds.length > 0) {
      try {
        const proofs = await base44.entities.ProofItems.filter({ id: { $in: uniqueProofIds } });
        proofs.forEach(pf => proofMap[pf.id] = pf);

        const calloutIds = proofs.filter(pf => pf.callout_id).map(pf => pf.callout_id);
        if (calloutIds.length > 0) {
          const callouts = await base44.entities.Callouts.filter({ id: { $in: calloutIds } });
          callouts.forEach(c => cnMap[c.id] = c.name);
          
          const witnessIds = [...new Set(callouts.filter(c => c.witness_id).map(c => c.witness_id))];
          if (witnessIds.length > 0) {
            const witnesses = await base44.entities.Parties.filter({ id: { $in: witnessIds } });
            callouts.forEach(c => {
              if (c.witness_id) {
                const wit = witnesses.find(w => w.id === c.witness_id);
                cwMap[c.id] = wit ? (wit.display_name || `${wit.first_name} ${wit.last_name}`.trim()) : null;
              }
            });
          }
        }
      } catch (err) {
        console.error('Error loading proof details:', err);
      }
    }
    setCalloutNames(cnMap);
    setCalloutWitnesses(cwMap);
    setProofItemsMap(proofMap);

    // Load all proof items for the case
    const allProofs = await base44.entities.ProofItems.filter({ case_id: activeCase.id });
    setAllProofItems(allProofs);
  };

  useEffect(() => {
    load();
  }, [activeCase]);

  const save = async () => {
    const data = { ...editing, case_id: activeCase.id };
    if (editing.id) {
      await base44.entities.Questions.update(editing.id, data);
      setQuestions(qs => qs.map(q => q.id === editing.id ? { ...q, ...data } : q));
    } else {
      // For new questions, assign order_index as the highest for this witness + 1
      const witnessQs = questions.filter(q => q.party_id === editing.party_id);
      const maxOrder = witnessQs.length > 0 ? Math.max(...witnessQs.map(q => q.order_index || 0)) : -1;
      const newQ = await base44.entities.Questions.create({ ...data, order_index: maxOrder + 1 });
      setQuestions(qs => [...qs, newQ]);
      setNewlyCreatedQuestionId(newQ.id);
    }
    setOpen(false);
    setEditing(null);
    setModalKey(k => k + 1);
  };

  const remove = async (id) => {
    if (!confirm("Delete?")) return;
    await base44.entities.Questions.delete(id);
    setQuestions(qs => qs.filter(q => q.id !== id));
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    
    const filtered = getFilteredQuestions();
    const newFiltered = Array.from(filtered);
    if (source.index === destination.index) return;
    
    const [moved] = newFiltered.splice(source.index, 1);
    newFiltered.splice(destination.index, 0, moved);
    
    // Renumber all filtered questions per witness
    const updated = newFiltered.map((q, i) => ({ ...q, order_index: i }));
    
    setQuestions(qs => qs.map(q => {
      const u = updated.find(r => r.id === q.id);
      return u ? { ...q, order_index: u.order_index } : q;
    }));
    
    // Save all updated questions
    Promise.all(updated.map(q => base44.entities.Questions.update(q.id, { order_index: q.order_index })));
  };

  const unlinkProof = async (questionId, proofId) => {
    const links = await base44.entities.QuestionProofItems.filter({ question_id: questionId, proof_item_id: proofId });
    for (const link of links) await base44.entities.QuestionProofItems.delete(link.id);
    setQuestionProofs(prev => ({ ...prev, [questionId]: (prev[questionId] || []).filter(id => id !== proofId) }));
  };

  const linkProof = async (questionId, proofId, bucketId) => {
    try {
      const existing = await base44.entities.QuestionProofItems.filter({
        question_id: questionId,
        proof_item_id: proofId,
      });
      if (existing.length === 0) {
        await base44.entities.QuestionProofItems.create({
          case_id: activeCase.id,
          question_id: questionId,
          proof_item_id: proofId,
          evidence_group_id: bucketId,
        });
      }
      setQuestionProofs(prev => ({
        ...prev,
        [questionId]: [...(prev[questionId] || []), proofId],
      }));
    } catch (error) {
      console.error('Error linking proof:', error);
    }
  };

  const getPartyName = (pid) => {
    const p = parties.find(x => x.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : "Unassigned";
  };

  const getBucketName = (bid) => {
    const b = evidenceGroups.find(x => x.id === bid);
    return b ? b.title : "Unknown";
  };

  const getFilteredQuestions = () => {
    return questions
      .filter(q => q.party_id === selectedPartyId)
      .filter(q => !selectedBucketId || q.evidence_group_id === selectedBucketId)
      .filter(q => !search || q.question_text?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  };

  const filtered = getFilteredQuestions();
  const bucketOptions = selectedPartyId
    ? evidenceGroups.filter(eg => questions.some(q => q.party_id === selectedPartyId && q.evidence_group_id === eg.id))
    : [];

  // Scroll to newly created question
  useEffect(() => {
    if (newlyCreatedQuestionId && scrollRef.current) {
      setTimeout(() => {
        const elem = document.getElementById(`question-${newlyCreatedQuestionId}`);
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setNewlyCreatedQuestionId(null);
        }
      }, 100);
    }
  }, [newlyCreatedQuestionId, filtered]);

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Questions</h1>
          <p className="text-sm text-slate-500">Manage witness questions by bucket</p>
        </div>
        <Button
          className="bg-cyan-600 hover:bg-cyan-700"
          onClick={() => {
            setEditing({ ...EMPTY, party_id: selectedPartyId });
            setOpen(true);
            setModalKey(k => k + 1);
          }}
        >
          <Plus className="w-4 h-4 mr-2" /> Add Question
        </Button>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="w-48">
            <Select value={selectedPartyId} onValueChange={v => { setSelectedPartyId(v); setSelectedBucketId(""); }}>
              <SelectTrigger className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
                <SelectValue placeholder="Select witness..." />
              </SelectTrigger>
              <SelectContent>
                {parties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPartyId && (
            <div className="w-48">
              <Select value={selectedBucketId} onValueChange={setSelectedBucketId}>
                <SelectTrigger className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
                  <SelectValue placeholder="Filter by bucket..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All buckets</SelectItem>
                  {bucketOptions.map(eg => (
                    <SelectItem key={eg.id} value={eg.id}>{eg.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedPartyId && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search questions..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200"
              />
            </div>
          )}
        </div>
      </div>

      {selectedPartyId ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="questions">
            {(provided) => (
              <div className="space-y-2" {...provided.droppableProps} ref={provided.innerRef}>
                {filtered.map((q, idx) => {
                  const linkedProofIds = questionProofs[q.id] || [];
                  return (
                    <Draggable key={q.id} draggableId={q.id} index={idx}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          id={`question-${q.id}`}
                          className={snapshot.isDragging ? 'opacity-50' : ''}
                        >
                          <Card className="bg-[#131a2e] border-[#1e2a45]">
                            <CardContent className="py-3 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2 flex-1">
                                  <button {...dragProvided.dragHandleProps} className="text-slate-500 hover:text-slate-300 flex-shrink-0 mt-0.5">
                                    <GripVertical className="w-3 h-3" />
                                  </button>
                                  <span className="text-sm font-semibold text-cyan-400">{idx + 1}.</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white">{q.question_text}</p>
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                      <Badge className={q.exam_type === "Direct" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                                        {q.exam_type}
                                      </Badge>
                                      <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">
                                        📦 {getBucketName(q.evidence_group_id)}
                                      </Badge>
                                      <Badge variant="outline" className="text-slate-500 border-slate-600">{q.status}</Badge>
                                    </div>
                                    {q.goal && <p className="text-xs text-slate-500 mt-1">Goal: {q.goal}</p>}
                                    {q.expected_answer && <p className="text-xs text-cyan-400 mt-1">Expected: {q.expected_answer}</p>}
                                  </div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0 items-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-400 hover:text-cyan-400"
                                    title="Link proof"
                                    onClick={() => {
                                      setProofLinkingQuestion(q);
                                      setShowProofLinking(true);
                                    }}
                                  >
                                    <Link2 className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-400 hover:text-cyan-400"
                                    onClick={() => {
                                      setEditing({ ...q });
                                      setOpen(true);
                                      setModalKey(k => k + 1);
                                    }}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-400 hover:text-red-400"
                                    onClick={() => remove(q.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>

                              {linkedProofIds.length > 0 && (
                                <div className="border-t border-slate-700 pt-2 ml-2 space-y-2">
                                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Linked Proof:</p>
                                  {linkedProofIds.map((proofId) => {
                                    const proof = proofItemsMap[proofId];
                                    if (!proof) return null;
                                    return (
                                      <div key={proofId} className="text-xs text-slate-300 bg-slate-700/30 rounded p-2 flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-slate-100">{proof.label}</p>
                                          {proof.type === 'extract' && proof.callout_id && calloutNames[proof.callout_id] && (
                                            <p className="text-slate-400">↳ {calloutNames[proof.callout_id]}</p>
                                          )}
                                          {proof.type === 'extract' && proof.callout_id && calloutWitnesses[proof.callout_id] && (
                                            <p className="text-cyan-400">👤 {calloutWitnesses[proof.callout_id]}</p>
                                          )}
                                          <p className="text-slate-500 text-[10px]">{proof.type === 'depoClip' ? 'Deposition Clip' : 'Exhibit Extract'}</p>
                                        </div>
                                        <div className="flex gap-0.5 flex-shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 p-0 text-slate-500 hover:text-cyan-400"
                                            title="Preview proof"
                                            onClick={() => {
                                              setSelectedProofItem(proof);
                                              setShowProofViewer(true);
                                            }}
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 p-0 text-slate-500 hover:text-red-400"
                                            title="Remove proof link"
                                            onClick={() => unlinkProof(q.id, proofId)}
                                          >
                                            <X className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="w-full h-7 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-slate-700/50"
                                    onClick={() => {
                                      setTempQuestionData(q);
                                      setShowProofModal(true);
                                    }}
                                  >
                                    <Link2 className="w-3 h-3 mr-1" /> Link More Proof
                                  </Button>
                                </div>
                              )}
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
      ) : (
        <div className="text-center text-slate-400 mt-8">
          <p>Select a witness to view their questions</p>
        </div>
      )}

      <ProofViewerModal
        proofItem={selectedProofItem}
        isOpen={showProofViewer}
        onClose={() => setShowProofViewer(false)}
      />

      <ProofLinkingModal
        open={showProofLinking}
        onClose={() => {
          setShowProofLinking(false);
          setProofLinkingQuestion(null);
        }}
        question={proofLinkingQuestion}
        caseId={activeCase.id}
        bucketId={proofLinkingQuestion?.evidence_group_id}
        linkedProofIds={questionProofs[proofLinkingQuestion?.id] || []}
        onLinkProof={linkProof}
        onUnlinkProof={unlinkProof}
        calloutNames={calloutNames}
        calloutWitnesses={calloutWitnesses}
        proofItemsMap={proofItemsMap}
        allProofItems={allProofItems}
      />

      {/* Create/Edit Question Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent key={modalKey} className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit" : "Add"} Question</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-slate-400 text-xs">Witness *</Label>
                <Select value={editing.party_id || ""} onValueChange={v => setEditing({ ...editing, party_id: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {parties.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-400 text-xs">Bucket *</Label>
                <Select value={editing.evidence_group_id || ""} onValueChange={v => setEditing({ ...editing, evidence_group_id: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {evidenceGroups.map(eg => (
                      <SelectItem key={eg.id} value={eg.id}>{eg.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-400 text-xs">Question *</Label>
                <Textarea
                  value={editing.question_text}
                  onChange={e => setEditing({ ...editing, question_text: e.target.value })}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Goal</Label>
                  <Input
                    value={editing.goal || ""}
                    onChange={e => setEditing({ ...editing, goal: e.target.value })}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Expected Answer</Label>
                  <Input
                    value={editing.expected_answer || ""}
                    onChange={e => setEditing({ ...editing, expected_answer: e.target.value })}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Type</Label>
                  <Select value={editing.exam_type} onValueChange={v => setEditing({ ...editing, exam_type: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Direct">Direct</SelectItem>
                      <SelectItem value="Cross">Cross</SelectItem>
                      <SelectItem value="Repair">Repair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Status</Label>
                  <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NotAsked">Not Asked</SelectItem>
                      <SelectItem value="Asked">Asked</SelectItem>
                      <SelectItem value="NeedsFollowUp">Needs Follow Up</SelectItem>
                      <SelectItem value="Skipped">Skipped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-slate-400 text-xs">Live Notes</Label>
                <Textarea
                  value={editing.live_notes || ""}
                  onChange={e => setEditing({ ...editing, live_notes: e.target.value })}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
                setModalKey(k => k + 1);
              }}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proof Linking Modal */}
      <Dialog open={showProofModal} onOpenChange={setShowProofModal}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Link Proof to Question</DialogTitle>
          </DialogHeader>
          {tempQuestionData && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">{tempQuestionData.question_text}</p>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400">Available Proof in {getBucketName(tempQuestionData.evidence_group_id)}:</p>
                {evidenceGroups.find(eg => eg.id === tempQuestionData.evidence_group_id) ? (
                  (() => {
                    const bucketProofs = questions
                      .filter(q => q.evidence_group_id === tempQuestionData.evidence_group_id)
                      .flatMap(q => questionProofs[q.id] || [])
                      .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

                    return bucketProofs.length > 0 ? (
                      bucketProofs.map(proofId => {
                        const proof = proofItemsMap[proofId];
                        if (!proof) return null;
                        const isLinked = (questionProofs[tempQuestionData.id] || []).includes(proofId);
                        return (
                          <div
                            key={proofId}
                            className="border border-slate-600 rounded p-3 cursor-pointer hover:border-cyan-500 flex items-start justify-between"
                            onClick={() => {
                              if (!isLinked) {
                                linkProof(tempQuestionData.id, proofId, tempQuestionData.evidence_group_id);
                              }
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium">{proof.label}</p>
                              {proof.type === 'extract' && proof.callout_id && calloutNames[proof.callout_id] && (
                                <p className="text-xs text-slate-400 mt-0.5">↳ {calloutNames[proof.callout_id]}</p>
                              )}
                              {proof.type === 'extract' && proof.callout_id && calloutWitnesses[proof.callout_id] && (
                                <p className="text-xs text-cyan-400 mt-0.5">👤 {calloutWitnesses[proof.callout_id]}</p>
                              )}
                              <p className="text-xs text-slate-500 mt-1">{proof.type === 'depoClip' ? 'Deposition Clip' : 'Exhibit Extract'}</p>
                            </div>
                            {isLinked && <Badge className="bg-green-500/20 text-green-400 text-xs">✓ Linked</Badge>}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-500">No proof in this bucket yet</p>
                    );
                  })()
                ) : null}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowProofModal(false)}
              className="border-slate-600 text-slate-300"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}