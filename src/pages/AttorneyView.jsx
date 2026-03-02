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
import {
  Gavel, Users, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle,
  Monitor, Search, BookOpen, FileText, Swords, Layers, Plus, X,
  Ban, Wifi, WifiOff, PanelLeftClose, PanelRightClose, ChevronDown, ChevronUp
} from "lucide-react";
import WorkflowBanner from "@/components/trial/WorkflowBanner";
import JuryPreviewPanel from "@/components/trial/JuryPreviewPanel";
import PairCodeModal from "@/components/trial/PairCodeModal";

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

  // Session
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [liveState, setLiveState] = useState(null);
  const [juryConnected, setJuryConnected] = useState(false);
  const [pairModalOpen, setPairModalOpen] = useState(false);

  // Data
  const [parties, setParties] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [evidenceGroups, setEvidenceGroups] = useState([]);
  const [depoClips, setDepoClips] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [admittedExhibits, setAdmittedExhibits] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [battleCards, setBattleCards] = useState([]);

  // Q runner
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [examType, setExamType] = useState("Cross");
  const [selectedQIdx, setSelectedQIdx] = useState(0);

  // Panels
  const [leftOpen, setLeftOpen] = useState(true);
  const [midOpen, setMidOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [proofTab, setProofTab] = useState("exhibits");
  const [exhibitControlTab, setExhibitControlTab] = useState("exhibits");
  const [rightTab, setRightTab] = useState("preview");

  // Exhibit control
  const [exhibitSearch, setExhibitSearch] = useState("");
  const [admitDialogExhibit, setAdmitDialogExhibit] = useState(null);
  const [admitForm, setAdmitForm] = useState({ admitted_no: "", admitted_by_side: "Plaintiff" });

  // Session creation
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");

  // Push feedback
  const [pushToast, setPushToast] = useState("");

  // ── Load ──────────────────────────────────────────────
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
        session_id: sid, mode: "blank", status: "idle", highlights_visible: true,
      });
      setLiveState(ns);
    }
  };

  useEffect(() => { load(); }, [activeCase]);

  // Poll LiveState + JuryConnection every 2s
  useEffect(() => {
    if (!sessionId) return;
    const poll = async () => {
      const [states, conns] = await Promise.all([
        base44.entities.LiveState.filter({ session_id: sessionId }),
        base44.entities.JuryConnection.filter({ session_id: sessionId }),
      ]);
      if (states.length) setLiveState(states[0]);
      // Connected = has a JuryConnection that was seen within last 10s
      const now = Date.now();
      const connected = conns.some(c => c.connected && c.last_seen_at && (now - new Date(c.last_seen_at).getTime()) < 12000);
      setJuryConnected(connected);
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [sessionId]);

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

  // ── Push helpers ──────────────────────────────────────
  const pushLive = async (patch, toastMsg) => {
    if (!liveState) return;
    const payload = { ...patch, updated_at: new Date().toISOString() };
    setLiveState(prev => ({ ...prev, ...payload }));
    await base44.entities.LiveState.update(liveState.id, payload);
    setPushToast(toastMsg || "Sent to jury ✓");
    setTimeout(() => setPushToast(""), 2500);
  };

  const pushExhibitToJury = (je) => {
    const adm = admittedById[je.id];
    if (!adm) {
      if (!confirm(`"${je.marked_title}" is not admitted yet. Send anyway?`)) return;
    }
    const label = adm ? `Exhibit ${adm.admitted_no} – ${je.marked_title}` : `#${je.marked_no} – ${je.marked_title}`;
    pushLive({ mode: "exhibit", status: "showing", joint_exhibit_id: je.id, page: 1, spotlight_image_url: null, callout_id: null, label }, `Sent: ${label}`);
  };

  const pushCalloutToJury = (callout, label) => {
    pushLive({
      mode: "spotlight", status: "showing",
      callout_id: callout.id,
      spotlight_image_url: callout.snapshot_image_url,
      highlight_rects: callout._highlightRects || [],
      highlights_visible: true,
      label: label || callout.name || "Callout",
    }, `Spotlight: ${callout.name || "Callout"}`);
  };

  const toggleHighlights = () => {
    pushLive({ highlights_visible: !liveState?.highlights_visible }, "Highlights toggled");
  };

  const clearJury = () => pushLive({ mode: "blank", status: "idle", spotlight_image_url: null, joint_exhibit_id: null, callout_id: null, label: "" }, "Jury cleared");

  // ── Session ───────────────────────────────────────────
  const createSession = async () => {
    const pairCode = Math.random().toString(36).slice(2, 7).toUpperCase();
    const s = await base44.entities.TrialSessions.create({
      case_id: activeCase.id, title: newSessionTitle, active: true, pair_code: pairCode,
    });
    setNewSessionOpen(false);
    setNewSessionTitle("");
    await load();
    setSessionId(s.id);
    loadLiveState(s.id);
  };

  const openJuryScreen = () => {
    const current = sessions.find(s => s.id === sessionId);
    if (!current?.pair_code) { alert("No pair code for this session. Try creating a new session."); return; }
    setPairModalOpen(true);
  };

  // ── Admit ─────────────────────────────────────────────
  const admitExhibit = async () => {
    if (!admitForm.admitted_no) return alert("Enter admitted number");
    const je = admitDialogExhibit;
    await base44.entities.AdmittedExhibits.create({
      case_id: activeCase.id, joint_exhibit_id: je.id,
      admitted_no: admitForm.admitted_no, admitted_by_side: admitForm.admitted_by_side,
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

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  // ── Panel header helper ───────────────────────────────
  const PanelHeader = ({ icon: Icon, label, color = "text-cyan-400", open, onToggle, right }) => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2a45] bg-[#0a0f1e] flex-shrink-0">
      <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <button onClick={onToggle} className="text-slate-600 hover:text-slate-300">
        {right ? (open ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />) : (open ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden">
      <WorkflowBanner />

      {/* TOP BAR */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 flex-wrap">
        <Gavel className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span className="text-sm font-bold text-white">Attorney View</span>
        <div className="w-px h-4 bg-[#1e2a45]" />

        <Select value={sessionId} onValueChange={v => { setSessionId(v); loadLiveState(v); }}>
          <SelectTrigger className="h-7 text-xs w-44 bg-[#131a2e] border-[#1e2a45] text-slate-200">
            <SelectValue placeholder="Select session…" />
          </SelectTrigger>
          <SelectContent>
            {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-7 text-xs bg-[#131a2e] border border-[#1e2a45] text-slate-400 hover:text-slate-200" onClick={() => setNewSessionOpen(true)}>
          <Plus className="w-3 h-3" />
        </Button>

        {currentSession?.pair_code && (
          <span className="text-[10px] bg-[#131a2e] border border-[#1e2a45] px-2 py-0.5 rounded text-slate-400 font-mono">
            <span className="text-slate-600">Code:</span> <strong className="text-cyan-300">{currentSession.pair_code}</strong>
          </span>
        )}

        <div className="w-px h-4 bg-[#1e2a45]" />

        {/* Real jury connection status */}
        <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border ${juryConnected ? "bg-green-500/10 text-green-400 border-green-700/40" : "bg-slate-800/50 text-slate-500 border-slate-700/40"}`}>
          {juryConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {juryConnected ? "Jury Connected" : "Jury Offline"}
        </div>

        {!juryConnected && (
          <span className="text-[10px] text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Jury not connected — pushes won't be seen
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {pushToast && <span className="text-xs text-green-400 font-medium animate-pulse">{pushToast}</span>}
          <Button size="sm" variant="outline" className="h-7 text-xs border-red-700/30 text-red-400 hover:bg-red-900/20" onClick={clearJury}>
            Clear Jury
          </Button>
          <Button size="sm" className="h-7 text-xs bg-green-700 hover:bg-green-600 text-white" onClick={openJuryScreen}>
            <Monitor className="w-3 h-3 mr-1" /> Open Jury Screen
          </Button>
        </div>
      </div>

      {/* 3-COLUMN LAYOUT */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══ LEFT: Question Runner ═══ */}
        <div className={`flex flex-col border-r border-[#1e2a45] bg-[#0f1629] transition-all duration-200 ${leftOpen ? "w-[320px]" : "w-8"} flex-shrink-0`}>
          {leftOpen ? (
            <>
              <PanelHeader icon={Users} label="Questions" open={leftOpen} onToggle={() => setLeftOpen(false)} />

              {/* Witness + exam */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#1e2a45] flex-shrink-0">
                <Select value={selectedPartyId} onValueChange={v => { setSelectedPartyId(v); setSelectedQIdx(0); }}>
                  <SelectTrigger className="h-6 text-[11px] flex-1 bg-[#131a2e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Witness…" /></SelectTrigger>
                  <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{partyName(p.id)}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex rounded border border-[#1e2a45] overflow-hidden flex-shrink-0">
                  {["D","C"].map((t, i) => (
                    <button key={t} onClick={() => { setExamType(i === 0 ? "Direct" : "Cross"); setSelectedQIdx(0); }}
                      className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${examType === (i === 0 ? "Direct" : "Cross") ? (i === 0 ? "bg-green-600 text-white" : "bg-orange-600 text-white") : "text-slate-500 hover:text-slate-300"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question list */}
              <div className="flex-1 overflow-y-auto">
                {witnessQuestions.map((q, idx) => (
                  <button key={q.id} onClick={() => setSelectedQIdx(idx)}
                    className={`w-full text-left px-2.5 py-2 border-b border-[#1e2a45] transition-colors ${selectedQIdx === idx ? "bg-cyan-500/10 border-l-2 border-l-cyan-400" : "hover:bg-white/5 border-l-2 border-l-transparent"}`}>
                    <div className="flex items-start gap-1.5">
                      <span className="text-[9px] text-slate-600 mt-0.5 flex-shrink-0 w-4">{idx+1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-300 line-clamp-2 leading-snug">{q.question_text}</p>
                        <span className={`text-[9px] mt-0.5 inline-block px-1.5 py-0.5 rounded ${STATUS_OPTS.find(s => s.value === q.status)?.color || ""}`}>{q.status}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {witnessQuestions.length === 0 && (
                  <p className="text-[10px] text-slate-600 text-center py-6">No questions for this witness.</p>
                )}
              </div>

              {/* Question detail */}
              {currentQ && (
                <div className="border-t border-[#1e2a45] p-2.5 space-y-2 flex-shrink-0 overflow-y-auto max-h-[55%]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button disabled={selectedQIdx === 0} onClick={() => setSelectedQIdx(i => i - 1)} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="text-[9px] text-slate-600">{selectedQIdx+1}/{witnessQuestions.length}</span>
                      <button disabled={selectedQIdx >= witnessQuestions.length - 1} onClick={() => setSelectedQIdx(i => i + 1)} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex gap-0.5 flex-wrap">
                      {STATUS_OPTS.map(s => (
                        <button key={s.value} onClick={() => updateQ("status", s.value)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${currentQ.status === s.value ? s.color : "bg-[#0f1629] border-[#1e2a45] text-slate-600 hover:border-slate-500"}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-2.5">
                    <p className="text-sm font-medium text-white leading-snug">{currentQ.question_text}</p>
                    {currentQ.goal && <p className="text-[10px] text-slate-400 mt-1">🎯 {currentQ.goal}</p>}
                    {currentQ.expected_answer && <p className="text-[10px] text-slate-400 mt-0.5">💬 {currentQ.expected_answer}</p>}
                  </div>

                  <div className="flex gap-1 flex-wrap">
                    {QUALITY_OPTS.map(opt => (
                      <button key={opt.value} onClick={() => updateQ("answer_quality", currentQ.answer_quality === opt.value ? null : opt.value)}
                        className={`px-2 py-1 rounded text-[9px] font-medium border transition-colors ${currentQ.answer_quality === opt.value ? opt.color : "bg-[#0f1629] border-[#1e2a45] text-slate-600 hover:border-slate-500"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={currentQ.admission_obtained || false} onCheckedChange={v => updateQ("admission_obtained", v)} />
                    <span className="text-[10px] text-slate-400">Admission Obtained</span>
                  </label>

                  <Textarea value={currentQ.live_notes || ""} onChange={e => updateQ("live_notes", e.target.value)}
                    placeholder="Live notes…" rows={2}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-[11px] resize-none" />

                  {currentQ.answer_quality === "Harmful" && (
                    <div className="text-[9px] text-red-400 bg-red-950/30 border border-red-700/30 rounded px-2 py-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Harmful answer — check Proof Drawer
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <button onClick={() => setLeftOpen(true)} className="flex flex-col items-center justify-center h-full gap-2 text-slate-600 hover:text-cyan-400 w-8">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[8px] uppercase tracking-widest writing-mode-vertical" style={{writingMode:"vertical-rl"}}>Questions</span>
            </button>
          )}
        </div>

        {/* ═══ MIDDLE: Proof Drawer + Exhibit Control ═══ */}
        <div className={`flex flex-col border-r border-[#1e2a45] bg-[#0a0f1e] transition-all duration-200 ${midOpen ? "flex-1 min-w-[300px]" : "w-8"} flex-shrink-0`}>
          {midOpen ? (
            <>
              {/* Sub-tabs */}
              <div className="flex border-b border-[#1e2a45] bg-[#080d1a] flex-shrink-0">
                <button onClick={() => setMidOpen(false)} className="p-2 text-slate-600 hover:text-slate-300 border-r border-[#1e2a45]">
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
                <div className="flex flex-1">
                  {[
                    { id: "exhibits", icon: BookOpen, label: "Proof" },
                    { id: "control", icon: CheckCircle, label: "Exhibit Ctrl" },
                    { id: "battlecards", icon: Swords, label: "Battle Cards" },
                  ].map(t => (
                    <button key={t.id} onClick={() => setProofTab(t.id)}
                      className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors flex-1 justify-center ${proofTab === t.id ? "border-cyan-400 text-cyan-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
                      <t.icon className="w-3 h-3" />{t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3">

                {/* PROOF DRAWER */}
                {proofTab === "exhibits" && (
                  <div className="space-y-2">
                    {!juryConnected && (
                      <div className="flex items-center gap-2 text-[10px] text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded px-2 py-1.5">
                        <WifiOff className="w-3 h-3 flex-shrink-0" /> Jury not connected — pushes queued
                      </div>
                    )}
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Admitted Exhibits</p>
                    {jointExhibits.filter(j => j.status === "Admitted").map(je => {
                      const adm = admittedById[je.id];
                      return (
                        <div key={je.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-green-300 flex-shrink-0">#{adm?.admitted_no || je.marked_no}</span>
                            <p className="text-xs text-slate-300 flex-1 truncate">{je.marked_title}</p>
                            <button onClick={() => pushExhibitToJury(je)}
                              className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-green-600/20 text-green-400 border border-green-700/40 hover:bg-green-600/30 flex-shrink-0">
                              <Monitor className="w-2.5 h-2.5" /> Send
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {jointExhibits.filter(j => j.status === "Admitted").length === 0 && (
                      <p className="text-[10px] text-slate-600 text-center py-4">No admitted exhibits yet.</p>
                    )}
                    <div className="pt-2">
                      <p className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-1">Depo Clips (attorney only)</p>
                      {depoClips.slice(0, 10).map(c => (
                        <div key={c.id} className="bg-[#0f1629] border border-[#1e2a45] rounded p-2 mb-1">
                          <p className="text-[9px] text-violet-400">{c.topic_tag}</p>
                          <p className="text-[10px] text-slate-400 line-clamp-2">{c.clip_text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* EXHIBIT CONTROL */}
                {proofTab === "control" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2 w-3 h-3 text-slate-500" />
                      <Input value={exhibitSearch} onChange={e => setExhibitSearch(e.target.value)}
                        placeholder="Search…" className="pl-7 h-7 text-[11px] bg-[#131a2e] border-[#1e2a45] text-slate-200" />
                    </div>
                    {filteredExhibits.map(je => {
                      const adm = admittedById[je.id];
                      return (
                        <div key={je.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`text-[10px] font-bold flex-shrink-0 ${adm ? "text-green-400" : "text-cyan-400"}`}>#{adm?.admitted_no || je.marked_no}</span>
                            <span className="text-[10px] text-slate-300 flex-1 truncate">{je.marked_title}</span>
                            <Badge className={`text-[8px] flex-shrink-0 ${je.status === "Admitted" ? "bg-green-500/20 text-green-400" : je.status === "Offered" ? "bg-cyan-500/20 text-cyan-400" : je.status === "Excluded" ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-400"}`}>{je.status}</Badge>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {je.status !== "Offered" && je.status !== "Admitted" && (
                              <button onClick={() => setExhibitStatus(je, "Offered")} className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-600/20 text-cyan-400 border border-cyan-700/40">Mark</button>
                            )}
                            {je.status !== "Admitted" && (
                              <button onClick={() => { setAdmitDialogExhibit(je); setAdmitForm({ admitted_no: "", admitted_by_side: "Plaintiff" }); }}
                                className="text-[8px] px-1.5 py-0.5 rounded bg-green-600/20 text-green-400 border border-green-700/40">Admit…</button>
                            )}
                            {je.status === "Admitted" && (
                              <button onClick={() => pushExhibitToJury(je)}
                                className="text-[8px] px-1.5 py-0.5 rounded bg-green-700/30 text-green-300 border border-green-700/40 flex items-center gap-0.5">
                                <Monitor className="w-2 h-2" /> Push
                              </button>
                            )}
                            <button onClick={() => setExhibitStatus(je, "Excluded")} className="text-[8px] px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-700/40"><Ban className="w-2 h-2" /></button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredExhibits.length === 0 && <p className="text-[10px] text-slate-600 text-center py-4">No exhibits.</p>}
                  </div>
                )}

                {/* BATTLE CARDS */}
                {proofTab === "battlecards" && (
                  <div className="space-y-2">
                    {battleCards.map(bc => (
                      <div key={bc.id} className="bg-[#131a2e] border border-red-900/30 rounded-xl p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-white">{bc.title}</p>
                        {bc.when_to_use && <p className="text-[9px] text-amber-400">When: {bc.when_to_use}</p>}
                        {bc.commit_question && <p className="text-[9px] text-slate-400"><span className="text-green-400 font-semibold">C1:</span> {bc.commit_question}</p>}
                        {bc.credit_question && <p className="text-[9px] text-slate-400"><span className="text-cyan-400 font-semibold">C2:</span> {bc.credit_question}</p>}
                        {bc.confront_question && <p className="text-[9px] text-slate-400"><span className="text-red-400 font-semibold">C3:</span> {bc.confront_question}</p>}
                      </div>
                    ))}
                    {battleCards.length === 0 && <p className="text-[10px] text-slate-600 text-center py-4">No battle cards. Create in Witness Prep.</p>}
                  </div>
                )}
              </div>
            </>
          ) : (
            <button onClick={() => setMidOpen(true)} className="flex flex-col items-center justify-center h-full gap-2 text-slate-600 hover:text-cyan-400 w-8">
              <Layers className="w-3.5 h-3.5" />
              <span className="text-[8px] uppercase tracking-widest" style={{writingMode:"vertical-rl"}}>Proof</span>
            </button>
          )}
        </div>

        {/* ═══ RIGHT: Jury Preview + Controls ═══ */}
        <div className={`flex flex-col border-l border-[#1e2a45] bg-[#0a0f1e] transition-all duration-200 ${rightOpen ? "w-[340px]" : "w-8"} flex-shrink-0`}>
          {rightOpen ? (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2a45] bg-[#0a0f1e] flex-shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-green-400">
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Jury Preview</span>
                </div>
                <button onClick={() => setRightOpen(false)} className="text-slate-600 hover:text-slate-300">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Preview + Highlight controls */}
              <div className="flex-1 overflow-hidden flex flex-col p-2 gap-2">
                <div className="flex-1 min-h-0">
                  <JuryPreviewPanel
                    liveState={liveState}
                    jointExhibits={jointExhibits}
                    admittedExhibits={admittedExhibits}
                    extracts={extracts}
                    onToggleHighlights={toggleHighlights}
                    onClear={clearJury}
                  />
                </div>

                {/* Mode controls */}
                {liveState?.mode === "spotlight" && (
                  <div className="flex-shrink-0 bg-[#131a2e] border border-yellow-700/30 rounded-lg p-2 space-y-1">
                    <p className="text-[9px] text-yellow-400 font-semibold uppercase tracking-wider">✦ Spotlight Active</p>
                    <button onClick={toggleHighlights}
                      className={`w-full text-[10px] py-1 rounded border transition-colors ${liveState?.highlights_visible ? "bg-yellow-500/20 text-yellow-300 border-yellow-600/40" : "text-slate-500 border-slate-700/40 hover:text-slate-300"}`}>
                      Highlights: {liveState?.highlights_visible ? "ON" : "OFF"}
                    </button>
                    <button onClick={clearJury}
                      className="w-full text-[10px] py-1 rounded border border-red-700/30 text-red-400 hover:bg-red-900/20">
                      Clear Spotlight
                    </button>
                  </div>
                )}

                {liveState?.mode === "exhibit" && (
                  <div className="flex-shrink-0 bg-[#131a2e] border border-green-700/30 rounded-lg p-2">
                    <p className="text-[9px] text-green-400 font-semibold uppercase tracking-wider mb-1">📄 Exhibit Active</p>
                    <p className="text-[10px] text-slate-400 truncate">{liveState.label || "—"}</p>
                    <button onClick={clearJury}
                      className="w-full mt-1 text-[10px] py-1 rounded border border-red-700/30 text-red-400 hover:bg-red-900/20">
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button onClick={() => setRightOpen(true)} className="flex flex-col items-center justify-center h-full gap-2 text-slate-600 hover:text-green-400 w-8">
              <Monitor className="w-3.5 h-3.5" />
              <span className="text-[8px] uppercase tracking-widest" style={{writingMode:"vertical-rl"}}>Jury</span>
            </button>
          )}
        </div>
      </div>

      {/* NEW SESSION DIALOG */}
      <Dialog open={newSessionOpen} onOpenChange={setNewSessionOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-sm">
          <DialogHeader><DialogTitle>New Trial Session</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs text-slate-400">Session Name (e.g. "Day 3 – Glazek")</Label>
            <Input value={newSessionTitle} onChange={e => setNewSessionTitle(e.target.value)} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1"
              onKeyDown={e => e.key === "Enter" && newSessionTitle.trim() && createSession()} />
          </div>
          <p className="text-[10px] text-slate-500">A 5-character pair code will be generated automatically.</p>
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
            {admitDialogExhibit && <p className="text-xs text-slate-500">#{admitDialogExhibit.marked_no} — {admitDialogExhibit.marked_title}</p>}
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">Admitted Number</Label>
              <Input value={admitForm.admitted_no} onChange={e => setAdmitForm({ ...admitForm, admitted_no: e.target.value })} placeholder="e.g. 12" className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1"
                onKeyDown={e => e.key === "Enter" && admitExhibit()} />
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
            <Button className="bg-green-600 hover:bg-green-700" onClick={admitExhibit} disabled={!admitForm.admitted_no}>Admit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAIR CODE MODAL */}
      <PairCodeModal open={pairModalOpen} onClose={() => setPairModalOpen(false)} session={currentSession} />
    </div>
  );
}