import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Zap, Users, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle,
  Eye, EyeOff, Monitor, Search, BookOpen, Scissors, FileText, Swords,
  Layers, Plus, X, Shield, CheckSquare, Ban, ArrowRight
} from "lucide-react";
import WorkflowBanner from "@/components/trial/WorkflowBanner";
import JuryView from "@/components/trial/JuryView";

const STATUS_OPTS = [
  { value: "NotAsked", label: "Not Asked", color: "bg-slate-500/20 text-slate-400 border-slate-600/40" },
  { value: "Asked", label: "Asked", color: "bg-green-500/20 text-green-400 border-green-600/40" },
  { value: "NeedsFollowUp", label: "Follow Up", color: "bg-amber-500/20 text-amber-400 border-amber-600/40" },
  { value: "Skipped", label: "Skipped", color: "bg-slate-600/20 text-slate-500 border-slate-700/40" },
];

const QUALITY_OPTS = [
  { value: "AsExpected", label: "As Expected", color: "bg-green-500/20 text-green-400 border-green-600/40" },
  { value: "Unexpected", label: "Unexpected", color: "bg-amber-500/20 text-amber-400 border-amber-600/40" },
  { value: "Harmful", label: "Harmful", color: "bg-red-600/20 text-red-400 border-red-600/40" },
  { value: "GreatAdmission", label: "Great Admission", color: "bg-cyan-500/20 text-cyan-400 border-cyan-600/40" },
];

