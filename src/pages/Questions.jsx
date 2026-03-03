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
import { Plus, Pencil, Trash2, Search, GripVertical, FileText, Paperclip } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ProofViewerModal from "@/components/proofLibrary/ProofViewerModal";
import BranchBuilder from "@/components/runner/BranchBuilder";

const EMPTY = { party_id: "", exam_type: "Direct", order_index: 0, question_text: "", goal: "", expected_answer: "", status: "NotAsked", answer_quality: "", admission_obtained: false, live_notes: "", is_branch_root: false, branch_prompt: "", importance: "Med", ask_if_time: true };

export default function Questions() {
  const { activeCase } = useActiveCase();
  const [questions, setQuestions] = useState([]);
  const [parties, setParties] = useState([]);
  const [trialPoints, setTrialPoints] = useState({}); // question_id -> trial point text
  const [proofCounts, setProofCounts] = useState({}); // question_id -> count
  const [proofItemsForQ, setProofItemsForQ] = useState({}); // question_id -> ProofItem[]
  const [selectedPartyId, setSelectedPartyId] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  // Proof viewer
  const [viewingProof, setViewingProof] = useState(null);
  const [proofViewerOpen, setProofViewerOpen] = useState(false);

  const load = async () => {
    if (!activeCase) return;
    const [q, p] = await Promise.all([
      base44.entities.Questions.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
    ]);
    setQuestions(q);
    setParties(p);
    loadLinkedData(q, activeCase.id);
  };

  const loadLinkedData = async (qs, caseId) => {
    if (!qs.length) return;
    const qIds = qs.map(q => q.id);

    // Fetch all in bulk by case_id — avoids N parallel requests that hit rate limits
    const [allProofLinks, allEvidenceLinks, allTpLinks, allTps] = await Promise.all([
      base44.entities.QuestionProofItems.filter({ case_id: caseId }),
      base44.entities.QuestionEvidenceGroups.filter({ case_id: caseId }),
      base44.entities.EvidenceGroupTrialPoints.filter({ case_id: caseId }),
      base44.entities.TrialPoints.filter({ case_id: caseId }),
    ]);

    // --- Proof counts + proof item lookup ---
    const qIdSet = new Set(qIds);
    const relevantProofLinks = allProofLinks.filter(l => qIdSet.has(l.question_id));

    const countMap = {};
    const proofIdToQIds = {};
    relevantProofLinks.forEach(l => {
      countMap[l.question_id] = (countMap[l.question_id] || 0) + 1;
      if (!proofIdToQIds[l.proof_item_id]) proofIdToQIds[l.proof_item_id] = [];
      proofIdToQIds[l.proof_item_id].push(l.question_id);
    });
    setProofCounts(countMap);

    const uniqueProofIds = Object.keys(proofIdToQIds);
    if (uniqueProofIds.length > 0) {
      // Fetch all proof items for this case in one call
      const allProofItems = await base44.entities.ProofItems.filter({ case_id: caseId });
      const proofItemMap = {};
      allProofItems.forEach(pi => { proofItemMap[pi.id] = pi; });

      const pMap = {};
      uniqueProofIds.forEach(pid => {
        const pi = proofItemMap[pid];
        if (!pi) return;
        (proofIdToQIds[pid] || []).forEach(qId => {
          if (!pMap[qId]) pMap[qId] = [];
          pMap[qId].push(pi);
        });
      });
      setProofItemsForQ(pMap);
    }

    // --- Trial points via evidence groups ---
    const tpMap = {};
    allTps.forEach(tp => { tpMap[tp.id] = tp; });

    // group_id -> first trial_point_id
    const groupToTp = {};
    allTpLinks.forEach(l => {
      if (!groupToTp[l.evidence_group_id]) groupToTp[l.evidence_group_id] = l.trial_point_id;
    });

    // question_id -> trial point text
    const qTpMap = {};
    allEvidenceLinks.forEach(l => {
      if (!qIdSet.has(l.question_id) || qTpMap[l.question_id]) return;
      const tpId = groupToTp[l.evidence_group_id];
      if (tpId && tpMap[tpId]) qTpMap[l.question_id] = tpMap[tpId].point_text;
    });
    setTrialPoints(qTpMap);
  };

  useEffect(() => { load(); }, [activeCase]);

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

  const saveQuestionsOrder = async (reorderedQuestions) => {
    for (let i = 0; i < reorderedQuestions.length; i++) {
      const q = reorderedQuestions[i];
      if (q.order_index !== i) {
        await base44.entities.Questions.update(q.id, { order_index: i });
      }
    }
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;
    const newQuestions = Array.from(filtered);
    const [moved] = newQuestions.splice(source.index, 1);
    newQuestions.splice(destination.index, 0, moved);
    const reordered = newQuestions.map((q, i) => ({ ...q, order_index: i }));
    setQuestions(qs => qs.map(q => reordered.find(r => r.id === q.id) || q));
    saveQuestionsOrder(reordered);
  };

  const getPartyName = (pid) => {
    const p = parties.find(x => x.id === pid);
    return p ? (p.display_name || `${p.first_name || ''} ${p.last_name}`.trim()) : "Unassigned";
  };

  const filtered = questions.filter(q => {
    const matchSearch = !search || q.question_text?.toLowerCase().includes(search.toLowerCase());
    const matchParty = selectedPartyId === "all" || q.party_id === selectedPartyId;
    const matchType = typeFilter === "all" || q.exam_type === typeFilter;
    return matchSearch && matchParty && matchType;
  }).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  // Build per-witness sequential numbers
  // Group filtered questions by party_id preserving order, assign numbers within each group
  const questionNumbers = (() => {
    const counters = {}; // partyId -> count
    const numMap = {}; // questionId -> number
    // Walk in order
    filtered.forEach(q => {
      const key = q.party_id || '__none__';
      if (!counters[key]) counters[key] = 0;
      counters[key]++;
      numMap[q.id] = counters[key];
    });
    return numMap;
  })();

  const handleClickProof = (proofItem) => {
    setViewingProof(proofItem);
    setProofViewerOpen(true);
  };

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
            <SelectContent className="bg-[#131a2e] border-[#1e2a45]">
              <SelectItem value="all" className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">All Witnesses</SelectItem>
              {parties.map(p => <SelectItem key={p.id} value={p.id} className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">{p.display_name || `${p.first_name || ''} ${p.last_name}`.trim()}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32 bg-[#131a2e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#131a2e] border-[#1e2a45]">
              <SelectItem value="all" className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">All Types</SelectItem>
              <SelectItem value="Direct" className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">Direct</SelectItem>
              <SelectItem value="Cross" className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">Cross</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="questions-list">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {filtered.map((q, idx) => {
                const proofList = proofItemsForQ[q.id] || [];
                const proofCount = proofCounts[q.id] || 0;
                const tpText = trialPoints[q.id];
                const num = questionNumbers[q.id];
                return (
                  <Draggable key={q.id} draggableId={q.id} index={idx}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={snapshot.isDragging ? "opacity-50" : ""}
                      >
                        <Card className="bg-[#131a2e] border-[#1e2a45] hover:border-cyan-500/30 transition-colors">
                          <CardContent className="py-3 flex items-start gap-3">
                            <div {...provided.dragHandleProps} className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0 pt-0.5">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            {/* Number */}
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1e2a45] flex items-center justify-center mt-0.5">
                              <span className="text-[11px] font-bold text-cyan-400">{num}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white leading-snug">{q.question_text}</p>

                              {/* Expected answer */}
                              {q.expected_answer && (
                                <p className="text-xs text-amber-300/80 mt-1 italic">A: {q.expected_answer}</p>
                              )}

                              <div className="flex gap-2 mt-2 flex-wrap items-center">
                                <Badge className={q.exam_type === "Direct" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>{q.exam_type}</Badge>
                                <Badge variant="outline" className="text-slate-400 border-slate-600">{getPartyName(q.party_id)}</Badge>

                                {/* Trial point */}
                                {tpText && (
                                  <span className="text-[10px] text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded px-1.5 py-0.5 max-w-[160px] truncate" title={tpText}>
                                    ⚖ {tpText}
                                  </span>
                                )}

                                {/* Proof indicator */}
                                {proofCount > 0 && (
                                  <button
                                    onClick={() => proofList.length > 0 && handleClickProof(proofList[0])}
                                    className="flex items-center gap-1 text-[10px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded px-1.5 py-0.5 hover:bg-cyan-500/20 transition-colors"
                                    title="Click to view proof"
                                  >
                                    <Paperclip className="w-2.5 h-2.5" />
                                    {proofCount} proof
                                  </button>
                                )}
                              </div>

                              {/* Proof list (clickable) if multiple */}
                              {proofList.length > 1 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {proofList.map(pi => (
                                    <button key={pi.id} onClick={() => handleClickProof(pi)}
                                      className="text-[10px] text-slate-400 hover:text-cyan-300 bg-[#0a0f1e] border border-[#1e2a45] rounded px-1.5 py-0.5 flex items-center gap-1 hover:border-cyan-500/40 transition-colors">
                                      <FileText className="w-2.5 h-2.5" />
                                      {pi.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0 items-center">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-cyan-400" onClick={() => { setEditing({ ...q }); setOpen(true); setModalKey(k => k + 1); }}><Pencil className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400" onClick={() => remove(q.id)}><Trash2 className="w-3 h-3" /></Button>
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
                    <SelectContent className="bg-[#131a2e] border-[#1e2a45]">
                      {parties.map(p => <SelectItem key={p.id} value={p.id} className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">{p.display_name || `${p.first_name || ''} ${p.last_name}`.trim()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Type</Label>
                  <Select value={editing.exam_type} onValueChange={v => setEditing({ ...editing, exam_type: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#131a2e] border-[#1e2a45]">
                      <SelectItem value="Direct" className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">Direct</SelectItem>
                      <SelectItem value="Cross" className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">Cross</SelectItem>
                    </SelectContent>
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
                    <SelectContent className="bg-[#131a2e] border-[#1e2a45]">
                      <SelectItem value="High" className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">High</SelectItem>
                      <SelectItem value="Med" className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">Med</SelectItem>
                      <SelectItem value="Low" className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Status</Label>
                  <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#131a2e] border-[#1e2a45]">{["NotAsked","Asked","NeedsFollowUp","Skipped"].map(s => <SelectItem key={s} value={s} className="text-slate-200 focus:bg-cyan-500/20 focus:text-cyan-300">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Order Index</Label>
                  <Input type="number" value={editing.order_index || 0} onChange={e => setEditing({ ...editing, order_index: parseInt(e.target.value) || 0 })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
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

      <ProofViewerModal
        proofItem={viewingProof}
        isOpen={proofViewerOpen}
        onClose={() => setProofViewerOpen(false)}
      />
    </div>
  );
}