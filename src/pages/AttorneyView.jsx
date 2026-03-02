import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Ban, Wifi, WifiOff, Scissors, Eye, EyeOff
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

function generateCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export default function AttorneyView() {
  const { activeCase } = useActiveCase();

  // Session (single source of truth)
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(null); // full TrialSession object
  const [juryConnected, setJuryConnected] = useState(false);
  const [pairModalOpen, setPairModalOpen] = useState(false);

  // Data
  const [parties, setParties] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [depoClips, setDepoClips] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [admittedExhibits, setAdmittedExhibits] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [callouts, setCallouts] = useState([]);
  const [highlightRects, setHighlightRects] = useState([]);
  const [proofItems, setProofItems] = useState([]);
  const [battleCards, setBattleCards] = useState([]);

  // Q runner
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [examType, setExamType] = useState("Cross");
  const [selectedQIdx, setSelectedQIdx] = useState(0);

  // Panels
  const [leftOpen, setLeftOpen] = useState(true);
  const [midOpen, setMidOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [proofTab, setProofTab] = useState("callouts");

  // Exhibit control
  const [exhibitSearch, setExhibitSearch] = useState("");
  const [admitDialogExhibit, setAdmitDialogExhibit] = useState(null);
  const [admitForm, setAdmitForm] = useState({ admitted_no: "", admitted_by_side: "Plaintiff" });

  // Session creation
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");

  // Push feedback
  const [pushToast, setPushToast] = useState("");

  // Proof filtering
  const [showAllProof, setShowAllProof] = useState(false);

  // ── Load ──────────────────────────────────────────────
  const load = async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [s, p, q, dc, je, ae, ex, co, bc, pi] = await Promise.all([
      base44.entities.TrialSessions.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.Questions.filter({ case_id: cid }),
      base44.entities.DepoClips.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.AdmittedExhibits.filter({ case_id: cid }),
      base44.entities.ExhibitExtracts.filter({ case_id: cid }),
      base44.entities.ExtractCallout.filter({ case_id: cid }),
      base44.entities.BattleCards.filter({ case_id: cid }),
      base44.entities.ProofItem.filter({ case_id: cid }),
    ]);
    setSessions(s);
    setParties(p);
    setQuestions(q);
    setDepoClips(dc);
    setJointExhibits(je);
    setAdmittedExhibits(ae);
    setExtracts(ex);
    setCallouts(co);
    setBattleCards(bc);
    setProofItems(pi);
    if (!selectedPartyId && p.length) setSelectedPartyId(p[0].id);
    if (s.length && !session) {
      const active = s.find(x => x.is_live) || s[0];
      setSession(active);
    }
    // Load highlight rects for all callouts
    if (co.length) {
      const rects = await base44.entities.HighlightRect.list();
      setHighlightRects(rects);
    }
  };

  useEffect(() => { load(); }, [activeCase]);

  // Poll session + jury connection every 2s
  useEffect(() => {
    if (!session?.id) return;
    const poll = async () => {
      const [updated, conns] = await Promise.all([
        base44.entities.TrialSessions.filter({ id: session.id }),
        base44.entities.JuryConnection.filter({ session_id: session.id }),
      ]);
      if (updated.length) setSession(updated[0]);
      const now = Date.now();
      const conn = conns.some(c => c.connected && c.last_seen_at && (now - new Date(c.last_seen_at).getTime()) < 12000);
      setJuryConnected(conn);
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [session?.id]);

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

  // When question changes, update session.active_question_id
  useEffect(() => {
    if (!session?.id || !currentQ) return;
    base44.entities.TrialSessions.update(session.id, { active_question_id: currentQ.id });
  }, [currentQ?.id, session?.id]);

  const updateQ = useCallback(async (field, value) => {
    if (!currentQ) return;
    await base44.entities.Questions.update(currentQ.id, { [field]: value });
    setQuestions(prev => prev.map(q => q.id === currentQ.id ? { ...q, [field]: value } : q));
  }, [currentQ]);

  // Proof items for current question
  const currentQProofIds = useMemo(() => new Set(currentQ?.linked_proof_item_ids || []), [currentQ]);

  const filteredProofItems = useMemo(() => {
    if (showAllProof || !currentQ) return proofItems;
    return proofItems.filter(p => currentQProofIds.has(p.id));
  }, [proofItems, currentQProofIds, showAllProof, currentQ]);

  // Callouts with their highlight rects
  const calloutsWithRects = useMemo(() => {
    return callouts.map(c => ({
      ...c,
      rects: highlightRects.filter(r => r.callout_id === c.id),
    }));
  }, [callouts, highlightRects]);

  // ── Push to Jury (updates TrialSession) ──────────────
  const pushToJury = async (presentableType, presentableId, options = {}, toastMsg) => {
    if (!session) return;
    const patch = {
      active_presentable_type: presentableType,
      active_presentable_id: presentableId,
      active_presentable_options: { spotlightOn: false, highlightsOn: true, page: 1, zoom: 1.0, ...options },
      is_live: true,
    };
    setSession(prev => ({ ...prev, ...patch }));
    await base44.entities.TrialSessions.update(session.id, patch);
    setPushToast(toastMsg || "Sent to jury ✓");
    setTimeout(() => setPushToast(""), 2500);
  };

  const pushExhibitToJury = (je) => {
    const adm = admittedById[je.id];
    if (!adm) {
      if (!confirm(`"${je.marked_title}" is not admitted yet. Send anyway?`)) return;
    }
    const label = adm ? `Exhibit ${adm.admitted_no} – ${je.marked_title}` : `#${je.marked_no} – ${je.marked_title}`;
    pushToJury("joint_exhibit", je.id, { page: 1, spotlightOn: false }, `Sent: ${label}`);
  };

  const pushCalloutToJury = (callout) => {
    const ext = extracts.find(e => e.id === callout.extract_id);
    const je = ext ? jointExhibits.find(j => j.exhibit_extract_id === ext.id) : null;
    const label = `${je ? `Ex. ${admittedById[je.id]?.admitted_no || je.marked_no} – ` : ""}${callout.name || "Callout"}`;
    pushToJury("extract_callout", callout.id, {
      spotlightOn: true,
      highlightsOn: true,
    }, `Spotlight: ${label}`);
  };

  const toggleHighlights = async () => {
    if (!session) return;
    const opts = session.active_presentable_options || {};
    const patch = {
      active_presentable_options: { ...opts, highlightsOn: !opts.highlightsOn },
    };
    setSession(prev => ({ ...prev, ...patch }));
    await base44.entities.TrialSessions.update(session.id, patch);
    setPushToast(opts.highlightsOn ? "Highlights OFF" : "Highlights ON");
    setTimeout(() => setPushToast(""), 1500);
  };

  const clearJury = async () => {
    if (!session) return;
    const patch = {
      active_presentable_type: "none",
      active_presentable_id: null,
      active_presentable_options: { spotlightOn: false, highlightsOn: false },
    };
    setSession(prev => ({ ...prev, ...patch }));
    await base44.entities.TrialSessions.update(session.id, patch);
    setPushToast("Jury cleared");
    setTimeout(() => setPushToast(""), 1500);
  };

  // ── Session ───────────────────────────────────────────
  const createSession = async () => {
    const s = await base44.entities.TrialSessions.create({
      case_id: activeCase.id, title: newSessionTitle, is_live: true,
      pair_code: generateCode(),
      active_presentable_type: "none",
      active_presentable_options: { spotlightOn: false, highlightsOn: true, page: 1, zoom: 1.0 },
    });
    setNewSessionOpen(false);
    setNewSessionTitle("");
    setSessions(prev => [...prev, s]);
    setSession(s);
  };

  const openJuryScreen = () => {
    if (!session?.pair_code) { alert("No pair code. Create or select a session."); return; }
    setPairModalOpen(true);
  };

  // ── Admit ─────────────────────────────────────────────
  const admitExhibit = async () => {
    if (!admitForm.admitted_no) return;
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
      j.marked_no?.toLowerCase().includes(exhibitSearch.toLowerCase())
    ), [jointExhibits, exhibitSearch]);

  const partyName = (id) => {
    const p = parties.find(x => x.id === id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : "—";
  };

  // Build jury preview-compatible state from session
  const juryPreviewState = useMemo(() => {
    if (!session) return null;
    const opts = session.active_presentable_options || {};
    const type = session.active_presentable_type || "none";
    const id = session.active_presentable_id;
    if (type === "none") return { mode: "blank" };
    if (type === "joint_exhibit") {
      return { mode: "exhibit", joint_exhibit_id: id, page: opts.page || 1, label: "" };
    }
    if (type === "extract_callout") {
      const callout = calloutsWithRects.find(c => c.id === id);
      return {
        mode: "spotlight",
        spotlight_image_url: callout?.snapshot_image_url,
        highlights_visible: opts.highlightsOn !== false,
        highlight_rects: (callout?.rects || []).map(r => ({ ...r.rect, color: r.color })),
        label: callout?.name || "Callout",
      };
    }
    return { mode: "blank" };
  }, [session, calloutsWithRects]);

  const isSpotlightActive = session?.active_presentable_type === "extract_callout";
  const highlightsOn = session?.active_presentable_options?.highlightsOn !== false;

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden">
      <WorkflowBanner />

      {/* TOP BAR */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 flex-wrap">
        <Gavel className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span className="text-sm font-bold text-white">Attorney View</span>
        <div className="w-px h-4 bg-[#1e2a45]" />

        <Select value={session?.id || ""} onValueChange={v => setSession(sessions.find(s => s.id === v) || null)}>
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

        {session?.pair_code && (
          <span className="text-[10px] bg-[#131a2e] border border-[#1e2a45] px-2 py-0.5 rounded text-slate-400 font-mono">
            Code: <strong className="text-cyan-300">{session.pair_code}</strong>
          </span>
        )}

        <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border ${juryConnected ? "bg-green-500/10 text-green-400 border-green-700/40" : "bg-slate-800/50 text-slate-500 border-slate-700/40"}`}>
          {juryConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {juryConnected ? "Jury Live" : "Jury Offline"}
        </div>

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
        <div className={`flex flex-col border-r border-[#1e2a45] bg-[#0f1629] transition-all duration-200 ${leftOpen ? "w-[300px]" : "w-8"} flex-shrink-0`}>
          {leftOpen ? (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e2a45] bg-[#0a0f1e] flex-shrink-0">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1"><Users className="w-3 h-3" /> Questions</span>
                <button onClick={() => setLeftOpen(false)} className="text-slate-600 hover:text-slate-300"><ChevronLeft className="w-3.5 h-3.5" /></button>
              </div>

              <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#1e2a45] flex-shrink-0">
                <Select value={selectedPartyId} onValueChange={v => { setSelectedPartyId(v); setSelectedQIdx(0); }}>
                  <SelectTrigger className="h-6 text-[11px] flex-1 bg-[#131a2e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Witness…" /></SelectTrigger>
                  <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{partyName(p.id)}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex rounded border border-[#1e2a45] overflow-hidden flex-shrink-0">
                  {["D","C"].map((t, i) => (
                    <button key={t} onClick={() => { setExamType(i === 0 ? "Direct" : "Cross"); setSelectedQIdx(0); }}
                      className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${examType === (i === 0 ? "Direct" : "Cross") ? (i === 0 ? "bg-green-600 text-white" : "bg-orange-600 text-white") : "text-slate-500 hover:text-slate-300"}`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Question list */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {witnessQuestions.map((q, idx) => (
                  <button key={q.id} onClick={() => setSelectedQIdx(idx)}
                    className={`w-full text-left px-2.5 py-2 border-b border-[#1e2a45] transition-colors ${selectedQIdx === idx ? "bg-cyan-500/10 border-l-2 border-l-cyan-400" : "hover:bg-white/5 border-l-2 border-l-transparent"}`}>
                    <div className="flex items-start gap-1.5">
                      <span className="text-[9px] text-slate-600 mt-0.5 flex-shrink-0 w-4">{idx+1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-300 line-clamp-2 leading-snug">{q.question_text}</p>
                        <span className={`text-[9px] mt-0.5 inline-block px-1.5 py-0.5 rounded ${STATUS_OPTS.find(s => s.value === q.status)?.color || ""}`}>{q.status}</span>
                        {(q.linked_proof_item_ids?.length > 0) && (
                          <span className="ml-1 text-[9px] text-cyan-600">{q.linked_proof_item_ids.length} proof</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {witnessQuestions.length === 0 && <p className="text-[10px] text-slate-600 text-center py-6">No questions for this witness.</p>}
              </div>

              {/* Question detail */}
              {currentQ && (
                <div className="border-t border-[#1e2a45] p-2.5 space-y-2 overflow-y-auto flex-shrink-0 max-h-[52%]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button disabled={selectedQIdx === 0} onClick={() => setSelectedQIdx(i => i - 1)} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="text-[9px] text-slate-600">{selectedQIdx+1}/{witnessQuestions.length}</span>
                      <button disabled={selectedQIdx >= witnessQuestions.length - 1} onClick={() => setSelectedQIdx(i => i + 1)} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex gap-0.5 flex-wrap justify-end">
                      {STATUS_OPTS.map(s => (
                        <button key={s.value} onClick={() => updateQ("status", s.value)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${currentQ.status === s.value ? s.color : "bg-[#0f1629] border-[#1e2a45] text-slate-600 hover:border-slate-500"}`}>{s.label}</button>
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
                        className={`px-2 py-1 rounded text-[9px] font-medium border transition-colors ${currentQ.answer_quality === opt.value ? opt.color : "bg-[#0f1629] border-[#1e2a45] text-slate-600 hover:border-slate-500"}`}>{opt.label}</button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={currentQ.admission_obtained || false} onCheckedChange={v => updateQ("admission_obtained", v)} />
                    <span className="text-[10px] text-slate-400">Admission Obtained</span>
                  </label>
                  <Textarea value={currentQ.live_notes || ""} onChange={e => updateQ("live_notes", e.target.value)}
                    placeholder="Live notes…" rows={2} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-[11px] resize-none" />
                  {currentQ.answer_quality === "Harmful" && (
                    <div className="text-[9px] text-red-400 bg-red-950/30 border border-red-700/30 rounded px-2 py-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Harmful — check Proof Drawer
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <button onClick={() => setLeftOpen(true)} className="flex flex-col items-center justify-center h-full gap-2 text-slate-600 hover:text-cyan-400 w-8">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[8px] uppercase tracking-widest" style={{writingMode:"vertical-rl"}}>Questions</span>
            </button>
          )}
        </div>

        {/* ═══ MIDDLE: Proof Drawer + Exhibit Control ═══ */}
        <div className={`flex flex-col border-r border-[#1e2a45] bg-[#0a0f1e] transition-all duration-200 ${midOpen ? "flex-1 min-w-[280px]" : "w-8"} flex-shrink-0`}>
          {midOpen ? (
            <>
              <div className="flex border-b border-[#1e2a45] bg-[#080d1a] flex-shrink-0 items-center">
                <button onClick={() => setMidOpen(false)} className="p-2 text-slate-600 hover:text-slate-300 border-r border-[#1e2a45] flex-shrink-0">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex flex-1 overflow-x-auto">
                  {[
                    { id: "callouts", icon: Scissors, label: "Callouts" },
                    { id: "exhibits", icon: BookOpen, label: "Exhibits" },
                    { id: "control", icon: CheckCircle, label: "Admit" },
                    { id: "clips", icon: FileText, label: "Clips" },
                    { id: "battlecards", icon: Swords, label: "Battle" },
                  ].map(t => (
                    <button key={t.id} onClick={() => setProofTab(t.id)}
                      className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap ${proofTab === t.id ? "border-cyan-400 text-cyan-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
                      <t.icon className="w-3 h-3" />{t.label}
                    </button>
                  ))}
                </div>
                {/* Show all proof toggle */}
                <div className="flex items-center gap-1 px-2 border-l border-[#1e2a45] flex-shrink-0">
                  <span className="text-[9px] text-slate-600">All</span>
                  <Switch checked={showAllProof} onCheckedChange={setShowAllProof} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">

                {/* CALLOUTS TAB */}
                {proofTab === "callouts" && (
                  <div className="space-y-2">
                    {!juryConnected && (
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded px-2 py-1">
                        <WifiOff className="w-3 h-3" /> Jury offline
                      </div>
                    )}
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                      Extract Callouts {!showAllProof && currentQ ? `— filtered for Q${selectedQIdx+1}` : "— all"}
                    </p>
                    {(() => {
                      const qProofCalloutIds = filteredProofItems
                        .filter(p => p.type === "extract_callout")
                        .map(p => p.ref_id);
                      const visible = showAllProof || !currentQ
                        ? calloutsWithRects
                        : calloutsWithRects.filter(c => qProofCalloutIds.includes(c.id));
                      if (!visible.length) return (
                        <p className="text-[10px] text-slate-600 text-center py-4">
                          {currentQ && !showAllProof ? "No callouts linked to this question. Toggle 'All' to see all." : "No callouts yet. Create them in Extracts."}
                        </p>
                      );
                      return visible.map(c => {
                        const ext = extracts.find(e => e.id === c.extract_id);
                        const isActive = session?.active_presentable_id === c.id;
                        return (
                          <div key={c.id} className={`rounded-lg border p-2 ${isActive ? "bg-yellow-900/20 border-yellow-600/40" : "bg-[#131a2e] border-[#1e2a45]"}`}>
                            <div className="flex items-start gap-2">
                              {c.snapshot_image_url && (
                                <img src={c.snapshot_image_url} alt={c.name}
                                  className="w-14 h-10 object-cover rounded border border-[#1e2a45] flex-shrink-0 bg-[#050809]" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-slate-200 font-medium leading-tight">{c.name || `p.${c.page_number}`}</p>
                                {ext && <p className="text-[9px] text-slate-500 truncate">{ext.extract_title_internal || ext.extract_title_official}</p>}
                                <p className="text-[9px] text-slate-600">p.{c.page_number} · {c.rects.length} highlights</p>
                              </div>
                            </div>
                            <div className="flex gap-1 mt-1.5">
                              <button onClick={() => pushCalloutToJury(c)}
                                className="flex-1 text-[9px] py-1 rounded bg-yellow-600/20 text-yellow-300 border border-yellow-600/40 hover:bg-yellow-600/30 flex items-center justify-center gap-1">
                                <Monitor className="w-2.5 h-2.5" /> Spotlight
                              </button>
                              {isActive && (
                                <button onClick={toggleHighlights}
                                  className={`text-[9px] px-2 py-1 rounded border transition-colors ${highlightsOn ? "bg-yellow-500/20 text-yellow-300 border-yellow-600/40" : "text-slate-500 border-slate-700/40"}`}>
                                  {highlightsOn ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* EXHIBITS (proof drawer - admitted) */}
                {proofTab === "exhibits" && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Admitted Exhibits</p>
                    {jointExhibits.filter(j => j.status === "Admitted").map(je => {
                      const adm = admittedById[je.id];
                      const isActive = session?.active_presentable_id === je.id;
                      return (
                        <div key={je.id} className={`rounded-lg border p-2 ${isActive ? "bg-green-900/20 border-green-600/40" : "bg-[#131a2e] border-[#1e2a45]"}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-green-300 flex-shrink-0">#{adm?.admitted_no || je.marked_no}</span>
                            <p className="text-xs text-slate-300 flex-1 truncate">{je.marked_title}</p>
                            <button onClick={() => pushExhibitToJury(je)}
                              className="text-[9px] px-2 py-1 rounded bg-green-600/20 text-green-400 border border-green-700/40 hover:bg-green-600/30 flex items-center gap-1 flex-shrink-0">
                              <Monitor className="w-2.5 h-2.5" /> Send
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {jointExhibits.filter(j => j.status === "Admitted").length === 0 && (
                      <p className="text-[10px] text-slate-600 text-center py-4">No admitted exhibits yet.</p>
                    )}
                  </div>
                )}

                {/* EXHIBIT CONTROL */}
                {proofTab === "control" && (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-2 top-2 w-3 h-3 text-slate-500" />
                      <Input value={exhibitSearch} onChange={e => setExhibitSearch(e.target.value)}
                        placeholder="Search…" className="pl-7 h-7 text-[11px] bg-[#131a2e] border-[#1e2a45] text-slate-200" />
                    </div>
                    {filteredExhibits.map(je => {
                      const adm = admittedById[je.id];
                      return (
                        <div key={je.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className={`text-[10px] font-bold ${adm ? "text-green-400" : "text-cyan-400"}`}>#{adm?.admitted_no || je.marked_no}</span>
                            <span className="text-[10px] text-slate-300 flex-1 truncate">{je.marked_title}</span>
                            <Badge className={`text-[8px] flex-shrink-0 ${je.status === "Admitted" ? "bg-green-500/20 text-green-400" : je.status === "Offered" ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-500/20 text-slate-400"}`}>{je.status}</Badge>
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

                {/* CLIPS */}
                {proofTab === "clips" && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Depo Clips (attorney only)</p>
                    {(() => {
                      const qProofClipIds = filteredProofItems.filter(p => p.type === "depo_clip").map(p => p.ref_id);
                      const visible = showAllProof || !currentQ
                        ? depoClips
                        : depoClips.filter(c => qProofClipIds.includes(c.id));
                      return visible.map(c => (
                        <div key={c.id} className="bg-[#131a2e] border border-[#1e2a45] rounded p-2">
                          <p className="text-[9px] text-violet-400">{c.topic_tag}</p>
                          <p className="text-[10px] text-slate-400 line-clamp-3">{c.clip_text}</p>
                          {c.start_cite && <p className="text-[9px] text-slate-600 font-mono">{c.start_cite}</p>}
                        </div>
                      ));
                    })()}
                    {depoClips.length === 0 && <p className="text-[10px] text-slate-600 text-center py-4">No depo clips.</p>}
                  </div>
                )}

                {/* BATTLE CARDS */}
                {proofTab === "battlecards" && (
                  <div className="space-y-2">
                    {battleCards.map(bc => (
                      <div key={bc.id} className="bg-[#131a2e] border border-red-900/30 rounded-xl p-3 space-y-1">
                        <p className="text-xs font-semibold text-white">{bc.title}</p>
                        {bc.when_to_use && <p className="text-[9px] text-amber-400">When: {bc.when_to_use}</p>}
                        {bc.commit_question && <p className="text-[9px] text-slate-400"><span className="text-green-400 font-semibold">C1:</span> {bc.commit_question}</p>}
                        {bc.credit_question && <p className="text-[9px] text-slate-400"><span className="text-cyan-400 font-semibold">C2:</span> {bc.credit_question}</p>}
                        {bc.confront_question && <p className="text-[9px] text-slate-400"><span className="text-red-400 font-semibold">C3:</span> {bc.confront_question}</p>}
                      </div>
                    ))}
                    {battleCards.length === 0 && <p className="text-[10px] text-slate-600 text-center py-4">No battle cards.</p>}
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

        {/* ═══ RIGHT: Jury Preview ═══ */}
        <div className={`flex flex-col border-l border-[#1e2a45] bg-[#0a0f1e] transition-all duration-200 ${rightOpen ? "w-[320px]" : "w-8"} flex-shrink-0`}>
          {rightOpen ? (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e2a45] bg-[#0a0f1e] flex-shrink-0">
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider flex items-center gap-1"><Monitor className="w-3 h-3" /> Jury Preview</span>
                <button onClick={() => setRightOpen(false)} className="text-slate-600 hover:text-slate-300"><ChevronRight className="w-3.5 h-3.5" /></button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col p-2 gap-2">
                <div className="flex-1 min-h-0">
                  <JuryPreviewPanel
                    liveState={juryPreviewState}
                    jointExhibits={jointExhibits}
                    admittedExhibits={admittedExhibits}
                    extracts={extracts}
                    onToggleHighlights={toggleHighlights}
                    onClear={clearJury}
                  />
                </div>

                {isSpotlightActive && (
                  <div className="flex-shrink-0 bg-[#131a2e] border border-yellow-700/30 rounded-lg p-2 space-y-1">
                    <p className="text-[9px] text-yellow-400 font-semibold uppercase tracking-wider">✦ Spotlight Active</p>
                    <button onClick={toggleHighlights}
                      className={`w-full text-[10px] py-1 rounded border transition-colors ${highlightsOn ? "bg-yellow-500/20 text-yellow-300 border-yellow-600/40" : "text-slate-500 border-slate-700/40 hover:text-slate-300"}`}>
                      Highlights: {highlightsOn ? "ON" : "OFF"}
                    </button>
                    <button onClick={clearJury} className="w-full text-[10px] py-1 rounded border border-red-700/30 text-red-400 hover:bg-red-900/20">
                      Clear Jury
                    </button>
                  </div>
                )}

                {session?.active_presentable_type === "joint_exhibit" && (
                  <div className="flex-shrink-0 bg-[#131a2e] border border-green-700/30 rounded-lg p-2">
                    <p className="text-[9px] text-green-400 font-semibold uppercase tracking-wider mb-1">📄 Exhibit Active</p>
                    <button onClick={clearJury} className="w-full text-[10px] py-1 rounded border border-red-700/30 text-red-400 hover:bg-red-900/20">Clear</button>
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
          <p className="text-[10px] text-slate-500">A pair code will be generated automatically.</p>
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
              <Input value={admitForm.admitted_no} onChange={e => setAdmitForm({ ...admitForm, admitted_no: e.target.value })} placeholder="e.g. 12"
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1" onKeyDown={e => e.key === "Enter" && admitExhibit()} />
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

      <PairCodeModal open={pairModalOpen} onClose={() => setPairModalOpen(false)} session={session} />
    </div>
  );
}