import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, Layers, Tag, ChevronRight, BookOpen, FileText, Scissors,
  GitBranch, Trash2, X, HelpCircle, Image, Highlighter
} from "lucide-react";
import WorkflowBanner from "@/components/trial/WorkflowBanner";

const PRIORITY_COLORS = { High: "bg-red-500/20 text-red-400", Med: "bg-amber-500/20 text-amber-400", Low: "bg-slate-500/20 text-slate-400" };
const EXAM_COLORS = { Direct: "bg-green-500/20 text-green-400", Cross: "bg-orange-500/20 text-orange-400", Impeach: "bg-red-500/20 text-red-400", Rehab: "bg-blue-500/20 text-blue-400", Any: "bg-slate-500/20 text-slate-400" };
const EMPTY_GROUP = { title: "", description: "", default_exam_type: "Any", priority: "Med", tags: [] };

const KIND_ICONS = {
  JointExhibit: BookOpen,
  Extract: FileText,
  Callout: Scissors,
  HighlightSet: Highlighter,
  DepoClip: FileText,
  TrialPoint: GitBranch,
  Party: Tag,
};

export default function ProofLibrary() {
  const { activeCase } = useActiveCase();
  const [groups, setGroups] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);
  const [parties, setParties] = useState([]);
  const [depoClips, setDepoClips] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [callouts, setCallouts] = useState([]);
  const [highlightSets, setHighlightSets] = useState([]);
  const [egLinks, setEgLinks] = useState([]);

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterExamType, setFilterExamType] = useState("all");

  const [editingGroup, setEditingGroup] = useState(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({ ...EMPTY_GROUP });
  const [tagInput, setTagInput] = useState("");

  const [genQuestionsOpen, setGenQuestionsOpen] = useState(false);
  const [genForm, setGenForm] = useState({ party_id: "", exam_type: "Cross", count: 3 });
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState("");

  const [addToWitnessOpen, setAddToWitnessOpen] = useState(false);
  const [witnessPlans, setWitnessPlans] = useState([]);
  const [addWitnessForm, setAddWitnessForm] = useState({ party_id: "", exam_type: "Cross" });

  // Evidence picker
  const [evidencePickerOpen, setEvidencePickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState("callouts");
  const [pickerSearch, setPickerSearch] = useState("");

  const load = async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [g, tp, p, dc, je, ex, co, hs, egl] = await Promise.all([
      base44.entities.EvidenceGroups.filter({ case_id: cid }),
      base44.entities.TrialPoints.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.DepoClips.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.ExhibitExtracts.filter({ case_id: cid }),
      base44.entities.ExtractCallout.filter({ case_id: cid }),
      base44.entities.HighlightSet.list(),
      base44.entities.EvidenceGroupLinks.list(),
    ]);
    setGroups(g);
    setTrialPoints(tp);
    setParties(p);
    setDepoClips(dc);
    setJointExhibits(je);
    setExtracts(ex);
    setCallouts(co);
    setHighlightSets(hs.filter(h => co.some(c => c.id === h.callout_id)));
    setEgLinks(egl.filter(l => g.find(gg => gg.id === l.evidence_group_id)));
  };

  useEffect(() => { load(); }, [activeCase]);

  const selectedGroup = useMemo(() => groups.find(g => g.id === selectedGroupId), [groups, selectedGroupId]);
  const linksForGroup = useMemo(() => {
    if (!selectedGroupId) return [];
    return egLinks.filter(l => l.evidence_group_id === selectedGroupId);
  }, [egLinks, selectedGroupId]);

  const filteredGroups = useMemo(() => groups.filter(g => {
    const matchSearch = !search || g.title?.toLowerCase().includes(search.toLowerCase());
    const matchPriority = filterPriority === "all" || g.priority === filterPriority;
    const matchExam = filterExamType === "all" || g.default_exam_type === filterExamType;
    return matchSearch && matchPriority && matchExam;
  }), [groups, search, filterPriority, filterExamType]);

  const saveNewGroup = async () => {
    await base44.entities.EvidenceGroups.create({ ...newGroupForm, case_id: activeCase.id });
    setNewGroupOpen(false);
    setNewGroupForm({ ...EMPTY_GROUP });
    load();
  };

  const saveEditGroup = async () => {
    await base44.entities.EvidenceGroups.update(editingGroup.id, editingGroup);
    setEditingGroup(null);
    load();
  };

  const deleteGroup = async (id) => {
    if (!confirm("Delete this evidence group?")) return;
    await base44.entities.EvidenceGroups.delete(id);
    if (selectedGroupId === id) setSelectedGroupId(null);
    load();
  };

  const removeLink = async (linkId) => {
    await base44.entities.EvidenceGroupLinks.delete(linkId);
    load();
  };

  const addLink = async (linkType, linkId) => {
    await base44.entities.EvidenceGroupLinks.create({
      evidence_group_id: selectedGroupId,
      link_type: linkType,
      link_id: linkId,
      role: "Supports",
      sort_order: linksForGroup.length,
    });
    load();
  };

  // Fixed generate questions — always clears loading with try/finally + timeout guard
  const generateQuestions = async () => {
    if (!genForm.party_id || !selectedGroupId) return;
    setGenLoading(true);
    setGenError("");
    const timeout = setTimeout(() => {
      setGenLoading(false);
      setGenError("Timed out after 12s. Please try again.");
    }, 12000);
    try {
      const tpLinks = linksForGroup.filter(l => l.link_type === "TrialPoint");
      const proofIds = linksForGroup
        .filter(l => ["JointExhibit","Extract","Callout","HighlightSet","DepoClip"].includes(l.link_type))
        .map(l => l.link_id);
      const created = [];
      for (let i = 0; i < genForm.count; i++) {
        const q = await base44.entities.Questions.create({
          case_id: activeCase.id,
          party_id: genForm.party_id,
          exam_type: genForm.exam_type,
          question_text: `(From: ${selectedGroup.title}) — [edit me]`,
          order_index: i,
          primary_evidence_group_id: selectedGroupId,
          importance: selectedGroup.priority || "Med",
          linked_trial_point_ids: tpLinks.map(l => l.link_id),
          linked_proof_item_ids: proofIds,
        });
        created.push(q);
      }
      clearTimeout(timeout);
      setGenQuestionsOpen(false);
      // Zero-click landing: navigate to WitnessPrep with first question auto-focused
      if (created.length > 0) {
        const firstQ = created[0];
        const queryStr = new URLSearchParams({
          witnessId: genForm.party_id,
          examType: genForm.exam_type,
          groupId: selectedGroupId,
          tab: "questions",
          questionId: firstQ.id,
        }).toString();
        window.location.href = `/WitnessPrep?${queryStr}`;
      } else {
        await load();
      }
    } catch (err) {
      clearTimeout(timeout);
      setGenError(err?.message || "Failed to create questions");
    } finally {
      setGenLoading(false);
    }
  };

  const addToWitnessPlan = async () => {
    if (!addWitnessForm.party_id || !selectedGroupId) return;
    let plan = witnessPlans.find(p => p.party_id === addWitnessForm.party_id && p.exam_type === addWitnessForm.exam_type);
    if (!plan) {
      const party = parties.find(p => p.id === addWitnessForm.party_id);
      plan = await base44.entities.WitnessPlans.create({
        case_id: activeCase.id,
        party_id: addWitnessForm.party_id,
        exam_type: addWitnessForm.exam_type,
        title: `${party?.display_name || party?.last_name} ${addWitnessForm.exam_type}`,
      });
    }
    const existing = await base44.entities.WitnessPlanItems.filter({ witness_plan_id: plan.id });
    await base44.entities.WitnessPlanItems.create({
      witness_plan_id: plan.id,
      evidence_group_id: selectedGroupId,
      order_index: existing.length,
    });
    setAddToWitnessOpen(false);
  };

  const openAddToWitness = async () => {
    const plans = await base44.entities.WitnessPlans.filter({ case_id: activeCase.id });
    setWitnessPlans(plans);
    setAddWitnessForm({ party_id: "", exam_type: "Cross" });
    setAddToWitnessOpen(true);
  };

  // Evidence picker: attach callout / extract / highlight set / joint exhibit / depo clip
  const attachEvidence = async (type, id) => {
    await addLink(type, id);
    setEvidencePickerOpen(false);
    setPickerSearch("");
  };

  const alreadyLinkedIds = useMemo(() => new Set(linksForGroup.map(l => l.link_id)), [linksForGroup]);

  const getLinkLabel = (link) => {
    switch (link.link_type) {
      case "JointExhibit": { const j = jointExhibits.find(x => x.id === link.link_id); return j ? `#${j.marked_no} ${j.marked_title}` : link.link_id; }
      case "Extract": { const e = extracts.find(x => x.id === link.link_id); return e ? (e.extract_title_internal || e.extract_title_official) : link.link_id; }
      case "Callout": { const c = callouts.find(x => x.id === link.link_id); return c ? (c.name || `p.${c.page_number}`) : link.link_id; }
      case "HighlightSet": { const hs = highlightSets.find(x => x.id === link.link_id); return hs ? hs.name : link.link_id; }
      case "DepoClip": { const d = depoClips.find(x => x.id === link.link_id); return d ? `${d.topic_tag || ""} — ${(d.clip_text || "").slice(0, 40)}` : link.link_id; }
      case "TrialPoint": { const tp = trialPoints.find(x => x.id === link.link_id); return tp ? tp.point_text : link.link_id; }
      case "Party": { const p = parties.find(x => x.id === link.link_id); return p ? (p.display_name || `${p.first_name} ${p.last_name}`) : link.link_id; }
      default: return link.link_id;
    }
  };

  const getCalloutExtractLabel = (c) => {
    const ext = extracts.find(e => e.id === c.extract_id);
    return `${c.name || `p.${c.page_number}`}${ext ? ` · ${ext.extract_title_internal || ext.extract_title_official}` : ""}`;
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden flex-col">
      <WorkflowBanner />
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Groups list */}
        <div className="w-72 flex-shrink-0 border-r border-[#1e2a45] flex flex-col bg-[#0f1629]">
          <div className="p-3 border-b border-[#1e2a45] space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><Layers className="w-4 h-4 text-cyan-400" /> Evidence Groups</h2>
              <Button size="sm" className="h-6 bg-cyan-600 hover:bg-cyan-700 text-xs px-2" onClick={() => setNewGroupOpen(true)}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-500" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-7 h-7 text-xs bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div className="flex gap-1">
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="h-6 text-[10px] bg-[#0a0f1e] border-[#1e2a45] text-slate-300 flex-1"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  {["all","High","Med","Low"].map(v => <SelectItem key={v} value={v}>{v === "all" ? "All" : v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterExamType} onValueChange={setFilterExamType}>
                <SelectTrigger className="h-6 text-[10px] bg-[#0a0f1e] border-[#1e2a45] text-slate-300 flex-1"><SelectValue placeholder="Exam" /></SelectTrigger>
                <SelectContent>
                  {["all","Direct","Cross","Impeach","Any"].map(v => <SelectItem key={v} value={v}>{v === "all" ? "All" : v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredGroups.map(g => {
              const isSelected = g.id === selectedGroupId;
              const linkCount = egLinks.filter(l => l.evidence_group_id === g.id).length;
              return (
                <button key={g.id} onClick={() => setSelectedGroupId(g.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-[#1e2a45] transition-colors ${isSelected ? "bg-cyan-500/10 border-l-2 border-l-cyan-400" : "hover:bg-white/5 border-l-2 border-l-transparent"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium leading-snug ${isSelected ? "text-cyan-200" : "text-slate-300"}`}>{g.title}</p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <Badge className={`text-[9px] px-1 py-0 ${PRIORITY_COLORS[g.priority] || ""}`}>{g.priority}</Badge>
                        <Badge className={`text-[9px] px-1 py-0 ${EXAM_COLORS[g.default_exam_type] || ""}`}>{g.default_exam_type}</Badge>
                        {linkCount > 0 && <span className="text-[9px] text-slate-500">{linkCount} items</span>}
                      </div>
                    </div>
                    <ChevronRight className={`w-3 h-3 flex-shrink-0 mt-0.5 ${isSelected ? "text-cyan-400" : "text-slate-600"}`} />
                  </div>
                </button>
              );
            })}
            {filteredGroups.length === 0 && <p className="text-xs text-slate-600 text-center py-8">No groups yet.</p>}
          </div>
        </div>

        {/* RIGHT: Group editor */}
        <div className="flex-1 overflow-y-auto">
          {!selectedGroup ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
              <Layers className="w-16 h-16 opacity-10" />
              <p>Select an evidence group to edit</p>
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setNewGroupOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> New Group
              </Button>
            </div>
          ) : (
            <div className="p-6 max-w-4xl">
              <div className="flex items-start justify-between mb-4 gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-white">{selectedGroup.title}</h1>
                  {selectedGroup.description && <p className="text-sm text-slate-400 mt-1">{selectedGroup.description}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge className={PRIORITY_COLORS[selectedGroup.priority] || ""}>{selectedGroup.priority} priority</Badge>
                    <Badge className={EXAM_COLORS[selectedGroup.default_exam_type] || ""}>{selectedGroup.default_exam_type}</Badge>
                    {(selectedGroup.tags || []).map(t => <Badge key={t} variant="outline" className="text-[10px] text-slate-400 border-slate-600"><Tag className="w-2.5 h-2.5 mr-1" />{t}</Badge>)}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  <Button size="sm" variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs h-7" onClick={() => setEditingGroup({ ...selectedGroup })}>Edit</Button>
                  <Button size="sm" className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 text-xs h-7" onClick={openAddToWitness}>
                    Add to Plan…
                  </Button>
                  <Button size="sm" className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 text-xs h-7" onClick={() => { setGenError(""); setGenQuestionsOpen(true); }}>
                    <HelpCircle className="w-3 h-3 mr-1" /> Create Qs…
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7" onClick={() => deleteGroup(selectedGroup.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="evidence">
                <TabsList className="bg-[#131a2e] border border-[#1e2a45]">
                  <TabsTrigger value="evidence" className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                    Evidence ({linksForGroup.filter(l => ["JointExhibit","Extract","Callout","HighlightSet","DepoClip"].includes(l.link_type)).length})
                  </TabsTrigger>
                  <TabsTrigger value="trialpoints" className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                    Trial Points ({linksForGroup.filter(l => l.link_type === "TrialPoint").length})
                  </TabsTrigger>
                  <TabsTrigger value="parties" className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                    Parties ({linksForGroup.filter(l => l.link_type === "Party").length})
                  </TabsTrigger>
                </TabsList>

                {/* EVIDENCE TAB — Callouts, Extracts, HighlightSets, Exhibits, Clips */}
                <TabsContent value="evidence" className="mt-3 space-y-2">
                  <div className="space-y-1.5">
                    {linksForGroup
                      .filter(l => ["JointExhibit","Extract","Callout","HighlightSet","DepoClip"].includes(l.link_type))
                      .map(link => {
                        const Icon = KIND_ICONS[link.link_type] || FileText;
                        const label = getLinkLabel(link);
                        const isCallout = link.link_type === "Callout";
                        const callout = isCallout ? callouts.find(c => c.id === link.link_id) : null;
                        return (
                          <div key={link.id} className="flex items-center gap-2 bg-[#131a2e] border border-[#1e2a45] rounded-lg px-3 py-2">
                            {callout?.snapshot_image_url ? (
                              <img src={callout.snapshot_image_url} alt="" className="w-10 h-7 object-cover rounded border border-[#1e2a45] flex-shrink-0" />
                            ) : (
                              <Icon className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-200 truncate">{label}</p>
                              <span className={`text-[9px] px-1 rounded ${
                                link.link_type === "Callout" ? "text-yellow-400 bg-yellow-900/20" :
                                link.link_type === "HighlightSet" ? "text-purple-400 bg-purple-900/20" :
                                link.link_type === "Extract" ? "text-blue-400 bg-blue-900/20" :
                                link.link_type === "DepoClip" ? "text-violet-400 bg-violet-900/20" :
                                "text-amber-400 bg-amber-900/20"
                              }`}>{link.link_type}</span>
                            </div>
                            <button onClick={() => removeLink(link.id)} className="text-slate-600 hover:text-red-400 flex-shrink-0"><X className="w-3 h-3" /></button>
                          </div>
                        );
                      })}
                  </div>
                  <Button size="sm" variant="outline" className="border-dashed border-cyan-800/50 text-cyan-500 hover:bg-cyan-900/10 text-xs h-7 mt-1"
                    onClick={() => { setEvidencePickerOpen(true); setPickerSearch(""); setPickerTab("callouts"); }}>
                    <Plus className="w-3 h-3 mr-1" /> Attach Evidence…
                  </Button>
                </TabsContent>

                {/* TRIAL POINTS */}
                <TabsContent value="trialpoints" className="mt-3 space-y-2">
                  {linksForGroup.filter(l => l.link_type === "TrialPoint").map(link => {
                    const tp = trialPoints.find(t => t.id === link.link_id);
                    return tp ? (
                      <div key={link.id} className="flex items-center justify-between bg-[#131a2e] border border-[#1e2a45] rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-200 flex-1 mr-2">{tp.point_text}</p>
                        <button onClick={() => removeLink(link.id)} className="text-slate-600 hover:text-red-400"><X className="w-3 h-3" /></button>
                      </div>
                    ) : null;
                  })}
                  <AttachSelector
                    label="Link Trial Point"
                    items={trialPoints.filter(t => !alreadyLinkedIds.has(t.id))}
                    getLabel={t => t.point_text}
                    onSelect={id => addLink("TrialPoint", id)}
                  />
                </TabsContent>

                {/* PARTIES */}
                <TabsContent value="parties" className="mt-3 space-y-2">
                  {linksForGroup.filter(l => l.link_type === "Party").map(link => {
                    const p = parties.find(x => x.id === link.link_id);
                    return p ? (
                      <div key={link.id} className="flex items-center justify-between bg-[#131a2e] border border-[#1e2a45] rounded-lg px-3 py-2">
                        <span className="text-xs text-slate-200">{p.display_name || `${p.first_name} ${p.last_name}`}</span>
                        <button onClick={() => removeLink(link.id)} className="text-slate-600 hover:text-red-400"><X className="w-3 h-3" /></button>
                      </div>
                    ) : null;
                  })}
                  <AttachSelector
                    label="Link Party"
                    items={parties.filter(p => !alreadyLinkedIds.has(p.id))}
                    getLabel={p => p.display_name || `${p.first_name} ${p.last_name}`}
                    onSelect={id => addLink("Party", id)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* NEW / EDIT GROUP DIALOGS */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
          <DialogHeader><DialogTitle>New Evidence Group</DialogTitle></DialogHeader>
          <GroupForm form={newGroupForm} setForm={setNewGroupForm} tagInput={tagInput} setTagInput={setTagInput} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveNewGroup} disabled={!newGroupForm.title?.trim()}>Create Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingGroup} onOpenChange={v => !v && setEditingGroup(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
          <DialogHeader><DialogTitle>Edit Evidence Group</DialogTitle></DialogHeader>
          {editingGroup && <GroupForm form={editingGroup} setForm={setEditingGroup} tagInput={tagInput} setTagInput={setTagInput} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveEditGroup}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GENERATE QUESTIONS DIALOG — fixed hang */}
      <Dialog open={genQuestionsOpen} onOpenChange={v => { if (!genLoading) setGenQuestionsOpen(v); }}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><HelpCircle className="w-4 h-4 text-cyan-400" /> Create Placeholder Questions</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-400">Creates editable placeholder questions from: <strong className="text-white">{selectedGroup?.title}</strong></p>
          <p className="text-[11px] text-slate-500 italic">(You will edit the question text in Witness Prep)</p>
          {genError && <p className="text-xs text-red-400 bg-red-950/30 border border-red-700/30 rounded px-2 py-1">{genError}</p>}
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">Witness</Label>
              <Select value={genForm.party_id} onValueChange={v => setGenForm({ ...genForm, party_id: v })}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select witness…" /></SelectTrigger>
                <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name || `${p.first_name} ${p.last_name}`}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Exam Type</Label>
              <Select value={genForm.exam_type} onValueChange={v => setGenForm({ ...genForm, exam_type: v })}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Direct">Direct</SelectItem><SelectItem value="Cross">Cross</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Number of Placeholder Questions</Label>
              <Input type="number" min={1} max={20} value={genForm.count} onChange={e => setGenForm({ ...genForm, count: parseInt(e.target.value) || 1 })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenQuestionsOpen(false)} disabled={genLoading} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={generateQuestions} disabled={genLoading || !genForm.party_id}>
              {genLoading ? "Creating…" : `Create ${genForm.count} Questions`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD TO WITNESS PLAN DIALOG */}
      <Dialog open={addToWitnessOpen} onOpenChange={setAddToWitnessOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-purple-400" /> Add to Witness Plan</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-400">Adding: <strong className="text-white">{selectedGroup?.title}</strong></p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">Witness</Label>
              <Select value={addWitnessForm.party_id} onValueChange={v => setAddWitnessForm({ ...addWitnessForm, party_id: v })}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select witness…" /></SelectTrigger>
                <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name || `${p.first_name} ${p.last_name}`}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Exam Type</Label>
              <Select value={addWitnessForm.exam_type} onValueChange={v => setAddWitnessForm({ ...addWitnessForm, exam_type: v })}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Direct">Direct</SelectItem><SelectItem value="Cross">Cross</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddToWitnessOpen(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={addToWitnessPlan} disabled={!addWitnessForm.party_id}>Add to Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EVIDENCE PICKER DIALOG */}
      <Dialog open={evidencePickerOpen} onOpenChange={setEvidencePickerOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>Attach Evidence</DialogTitle></DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-500" />
            <Input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Search…" className="pl-7 h-7 text-xs bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
          </div>
          <Tabs value={pickerTab} onValueChange={setPickerTab} className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="bg-[#0a0f1e] border border-[#1e2a45] flex-shrink-0">
              {[
                { id: "callouts", label: "Callouts" },
                { id: "highlightsets", label: "Highlight Sets" },
                { id: "extracts", label: "Extracts" },
                { id: "exhibits", label: "Exhibits" },
                { id: "clips", label: "Depo Clips" },
              ].map(t => (
                <TabsTrigger key={t.id} value={t.id} className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white">{t.label}</TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-2 space-y-1">
              {pickerTab === "callouts" && callouts
                .filter(c => !alreadyLinkedIds.has(c.id) && (!pickerSearch || getCalloutExtractLabel(c).toLowerCase().includes(pickerSearch.toLowerCase())))
                .map(c => (
                  <button key={c.id} onClick={() => attachEvidence("Callout", c.id)}
                    className="w-full flex items-center gap-2 text-left px-3 py-2 bg-[#0f1629] hover:bg-cyan-900/20 rounded-lg border border-[#1e2a45] transition-colors">
                    {c.snapshot_image_url ? (
                      <img src={c.snapshot_image_url} alt="" className="w-12 h-8 object-cover rounded border border-[#1e2a45] flex-shrink-0" />
                    ) : (
                      <Scissors className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 truncate">{getCalloutExtractLabel(c)}</p>
                      <p className="text-[9px] text-slate-500">p.{c.page_number}</p>
                    </div>
                  </button>
                ))}

              {pickerTab === "highlightsets" && highlightSets
                .filter(hs => !alreadyLinkedIds.has(hs.id) && (!pickerSearch || hs.name.toLowerCase().includes(pickerSearch.toLowerCase())))
                .map(hs => {
                  const c = callouts.find(x => x.id === hs.callout_id);
                  return (
                    <button key={hs.id} onClick={() => attachEvidence("HighlightSet", hs.id)}
                      className="w-full flex items-center gap-2 text-left px-3 py-2 bg-[#0f1629] hover:bg-purple-900/20 rounded-lg border border-[#1e2a45] transition-colors">
                      <Highlighter className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 truncate">{hs.name}</p>
                        {c && <p className="text-[9px] text-slate-500 truncate">Callout: {c.name || `p.${c.page_number}`}</p>}
                      </div>
                    </button>
                  );
                })}

              {pickerTab === "extracts" && extracts
                .filter(e => !alreadyLinkedIds.has(e.id) && (!pickerSearch || (e.extract_title_internal || e.extract_title_official || "").toLowerCase().includes(pickerSearch.toLowerCase())))
                .map(e => (
                  <button key={e.id} onClick={() => attachEvidence("Extract", e.id)}
                    className="w-full text-left px-3 py-2 bg-[#0f1629] hover:bg-blue-900/20 rounded-lg border border-[#1e2a45] transition-colors">
                    <p className="text-xs text-slate-200 truncate">{e.extract_title_internal || e.extract_title_official}</p>
                    <p className="text-[9px] text-slate-500">{e.extract_page_start && e.extract_page_end ? `pp. ${e.extract_page_start}–${e.extract_page_end}` : ""}</p>
                  </button>
                ))}

              {pickerTab === "exhibits" && jointExhibits
                .filter(j => !alreadyLinkedIds.has(j.id) && (!pickerSearch || (`${j.marked_no} ${j.marked_title}`).toLowerCase().includes(pickerSearch.toLowerCase())))
                .map(j => (
                  <button key={j.id} onClick={() => attachEvidence("JointExhibit", j.id)}
                    className="w-full text-left px-3 py-2 bg-[#0f1629] hover:bg-amber-900/20 rounded-lg border border-[#1e2a45] transition-colors">
                    <p className="text-xs text-slate-200"><span className="text-amber-300 font-bold">#{j.marked_no}</span> {j.marked_title}</p>
                    <Badge className={`text-[9px] mt-0.5 ${j.status === "Admitted" ? "bg-green-500/20 text-green-400" : "bg-slate-500/20 text-slate-400"}`}>{j.status}</Badge>
                  </button>
                ))}

              {pickerTab === "clips" && depoClips
                .filter(c => !alreadyLinkedIds.has(c.id) && (!pickerSearch || (c.clip_text || c.topic_tag || "").toLowerCase().includes(pickerSearch.toLowerCase())))
                .map(c => (
                  <button key={c.id} onClick={() => attachEvidence("DepoClip", c.id)}
                    className="w-full text-left px-3 py-2 bg-[#0f1629] hover:bg-violet-900/20 rounded-lg border border-[#1e2a45] transition-colors">
                    <p className="text-[9px] text-violet-400">{c.topic_tag}</p>
                    <p className="text-xs text-slate-300 line-clamp-2">{c.clip_text}</p>
                  </button>
                ))}
            </div>
          </Tabs>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setEvidencePickerOpen(false)} className="border-slate-600 text-slate-300">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupForm({ form, setForm, tagInput, setTagInput }) {
  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm({ ...form, tags: [...(form.tags || []), tagInput.trim()] });
    setTagInput("");
  };
  const removeTag = (t) => setForm({ ...form, tags: (form.tags || []).filter(x => x !== t) });
  return (
    <div className="space-y-3">
      <div><Label className="text-xs text-slate-400">Title</Label>
        <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="e.g. Sightlines blocked" />
      </div>
      <div><Label className="text-xs text-slate-400">Description</Label>
        <Textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs text-slate-400">Exam Type</Label>
          <Select value={form.default_exam_type || "Any"} onValueChange={v => setForm({ ...form, default_exam_type: v })}>
            <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>{["Direct","Cross","Impeach","Rehab","Any"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs text-slate-400">Priority</Label>
          <Select value={form.priority || "Med"} onValueChange={v => setForm({ ...form, priority: v })}>
            <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>{["High","Med","Low"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs text-slate-400">Tags</Label>
        <div className="flex gap-2 mt-1">
          <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} placeholder="Add tag…" className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 h-7 text-xs flex-1" />
          <Button size="sm" className="h-7 text-xs bg-slate-700 hover:bg-slate-600" onClick={addTag}>Add</Button>
        </div>
        <div className="flex gap-1 flex-wrap mt-1.5">
          {(form.tags || []).map(t => (
            <Badge key={t} variant="outline" className="text-[10px] text-slate-400 border-slate-600 flex items-center gap-1">
              {t} <button onClick={() => removeTag(t)}><X className="w-2.5 h-2.5" /></button>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function AttachSelector({ label, items, getLabel, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = items.filter(i => getLabel(i).toLowerCase().includes(search.toLowerCase()));
  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-cyan-500 hover:text-cyan-300 border border-dashed border-cyan-800/40 rounded px-2 py-1 mt-1">
      <Plus className="w-3 h-3" /> {label}
    </button>
  );
  return (
    <div className="bg-[#0a0f1e] border border-[#1e2a45] rounded-lg p-2 space-y-1.5">
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="h-6 text-xs bg-[#131a2e] border-[#1e2a45] text-slate-200" />
      <div className="max-h-40 overflow-y-auto space-y-0.5">
        {filtered.slice(0, 20).map(i => (
          <button key={i.id} onClick={() => { onSelect(i.id); setOpen(false); setSearch(""); }}
            className="w-full text-left text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded px-2 py-1 truncate">{getLabel(i)}</button>
        ))}
        {filtered.length === 0 && <p className="text-[10px] text-slate-600 text-center py-2">No items found</p>}
      </div>
      <button onClick={() => setOpen(false)} className="text-[10px] text-slate-500 hover:text-slate-300">Cancel</button>
    </div>
  );
}