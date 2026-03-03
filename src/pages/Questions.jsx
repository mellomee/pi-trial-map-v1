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
import { Plus, Pencil, Trash2, Search, GripVertical, BookOpen, FileText, Video, ChevronRight, Target } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import BranchBuilder from "@/components/runner/BranchBuilder";
import ProofViewerModal from "@/components/proofLibrary/ProofViewerModal";

const EMPTY = { party_id: "", exam_type: "Direct", order_index: 0, question_text: "", goal: "", expected_answer: "", status: "NotAsked", answer_quality: "", admission_obtained: false, live_notes: "", is_branch_root: false, branch_prompt: "", importance: "Med", ask_if_time: true };

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

  // Proof data
  const [questionProofMap, setQuestionProofMap] = useState({}); // questionId -> ProofItem[]
  const [calloutNames, setCalloutNames] = useState({}); // calloutId -> name
  const [calloutWitnesses, setCalloutWitnesses] = useState({}); // calloutId -> witness name
  const [trialPointMap, setTrialPointMap] = useState({}); // questionId -> TrialPoint[]

  // Proof viewer
  const [selectedProofItem, setSelectedProofItem] = useState(null);
  const [showProofModal, setShowProofModal] = useState(false);

  const load = async () => {
    if (!activeCase) return;
    const [q, p] = await Promise.all([
      base44.entities.Questions.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
    ]);
    setQuestions(q);
    setParties(p);
    await loadProofData(q, p, activeCase.id);
  };

  const loadProofData = async (qs, ps, caseId) => {
    try {
      // Load all QuestionProofItems + ProofItems for this case
      const [qpLinks, allProofItems] = await Promise.all([
        base44.entities.QuestionProofItems.filter({ case_id: caseId }),
        base44.entities.ProofItems.filter({ case_id: caseId }),
      ]);

      // Build questionId -> ProofItems map
      const proofMap = {};
      for (const q of qs) {
        const links = qpLinks.filter(l => l.question_id === q.id);
        proofMap[q.id] = links.map(l => allProofItems.find(p => p.id === l.proof_item_id)).filter(Boolean);
      }
      setQuestionProofMap(proofMap);

      // Resolve callout names + witnesses for extract type proofs
      const allCalloutIds = [...new Set(
        Object.values(proofMap).flat().filter(p => p?.type === 'extract' && p?.callout_id).map(p => p.callout_id)
      )];
      if (allCalloutIds.length > 0) {
        const partyLookup = {};
        ps.forEach(p => { partyLookup[p.id] = p.display_name || `${p.first_name || ''} ${p.last_name}`.trim(); });
        const nameMap = {};
        const witMap = {};
        await Promise.all(allCalloutIds.map(async cid => {
          const cos = await base44.entities.Callouts.filter({ id: cid });
          if (cos.length > 0) {
            nameMap[cid] = cos[0].name;
            if (cos[0].witness_id) witMap[cid] = partyLookup[cos[0].witness_id] || null;
          }
        }));
        setCalloutNames(nameMap);
        setCalloutWitnesses(witMap);
      }

      // Load trial points linked via QuestionLinks
      const [qLinks, tps] = await Promise.all([
        base44.entities.QuestionLinks.filter({ case_id: caseId, link_type: 'TrialPoint' }),
        base44.entities.TrialPoints.filter({ case_id: caseId }),
      ]);
      const tpLookup = {};
      tps.forEach(tp => { tpLookup[tp.id] = tp; });
      const tpMap = {};
      for (const ql of qLinks) {
        if (!tpMap[ql.question_id]) tpMap[ql.question_id] = [];
        if (tpLookup[ql.link_id]) tpMap[ql.question_id].push(tpLookup[ql.link_id]);
      }
      // Also check EvidenceGroup trial points via primary_evidence_group_id
      // Load evidence groups for this case to filter egLinks
      const caseEGs = await base44.entities.EvidenceGroups.filter({ case_id: caseId }).catch(() => []);
      const caseEGIds = new Set(caseEGs.map(g => g.id));
      // EvidenceGroupTrialPoints has no case_id, so we must list all and filter client-side
      const allEgLinks = await base44.entities.EvidenceGroupTrialPoints.list('-created_date', 1000).catch(() => []);
      const filteredEgLinks = allEgLinks.filter(l => caseEGIds.has(l.evidence_group_id));
      for (const q of qs) {
        if (q.primary_evidence_group_id) {
          const egTps = filteredEgLinks.filter(l => l.evidence_group_id === q.primary_evidence_group_id);
          for (const etp of egTps) {
            if (tpLookup[etp.trial_point_id]) {
              if (!tpMap[q.id]) tpMap[q.id] = [];
              if (!tpMap[q.id].find(t => t.id === etp.trial_point_id)) {
                tpMap[q.id].push(tpLookup[etp.trial_point_id]);
              }
            }
          }
        }
      }
      setTrialPointMap(tpMap);
    } catch (e) {
      console.error('Error loading proof data:', e);
    }
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
      if (q.order_index !== i) await base44.entities.Questions.update(q.id, { order_index: i });
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

  // Build per-witness numbering: group filtered by party_id, sort by order_index, assign number
  const questionNumbers = (() => {
    // Group by party_id and assign sequential numbers per witness
    const byParty = {};
    // Sort by order_index first
    const sorted = [...filtered].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    sorted.forEach(q => {
      if (!byParty[q.party_id]) byParty[q.party_id] = [];
      byParty[q.party_id].push(q.id);
    });
    const numMap = {};
    Object.values(byParty).forEach(ids => {
      ids.forEach((id, i) => { numMap[id] = i + 1; });
    });
    return numMap;
  })();

  // When "All Witnesses", sort by witness then order_index so same-numbered questions cluster together
  const displayList = selectedPartyId === "all"
    ? [...filtered].sort((a, b) => {
        const numDiff = (questionNumbers[a.id] || 0) - (questionNumbers[b.id] || 0);
        if (numDiff !== 0) return numDiff;
        return (a.party_id || '').localeCompare(b.party_id || '');
      })
    : filtered;

  const getProofSubtitle = (proof) => {
    if (proof.type === 'depoClip') return null;
    if (proof.callout_id) {
      const name = calloutNames[proof.callout_id];
      const wit = calloutWitnesses[proof.callout_id];
      return [name, wit].filter(Boolean).join(' · ') || null;
    }
    return null;
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
            <SelectContent>
              <SelectItem value="all">All Witnesses</SelectItem>
              {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name || `${p.first_name || ''} ${p.last_name}`.trim()}</SelectItem>)}
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

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="questions-list">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {displayList.map((q, idx) => {
                const proofs = questionProofMap[q.id] || [];
                const hasProof = proofs.length > 0;
                const trialPoints = trialPointMap[q.id] || [];
                const qNum = questionNumbers[q.id];

                return (
                  <Draggable key={q.id} draggableId={q.id} index={idx}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} className={snapshot.isDragging ? "opacity-50" : ""}>
                        <Card className="bg-[#131a2e] border-[#1e2a45]">
                          <CardContent className="py-3 flex items-start justify-between gap-3">
                            <div {...provided.dragHandleProps} className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0 pt-1">
                              <GripVertical className="w-4 h-4" />
                            </div>

                            {/* Question number badge */}
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-600/20 text-cyan-400 text-xs font-bold flex items-center justify-center mt-0.5">
                              {qNum}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white leading-snug">{q.question_text}</p>

                              {/* Meta badges */}
                              <div className="flex gap-2 mt-2 flex-wrap items-center">
                                <Badge className={q.exam_type === "Direct" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>{q.exam_type}</Badge>
                                <Badge variant="outline" className="text-slate-400 border-slate-600 text-[10px]">{getPartyName(q.party_id)}</Badge>
                                {q.importance && q.importance !== 'Med' && (
                                  <Badge className={q.importance === 'High' ? 'bg-orange-500/20 text-orange-400 text-[10px]' : 'bg-gray-500/20 text-gray-400 text-[10px]'}>
                                    {q.importance}
                                  </Badge>
                                )}
                                {/* Proof indicator */}
                                {hasProof && (
                                  <span className="text-[10px] text-purple-400 font-medium flex items-center gap-0.5">
                                    <BookOpen className="w-3 h-3" /> {proofs.length} proof
                                  </span>
                                )}
                              </div>

                              {/* Trial point */}
                              {trialPoints.length > 0 && (
                                <div className="mt-1.5 flex items-center gap-1">
                                  <Target className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                                  <span className="text-[11px] text-yellow-400 truncate">{trialPoints[0].point_text}</span>
                                </div>
                              )}

                              {/* Expected answer */}
                              {q.expected_answer && (
                                <p className="text-[11px] text-slate-500 mt-1 border-l-2 border-slate-700 pl-2 italic truncate">
                                  A: {q.expected_answer}
                                </p>
                              )}

                              {/* Proof items — clickable */}
                              {hasProof && (
                                <div className="mt-2 flex flex-col gap-1">
                                  {proofs.map(proof => {
                                    const subtitle = getProofSubtitle(proof);
                                    return (
                                      <button
                                        key={proof.id}
                                        onClick={() => { setSelectedProofItem(proof); setShowProofModal(true); }}
                                        className="flex items-center gap-1.5 text-left bg-[#0a0f1e] border border-[#1e2a45] rounded px-2 py-1.5 hover:border-cyan-500/50 hover:bg-cyan-900/20 transition-colors group"
                                      >
                                        {proof.type === 'depoClip'
                                          ? <Video className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                          : <FileText className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                        }
                                        <span className="text-[11px] text-slate-300 group-hover:text-cyan-300 flex-1 truncate">{proof.label}</span>
                                        {subtitle && <span className="text-[10px] text-slate-500 truncate flex-shrink-0">{subtitle}</span>}
                                        <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 flex-shrink-0" />
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-1 flex-shrink-0 items-start">
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

      {/* Edit/Add Question Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent key={modalKey} className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-slate-100">{editing?.id ? "Edit" : "Add"} Question</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label className="text-slate-400 text-xs">Question</Label><Textarea value={editing.question_text} onChange={e => setEditing({ ...editing, question_text: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={3} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Witness</Label>
                  <Select value={editing.party_id || ""} onValueChange={v => setEditing({ ...editing, party_id: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name || `${p.first_name || ''} ${p.last_name}`.trim()}</SelectItem>)}</SelectContent>
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
        proofItem={selectedProofItem}
        isOpen={showProofModal}
        onClose={() => setShowProofModal(false)}
      />
    </div>
  );
}