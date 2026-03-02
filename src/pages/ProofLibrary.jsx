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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Plus, Search, Layers, Tag, ChevronRight, BookOpen, FileText, Scissors,
  GitBranch, Trash2, X, HelpCircle, Zap, Info
} from "lucide-react";
import WorkflowBanner from "@/components/trial/WorkflowBanner";

const PRIORITY_COLORS = { High: "bg-red-500/20 text-red-400", Med: "bg-amber-500/20 text-amber-400", Low: "bg-slate-500/20 text-slate-400" };
const EXAM_COLORS = { Direct: "bg-green-500/20 text-green-400", Cross: "bg-orange-500/20 text-orange-400", Impeach: "bg-red-500/20 text-red-400", Rehab: "bg-blue-500/20 text-blue-400", Any: "bg-slate-500/20 text-slate-400" };

const EMPTY_GROUP = { title: "", description: "", default_exam_type: "Any", priority: "Med", tags: [] };

export default function ProofLibrary() {
  const { activeCase } = useActiveCase();
  const [groups, setGroups] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);
  const [parties, setParties] = useState([]);
  const [depoClips, setDepoClips] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [admittedExhibits, setAdmittedExhibits] = useState([]);
  const [extracts, setExtracts] = useState([]);
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

  const [addToWitnessOpen, setAddToWitnessOpen] = useState(false);
  const [witnessPlans, setWitnessPlans] = useState([]);
  const [addWitnessForm, setAddWitnessForm] = useState({ party_id: "", exam_type: "Cross" });

  const load = async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [g, tp, p, dc, je, ae, ex, egl] = await Promise.all([
      base44.entities.EvidenceGroups.filter({ case_id: cid }),
      base44.entities.TrialPoints.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.DepoClips.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.AdmittedExhibits.filter({ case_id: cid }),
      base44.entities.ExhibitExtracts.filter({ case_id: cid }),
      base44.entities.EvidenceGroupLinks.list(),
    ]);
    setGroups(g);
    setTrialPoints(tp);
    setParties(p);
    setDepoClips(dc);
    setJointExhibits(je);
    setAdmittedExhibits(ae);
    setExtracts(ex);
    setEgLinks(egl.filter(l => g.find(gg => gg.id === l.evidence_group_id)));
  };

  useEffect(() => { load(); }, [activeCase]);

  const selectedGroup = useMemo(() => groups.find(g => g.id === selectedGroupId), [groups, selectedGroupId]);

  const linksForGroup = useMemo(() => {
    if (!selectedGroupId) return [];
    return egLinks.filter(l => l.evidence_group_id === selectedGroupId);
  }, [egLinks, selectedGroupId]);

  const filteredGroups = useMemo(() => groups.filter(g => {
    const matchSearch = !search || g.title?.toLowerCase().includes(search.toLowerCase()) || (g.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchPriority = filterPriority === "all" || g.priority === filterPriority;
    const matchExam = filterExamType === "all" || g.default_exam_type === filterExamType;
    return matchSearch && matchPriority && matchExam;
  }), [groups, search, filterPriority, filterExamType]);

  const admittedById = useMemo(() => {
    const m = {};
    admittedExhibits.forEach(a => { m[a.joint_exhibit_id] = a; });
    return m;
  }, [admittedExhibits]);

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
    });
    load();
  };

  const generateQuestions = async () => {
    if (!genForm.party_id || !selectedGroupId) return;
    setGenLoading(true);
    const groupLinks = egLinks.filter(l => l.evidence_group_id === selectedGroupId);
    const tpLinks = groupLinks.filter(l => l.link_type === "TrialPoint");
    for (let i = 0; i < genForm.count; i++) {
      const q = await base44.entities.Questions.create({
        case_id: activeCase.id,
        party_id: genForm.party_id,
        exam_type: genForm.exam_type,
        question_text: `[Question ${i + 1} for: ${selectedGroup.title}]`,
        order_index: i,
        primary_evidence_group_id: selectedGroupId,
        importance: selectedGroup.priority || "Med",
      });
      for (const tpLink of tpLinks) {
        await base44.entities.QuestionLinks.create({
          question_id: q.id,
          link_type: "TrialPoint",
          link_id: tpLink.link_id,
        });
      }
    }
    setGenLoading(false);
    setGenQuestionsOpen(false);
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
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Med">Med</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterExamType} onValueChange={setFilterExamType}>
                <SelectTrigger className="h-6 text-[10px] bg-[#0a0f1e] border-[#1e2a45] text-slate-300 flex-1"><SelectValue placeholder="Exam" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Direct">Direct</SelectItem>
                  <SelectItem value="Cross">Cross</SelectItem>
                  <SelectItem value="Impeach">Impeach</SelectItem>
                  <SelectItem value="Any">Any</SelectItem>
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
                        {linkCount > 0 && <span className="text-[9px] text-slate-500">{linkCount} links</span>}
                      </div>
                    </div>
                    <ChevronRight className={`w-3 h-3 flex-shrink-0 mt-0.5 ${isSelected ? "text-cyan-400" : "text-slate-600"}`} />
                  </div>
                </button>
              );
            })}
            {filteredGroups.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-8">No groups yet. Create one to get started.</p>
            )}
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
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-bold text-white">{selectedGroup.title}</h1>
                  {selectedGroup.description && <p className="text-sm text-slate-400 mt-1">{selectedGroup.description}</p>}
                  <div className="flex gap-2 mt-2">
                    <Badge className={PRIORITY_COLORS[selectedGroup.priority] || ""}>{selectedGroup.priority} priority</Badge>
                    <Badge className={EXAM_COLORS[selectedGroup.default_exam_type] || ""}>{selectedGroup.default_exam_type}</Badge>
                    {(selectedGroup.tags || []).map(t => <Badge key={t} variant="outline" className="text-[10px] text-slate-400 border-slate-600"><Tag className="w-2.5 h-2.5 mr-1" />{t}</Badge>)}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs" onClick={() => setEditingGroup({ ...selectedGroup })}>Edit</Button>
                  <Button size="sm" className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 text-xs" onClick={openAddToWitness}>
                    Add to Witness Plan…
                  </Button>
                  <Button size="sm" className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 text-xs" onClick={() => setGenQuestionsOpen(true)}>
                    <HelpCircle className="w-3 h-3 mr-1" /> Create Questions…
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => deleteGroup(selectedGroup.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Linked Proof Tabs */}
              <Tabs defaultValue="trialpoints">
                <TabsList className="bg-[#131a2e] border border-[#1e2a45]">
                  <TabsTrigger value="trialpoints" className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                    Trial Points ({linksForGroup.filter(l => l.link_type === "TrialPoint").length})
                  </TabsTrigger>
                  <TabsTrigger value="clips" className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                    Depo Clips ({linksForGroup.filter(l => l.link_type === "DepoClip").length})
                  </TabsTrigger>
                  <TabsTrigger value="exhibits" className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                    Exhibits ({linksForGroup.filter(l => l.link_type === "JointExhibit").length})
                  </TabsTrigger>
                  <TabsTrigger value="parties" className="text-xs data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                    Parties ({linksForGroup.filter(l => l.link_type === "Party").length})
                  </TabsTrigger>
                </TabsList>

                {/* TRIAL POINTS */}
                <TabsContent value="trialpoints" className="mt-3 space-y-2">
                  {linksForGroup.filter(l => l.link_type === "TrialPoint").map(link => {
                    const tp = trialPoints.find(t => t.id === link.link_id);
                    return tp ? (
                      <div key={link.id} className="flex items-center justify-between bg-[#131a2e] border border-[#1e2a45] rounded-lg px-3 py-2">
                        <div>
                          <p className="text-xs text-slate-200">{tp.point_text}</p>
                          <div className="flex gap-1 mt-1">
                            {tp.status && <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-700">{tp.status}</Badge>}
                            {tp.theme && <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-700">{tp.theme}</Badge>}
                          </div>
                        </div>
                        <button onClick={() => removeLink(link.id)} className="text-slate-600 hover:text-red-400 ml-2"><X className="w-3 h-3" /></button>
                      </div>
                    ) : null;
                  })}
                  <AttachSelector
                    label="Link Trial Point"
                    items={trialPoints.filter(t => !linksForGroup.some(l => l.link_type === "TrialPoint" && l.link_id === t.id))}
                    getLabel={t => t.point_text}
                    onSelect={id => addLink("TrialPoint", id)}
                  />
                </TabsContent>

                {/* DEPO CLIPS */}
                <TabsContent value="clips" className="mt-3 space-y-2">
                  {linksForGroup.filter(l => l.link_type === "DepoClip").map(link => {
                    const clip = depoClips.find(c => c.id === link.link_id);
                    return clip ? (
                      <div key={link.id} className="flex items-start justify-between bg-[#131a2e] border border-[#1e2a45] rounded-lg px-3 py-2">
                        <div className="flex-1">
                          <p className="text-[10px] text-violet-400 mb-0.5">{clip.topic_tag}</p>
                          <p className="text-xs text-slate-300 line-clamp-2">{clip.clip_text}</p>
                          {clip.start_cite && <p className="text-[9px] text-slate-500 mt-0.5 font-mono">{clip.start_cite}{clip.end_cite ? ` – ${clip.end_cite}` : ""}</p>}
                        </div>
                        <button onClick={() => removeLink(link.id)} className="text-slate-600 hover:text-red-400 ml-2 flex-shrink-0"><X className="w-3 h-3" /></button>
                      </div>
                    ) : null;
                  })}
                  <AttachSelector
                    label="Attach Depo Clip"
                    items={depoClips.filter(c => !linksForGroup.some(l => l.link_type === "DepoClip" && l.link_id === c.id))}
                    getLabel={c => `${c.topic_tag || ""} — ${(c.clip_text || "").slice(0, 60)}`}
                    onSelect={id => addLink("DepoClip", id)}
                  />
                </TabsContent>

                {/* EXHIBITS */}
                <TabsContent value="exhibits" className="mt-3 space-y-2">
                  {linksForGroup.filter(l => l.link_type === "JointExhibit").map(link => {
                    const je = jointExhibits.find(j => j.id === link.link_id);
                    const adm = je ? admittedById[je.id] : null;
                    return je ? (
                      <div key={link.id} className="flex items-center justify-between bg-[#131a2e] border border-[#1e2a45] rounded-lg px-3 py-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-300">#{adm?.admitted_no || je.marked_no}</span>
                            <span className="text-xs text-slate-200">{je.marked_title}</span>
                          </div>
                          <Badge className={`text-[9px] mt-0.5 ${je.status === "Admitted" ? "bg-green-500/20 text-green-400" : "bg-slate-500/20 text-slate-400"}`}>{je.status}</Badge>
                        </div>
                        <button onClick={() => removeLink(link.id)} className="text-slate-600 hover:text-red-400 ml-2"><X className="w-3 h-3" /></button>
                      </div>
                    ) : null;
                  })}
                  <AttachSelector
                    label="Attach Joint Exhibit"
                    items={jointExhibits.filter(j => !linksForGroup.some(l => l.link_type === "JointExhibit" && l.link_id === j.id))}
                    getLabel={j => `#${j.marked_no} — ${j.marked_title}`}
                    onSelect={id => addLink("JointExhibit", id)}
                  />
                </TabsContent>

                {/* PARTIES */}
                <TabsContent value="parties" className="mt-3 space-y-2">
                  {linksForGroup.filter(l => l.link_type === "Party").map(link => {
                    const p = parties.find(p => p.id === link.link_id);
                    return p ? (
                      <div key={link.id} className="flex items-center justify-between bg-[#131a2e] border border-[#1e2a45] rounded-lg px-3 py-2">
                        <span className="text-xs text-slate-200">{p.display_name || `${p.first_name} ${p.last_name}`}</span>
                        <button onClick={() => removeLink(link.id)} className="text-slate-600 hover:text-red-400"><X className="w-3 h-3" /></button>
                      </div>
                    ) : null;
                  })}
                  <AttachSelector
                    label="Link Party"
                    items={parties.filter(p => !linksForGroup.some(l => l.link_type === "Party" && l.link_id === p.id))}
                    getLabel={p => p.display_name || `${p.first_name} ${p.last_name}`}
                    onSelect={id => addLink("Party", id)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* NEW GROUP DIALOG */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
          <DialogHeader><DialogTitle>New Evidence Group</DialogTitle></DialogHeader>
          <GroupForm form={newGroupForm} setForm={setNewGroupForm} tagInput={tagInput} setTagInput={setTagInput} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveNewGroup}>Create Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT GROUP DIALOG */}
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

      {/* GENERATE QUESTIONS DIALOG */}
      <Dialog open={genQuestionsOpen} onOpenChange={setGenQuestionsOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><HelpCircle className="w-4 h-4 text-cyan-400" /> Create Questions from Group</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-400">Creates placeholder questions linked to: <strong className="text-white">{selectedGroup?.title}</strong></p>
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
              <Label className="text-xs text-slate-400">Number of Questions</Label>
              <Input type="number" min={1} max={20} value={genForm.count} onChange={e => setGenForm({ ...genForm, count: parseInt(e.target.value) || 1 })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenQuestionsOpen(false)} className="border-slate-600 text-slate-300">Cancel</Button>
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
        <div><Label className="text-xs text-slate-400">Default Exam Type</Label>
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
      <div className="max-h-32 overflow-y-auto space-y-0.5">
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