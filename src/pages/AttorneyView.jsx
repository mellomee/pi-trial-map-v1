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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gavel, Users, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle,
  Eye, Monitor, Search, BookOpen, FileText, Swords, Layers, Plus, X,
  CheckSquare, Ban, ArrowDown, Wifi, WifiOff, Trash2
} from "lucide-react";
import WorkflowBanner from "@/components/trial/WorkflowBanner";
import { createPageUrl } from "@/utils";

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

export default function AttorneyView() {
  const { activeCase } = useActiveCase();

  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [liveState, setLiveState] = useState(null);

  const [parties, setParties] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [evidenceGroups, setEvidenceGroups] = useState([]);
  const [depoClips, setDepoClips] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [admittedExhibits, setAdmittedExhibits] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [battleCards, setBattleCards] = useState([]);

  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [examType, setExamType] = useState("Cross");
  const [selectedQIdx, setSelectedQIdx] = useState(0);
  const [activeTab, setActiveTab] = useState("questions");

  const [proofTab, setProofTab] = useState("exhibits");
  const [exhibitSearch, setExhibitSearch] = useState("");
  const [admitDialogExhibit, setAdmitDialogExhibit] = useState(null);
  const [admitForm, setAdmitForm] = useState({ admitted_no: "", admitted_by_side: "Plaintiff" });

  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [pushToast, setPushToast] = useState("");

  const load = async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [s, p, q, eg, dc, je, ae, ex, bc] = await Promise.all([
      base44.entities.TrialSessions.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.Questions.filter({ case_id: cid }),
      base44.entities.EvidenceGroups.filter({ case_id: cid }),
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
    setDepoClips(dc);
    setJointExhibits(je);
    setAdmittedExhibits(ae);
    setExtracts(ex);
    setBattleCards(bc);
    if (!selectedPartyId && p.length) setSelectedPartyId(p[0].id);
    if (s.length && !sessionId) {
      const active = s.find(x => x.active) || s[0];
      setSessionId(active.id);
      loadLiveState(active.id);
    }
  };

  const loadLiveState = async (sid) => {
    const states = await base44.entities.LiveState.filter({ session_id: sid });
    if (states.length) {
      setLiveState(states[0]);
    } else {
      const ns = await base44.entities.LiveState.create({
        session_id: sid, mode: "BLANK", connected_jury_clients: 0, spotlight: false, show_highlights: true,
      });
      setLiveState(ns);
    }
  };

  useEffect(() => { load(); }, [activeCase]);

  // Poll live state for jury connection count
  useEffect(() => {
    if (!liveState?.id) return;
    const interval = setInterval(async () => {
      const states = await base44.entities.LiveState.filter({ session_id: sessionId });
      if (states.length) setLiveState(states[0]);
    }, 5000);
    return () => clearInterval(interval);
  }, [liveState?.id, sessionId]);

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

  const pushLive = async (patch) => {
    if (!liveState) return;
    const updated = { ...liveState, ...patch, updated_at: new Date().toISOString() };
    setLiveState(updated);
    await base44.entities.LiveState.update(liveState.id, { ...patch, updated_at: new Date().toISOString() });
    setPushToast("Pushed to jury ✓");
    setTimeout(() => setPushToast(""), 2000);
  };

  const pushExhibitToJury = (je) => {
    const adm = admittedById[je.id];
    if (!adm) { alert("Only ADMITTED exhibits can be pushed to jury."); return; }
    pushLive({ mode: "EXHIBIT", joint_exhibit_id: je.id, page: 1, callout_clip_id: null });
  };

  const clearJury = () => pushLive({ mode: "BLANK", joint_exhibit_id: null, callout_clip_id: null });

  const createSession = async () => {
    const pairCode = Math.random().toString(36).slice(2, 7).toUpperCase();
    const s = await base44.entities.TrialSessions.create({
      case_id: activeCase.id, title: newSessionTitle, active: true, pair_code: pairCode,
    });
    await load();
    setSessionId(s.id);
    loadLiveState(s.id);
    setNewSessionOpen(false);
    setNewSessionTitle("");
  };

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
      joint_exhibit_id: je.id, number_type: "Admitted",
      number_value: admitForm.admitted_no, effective_at: new Date().toISOString(),
    });
    setAdmitDialogExhibit(null);
    load();
  };

  const setExhibitStatus = async (je, status) => {
    await base44.entities.JointExhibits.update(je.id, { status });
    load();
  };

  const filteredExhibits = useMemo(() =>
    jointExhibits.filter(j =>
      !exhibitSearch ||
      j.marked_title?.toLowerCase().includes(exhibitSearch.toLowerCase()) ||
      j.marked_no?.toLowerCase().includes(exhibitSearch.toLowerCase()) ||
      admittedById[j.id]?.admitted_no?.toLowerCase().includes(exhibitSearch.toLowerCase())
    ), [jointExhibits, exhibitSearch, admittedById]);

  const partyName = (id) => {
    const p = parties.find(x => x.id === id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : "—";
  };

  const currentSession = sessions.find(s => s.id === sessionId);
  const juryConnected = (liveState?.connected_jury_clients || 0) > 0;

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden">
      <WorkflowBanner />

      {/* TOP BAR */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 flex-wrap">
        <Gavel className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-bold text-white">Attorney View</span>
        <div className="w-px h-4 bg-[#1e2a45]" />

        <Select value={sessionId} onValueChange={v => { setSessionId(v); loadLiveState(v); }}>
          <SelectTrigger className="h-7 text-xs w-48 bg-[#131a2e] border-[#1e2a45] text-slate-200">
            <SelectValue placeholder="Select session…" />
          </SelectTrigger>
          <SelectContent>
            {sessions.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.title} {s.pair_code && <span className="text-slate-500">({s.pair_code})</span>}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-7 text-xs bg-[#131a2e] border border-[#1e2a45] text-slate-400 hover:text-slate-200" onClick={() => setNewSessionOpen(true)}>
          <Plus className="w-3 h-3" />
        </Button>

        {currentSession?.pair_code && (
          <span className="text-xs bg-[#131a2e] border border-[#1e2a45] px-2 py-0.5 rounded text-slate-400">
            Code: <strong className="text-cyan-300">{currentSession.pair_code}</strong>
          </span>
        )}

        <div className="w-px h-4 bg-[#1e2a45]" />

        {/* Jury connection status */}
        <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border ${juryConnected ? "bg-green-500/10 text-green-400 border-green-700/40" : "bg-slate-700/20 text-slate-500 border-slate-700/40"}`}>
          {juryConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {liveState?.connected_jury_clients || 0} jury connected
        </div>

        <div className="ml-auto flex items-center gap-2">
          {pushToast && <span className="text-xs text-green-400 font-medium">{pushToast}</span>}
          <Button size="sm" variant="outline" className="h-7 text-xs border-slate-700/50 text-slate-400 hover:text-red-400 hover:border-red-700/40" onClick={clearJury}>
            Clear Jury
          </Button>
          <a href={createPageUrl("JuryView")} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-green-700/40 text-green-400 hover:bg-green-500/10 text-xs transition-colors">
            <Monitor className="w-3 h-3" /> Open Jury Screen
          </a>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-[#1e2a45] bg-[#0f1629] px-4 gap-1 flex-shrink-0">
        {[
          { id: "questions", label: "Questions" },
          { id: "proof", label: "Proof Drawer" },
          { id: "exhibits", label: "Exhibit Control" },
          { id: "battlecards", label: "Battle Cards" },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === t.id ? "border-cyan-400 text-cyan-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">

        {/* ── QUESTIONS TAB ── */}
        {activeTab === "questions" && (
          <div className="flex h-full">
            {/* Left: question list */}
            <div className="w-72 flex-shrink-0 border-r border-[#1e2a45] flex flex-col bg-[#0f1629]">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e2a45]">
                <Select value={selectedPartyId} onValueChange={v => { setSelectedPartyId(v); setSelectedQIdx(0); }}>
                  <SelectTrigger className="h-7 text-xs flex-1 bg-[#131a2e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Witness…" /></SelectTrigger>
                  <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{partyName(p.id)}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex rounded border border-[#1e2a45] overflow-hidden">
                  {["D","C"].map((t, i) => (
                    <button key={t} onClick={() => { setExamType(i === 0 ? "Direct" : "Cross"); setSelectedQIdx(0); }}
                      className={`px-2 py-1 text-xs font-medium transition-colors ${examType === (i === 0 ? "Direct" : "Cross") ? (i === 0 ? "bg-green-600 text-white" : "bg-orange-600 text-white") : "text-slate-500 hover:text-slate-300"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {witnessQuestions.map((q, idx) => (
                  <button key={q.id} onClick={() => setSelectedQIdx(idx)}
                    className={`w-full text-left px-3 py-2.5 border-b border-[#1e2a45] transition-colors ${selectedQIdx === idx ? "bg-cyan-500/10 border-l-2 border-l-cyan-400" : "hover:bg-white/5 border-l-2 border-l-transparent"}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-slate-600 mt-0.5 flex-shrink-0">{idx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300 line-clamp-2">{q.question_text}</p>
                        <Badge className={`text-[9px] mt-0.5 ${STATUS_OPTS.find(s => s.value === q.status)?.color || ""}`}>{q.status}</Badge>
                      </div>
                    </div>
                  </button>
                ))}
                {witnessQuestions.length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-8">No questions.</p>
                )}
              </div>
            </div>

            {/* Right: question detail */}
            <div className="flex-1 overflow-y-auto p-5">
              {!currentQ ? (
                <div className="flex items-center justify-center h-full text-slate-600"><FileText className="w-12 h-12 opacity-10" /></div>
              ) : (
                <div className="space-y-4 max-w-2xl">
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
                    <div className="flex gap-1 flex-wrap">
                      {STATUS_OPTS.map(s => (
                        <button key={s.value} onClick={() => updateQ("status", s.value)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${currentQ.status === s.value ? s.color : "bg-[#0f1629] border-[#1e2a45] text-slate-500 hover:border-slate-500"}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-5">
                    <p className="text-xl font-semibold text-white leading-relaxed">{currentQ.question_text}</p>
                    {currentQ.goal && <p className="text-sm text-slate-400 mt-2">🎯 {currentQ.goal}</p>}
                    {currentQ.expected_answer && <p className="text-sm text-slate-300 mt-1">💬 Expected: {currentQ.expected_answer}</p>}
                  </div>

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

                  {currentQ.answer_quality === "Harmful" && (
                    <div className="bg-red-950/30 border border-red-700/40 rounded-xl p-3">
                      <p className="text-xs text-red-400 font-semibold flex items-center gap-1 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" /> Harmful — switch to Proof Drawer
                      </p>
                      <Button size="sm" onClick={() => setActiveTab("proof")}
                        className="bg-red-700/30 border border-red-600/40 text-red-300 hover:bg-red-700/40 text-xs">
                        Open Proof Drawer
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PROOF DRAWER TAB ── */}
        {activeTab === "proof" && (
          <div className="h-full flex flex-col">
            <div className="flex border-b border-[#1e2a45] px-3 gap-1 bg-[#080d1a] flex-shrink-0">
              {[
                { id: "exhibits", icon: BookOpen, label: "Exhibits" },
                { id: "clips", icon: FileText, label: "Depo Clips" },
                { id: "battlecards", icon: Swords, label: "Battle Cards" },
                { id: "groups", icon: Layers, label: "Groups" },
              ].map(t => (
                <button key={t.id} onClick={() => setProofTab(t.id)}
                  className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${proofTab === t.id ? "border-cyan-400 text-cyan-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
                  <t.icon className="w-3 h-3" />{t.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {proofTab === "exhibits" && (
                <div className="max-w-2xl space-y-2">
                  <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">Admitted — push to jury display</p>
                  {!juryConnected && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded px-3 py-2">
                      <WifiOff className="w-3.5 h-3.5" /> No jury connected. Push will update LiveState but jury screen may not be open.
                    </div>
                  )}
                  {jointExhibits.filter(j => j.status === "Admitted").map(je => {
                    const adm = admittedById[je.id];
                    return (
                      <div key={je.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-3 flex items-center gap-3">
                        <span className="text-sm font-bold text-green-300 w-12 flex-shrink-0">#{adm?.admitted_no || je.marked_no}</span>
                        <p className="text-sm text-slate-200 flex-1">{je.marked_title}</p>
                        <button onClick={() => pushExhibitToJury(je)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-600/20 text-green-400 border border-green-700/40 hover:bg-green-600/30 text-xs font-medium transition-colors">
                          <Monitor className="w-3 h-3" /> Push to Jury
                        </button>
                      </div>
                    );
                  })}
                  {jointExhibits.filter(j => j.status === "Admitted").length === 0 && (
                    <p className="text-sm text-slate-600 text-center py-8">No admitted exhibits. Admit them in Exhibit Control.</p>
                  )}
                </div>
              )}
              {proofTab === "clips" && (
                <div className="max-w-2xl space-y-2">
                  {depoClips.map(c => (
                    <div key={c.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-3">
                      <p className="text-[10px] text-violet-400 font-medium mb-1">{c.topic_tag}</p>
                      <p className="text-sm text-slate-300">{c.clip_text}</p>
                      {c.start_cite && <p className="text-[9px] text-slate-600 mt-1 font-mono">{c.start_cite}{c.end_cite ? ` – ${c.end_cite}` : ""}</p>}
                    </div>
                  ))}
                  {depoClips.length === 0 && <p className="text-sm text-slate-600 text-center py-8">No depo clips.</p>}
                </div>
              )}
              {proofTab === "battlecards" && (
                <div className="max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-3">
                  {battleCards.map(bc => (
                    <div key={bc.id} className="bg-[#131a2e] border border-red-900/30 rounded-xl p-4 space-y-2">
                      <p className="text-sm font-semibold text-white">{bc.title}</p>
                      {bc.when_to_use && <p className="text-[10px] text-amber-400">When: {bc.when_to_use}</p>}
                      {bc.commit_question && <p className="text-[10px] text-slate-400"><span className="text-green-400 font-semibold">C1:</span> {bc.commit_question}</p>}
                      {bc.credit_question && <p className="text-[10px] text-slate-400"><span className="text-cyan-400 font-semibold">C2:</span> {bc.credit_question}</p>}
                      {bc.confront_question && <p className="text-[10px] text-slate-400"><span className="text-red-400 font-semibold">C3:</span> {bc.confront_question}</p>}
                    </div>
                  ))}
                  {battleCards.length === 0 && <p className="text-sm text-slate-600 text-center py-8 col-span-2">No battle cards.</p>}
                </div>
              )}
              {proofTab === "groups" && (
                <div className="max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-3">
                  {evidenceGroups.map(g => (
                    <div key={g.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-3">
                      <p className="text-sm text-slate-200">{g.title}</p>
                      {g.description && <p className="text-xs text-slate-500 mt-0.5">{g.description}</p>}
                      <Badge className={`text-[9px] mt-1 ${g.priority === "High" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>{g.priority}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EXHIBIT CONTROL TAB ── */}
        {activeTab === "exhibits" && (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <Input value={exhibitSearch} onChange={e => setExhibitSearch(e.target.value)}
                  placeholder="Search exhibits…" className="pl-8 h-8 bg-[#131a2e] border-[#1e2a45] text-slate-200 text-xs" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {filteredExhibits.map(je => {
                const adm = admittedById[je.id];
                return (
                  <div key={je.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#131a2e] border border-[#1e2a45]">
                    <span className={`text-sm font-bold w-14 flex-shrink-0 ${adm ? "text-green-400" : "text-cyan-400"}`}>
                      #{adm?.admitted_no || je.marked_no}
                    </span>
                    <span className="text-sm text-slate-300 flex-1 truncate">{je.marked_title}</span>
                    <Badge className={`text-[9px] flex-shrink-0 ${je.status === "Admitted" ? "bg-green-500/20 text-green-400" : je.status === "Offered" ? "bg-cyan-500/20 text-cyan-400" : je.status === "Excluded" ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-400"}`}>{je.status}</Badge>
                    <div className="flex gap-1 flex-shrink-0">
                      {je.status !== "Admitted" && je.status !== "Offered" && (
                        <button onClick={() => setExhibitStatus(je, "Offered")} className="text-[9px] px-2 py-1 rounded bg-cyan-600/20 text-cyan-400 border border-cyan-700/40 hover:bg-cyan-600/30">Mark</button>
                      )}
                      {je.status !== "Admitted" && (
                        <button onClick={() => { setAdmitDialogExhibit(je); setAdmitForm({ admitted_no: "", admitted_by_side: "Plaintiff" }); }}
                          className="text-[9px] px-2 py-1 rounded bg-green-600/20 text-green-400 border border-green-700/40 hover:bg-green-600/30">Admit…</button>
                      )}
                      {je.status === "Admitted" && (
                        <button onClick={() => pushExhibitToJury(je)}
                          className="text-[9px] px-2 py-1 rounded bg-green-700/30 text-green-300 border border-green-700/40 hover:bg-green-700/40 flex items-center gap-1">
                          <Monitor className="w-2.5 h-2.5" /> Push
                        </button>
                      )}
                      <button onClick={() => setExhibitStatus(je, "Excluded")} className="text-[9px] px-2 py-1 rounded bg-red-600/20 text-red-400 border border-red-700/40 hover:bg-red-600/30"><Ban className="w-2.5 h-2.5" /></button>
                    </div>
                  </div>
                );
              })}
              {filteredExhibits.length === 0 && (
                <div className="text-center py-12 text-slate-600">No exhibits found.</div>
              )}
            </div>
          </div>
        )}

        {/* ── BATTLE CARDS TAB ── */}
        {activeTab === "battlecards" && (
          <div className="h-full overflow-y-auto p-4">
            <div className="max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-3">
              {battleCards.map(bc => (
                <div key={bc.id} className="bg-[#131a2e] border border-red-900/30 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-bold text-white">{bc.title}</p>
                  {bc.when_to_use && <p className="text-xs text-amber-400">🎯 When: {bc.when_to_use}</p>}
                  {bc.goal && <p className="text-xs text-slate-500">{bc.goal}</p>}
                  <div className="pt-2 border-t border-[#1e2a45] space-y-1">
                    {bc.commit_question && <p className="text-xs text-slate-300"><span className="text-green-400 font-semibold">C1 Commit:</span> {bc.commit_question}</p>}
                    {bc.credit_question && <p className="text-xs text-slate-300"><span className="text-cyan-400 font-semibold">C2 Credit:</span> {bc.credit_question}</p>}
                    {bc.confront_question && <p className="text-xs text-slate-300"><span className="text-red-400 font-semibold">C3 Confront:</span> {bc.confront_question}</p>}
                  </div>
                </div>
              ))}
              {battleCards.length === 0 && <p className="text-sm text-slate-600 text-center py-8 col-span-2">No battle cards. Create them in Witness Prep.</p>}
            </div>
          </div>
        )}
      </div>

      {/* NEW SESSION DIALOG */}
      <Dialog open={newSessionOpen} onOpenChange={setNewSessionOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-sm">
          <DialogHeader><DialogTitle>New Trial Session</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs text-slate-400">Session Title (e.g. "Day 1 — Smith")</Label>
            <Input value={newSessionTitle} onChange={e => setNewSessionTitle(e.target.value)} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1" />
          </div>
          <p className="text-[10px] text-slate-500">A unique pair code will be generated automatically.</p>
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