import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Target, FileText, BookOpen, Link2, ExternalLink, Copy,
  ChevronLeft, ChevronRight, AlertTriangle, GitBranch, ArrowRight, Zap, Monitor
} from "lucide-react";
import { createPageUrl } from "@/utils";

const STATUS_OPTS = [
  { value: "NotAsked", label: "Not Asked", color: "bg-slate-600/30 text-slate-400 border-slate-600" },
  { value: "Asked", label: "Asked", color: "bg-green-600/30 text-green-400 border-green-600" },
  { value: "NeedsFollowUp", label: "Follow Up", color: "bg-amber-600/30 text-amber-400 border-amber-600" },
  { value: "Skipped", label: "Skipped", color: "bg-slate-700/30 text-slate-500 border-slate-700" },
];

const QUALITY_OPTS = [
  { value: "AsExpected", label: "As Expected", color: "bg-green-500/20 text-green-400 border-green-600/40" },
  { value: "Unexpected", label: "Unexpected", color: "bg-amber-500/20 text-amber-400 border-amber-600/40" },
  { value: "Harmful", label: "Harmful", color: "bg-red-500/20 text-red-400 border-red-600/40" },
  { value: "GreatAdmission", label: "Great Admission", color: "bg-cyan-500/20 text-cyan-400 border-cyan-600/40" },
];

