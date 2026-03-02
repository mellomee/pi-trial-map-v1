import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Plus, ChevronRight, Trash2, HelpCircle, X, Layers, Swords } from "lucide-react";
import WorkflowBanner from "@/components/trial/WorkflowBanner";

const STATUS_COLORS = {
  NotAsked: "bg-slate-500/20 text-slate-400",
  Asked: "bg-green-500/20 text-green-400",
  NeedsFollowUp: "bg-amber-500/20 text-amber-400",
  Skipped: "bg-slate-600/20 text-slate-500",
};

export default function WitnessPrep() {
  const { activeCase } = useActiveCase();
  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [examType, setExamType] = useState("Cross");
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const [witnessPlans, setWitnessPlans] = useState([]);
  const [planItems, setPlanItems] = useState([]);
  const [evidenceGroups, setEvidenceGroups] = useState([]);
  const [egLinks, setEgLinks] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);
  const [depoClips, setDepoClips] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [battleCards, setBattleCards] = useState([]);

  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [addBcOpen, setAddBcOpen] = useState(false);
  const [newBcForm, setNewBcForm] = useState({ title: "", goal: "", when_to_use: "", commit_question: "", credit_question: "", confront_question: "", priority: "Med" });
  const [activeTab, setActiveTab] = useState("plan");

  // Parse URL query parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wId = params.get("witnessId");
    const eType = params.get("examType");
    const gId = params.get("groupId");
    const tab = params.get("tab");
    if (wId) setSelectedPartyId(wId);
    if (eType) setExamType(eType);
    if (gId) setSelectedGroupId(gId);
    if (tab) setActiveTab(tab);
  }, []);

  const load = async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [p, wp, pi, eg, egl, q, tp, dc, je, bc] = await Promise.all([
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.WitnessPlans.filter({ case_id: cid }),
      base44.entities.WitnessPlanItems.list(),
      base44.entities.EvidenceGroups.filter({ case_id: cid }),
      base44.entities.EvidenceGroupLinks.list(),
      base44.entities.Questions.filter({ case_id: cid }),
      base44.entities.TrialPoints.filter({ case_id: cid }),
      base44.entities.DepoClips.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.BattleCards.filter({ case_id: cid }),
    ]);
    setParties(p);
    setWitnessPlans(wp);
    setPlanItems(pi);
    setEvidenceGroups(eg);
    setEgLinks(egl);
    setQuestions(q);
    setTrialPoints(tp);
    setDepoClips(dc);
    setJointExhibits(je);
    setBattleCards(bc);
    if (!selectedPartyId && p.length > 0) setSelectedPartyId(p[0].id);
  };

  useEffect(() => { load(); }, [activeCase]);

  const currentPlan = useMemo(() =>
    witnessPlans.find(p => p.party_id === selectedPartyId && p.exam_type === examType),
    [witnessPlans, selectedPartyId, examType]
  );

  const currentPlanItems = useMemo(() => {
    if (!currentPlan) return [];
    return planItems
      .filter(i => i.witness_plan_id === currentPlan.id)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [planItems, currentPlan]);

  const witnessQuestions = useMemo(() =>
    questions
      .filter(q => q.party_id === selectedPartyId && q.exam_type === examType)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
    [questions, selectedPartyId, examType]
  );

  // In Questions tab, show only groups that have questions for this witness/exam
  const relevantGroupIds = useMemo(() => {
    const ids = new Set(witnessQuestions.map(q => q.primary_evidence_group_id).filter(Boolean));
    return Array.from(ids);
  }, [witnessQuestions]);

  const visibleGroups = useMemo(() => {
    return evidenceGroups.filter(g => relevantGroupIds.includes(g.id));
  }, [evidenceGroups, relevantGroupIds]);

  const selectedQuestion = useMemo(() => questions.find(q => q.id === selectedQuestionId), [questions, selectedQuestionId]);

  const getGroupLinks = (groupId) => egLinks.filter(l => l.evidence_group_id === groupId);

  const onDragEnd = async (result) => {
    if (!result.destination || !currentPlan) return;
    const reordered = Array.from(currentPlanItems);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    for (let i = 0; i < reordered.length; i++) {
      await base44.entities.WitnessPlanItems.update(reordered[i].id, { order_index: i });
    }
    load();
  };

  const removePlanItem = async (itemId) => {
    await base44.entities.WitnessPlanItems.delete(itemId);
    load();
  };

  const addGroupToPlan = async (groupId) => {
    let plan = currentPlan;
    if (!plan) {
      const party = parties.find(p => p.id === selectedPartyId);
      plan = await base44.entities.WitnessPlans.create({
        case_id: activeCase.id, party_id: selectedPartyId, exam_type: examType,
        title: `${party?.display_name || party?.last_name} ${examType}`,
      });
    }
    await base44.entities.WitnessPlanItems.create({
      witness_plan_id: plan.id, evidence_group_id: groupId, order_index: currentPlanItems.length,
    });
    setAddGroupOpen(false);
    load();
  };

  const saveBattleCard = async () => {
    await base44.entities.BattleCards.create({ ...newBcForm, case_id: activeCase.id });
    setAddBcOpen(false);
    setNewBcForm({ title: "", goal: "", when_to_use: "", commit_question: "", credit_question: "", confront_question: "", priority: "Med" });
    load();
  };

  const deleteBattleCard = async (id) => {
    if (!confirm("Delete this battle card?")) return;
    await base44.entities.BattleCards.delete(id);
    load();
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  const partyName = (id) => {
    const p = parties.find(x => x.id === id);
    return p ? (p.display_name || `${p.first_name} ${p.last_name}`) : "—";
  };

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden flex-col">
      <WorkflowBanner />
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0">
        <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
          <SelectTrigger className="w-48 h-8 bg-[#131a2e] border-[#1e2a45] text-slate-200 text-sm"><SelectValue placeholder="Select witness…" /></SelectTrigger>
          <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{partyName(p.id)}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex rounded border border-[#1e2a45] overflow-hidden">
          {["Direct","Cross"].map(t => (
            <button key={t} onClick={() => setExamType(t)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${examType === t ? (t === "Direct" ? "bg-green-600 text-white" : "bg-orange-600 text-white") : "text-slate-400 hover:text-slate-200"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          {["plan","questions","battlecards"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === tab ? "bg-cyan-600/20 text-cyan-400 border border-cyan-700/40" : "text-slate-500 hover:text-slate-300"}`}>
              {tab === "plan" ? "Witness Plan" : tab === "questions" ? "Questions" : "Battle Cards"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* WITNESS PLAN TAB */}
        {activeTab === "plan" && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left: plan items */}
            <div className="w-72 flex-shrink-0 border-r border-[#1e2a45] flex flex-col bg-[#0f1629]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2a45]">
                <p className="text-xs font-bold text-slate-300">Evidence Group Order</p>
                <Button size="sm" className="h-6 bg-cyan-600/20 text-cyan-400 border border-cyan-700/40 text-[10px] px-2 hover:bg-cyan-600/30" onClick={() => setAddGroupOpen(true)}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="plan-items">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="flex-1 overflow-y-auto">
                      {currentPlanItems.map((item, idx) => {
                        const group = evidenceGroups.find(g => g.id === item.evidence_group_id);
                        if (!group) return null;
                        const links = getGroupLinks(group.id);
                        return (
                          <Draggable key={item.id} draggableId={item.id} index={idx}>
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.draggableProps}
                                className="border-b border-[#1e2a45] bg-[#0f1629] hover:bg-[#131a2e]">
                                <div className="flex items-center gap-2 px-2 py-2">
                                  <div {...provided.dragHandleProps} className="text-slate-600 hover:text-slate-400 cursor-grab">
                                    <GripVertical className="w-3 h-3" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-300 truncate">{group.title}</p>
                                    <div className="flex gap-1 mt-0.5">
                                      {links.filter(l => l.link_type === "DepoClip").length > 0 && (
                                        <span className="text-[9px] text-violet-400">{links.filter(l => l.link_type === "DepoClip").length} clips</span>
                                      )}
                                      {links.filter(l => l.link_type === "JointExhibit").length > 0 && (
                                        <span className="text-[9px] text-amber-400 ml-1">{links.filter(l => l.link_type === "JointExhibit").length} exh</span>
                                      )}
                                    </div>
                                  </div>
                                  <button onClick={() => removePlanItem(item.id)} className="text-slate-700 hover:text-red-400">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      {currentPlanItems.length === 0 && (
                        <p className="text-xs text-slate-600 text-center py-6">No groups in plan yet.</p>
                      )}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>

            {/* Right: group detail */}
            <div className="flex-1 overflow-y-auto p-4">
              {currentPlanItems.map(item => {
                const group = evidenceGroups.find(g => g.id === item.evidence_group_id);
                if (!group) return null;
                const links = getGroupLinks(group.id);
                const clipLinks = links.filter(l => l.link_type === "DepoClip");
                const exhibitLinks = links.filter(l => l.link_type === "JointExhibit");
                const tpLinks = links.filter(l => l.link_type === "TrialPoint");
                return (
                  <div key={item.id} className="mb-4 bg-[#131a2e] border border-[#1e2a45] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#1e2a45] flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{group.title}</p>
                        <p className="text-xs text-slate-500">{group.description}</p>
                      </div>
                      <Badge className={`text-[9px] ${group.priority === "High" ? "bg-red-500/20 text-red-400" : group.priority === "Med" ? "bg-amber-500/20 text-amber-400" : "bg-slate-500/20 text-slate-400"}`}>{group.priority}</Badge>
                    </div>
                    <div className="p-3 grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Trial Points ({tpLinks.length})</p>
                        {tpLinks.map(l => {
                          const tp = trialPoints.find(t => t.id === l.link_id);
                          return tp ? <p key={l.id} className="text-slate-400 line-clamp-2 mb-0.5">• {tp.point_text}</p> : null;
                        })}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Depo Clips ({clipLinks.length})</p>
                        {clipLinks.map(l => {
                          const c = depoClips.find(dc => dc.id === l.link_id);
                          return c ? <p key={l.id} className="text-violet-400 line-clamp-1 mb-0.5">• {c.topic_tag || c.clip_text?.slice(0, 40)}</p> : null;
                        })}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Exhibits ({exhibitLinks.length})</p>
                        {exhibitLinks.map(l => {
                          const je = jointExhibits.find(j => j.id === l.link_id);
                          return je ? <p key={l.id} className="text-amber-400 line-clamp-1 mb-0.5">• #{je.marked_no} {je.marked_title}</p> : null;
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {currentPlanItems.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                  <Layers className="w-12 h-12 opacity-10" />
                  <p>Add evidence groups to build the witness plan</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QUESTIONS TAB */}
         {activeTab === "questions" && (
           <div className="flex flex-1 overflow-hidden">
             <div className="w-72 flex-shrink-0 border-r border-[#1e2a45] flex flex-col">
               {/* Groups sidebar in Questions tab */}
               <div className="px-3 py-2 border-b border-[#1e2a45]">
                 <p className="text-xs font-bold text-slate-300">Evidence Groups</p>
               </div>
               <div className="flex-1 overflow-y-auto">
                 {visibleGroups.length > 0 ? visibleGroups.map(g => (
                   <button key={g.id} onClick={() => setSelectedGroupId(g.id)}
                     className={`w-full text-left px-3 py-2 border-b border-[#1e2a45] text-xs transition-colors ${selectedGroupId === g.id ? "bg-cyan-500/10 border-l-2 border-l-cyan-400 text-cyan-200" : "text-slate-400 hover:bg-white/5"}`}>
                     {g.title}
                   </button>
                 )) : (
                   <p className="text-xs text-slate-600 text-center py-4">No groups with questions</p>
                 )}
               </div>
             </div>

             {/* Questions list in center */}
             <div className="w-72 flex-shrink-0 border-r border-[#1e2a45] flex flex-col bg-[#0a0f1e]">
               <div className="px-3 py-2 border-b border-[#1e2a45]">
                 <p className="text-xs font-bold text-slate-300">{witnessQuestions.length} questions</p>
               </div>
               <div className="flex-1 overflow-y-auto">
                 {witnessQuestions.map((q, idx) => (
                   <button key={q.id} onClick={() => setSelectedQuestionId(q.id)}
                     className={`w-full text-left px-3 py-2.5 border-b border-[#1e2a45] transition-colors ${selectedQuestionId === q.id ? "bg-cyan-500/10 border-l-2 border-l-cyan-400" : "hover:bg-white/5 border-l-2 border-l-transparent"}`}>
                     <div className="flex items-start gap-2">
                       <span className="text-[10px] text-slate-600 mt-0.5">{idx+1}.</span>
                       <div className="flex-1 min-w-0">
                         <p className="text-xs text-slate-300 line-clamp-2">{q.question_text}</p>
                         <Badge className={`text-[9px] mt-1 ${STATUS_COLORS[q.status] || ""}`}>{q.status}</Badge>
                       </div>
                     </div>
                   </button>
                 ))}
                 {witnessQuestions.length === 0 && (
                   <p className="text-xs text-slate-600 text-center py-8">No questions yet.</p>
                 )}
               </div>
             </div>

             {/* Question detail on right */}
             <div className="flex-1 overflow-y-auto p-5">
               {selectedQuestion ? (
                 <QuestionDetailPanel
                   question={selectedQuestion}
                   trialPoints={trialPoints}
                   depoClips={depoClips}
                   jointExhibits={jointExhibits}
                   egLinks={egLinks}
                   evidenceGroups={evidenceGroups}
                   onUpdate={load}
                   caseId={activeCase.id}
                 />
               ) : (
                 <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                   <HelpCircle className="w-12 h-12 opacity-10" />
                   <p>Select a question to view details</p>
                 </div>
               )}
             </div>
           </div>
         )}

        {/* BATTLE CARDS TAB */}
        {activeTab === "battlecards" && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><Swords className="w-4 h-4 text-red-400" /> Battle Cards</h2>
              <Button size="sm" className="bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 text-xs" onClick={() => setAddBcOpen(true)}>
                <Plus className="w-3 h-3 mr-1" /> New Battle Card
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {battleCards.map(bc => (
                <div key={bc.id} className="bg-[#131a2e] border border-red-900/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-semibold text-white">{bc.title}</p>
                    <button onClick={() => deleteBattleCard(bc.id)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  {bc.when_to_use && <p className="text-[10px] text-amber-400">When: {bc.when_to_use}</p>}
                  {bc.goal && <p className="text-[10px] text-slate-500">Goal: {bc.goal}</p>}
                  {bc.commit_question && (
                    <div className="space-y-1 pt-2 border-t border-[#1e2a45]">
                      {bc.commit_question && <p className="text-[10px] text-slate-400"><span className="text-green-400 font-semibold">C1 Commit:</span> {bc.commit_question}</p>}
                      {bc.credit_question && <p className="text-[10px] text-slate-400"><span className="text-cyan-400 font-semibold">C2 Credit:</span> {bc.credit_question}</p>}
                      {bc.confront_question && <p className="text-[10px] text-slate-400"><span className="text-red-400 font-semibold">C3 Confront:</span> {bc.confront_question}</p>}
                    </div>
                  )}
                  <Badge className={`text-[9px] ${bc.priority === "High" ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-400"}`}>{bc.priority}</Badge>
                </div>
              ))}
              {battleCards.length === 0 && <p className="text-slate-600 text-sm col-span-2 text-center py-8">No battle cards yet.</p>}
            </div>
          </div>
        )}
      </div>

      {/* ADD GROUP MODAL */}
      <Dialog open={addGroupOpen} onOpenChange={setAddGroupOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-sm">
          <DialogHeader><DialogTitle>Add Evidence Group to Plan</DialogTitle></DialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {evidenceGroups.filter(g => !currentPlanItems.some(i => i.evidence_group_id === g.id)).map(g => (
              <button key={g.id} onClick={() => addGroupToPlan(g.id)}
                className="w-full text-left px-3 py-2 rounded hover:bg-white/5 transition-colors">
                <p className="text-xs text-slate-300">{g.title}</p>
                <Badge className={`text-[9px] mt-0.5 ${g.priority === "High" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>{g.priority}</Badge>
              </button>
            ))}
            {evidenceGroups.filter(g => !currentPlanItems.some(i => i.evidence_group_id === g.id)).length === 0 && (
              <p className="text-xs text-slate-600 text-center py-4">All groups already added.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* NEW BATTLE CARD MODAL */}
      <Dialog open={addBcOpen} onOpenChange={setAddBcOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Swords className="w-4 h-4 text-red-400" /> New Battle Card</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs text-slate-400">Title / Topic</Label>
              <Input value={newBcForm.title} onChange={e => setNewBcForm({ ...newBcForm, title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div><Label className="text-xs text-slate-400">When to Use</Label>
              <Input value={newBcForm.when_to_use} onChange={e => setNewBcForm({ ...newBcForm, when_to_use: e.target.value })} placeholder="e.g. When witness denies sightlines" className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div><Label className="text-xs text-slate-400">Goal</Label>
              <Input value={newBcForm.goal} onChange={e => setNewBcForm({ ...newBcForm, goal: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div className="border-t border-[#1e2a45] pt-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">3-C Sequence</p>
              <div><Label className="text-xs text-green-400">Commit Question</Label>
                <Textarea value={newBcForm.commit_question} onChange={e => setNewBcForm({ ...newBcForm, commit_question: e.target.value })} rows={2} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div className="mt-2"><Label className="text-xs text-cyan-400">Credit Question</Label>
                <Textarea value={newBcForm.credit_question} onChange={e => setNewBcForm({ ...newBcForm, credit_question: e.target.value })} rows={2} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div className="mt-2"><Label className="text-xs text-red-400">Confront Question</Label>
                <Textarea value={newBcForm.confront_question} onChange={e => setNewBcForm({ ...newBcForm, confront_question: e.target.value })} rows={2} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
            </div>
            <div><Label className="text-xs text-slate-400">Priority</Label>
              <Select value={newBcForm.priority} onValueChange={v => setNewBcForm({ ...newBcForm, priority: v })}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="High">High</SelectItem><SelectItem value="Med">Med</SelectItem><SelectItem value="Low">Low</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBcOpen(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-red-700 hover:bg-red-800" onClick={saveBattleCard}>Save Battle Card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionDetailPanel({ question, trialPoints, depoClips, jointExhibits, battleCards, onUpdate, caseId }) {
  const [q, setQ] = useState(question);
  const [links, setLinks] = useState([]);

  useEffect(() => {
    setQ(question);
    base44.entities.QuestionLinks.filter({ question_id: question.id }).then(setLinks);
  }, [question.id]);

  const save = async (field, val) => {
    const updated = { ...q, [field]: val };
    setQ(updated);
    await base44.entities.Questions.update(q.id, { [field]: val });
    onUpdate();
  };

  const tpLinks = links.filter(l => l.link_type === "TrialPoint");
  const exhibitLinks = links.filter(l => l.link_type === "JointExhibit");
  const clipLinks = links.filter(l => l.link_type === "DepoClip");

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-4">
        <p className="text-base font-semibold text-white mb-2">{q.question_text}</p>
        <div className="flex gap-2 flex-wrap">
          <Badge className={q.exam_type === "Direct" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}>{q.exam_type}</Badge>
          <Badge className={STATUS_COLORS[q.status] || ""}>{q.status}</Badge>
          {q.importance && <Badge variant="outline" className="text-slate-400 border-slate-600">{q.importance}</Badge>}
        </div>
        {q.goal && <p className="text-xs text-slate-400 mt-2">🎯 {q.goal}</p>}
        {q.expected_answer && <p className="text-xs text-slate-400 mt-1">💬 Expected: {q.expected_answer}</p>}
      </div>

      <div>
        <Label className="text-xs text-slate-400">Live Notes</Label>
        <Textarea value={q.live_notes || ""} onChange={e => save("live_notes", e.target.value)} rows={2}
          className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-sm mt-1" placeholder="Notes during exam…" />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Linked Trial Points ({tpLinks.length})</p>
        {tpLinks.map(l => {
          const tp = trialPoints.find(t => t.id === l.link_id);
          return tp ? <p key={l.id} className="text-xs text-slate-300 bg-[#131a2e] rounded px-2 py-1">• {tp.point_text}</p> : null;
        })}
      </div>

      {exhibitLinks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Linked Exhibits ({exhibitLinks.length})</p>
          {exhibitLinks.map(l => {
            const je = jointExhibits.find(j => j.id === l.link_id);
            return je ? <p key={l.id} className="text-xs text-amber-300 bg-[#131a2e] rounded px-2 py-1">#{je.marked_no} — {je.marked_title}</p> : null;
          })}
        </div>
      )}

      {clipLinks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Depo Clips ({clipLinks.length})</p>
          {clipLinks.map(l => {
            const c = depoClips.find(dc => dc.id === l.link_id);
            return c ? <div key={l.id} className="bg-[#131a2e] rounded px-2 py-1">
              <p className="text-[10px] text-violet-400">{c.topic_tag}</p>
              <p className="text-xs text-slate-300 line-clamp-2">{c.clip_text}</p>
            </div> : null;
          })}
        </div>
      )}
    </div>
  );
}