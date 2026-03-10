import React, { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Search, GripVertical, GitBranch, X, ExternalLink } from "lucide-react";
import ChildrenQuestionsModal from "@/components/questions/ChildrenQuestionsModal";
import ProofViewerModal from "@/components/proofLibrary/ProofViewerModal";
import { createPageUrl } from "@/utils";
import BranchBuilder from "@/components/runner/BranchBuilder";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const EMPTY = { party_id: "", exam_type: "Direct", order_index: null, question_text: "", goal: "", expected_answer: "", status: "NotAsked", answer_quality: "", admission_obtained: false, live_notes: "", is_branch_root: false, branch_prompt: "", importance: "Med", ask_if_time: true };

export default function Questions() {
  const { activeCase } = useActiveCase();
  const [questions, setQuestions] = useState([]);
  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [childrenModal, setChildrenModal] = useState(null); // parent question node
  const [questionProofs, setQuestionProofs] = useState({}); // questionId -> array of proofItems
  const [calloutNames, setCalloutNames] = useState({});
  const [calloutWitnesses, setCalloutWitnesses] = useState({});
  const [proofItemsMap, setProofItemsMap] = useState({}); // proofId -> proof details
  const [selectedProofItem, setSelectedProofItem] = useState(null);
  const [showProofViewer, setShowProofViewer] = useState(false);

  const load = async () => {
    if (!activeCase) return;
    const [q, p] = await Promise.all([
      base44.entities.Questions.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
    ]);
    setQuestions(q);
    setParties(p);

    // Load question-proof links
    const allQPLinks = await base44.entities.QuestionProofItems.filter({ case_id: activeCase.id });
    const qMap = {};
    const cnMap = {};
    const cwMap = {};

    allQPLinks.forEach(link => {
      if (!qMap[link.question_id]) qMap[link.question_id] = [];
      qMap[link.question_id].push(link.proof_item_id);
    });
    setQuestionProofs(qMap);

    // Load proof item details and callout info with reduced rate
    const uniqueProofIds = [...new Set(allQPLinks.map(l => l.proof_item_id))];
    const proofMap = {};
    if (uniqueProofIds.length > 0) {
      try {
        const proofs = await base44.entities.ProofItems.filter({ id: { $in: uniqueProofIds } });
        proofs.forEach(pf => proofMap[pf.id] = pf);

        const calloutIds = proofs.filter(p => p.callout_id).map(p => p.callout_id);
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
      const newQ = await base44.entities.Questions.create(data);
      setQuestions(qs => [...qs, newQ]);
    }
    setOpen(false);
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

    // Work with filtered (already sorted) questions
    const newFiltered = Array.from(allFiltered);
    if (source.index === destination.index) return;
    
    const [moved] = newFiltered.splice(source.index, 1);
    newFiltered.splice(destination.index, 0, moved);
    
    // Update state with new ordering (display only, don't persist)
    setQuestions(qs => {
      const map = new Map(qs.map(q => [q.id, q]));
      return newFiltered.map(q => map.get(q.id) || q);
    });
  };

  const unlinkProof = async (questionId, proofId) => {
    const links = await base44.entities.QuestionProofItems.filter({ question_id: questionId, proof_item_id: proofId });
    for (const link of links) await base44.entities.QuestionProofItems.delete(link.id);
    setQuestionProofs(prev => ({ ...prev, [questionId]: (prev[questionId] || []).filter(id => id !== proofId) }));
  };

  const getPartyName = (pid) => {
    const p = parties.find(x => x.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : "Unassigned";
  };

  // Build hierarchy from parent_id relationships
  const buildQuestionTree = (allQuestions) => {
    const tree = [];
    const qMap = {};

    // First pass: index all questions
    allQuestions.forEach(q => {
      qMap[q.id] = { ...q, children: [] };
    });

    // Second pass: build parent-child relationships
    allQuestions.forEach(q => {
      if (q.parent_id && qMap[q.parent_id]) {
        // This is a child question
        qMap[q.parent_id].children.push(qMap[q.id]);
      } else {
        // This is a root question
        tree.push(qMap[q.id]);
      }
    });

    return tree;
  };

  const allFiltered = questions.filter(q => {
    const matchSearch = !search || q.question_text?.toLowerCase().includes(search.toLowerCase());
    const matchParty = selectedPartyId === "all" || q.party_id === selectedPartyId;
    const matchType = typeFilter === "all" || q.exam_type === typeFilter;
    return matchSearch && matchParty && matchType;
  });

  // Separate ordered and unordered questions
  const orderedQuestions = allFiltered.filter(q => q.order_index !== null && q.order_index !== undefined).sort((a, b) => a.order_index - b.order_index);
  const unorderedQuestions = allFiltered.filter(q => q.order_index === null || q.order_index === undefined);

  const filtered = buildQuestionTree(orderedQuestions);

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Questions</h1>
          <p className="text-sm text-slate-500">Direct & Cross Examination</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setEditing({ ...EMPTY }); setOpen(true); setModalKey(k => k + 1); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Question
        </Button>
      </div>

      <div className="space-y-3 mb-6">
         <div className="flex flex-wrap gap-3">
           <div className="relative flex-1 max-w-sm">
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
             <Input placeholder="Search questions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
           </div>
           <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
             <SelectTrigger className="w-48 bg-[#131a2e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select witness..." /></SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Witnesses</SelectItem>
               {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
             </SelectContent>
           </Select>
           <Select value={typeFilter} onValueChange={setTypeFilter}>
             <SelectTrigger className="w-32 bg-[#131a2e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Types</SelectItem>
               <SelectItem value="Direct">Direct</SelectItem>
               <SelectItem value="Cross">Cross</SelectItem>
             </SelectContent>
           </Select>
         </div>
       </div>

      {/* Unordered Questions Section */}
      {unorderedQuestions.length > 0 && (
        <div className="mb-8 p-4 bg-[#0f1629] border border-amber-500/30 rounded-lg">
          <h2 className="text-sm font-semibold text-amber-400 mb-3">Unordered Questions ({unorderedQuestions.length})</h2>
          <div className="space-y-2">
            {unorderedQuestions.map(q => (
              <Card key={q.id} className="bg-[#131a2e] border-[#1e2a45]">
                <CardContent className="py-2 px-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{q.question_text}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge className={q.exam_type === "Direct" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>{q.exam_type}</Badge>
                        <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">{getPartyName(q.party_id)}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-cyan-400" 
                        onClick={() => { setEditing({ ...q }); setOpen(true); setModalKey(k => k + 1); }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-400" 
                        onClick={() => remove(q.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Render question hierarchy */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="questions">
          {(provided) => (
            <div className="space-y-2" {...provided.droppableProps} ref={provided.innerRef}>
              {filtered.map((q, parentIdx) => {
                const linkedProofIds = questionProofs[q.id] || [];
                const hasChildren = q.children && q.children.length > 0;
                return (
                  <div key={q.id}>
                    <Draggable draggableId={q.id} index={parentIdx}>
                      {(dragProvided, snapshot) => (
                        <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className={snapshot.isDragging ? 'opacity-50' : ''}>
                          <Card className="bg-[#131a2e] border-[#1e2a45]">
                            <CardContent className="py-3 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2 flex-1">
                                  <button {...dragProvided.dragHandleProps} className="text-slate-500 hover:text-slate-300 flex-shrink-0 mt-0.5">
                                    <GripVertical className="w-3 h-3" />
                                  </button>
                                  <span className="text-sm font-semibold text-cyan-400">{parentIdx + 1}.</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white">{q.question_text}</p>
                                  <div className="flex gap-2 mt-2 flex-wrap">
                                    <Badge className={q.exam_type === "Direct" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>{q.exam_type}</Badge>
                                    <Badge variant="outline" className="text-slate-400 border-slate-600">{getPartyName(q.party_id)}</Badge>
                                    <Badge variant="outline" className="text-slate-500 border-slate-600">{q.status}</Badge>
                                    {q.question_type && <Badge className="bg-purple-500/20 text-purple-400 text-xs">{q.question_type}</Badge>}
                                  </div>
                                  {q.goal && <p className="text-xs text-slate-500 mt-1">Goal: {q.goal}</p>}
                                  {q.expected_answer && <p className="text-xs text-cyan-400 mt-1">Expected: {q.expected_answer}</p>}
                                </div>
                              </div>
                              <div className="flex gap-1 flex-shrink-0 items-center">
                                {hasChildren && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-purple-400 hover:text-purple-300"
                                    title={`${q.children.length} child question(s)`}
                                    onClick={() => setChildrenModal(q)}
                                  >
                                    <GitBranch className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-cyan-400" onClick={() => { setEditing({ ...q }); setOpen(true); setModalKey(k => k + 1); }}><Pencil className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400" onClick={() => remove(q.id)}><Trash2 className="w-3 h-3" /></Button>
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
                                        <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-slate-500 hover:text-cyan-400"
                                          title="Preview proof"
                                          onClick={() => { setSelectedProofItem(proof); setShowProofViewer(true); }}>
                                          <ExternalLink className="w-3 h-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-slate-500 hover:text-red-400"
                                          title="Remove proof link"
                                          onClick={() => unlinkProof(q.id, proofId)}>
                                          <X className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </Draggable>
                  
                  {/* Render child questions below parent */}
                  {hasChildren && (
                      <div className="ml-8 space-y-2 mt-2 border-l-2 border-slate-700 pl-3">
                        {q.children.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).map((child, childIdx) => {
                          const childProofIds = questionProofs[child.id] || [];
                          return (
                            <Card key={child.id} className="bg-[#0f1629] border-[#1e2a45]">
                              <CardContent className="py-2 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2 flex-1">
                                    <span className="text-xs text-slate-500 flex-shrink-0 mt-0.5">{parentIdx + 1}.{childIdx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-slate-100">{child.question_text}</p>
                                      <div className="flex gap-2 mt-1 flex-wrap">
                                        <Badge className={child.exam_type === "Direct" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"} variant="outline">{child.exam_type}</Badge>
                                        <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">{getPartyName(child.party_id)}</Badge>
                                        {child.question_type && <Badge className="bg-purple-500/20 text-purple-400 text-xs">{child.question_type}</Badge>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-cyan-400" onClick={() => { setEditing({ ...child }); setOpen(true); setModalKey(k => k + 1); }}><Pencil className="w-3 h-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-400" onClick={() => remove(child.id)}><Trash2 className="w-3 h-3" /></Button>
                                  </div>
                                </div>
                                {childProofIds.length > 0 && (
                                  <div className="text-xs text-slate-400 pt-1">
                                    {childProofIds.length} proof item(s) linked
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                </div>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <ChildrenQuestionsModal
        isOpen={!!childrenModal}
        onClose={() => setChildrenModal(null)}
        parent={childrenModal}
        proofItemsMap={proofItemsMap}
        calloutNames={calloutNames}
        calloutWitnesses={calloutWitnesses}
        getPartyName={getPartyName}
        onEdit={(child) => { setChildrenModal(null); setEditing({ ...child }); setOpen(true); setModalKey(k => k + 1); }}
        onDelete={remove}
        onReordered={load}
      />

      <ProofViewerModal
        proofItem={selectedProofItem}
        isOpen={showProofViewer}
        onClose={() => setShowProofViewer(false)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent key={modalKey} className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} Question</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label className="text-slate-400 text-xs">Question</Label><Textarea value={editing.question_text} onChange={e => setEditing({ ...editing, question_text: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={3} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Witness</Label>
                  <Select value={editing.party_id || ""} onValueChange={v => setEditing({ ...editing, party_id: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Type</Label>
                  <Select value={editing.exam_type} onValueChange={v => setEditing({ ...editing, exam_type: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Direct">Direct</SelectItem><SelectItem value="Cross">Cross</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-slate-400 text-xs">Goal</Label><Input value={editing.goal || ""} onChange={e => setEditing({ ...editing, goal: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" /></div>
                <div><Label className="text-slate-400 text-xs">Expected Answer</Label><Input value={editing.expected_answer || ""} onChange={e => setEditing({ ...editing, expected_answer: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" /></div>
                <div>
                  <Label className="text-slate-400 text-xs">Importance</Label>
                  <Select value={editing.importance || "Med"} onValueChange={v => setEditing({ ...editing, importance: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Med">Med</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Status</Label>
                  <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{["NotAsked","Asked","NeedsFollowUp","Skipped"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Order Index (Leave blank for unordered)</Label>
                  <Input type="number" value={editing.order_index !== null && editing.order_index !== undefined ? editing.order_index : ""} onChange={e => setEditing({ ...editing, order_index: e.target.value === "" ? null : parseInt(e.target.value) })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Switch checked={!!editing.is_branch_root} onCheckedChange={v => setEditing({ ...editing, is_branch_root: v })} />
                  <Label className="text-xs text-slate-400">Branch Root</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.ask_if_time !== false} onCheckedChange={v => setEditing({ ...editing, ask_if_time: v })} />
                  <Label className="text-xs text-slate-400">Ask if time permits</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={!!editing.admission_obtained} onCheckedChange={v => setEditing({ ...editing, admission_obtained: v })} />
                  <Label className="text-xs text-slate-400">Admission Obtained</Label>
                </div>
              </div>
              {editing.is_branch_root && (
                <div><Label className="text-slate-400 text-xs">Branch Prompt</Label><Input value={editing.branch_prompt || ""} onChange={e => setEditing({ ...editing, branch_prompt: e.target.value })} placeholder="e.g. If they deny, go to impeachment branch" className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" /></div>
              )}
              <div><Label className="text-slate-400 text-xs">Live Notes</Label><Textarea value={editing.live_notes || ""} onChange={e => setEditing({ ...editing, live_notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} /></div>

              {/* Branching panel — only shown when editing an existing question */}
              {editing.id && (
                <div className="mt-4 pt-4 border-t border-[#1e2a45]">
                  <BranchBuilder
                    question={editing}
                    allQuestions={questions}
                    caseId={activeCase.id}
                    onQuickCreate={async (type) => {
                      const newQ = await base44.entities.Questions.create({
                        case_id: activeCase.id,
                        party_id: editing.party_id,
                        exam_type: editing.exam_type,
                        question_text: type === "impeachment" ? `[Impeachment] ${editing.question_text.slice(0, 40)}…` : `[Follow-up] ${editing.question_text.slice(0, 40)}…`,
                        order_index: (editing.order_index || 0) + 0.5,
                        is_branch_root: false,
                        importance: "High",
                      });
                      // auto-create a branch rule pointing to it
                      await base44.entities.QuestionBranches.create({
                        case_id: activeCase.id,
                        from_question_id: editing.id,
                        condition_type: type === "impeachment" ? "WITNESS_DENIES" : "ANSWER_UNEXPECTED",
                        to_question_id: newQ.id,
                        priority: 1,
                        auto_jump: true,
                      });
                      load();
                    }}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); setModalKey(k => k + 1); }} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}