export default function TrialRunner() {
  const { activeCase } = useActiveCase();
  const [parties, setParties] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedParty, setSelectedParty] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  const [questionLinks, setQuestionLinks] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);
  const [trialPointLinks, setTrialPointLinks] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [depoClips, setDepoClips] = useState([]);
  const [depositions, setDepositions] = useState([]);
  const [branches, setBranches] = useState([]); // all QuestionBranches for case
  const [suggestedNext, setSuggestedNext] = useState(null); // { question, branch }
  const [witnessMode, setWitnessMode] = useState(null); // WITNESS_DENIES etc

  const [detailModal, setDetailModal] = useState(null); // { type: 'tp'|'exhibit'|'clip', data: ... }

  useEffect(() => {
    if (!activeCase) return;
    const cid = activeCase.id;
    Promise.all([
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.Questions.filter({ case_id: cid }),
      base44.entities.QuestionLinks.filter({ case_id: cid }),
      base44.entities.TrialPoints.filter({ case_id: cid }),
      base44.entities.TrialPointLinks.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
      base44.entities.DepoClips.filter({ case_id: cid }),
      base44.entities.Depositions.filter({ case_id: cid }),
      base44.entities.QuestionBranches.filter({ case_id: cid }),
    ]).then(([p, q, ql, tp, tpl, je, de, dc, deps, br]) => {
      setParties(p);
      const sorted = q.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setQuestions(sorted);
      if (sorted.length > 0) setSelectedId(sorted[0].id);
      setQuestionLinks(ql);
      setTrialPoints(tp);
      setTrialPointLinks(tpl);
      setJointExhibits(je);
      setDepoExhibits(de);
      setDepoClips(dc);
      setDepositions(deps);
      setBranches(br);
    });
  }, [activeCase]);

  const filtered = useMemo(
    () => questions.filter(q => selectedParty === "all" || q.party_id === selectedParty),
    [questions, selectedParty]
  );

  const current = filtered.find(q => q.id === selectedId) || filtered[0] || null;
  const currentIdx = filtered.findIndex(q => q.id === current?.id);

  // Branch evaluation
  const evaluateBranch = (question, quality, admission, witnessBehavior) => {
    if (!question) return null;
    const fromBranches = branches
      .filter(b => b.from_question_id === question.id && b.to_question_id)
      .sort((a, b) => (a.priority || 1) - (b.priority || 1));
    if (fromBranches.length === 0) return null;

    // Build priority match keys
    const candidates = [];
    // Witness behavior takes priority if set
    if (witnessBehavior) candidates.push(witnessBehavior);
    if (admission) candidates.push("ADMISSION_YES");
    else candidates.push("ADMISSION_NO");
    if (quality === "GreatAdmission") candidates.push("ANSWER_GREAT");
    else if (quality === "Harmful") candidates.push("ANSWER_HARMFUL");
    else if (quality === "Unexpected") candidates.push("ANSWER_UNEXPECTED");
    else if (quality === "AsExpected") candidates.push("ANSWER_EXPECTED");

    for (const key of candidates) {
      const match = fromBranches.find(b => b.condition_type === key && b.auto_jump !== false);
      if (match) {
        const nextQ = questions.find(q => q.id === match.to_question_id);
        return nextQ ? { question: nextQ, branch: match } : null;
      }
    }
    // fallback: first branch rule
    const first = fromBranches[0];
    const nextQ = questions.find(q => q.id === first.to_question_id);
    return nextQ ? { question: nextQ, branch: first } : null;
  };

  const updateQuestion = async (field, value) => {
    if (!current) return;
    const updated = { ...current, [field]: value };
    await base44.entities.Questions.update(current.id, { [field]: value });
    setQuestions(prev => prev.map(x => x.id === current.id ? updated : x));
    // Re-evaluate branch suggestion whenever quality/admission changes
    if (field === "answer_quality" || field === "admission_obtained") {
      const suggestion = evaluateBranch(
        updated,
        field === "answer_quality" ? value : updated.answer_quality,
        field === "admission_obtained" ? value : updated.admission_obtained,
        witnessMode
      );
      setSuggestedNext(suggestion);
    }
  };

  const applyWitnessMode = (mode) => {
    const next = witnessMode === mode ? null : mode;
    setWitnessMode(next);
    const suggestion = evaluateBranch(current, current?.answer_quality, current?.admission_obtained, next);
    setSuggestedNext(suggestion);
  };

  const jumpToSuggested = () => {
    if (!suggestedNext) return;
    setSelectedId(suggestedNext.question.id);
    setSuggestedNext(null);
    setWitnessMode(null);
  };

  const getPartyName = (pid) => {
    const p = parties.find(x => x.id === pid);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : "";
  };

  // Linked TP ids per question (for list highlighting)
  const linkedTpIdsByQuestion = useMemo(() => {
    const map = {};
    questionLinks.forEach(l => {
      if (l.link_type === "TrialPoint") {
        if (!map[l.question_id]) map[l.question_id] = [];
        map[l.question_id].push(l.link_id);
      }
    });
    return map;
  }, [questionLinks]);

  // Proof for current question
  const proofData = useMemo(() => {
    if (!current) return { tps: [], exhibits: [], clips: [] };

    const tpIds = new Set(linkedTpIdsByQuestion[current.id] || []);
    const linkedTPs = trialPoints.filter(tp => tpIds.has(tp.id));

    const relevantTPLinks = trialPointLinks.filter(l => tpIds.has(l.trial_point_id));
    const exhibitIds = new Set(relevantTPLinks.filter(l => l.entity_type === "MasterExhibit").map(l => l.entity_id));
    const clipIds = new Set(relevantTPLinks.filter(l => l.entity_type === "DepoClip").map(l => l.entity_id));

    // Filter clips to this witness' depositions only
    let witnessDepoIds = new Set();
    if (current.party_id) {
      depositions.filter(d => d.party_id === current.party_id).forEach(d => witnessDepoIds.add(d.id));
    }

    const allClips = depoClips.filter(c => clipIds.has(c.id));
    const witnessClips = current.party_id
      ? allClips.filter(c => witnessDepoIds.has(c.deposition_id))
      : allClips;

    const exhibits = jointExhibits.filter(je => exhibitIds.has(je.id));

    return { tps: linkedTPs, exhibits, clips: witnessClips };
  }, [current, linkedTpIdsByQuestion, trialPoints, trialPointLinks, jointExhibits, depoClips, depositions]);

  const hasProof = proofData.tps.length > 0 || proofData.exhibits.length > 0 || proofData.clips.length > 0;

  const getDepoExhibitInfo = (je) => {
    const depoId = je.primary_depo_exhibit_id || (je.source_depo_exhibit_ids || [])[0];
    return depoExhibits.find(d => d.id === depoId) || null;
  };

  const getDepositionName = (depoId) => {
    const d = depositions.find(x => x.id === depoId);
    if (!d) return null;
    const p = parties.find(x => x.id === d.party_id);
    const pName = p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : d.sheet_name;
    return pName;
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="flex h-screen bg-[#0a0f1e] overflow-hidden">
      {/* ── Left: Question List ─────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-[#1e2a45] flex flex-col bg-[#0f1629]">
        <div className="p-3 border-b border-[#1e2a45] space-y-2">
          <h2 className="text-sm font-bold text-white">Trial Runner</h2>
          <Select value={selectedParty} onValueChange={v => { setSelectedParty(v); }}>
            <SelectTrigger className="w-full h-8 bg-[#131a2e] border-[#1e2a45] text-slate-200 text-xs">
              <SelectValue placeholder="All Witnesses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Witnesses</SelectItem>
              {parties.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-slate-500">{filtered.length} question{filtered.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((q, idx) => {
            const tpCount = (linkedTpIdsByQuestion[q.id] || []).length;
            const hasLinks = tpCount > 0;
            const isActive = q.id === current?.id;
            const statusColor = STATUS_OPTS.find(s => s.value === q.status)?.color || "";
            const branchCount = branches.filter(b => b.from_question_id === q.id).length;

            return (
              <button
                key={q.id}
                onClick={() => setSelectedId(q.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-[#1e2a45] transition-colors relative
                  ${isActive ? "bg-cyan-600/15 border-l-2 border-l-cyan-400" : "hover:bg-white/5 border-l-2 border-l-transparent"}
                  ${hasLinks && !isActive ? "bg-red-950/30" : ""}
                `}
              >
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-600 mt-0.5 flex-shrink-0">{idx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug line-clamp-2 ${hasLinks ? "text-red-200" : "text-slate-300"}`}>
                      {q.question_text}
                    </p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {q.status && q.status !== "NotAsked" && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${statusColor}`}>{q.status}</span>
                      )}
                      {hasLinks && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border bg-red-500/20 text-red-400 border-red-600/40 flex items-center gap-0.5">
                          <Target className="w-2.5 h-2.5" /> {tpCount}
                        </span>
                      )}
                      {branchCount > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border bg-cyan-500/10 text-cyan-600 border-cyan-800/40 flex items-center gap-0.5">
                          <GitBranch className="w-2.5 h-2.5" /> {branchCount}
                        </span>
                      )}
                      {q.exam_type && (
                        <span className={`text-[9px] px-1 py-0.5 rounded ${q.exam_type === "Direct" ? "text-green-500" : "text-orange-400"}`}>
                          {q.exam_type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Question Detail ───────────────────────────────── */}
      {!current ? (
        <div className="flex-1 flex items-center justify-center text-slate-500">No questions found.</div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">

            {/* Navigation row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentIdx <= 0}
                  onClick={() => setSelectedId(filtered[currentIdx - 1]?.id)}
                  className="text-slate-400 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-500">{currentIdx + 1} / {filtered.length}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentIdx >= filtered.length - 1}
                  onClick={() => setSelectedId(filtered[currentIdx + 1]?.id)}
                  className="text-slate-400 hover:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <a
                href={`${createPageUrl("QuestionDetail")}?id=${current.id}`}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-400"
              >
                <Link2 className="w-3 h-3" /> Manage Links
              </a>
            </div>

            {/* Question card — red background if linked */}
            <div className={`rounded-xl p-5 border ${
              hasProof
                ? "bg-red-950/40 border-red-700/50"
                : "bg-[#131a2e] border-[#1e2a45]"
            }`}>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge className={current.exam_type === "Direct" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}>
                  {current.exam_type || "—"}
                </Badge>
                {current.party_id && (
                  <Badge variant="outline" className="text-slate-300 border-slate-600">{getPartyName(current.party_id)}</Badge>
                )}
                {hasProof && (
                  <Badge className="bg-red-500/20 text-red-400 border border-red-600/40">
                    <Target className="w-3 h-3 mr-1" /> {proofData.tps.length} trial point{proofData.tps.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              <p className="text-xl font-semibold text-white leading-relaxed">{current.question_text}</p>

              {(current.goal || current.expected_answer) && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                  {current.goal && (
                    <p className="text-sm text-slate-400"><span className="text-slate-500">🎯 Goal:</span> {current.goal}</p>
                  )}
                  {current.expected_answer && (
                    <p className="text-sm text-slate-300"><span className="text-slate-500">💬 Expected:</span> {current.expected_answer}</p>
                  )}
                </div>
              )}
            </div>

            {/* Status + Quality + Admission row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Status</p>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => updateQuestion("status", s.value)}
                      className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                        current.status === s.value ? s.color : "bg-[#0f1629] border-[#1e2a45] text-slate-500 hover:border-slate-500"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Answer Quality</p>
                  <div className="flex gap-2 flex-wrap">
                    {QUALITY_OPTS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateQuestion("answer_quality", current.answer_quality === opt.value ? null : opt.value)}
                        className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                          current.answer_quality === opt.value ? opt.color : "bg-[#0f1629] border-[#1e2a45] text-slate-500 hover:border-slate-500"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Witness Behavior</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: "WITNESS_DENIES", label: "Denies", color: "bg-red-600/20 text-red-400 border-red-600/40" },
                      { key: "WITNESS_CANT_RECALL", label: "Can't Recall", color: "bg-amber-600/20 text-amber-400 border-amber-600/40" },
                      { key: "WITNESS_BLAMES_OTHER", label: "Blames Other", color: "bg-orange-600/20 text-orange-400 border-orange-600/40" },
                    ].map(b => (
                      <button
                        key={b.key}
                        onClick={() => applyWitnessMode(b.key)}
                        className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                          witnessMode === b.key ? b.color : "bg-[#0f1629] border-[#1e2a45] text-slate-500 hover:border-slate-500"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Branch Suggestion Panel */}
            {suggestedNext && (
              <div className="bg-cyan-950/40 border border-cyan-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Suggested Next Question</span>
                </div>
                <p className="text-sm text-white mb-3 leading-snug">{suggestedNext.question.question_text}</p>
                {suggestedNext.branch.condition_text && (
                  <p className="text-[10px] text-cyan-600 italic mb-2">{suggestedNext.branch.condition_text}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={jumpToSuggested}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium"
                  >
                    <Zap className="w-3 h-3" /> Go to Suggested
                  </button>
                  <button
                    onClick={() => setSuggestedNext(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0f1629] border border-[#1e2a45] text-slate-400 hover:text-slate-200 text-xs"
                  >
                    Ignore
                  </button>
                  <button
                    onClick={() => setDetailModal({ type: "branchList", currentQ: current })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0f1629] border border-[#1e2a45] text-slate-400 hover:text-slate-200 text-xs"
                  >
                    <ArrowRight className="w-3 h-3" /> All Branches
                  </button>
                </div>
              </div>
            )}

            {/* Admission + Notes */}
            <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={current.admission_obtained || false}
                  onCheckedChange={v => updateQuestion("admission_obtained", v)}
                />
                <Label className="text-sm text-slate-300">Admission Obtained</Label>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Live Notes</p>
                <Textarea
                  value={current.live_notes || ""}
                  onChange={e => updateQuestion("live_notes", e.target.value)}
                  placeholder="Notes during examination…"
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-sm"
                  rows={2}
                />
              </div>
            </div>

            {/* ── PROOF SECTION ─────────────────────────────────── */}
            {hasProof && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Proof
                </p>

                {/* Trial Points */}
                {proofData.tps.length > 0 && (
                  <div className="bg-[#0f1629] border border-[#1e2a45] rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-[#1e2a45] flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Trial Points</span>
                    </div>
                    <div className="divide-y divide-[#1e2a45]">
                      {proofData.tps.map(tp => (
                        <div key={tp.id} className="flex items-start justify-between px-4 py-3 gap-3">
                          <div className="flex-1">
                            <p className="text-sm text-slate-200">{tp.point_text}</p>
                            <div className="flex gap-1 mt-1">
                              <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-700">{tp.status}</Badge>
                              {tp.theme && <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-700">{tp.theme}</Badge>}
                              {tp.priority && <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-700">{tp.priority}</Badge>}
                            </div>
                          </div>
                          <button
                            onClick={() => setDetailModal({ type: "tp", data: tp })}
                            className="text-slate-600 hover:text-cyan-400 flex-shrink-0 mt-0.5"
                            title="View detail"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exhibits */}
                {proofData.exhibits.length > 0 && (
                  <div className="bg-[#0f1629] border border-[#1e2a45] rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-[#1e2a45] flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Exhibits</span>
                    </div>
                    <div className="divide-y divide-[#1e2a45]">
                      {proofData.exhibits.map(je => {
                      const depo = getDepoExhibitInfo(je);
                      const isAdmitted = je.status === "Admitted" || je.admitted_no;
                      return (
                        <div key={je.id} className="flex items-start justify-between px-4 py-3 gap-3">
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-bold text-amber-300">Exh. {je.marked_no}</span>
                              <span className="text-sm text-slate-200">{je.marked_title}</span>
                            </div>
                            {je.pages && (
                              <p className="text-[10px] text-slate-400 mt-0.5">Pages: {je.pages}</p>
                            )}
                            {je.notes && (
                              <p className="text-[10px] text-slate-500 mt-0.5 italic">{je.notes}</p>
                            )}
                            {depo && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {depo.depo_exhibit_no && `Depo Exh. ${depo.depo_exhibit_no} · `}
                                {depo.deponent_name || ""}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button
                              onClick={() => setDetailModal({ type: "exhibit", data: je, depo })}
                              className="text-slate-600 hover:text-amber-400"
                              title="View detail"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            {isAdmitted && (
                              <a
                                href={`${createPageUrl("Present")}?exhibit_id=${je.id}`}
                                className="text-slate-600 hover:text-green-400"
                                title="Present to jury"
                              >
                                <Monitor className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  </div>
                )}

                {/* Depo Clips */}
                {proofData.clips.length > 0 && (
                  <div className="bg-[#0f1629] border border-[#1e2a45] rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-[#1e2a45] flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
                        Depo Clips {current.party_id ? `(${getPartyName(current.party_id)})` : ""}
                      </span>
                    </div>
                    <div className="divide-y divide-[#1e2a45]">
                      {proofData.clips.map(c => (
                        <div key={c.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              {c.topic_tag && (
                                <p className="text-[10px] text-violet-400 font-medium mb-1">{c.topic_tag}</p>
                              )}
                              {c.start_cite && (
                                <p className="text-[10px] font-mono text-slate-500 mb-1">
                                  {c.start_cite}{c.end_cite ? ` – ${c.end_cite}` : ""}
                                  {c.deposition_id && getDepositionName(c.deposition_id) ? ` · ${getDepositionName(c.deposition_id)}` : ""}
                                </p>
                              )}
                              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{c.clip_text}</p>
                            </div>
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <button
                                onClick={() => navigator.clipboard?.writeText(c.clip_text)}
                                className="text-slate-600 hover:text-violet-400"
                                title="Copy"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDetailModal({ type: "clip", data: c })}
                                className="text-slate-600 hover:text-violet-400"
                                title="View detail"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No proof */}
            {!hasProof && (
              <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-4 text-center">
                <p className="text-xs text-slate-600">No trial points linked to this question.</p>
                <a
                  href={`${createPageUrl("QuestionDetail")}?id=${current.id}`}
                  className="inline-flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-400 mt-1"
                >
                  <Link2 className="w-3 h-3" /> Link Trial Points
                </a>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────── */}
      <Dialog open={!!detailModal} onOpenChange={() => setDetailModal(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
          {detailModal?.type === "tp" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-cyan-400 flex items-center gap-2">
                  <Target className="w-4 h-4" /> Trial Point
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-base text-white">{detailModal.data.point_text}</p>
                <div className="flex flex-wrap gap-2">
                  {detailModal.data.status && <Badge variant="outline" className="text-slate-400 border-slate-600">{detailModal.data.status}</Badge>}
                  {detailModal.data.theme && <Badge variant="outline" className="text-slate-400 border-slate-600">{detailModal.data.theme}</Badge>}
                  {detailModal.data.priority && <Badge variant="outline" className="text-slate-400 border-slate-600">{detailModal.data.priority}</Badge>}
                </div>
                {detailModal.data.notes && <p className="text-sm text-slate-400 italic">{detailModal.data.notes}</p>}
              </div>
            </>
          )}
          {detailModal?.type === "exhibit" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-amber-400 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Exhibit {detailModal.data.marked_no}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-base text-white">{detailModal.data.marked_title}</p>
                {detailModal.data.pages && <p className="text-sm text-slate-400">Pages: {detailModal.data.pages}</p>}
                {detailModal.data.notes && <p className="text-sm text-slate-400 italic">{detailModal.data.notes}</p>}
                {detailModal.depo && (
                  <div className="bg-[#0f1629] rounded p-3 text-xs text-slate-400 space-y-0.5">
                    {detailModal.depo.depo_exhibit_no && <p>Depo Exh. #{detailModal.depo.depo_exhibit_no}</p>}
                    {detailModal.depo.deponent_name && <p>Deponent: {detailModal.depo.deponent_name}</p>}
                    {detailModal.depo.referenced_page && <p>Referenced Page: {detailModal.depo.referenced_page}</p>}
                    {detailModal.depo.notes && <p className="italic">{detailModal.depo.notes}</p>}
                  </div>
                )}
                {detailModal.data.status && (
                  <Badge variant="outline" className="text-slate-400 border-slate-600">{detailModal.data.status}</Badge>
                )}
              </div>
            </>
          )}
          {detailModal?.type === "branchList" && detailModal.currentQ && (
            <>
              <DialogHeader>
                <DialogTitle className="text-cyan-400 flex items-center gap-2">
                  <GitBranch className="w-4 h-4" /> All Branch Rules
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {branches
                  .filter(b => b.from_question_id === detailModal.currentQ.id)
                  .sort((a, b) => (a.priority || 1) - (b.priority || 1))
                  .map(b => {
                    const nextQ = questions.find(q => q.id === b.to_question_id);
                    const COND_LABELS = {
                      ANSWER_EXPECTED: "As Expected", ANSWER_UNEXPECTED: "Unexpected",
                      ANSWER_HARMFUL: "Harmful", ANSWER_GREAT: "Great Admission",
                      ADMISSION_YES: "Admission Yes", ADMISSION_NO: "Admission No",
                      WITNESS_DENIES: "Witness Denies", WITNESS_CANT_RECALL: "Can't Recall",
                      WITNESS_BLAMES_OTHER: "Blames Other", CUSTOM: "Custom",
                    };
                    return (
                      <div key={b.id} className="bg-[#0f1629] border border-[#1e2a45] rounded p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] text-amber-400 font-medium">{COND_LABELS[b.condition_type] || b.condition_type}</span>
                          <ArrowRight className="w-3 h-3 text-slate-600" />
                          <span className="text-xs text-cyan-300">{nextQ?.question_text?.slice(0, 60) || "—"}</span>
                        </div>
                        {b.condition_text && <p className="text-[10px] text-slate-500 italic">{b.condition_text}</p>}
                        {nextQ && (
                          <button
                            onClick={() => { setSelectedId(nextQ.id); setSuggestedNext(null); setDetailModal(null); }}
                            className="mt-2 px-2 py-1 rounded bg-cyan-600/20 text-cyan-400 text-[10px] hover:bg-cyan-600/40"
                          >
                            Jump to this question
                          </button>
                        )}
                      </div>
                    );
                  })}
                {branches.filter(b => b.from_question_id === detailModal.currentQ.id).length === 0 && (
                  <p className="text-slate-500 text-xs text-center py-4">No branch rules set for this question.</p>
                )}
              </div>
            </>
          )}
          {detailModal?.type === "clip" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-violet-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Depo Clip
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {detailModal.data.topic_tag && <p className="text-xs text-violet-400 font-medium">{detailModal.data.topic_tag}</p>}
                {detailModal.data.start_cite && (
                  <p className="text-xs font-mono text-slate-500">
                    {detailModal.data.start_cite}{detailModal.data.end_cite ? ` – ${detailModal.data.end_cite}` : ""}
                    {detailModal.data.deposition_id && getDepositionName(detailModal.data.deposition_id)
                      ? ` · ${getDepositionName(detailModal.data.deposition_id)}` : ""}
                  </p>
                )}
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{detailModal.data.clip_text}</p>
                {detailModal.data.notes && <p className="text-xs text-slate-500 italic">{detailModal.data.notes}</p>}
                <div className="flex gap-2">
                  {detailModal.data.direction && (
                    <Badge className={detailModal.data.direction === "HelpsUs" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                      {detailModal.data.direction}
                    </Badge>
                  )}
                  {detailModal.data.impeachment_ready && (
                    <Badge className="bg-amber-500/20 text-amber-400">Impeachment Ready</Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}