export default function TrialMode() {
  const { activeCase } = useActiveCase();

  // Session
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [sessionState, setSessionState] = useState(null);
  const [juryDisplayOn, setJuryDisplayOn] = useState(true);
  const [privatePreview, setPrivatePreview] = useState(false);

  // Data
  const [parties, setParties] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [egLinks, setEgLinks] = useState([]);
  const [evidenceGroups, setEvidenceGroups] = useState([]);
  const [depoClips, setDepoClips] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [admittedExhibits, setAdmittedExhibits] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [battleCards, setBattleCards] = useState([]);

  // Attorney state
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [examType, setExamType] = useState("Cross");
  const [selectedQIdx, setSelectedQIdx] = useState(0);

  // Proof drawer
  const [proofDrawerOpen, setProofDrawerOpen] = useState(false);
  const [proofTab, setProofTab] = useState("exhibits");

  // Exhibit control
  const [exhibitSearch, setExhibitSearch] = useState("");
  const [admitDialogExhibit, setAdmitDialogExhibit] = useState(null);
  const [admitForm, setAdmitForm] = useState({ admitted_no: "", admitted_by_side: "Plaintiff" });
  const [exhibitPanelOpen, setExhibitPanelOpen] = useState(false);

  // New session
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");

  const load = async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [s, p, q, eg, egl, dc, je, ae, ex, bc] = await Promise.all([
      base44.entities.TrialSessions.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.Questions.filter({ case_id: cid }),
      base44.entities.EvidenceGroups.filter({ case_id: cid }),
      base44.entities.EvidenceGroupLinks.list(),
      base44.entities.DepoClips.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.AdmittedExhibits.filter({ case_id: cid }),
      base44.entities.ExhibitExtracts.filter({ case_id: cid }),
      base44.entities.BattleCards.filter({ case_id: cid }),
    ]);
    setSessions(s);
    setParties(p);
    setQuestions(q);
    setEvidenceGroups(eg);
    setEgLinks(egl);
    setDepoClips(dc);
    setJointExhibits(je);
    setAdmittedExhibits(ae);
    setExtracts(ex);
    setBattleCards(bc);
    if (!selectedPartyId && p.length) setSelectedPartyId(p[0].id);
    if (s.length && !sessionId) {
      const active = s.find(x => x.active) || s[0];
      setSessionId(active.id);
      loadSessionState(active.id);
    }
  };

  const loadSessionState = async (sid) => {
    const states = await base44.entities.TrialSessionState.filter({ trial_session_id: sid });
    if (states.length) setSessionState(states[0]);
    else {
      const ns = await base44.entities.TrialSessionState.create({ trial_session_id: sid });
      setSessionState(ns);
    }
  };

  useEffect(() => { load(); }, [activeCase]);

  const admittedById = useMemo(() => {
    const m = {};
    admittedExhibits.forEach(a => { m[a.joint_exhibit_id] = a; });
    return m;
  }, [admittedExhibits]);

  const witnessQuestions = useMemo(() =>
    questions
      .filter(q => q.party_id === selectedPartyId && q.exam_type === examType)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
    [questions, selectedPartyId, examType]
  );

  const currentQ = witnessQuestions[selectedQIdx] || null;

  const updateQ = useCallback(async (field, value) => {
    if (!currentQ) return;
    await base44.entities.Questions.update(currentQ.id, { [field]: value });
    setQuestions(prev => prev.map(q => q.id === currentQ.id ? { ...q, [field]: value } : q));
  }, [currentQ]);

  const updateSessionState = async (patch) => {
    if (!sessionState) return;
    const updated = { ...sessionState, ...patch };
    setSessionState(updated);
    await base44.entities.TrialSessionState.update(sessionState.id, patch);
  };

  const pushToJury = (exhibitId) => {
    const adm = admittedById[exhibitId];
    if (!adm && !privatePreview) {
      alert("Not admitted — cannot push to jury unless in Private Preview mode.");
      return;
    }
    updateSessionState({ jury_selected_joint_exhibit_id: exhibitId, jury_selected_page: 1 });
  };

  const pushCalloutToJury = (calloutId) => {
    updateSessionState({ jury_selected_callout_id: calloutId });
  };

  const createSession = async () => {
    const s = await base44.entities.TrialSessions.create({ case_id: activeCase.id, title: newSessionTitle, active: true });
    await load();
    setSessionId(s.id);
    loadSessionState(s.id);
    setNewSessionOpen(false);
    setNewSessionTitle("");
  };

  // Admit workflow
  const admitExhibit = async () => {
    if (!admitForm.admitted_no) return alert("Enter admitted number");
    const je = admitDialogExhibit;
    await base44.entities.AdmittedExhibits.create({
      case_id: activeCase.id,
      joint_exhibit_id: je.id,
      admitted_no: admitForm.admitted_no,
      admitted_by_side: admitForm.admitted_by_side,
      date_admitted: new Date().toISOString().split("T")[0],
    });
    await base44.entities.JointExhibits.update(je.id, { status: "Admitted", admitted_no: admitForm.admitted_no });
    await base44.entities.ExhibitNumberHistory.create({
      joint_exhibit_id: je.id,
      number_type: "Admitted",
      number_value: admitForm.admitted_no,
      effective_at: new Date().toISOString(),
    });
    setAdmitDialogExhibit(null);
    load();
  };

  const setExhibitStatus = async (je, status) => {
    await base44.entities.JointExhibits.update(je.id, { status });
    load();
  };

  const filteredExhibits = useMemo(() => {
    return jointExhibits.filter(j =>
      !exhibitSearch ||
      j.marked_title?.toLowerCase().includes(exhibitSearch.toLowerCase()) ||
      j.marked_no?.toLowerCase().includes(exhibitSearch.toLowerCase()) ||
      admittedById[j.id]?.admitted_no?.toLowerCase().includes(exhibitSearch.toLowerCase())
    );
  }, [jointExhibits, exhibitSearch, admittedById]);

  const partyName = (id) => {
    const p = parties.find(x => x.id === id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : "—";
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden">
      <WorkflowBanner />

      {/* TOP BAR */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 flex-wrap">
        <Zap className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-bold text-white">Trial Mode</span>
        <div className="w-px h-4 bg-[#1e2a45]" />

        {/* Session selector */}
        <Select value={sessionId} onValueChange={v => { setSessionId(v); loadSessionState(v); }}>
          <SelectTrigger className="h-7 text-xs w-44 bg-[#131a2e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select session…" /></SelectTrigger>
          <SelectContent>
            {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-7 text-xs bg-[#131a2e] border border-[#1e2a45] text-slate-400 hover:text-slate-200" onClick={() => setNewSessionOpen(true)}>
          <Plus className="w-3 h-3" />
        </Button>

        <div className="w-px h-4 bg-[#1e2a45]" />

        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
          <Switch checked={juryDisplayOn} onCheckedChange={v => { setJuryDisplayOn(v); updateSessionState({ jury_display_on: v }); }} />
          <Monitor className="w-3.5 h-3.5" /> Jury Display
        </label>

        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
          <Switch checked={privatePreview} onCheckedChange={setPrivatePreview} />
          <Eye className="w-3.5 h-3.5" /> Private Preview
        </label>

        <Button size="sm" variant="outline" className="ml-auto h-7 text-xs border-amber-600/40 text-amber-400 hover:bg-amber-500/10" onClick={() => setExhibitPanelOpen(v => !v)}>
          <CheckSquare className="w-3 h-3 mr-1" /> Exhibit Control
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs border-cyan-600/40 text-cyan-400 hover:bg-cyan-500/10" onClick={() => setProofDrawerOpen(v => !v)}>
          <Layers className="w-3 h-3 mr-1" /> Proof Drawer
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── ATTORNEY SIDE ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto flex flex-col border-r border-[#1e2a45] min-w-0">

          {/* Witness + exam selector */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0">
            <Users className="w-4 h-4 text-slate-500" />
            <Select value={selectedPartyId} onValueChange={v => { setSelectedPartyId(v); setSelectedQIdx(0); }}>
              <SelectTrigger className="h-7 text-xs w-44 bg-[#131a2e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Witness…" /></SelectTrigger>
              <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{partyName(p.id)}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex rounded border border-[#1e2a45] overflow-hidden">
              {["Direct","Cross"].map(t => (
                <button key={t} onClick={() => { setExamType(t); setSelectedQIdx(0); }}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${examType === t ? (t === "Direct" ? "bg-green-600 text-white" : "bg-orange-600 text-white") : "text-slate-500 hover:text-slate-300"}`}>
                  {t}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">{witnessQuestions.length} questions</span>
          </div>

          {/* Exhibit Control Panel */}
          {exhibitPanelOpen && (
            <div className="border-b border-[#1e2a45] bg-[#080d1a] p-3">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Exhibit Control</p>
                <button onClick={() => setExhibitPanelOpen(false)} className="ml-auto text-slate-500 hover:text-slate-300"><X className="w-3 h-3" /></button>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-2 w-3 h-3 text-slate-500" />
                <Input value={exhibitSearch} onChange={e => setExhibitSearch(e.target.value)} placeholder="Search exhibits…" className="pl-7 h-7 text-xs bg-[#131a2e] border-[#1e2a45] text-slate-200" />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredExhibits.slice(0, 30).map(je => {
                  const adm = admittedById[je.id];
                  return (
                    <div key={je.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#131a2e] border border-[#1e2a45]">
                      <span className={`text-xs font-bold w-10 flex-shrink-0 ${adm ? "text-green-400" : "text-cyan-400"}`}>
                        #{adm?.admitted_no || je.marked_no}
                      </span>
                      <span className="text-xs text-slate-300 flex-1 truncate">{je.marked_title}</span>
                      <Badge className={`text-[9px] flex-shrink-0 ${je.status === "Admitted" ? "bg-green-500/20 text-green-400" : je.status === "Offered" ? "bg-cyan-500/20 text-cyan-400" : je.status === "Excluded" ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-400"}`}>{je.status}</Badge>
                      <div className="flex gap-1 flex-shrink-0">
                        {je.status !== "Offered" && je.status !== "Admitted" && (
                          <button onClick={() => setExhibitStatus(je, "Offered")} title="Mark Offered" className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-600/20 text-cyan-400 border border-cyan-700/40 hover:bg-cyan-600/30">Offer</button>
                        )}
                        {je.status !== "Admitted" && (
                          <button onClick={() => { setAdmitDialogExhibit(je); setAdmitForm({ admitted_no: "", admitted_by_side: "Plaintiff" }); }} className="text-[9px] px-1.5 py-0.5 rounded bg-green-600/20 text-green-400 border border-green-700/40 hover:bg-green-600/30">Admit…</button>
                        )}
                        {je.status !== "Excluded" && <button onClick={() => setExhibitStatus(je, "Excluded")} title="Exclude" className="text-[9px] px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-700/40 hover:bg-red-600/30"><Ban className="w-2.5 h-2.5" /></button>}
                        {je.status !== "Withdrawn" && <button onClick={() => setExhibitStatus(je, "Withdrawn")} title="Withdraw" className="text-[9px] px-1.5 py-0.5 rounded bg-slate-600/20 text-slate-400 border border-slate-700/40 hover:bg-slate-600/30"><ArrowRight className="w-2.5 h-2.5 rotate-90" /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Question runner */}
          <div className="flex-1 overflow-y-auto p-4">
            {witnessQuestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                <FileText className="w-12 h-12 opacity-10" />
                <p>No questions for this witness / exam type.</p>
                <p className="text-xs">Go to Proof Library to generate questions.</p>
              </div>
            ) : !currentQ ? null : (
              <div className="space-y-4 max-w-2xl">
                {/* Nav */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" disabled={selectedQIdx === 0} onClick={() => setSelectedQIdx(i => i - 1)} className="text-slate-400 hover:text-white">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-slate-500">{selectedQIdx + 1} / {witnessQuestions.length}</span>
                    <Button variant="ghost" size="sm" disabled={selectedQIdx >= witnessQuestions.length - 1} onClick={() => setSelectedQIdx(i => i + 1)} className="text-slate-400 hover:text-white">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {STATUS_OPTS.map(s => (
                      <button key={s.value} onClick={() => updateQ("status", s.value)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${currentQ.status === s.value ? s.color : "bg-[#0f1629] border-[#1e2a45] text-slate-500 hover:border-slate-500"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question card */}
                <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-5">
                  <p className="text-xl font-semibold text-white leading-relaxed">{currentQ.question_text}</p>
                  {currentQ.goal && <p className="text-sm text-slate-400 mt-2">🎯 {currentQ.goal}</p>}
                  {currentQ.expected_answer && <p className="text-sm text-slate-300 mt-1">💬 Expected: {currentQ.expected_answer}</p>}
                </div>

                {/* Quality */}
                <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Answer Quality</p>
                  <div className="flex gap-2 flex-wrap">
                    {QUALITY_OPTS.map(opt => (
                      <button key={opt.value} onClick={() => updateQ("answer_quality", currentQ.answer_quality === opt.value ? null : opt.value)}
                        className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${currentQ.answer_quality === opt.value ? opt.color : "bg-[#0f1629] border-[#1e2a45] text-slate-500 hover:border-slate-500"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admission + notes */}
                <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={currentQ.admission_obtained || false} onCheckedChange={v => updateQ("admission_obtained", v)} />
                    <span className="text-sm text-slate-300">Admission Obtained</span>
                  </label>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Live Notes</p>
                    <Textarea value={currentQ.live_notes || ""} onChange={e => updateQ("live_notes", e.target.value)}
                      placeholder="Notes during examination…" rows={2}
                      className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-sm" />
                  </div>
                </div>

                {/* Proof Drawer inline (when not open as panel) */}
                {currentQ.answer_quality === "Harmful" && (
                  <div className="bg-red-950/30 border border-red-700/40 rounded-xl p-3">
                    <p className="text-xs text-red-400 font-semibold flex items-center gap-1 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5" /> Harmful answer — open Proof Drawer for battle cards
                    </p>
                    <Button size="sm" onClick={() => { setProofDrawerOpen(true); setProofTab("battlecards"); }}
                      className="bg-red-700/30 border border-red-600/40 text-red-300 hover:bg-red-700/40 text-xs">
                      Open Battle Cards
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── PROOF DRAWER ─────────────────────────── */}
        {proofDrawerOpen && (
          <div className="w-80 flex-shrink-0 border-r border-[#1e2a45] flex flex-col bg-[#0f1629]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2a45]">
              <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Proof Drawer</p>
              <button onClick={() => setProofDrawerOpen(false)} className="text-slate-500 hover:text-slate-300"><X className="w-3 h-3" /></button>
            </div>
            <Tabs value={proofTab} onValueChange={setProofTab} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="bg-[#080d1a] border-b border-[#1e2a45] rounded-none justify-start px-2 h-auto py-1.5 gap-1 flex-shrink-0">
                {[
                  { id: "exhibits", icon: BookOpen, label: "Exhibits" },
                  { id: "clips", icon: FileText, label: "Clips" },
                  { id: "battlecards", icon: Swords, label: "Battle" },
                  { id: "groups", icon: Layers, label: "Groups" },
                ].map(t => (
                  <button key={t.id} onClick={() => setProofTab(t.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${proofTab === t.id ? "bg-cyan-600/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}>
                    <t.icon className="w-3 h-3" />{t.label}
                  </button>
                ))}
              </TabsList>
              <div className="flex-1 overflow-y-auto p-2">
                {/* EXHIBITS */}
                {proofTab === "exhibits" && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider px-1">Admitted exhibits — push to jury</p>
                    {jointExhibits.filter(j => j.status === "Admitted").map(je => {
                      const adm = admittedById[je.id];
                      return (
                        <div key={je.id} className="bg-[#131a2e] border border-[#1e2a45] rounded p-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-green-300">#{adm?.admitted_no || je.marked_no}</span>
                            <button onClick={() => pushToJury(je.id)}
                              className="text-[9px] px-2 py-0.5 rounded bg-green-600/20 text-green-400 border border-green-700/40 hover:bg-green-600/30 flex items-center gap-1">
                              <Monitor className="w-2.5 h-2.5" /> Push to Jury
                            </button>
                          </div>
                          <p className="text-xs text-slate-300 line-clamp-1">{je.marked_title}</p>
                        </div>
                      );
                    })}
                    {jointExhibits.filter(j => j.status !== "Admitted").length > 0 && (
                      <>
                        <p className="text-[9px] text-slate-600 uppercase tracking-wider px-1 mt-2">Marked (not admitted)</p>
                        {jointExhibits.filter(j => j.status !== "Admitted").map(je => (
                          <div key={je.id} className="bg-[#0a0f1e] border border-[#1e2a45] rounded p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-cyan-400">#{je.marked_no}</span>
                              <button onClick={() => pushToJury(je.id)}
                                className="text-[9px] px-2 py-0.5 rounded bg-slate-600/20 text-slate-400 border border-slate-700/40 hover:bg-slate-600/30 flex items-center gap-1">
                                <Eye className="w-2.5 h-2.5" /> Preview
                              </button>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-1">{je.marked_title}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* DEPO CLIPS */}
                {proofTab === "clips" && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider px-1">Attorney-only reference</p>
                    {depoClips.filter(c => !currentQ || c.party_id === selectedPartyId || !c.party_id).slice(0, 20).map(c => (
                      <div key={c.id} className="bg-[#131a2e] border border-[#1e2a45] rounded p-2">
                        <p className="text-[9px] text-violet-400 font-medium mb-0.5">{c.topic_tag}</p>
                        <p className="text-xs text-slate-300 line-clamp-3">{c.clip_text}</p>
                        {c.start_cite && <p className="text-[9px] text-slate-600 mt-0.5 font-mono">{c.start_cite}</p>}
                      </div>
                    ))}
                    {depoClips.length === 0 && <p className="text-xs text-slate-600 text-center py-4">No depo clips.</p>}
                  </div>
                )}

                {/* BATTLE CARDS */}
                {proofTab === "battlecards" && (
                  <div className="space-y-2">
                    {battleCards.map(bc => (
                      <div key={bc.id} className="bg-[#131a2e] border border-red-900/30 rounded p-2 space-y-1">
                        <p className="text-xs font-semibold text-white">{bc.title}</p>
                        {bc.when_to_use && <p className="text-[9px] text-amber-400">When: {bc.when_to_use}</p>}
                        {bc.commit_question && <p className="text-[9px] text-slate-400"><span className="text-green-400">C1:</span> {bc.commit_question}</p>}
                        {bc.credit_question && <p className="text-[9px] text-slate-400"><span className="text-cyan-400">C2:</span> {bc.credit_question}</p>}
                        {bc.confront_question && <p className="text-[9px] text-slate-400"><span className="text-red-400">C3:</span> {bc.confront_question}</p>}
                      </div>
                    ))}
                    {battleCards.length === 0 && <p className="text-xs text-slate-600 text-center py-4">No battle cards. Create them in Witness Prep.</p>}
                  </div>
                )}

                {/* EVIDENCE GROUPS */}
                {proofTab === "groups" && (
                  <div className="space-y-1.5">
                    {evidenceGroups.map(g => (
                      <div key={g.id} className="bg-[#131a2e] border border-[#1e2a45] rounded p-2">
                        <p className="text-xs text-slate-300">{g.title}</p>
                        <Badge className={`text-[9px] mt-0.5 ${g.priority === "High" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>{g.priority}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Tabs>
          </div>
        )}

        {/* ── JURY SIDE ────────────────────────────── */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border-l border-[#1e2a45] bg-[#050809]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2a45] bg-[#0a0f1e]">
            <p className="text-xs font-bold text-green-400 uppercase tracking-wider flex items-center gap-1">
              <Monitor className="w-3.5 h-3.5" /> Jury Display {juryDisplayOn ? <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-700/40 px-1 rounded">ON</span> : <span className="text-[9px] text-slate-500">(OFF)</span>}
            </p>
            {sessionState && (
              <div className="flex items-center gap-2">
                <button onClick={() => updateSessionState({ spotlight_on: !sessionState.spotlight_on })}
                  className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${sessionState.spotlight_on ? "bg-yellow-500/20 text-yellow-300 border-yellow-600/40" : "text-slate-500 border-slate-700/40 hover:text-slate-300"}`}>
                  ✦ Spotlight
                </button>
                {sessionState.spotlight_on && (
                  <button onClick={() => updateSessionState({ highlights_on: !sessionState.highlights_on })}
                    className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${sessionState.highlights_on ? "bg-green-500/20 text-green-300 border-green-600/40" : "text-slate-500 border-slate-700/40"}`}>
                    Highlights
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {juryDisplayOn && sessionState ? (
              <JuryView
                sessionState={sessionState}
                jointExhibits={jointExhibits}
                admittedExhibits={admittedExhibits}
                extracts={extracts}
                onUpdateState={updateSessionState}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-3">
                <Monitor className="w-12 h-12 opacity-20" />
                <p className="text-xs">Jury display is off</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NEW SESSION DIALOG */}
      <Dialog open={newSessionOpen} onOpenChange={setNewSessionOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-sm">
          <DialogHeader><DialogTitle>New Trial Session</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs text-slate-400">Session Title (e.g. "Day 1 — Smith")</Label>
            <Input value={newSessionTitle} onChange={e => setNewSessionTitle(e.target.value)} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSessionOpen(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={createSession} disabled={!newSessionTitle.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADMIT DIALOG */}
      <Dialog open={!!admitDialogExhibit} onOpenChange={v => !v && setAdmitDialogExhibit(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-400"><CheckCircle className="w-4 h-4" /> Admit Exhibit</DialogTitle>
            {admitDialogExhibit && <p className="text-xs text-slate-500 mt-1">#{admitDialogExhibit.marked_no} — {admitDialogExhibit.marked_title}</p>}
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">Admitted Number (required)</Label>
              <Input value={admitForm.admitted_no} onChange={e => setAdmitForm({ ...admitForm, admitted_no: e.target.value })} placeholder="e.g. 12" className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Offered By</Label>
              <Select value={admitForm.admitted_by_side} onValueChange={v => setAdmitForm({ ...admitForm, admitted_by_side: v })}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdmitDialogExhibit(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={admitExhibit}>Admit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}