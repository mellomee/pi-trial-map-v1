import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GripVertical, Plus, ChevronLeft, ChevronRight, Trash2, FileText, Layers, Target } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function ExamBuilder() {
  const { activeCase } = useActiveCase();
  const urlParams = new URLSearchParams(window.location.search);
  const initialWitnessId = urlParams.get("witnessId");
  const initialGroupId = urlParams.get("groupId");

  const [parties, setParties] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [evidenceGroups, setEvidenceGroups] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);

  const [selectedWitnessId, setSelectedWitnessId] = useState(initialWitnessId || "");
  const [examType, setExamType] = useState("Direct");
  const [selectedQIdx, setSelectedQIdx] = useState(0);
  const [editingQId, setEditingQId] = useState(null);

  // Load all data
  useEffect(() => {
    if (!activeCase) return;
    const cid = activeCase.id;
    Promise.all([
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.Questions.filter({ case_id: cid }),
      base44.entities.EvidenceGroups.filter({ case_id: cid }),
      base44.entities.TrialPoints.filter({ case_id: cid }),
    ]).then(([p, q, eg, tp]) => {
      setParties(p);
      setQuestions(q.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
      setEvidenceGroups(eg);
      setTrialPoints(tp);
      if (initialWitnessId && !selectedWitnessId) setSelectedWitnessId(initialWitnessId);
    });
  }, [activeCase]);

  // Filter questions for selected witness + exam type
  const witnessQuestions = useMemo(() =>
    questions
      .filter(q => q.party_id === selectedWitnessId && q.exam_type === examType)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
    [questions, selectedWitnessId, examType]
  );

  const currentQ = witnessQuestions[selectedQIdx] || null;

  // Get evidence group for current question
  const currentGroup = currentQ && currentQ.evidence_group_id
    ? evidenceGroups.find(eg => eg.id === currentQ.evidence_group_id)
    : null;

  // Get trial points for current question (inherited from group or overridden)
  const currentTrialPointIds = useMemo(() => {
    if (!currentQ) return [];
    if (currentQ.trial_point_ids && currentQ.trial_point_ids.length > 0) {
      return currentQ.trial_point_ids;
    }
    if (currentGroup?.linked_trial_point_ids) {
      return currentGroup.linked_trial_point_ids;
    }
    return [];
  }, [currentQ, currentGroup]);

  const currentTrialPoints = useMemo(
    () => currentTrialPointIds.map(id => trialPoints.find(tp => tp.id === id)).filter(Boolean),
    [currentTrialPointIds, trialPoints]
  );

  const updateQuestion = async (field, value) => {
    if (!currentQ) return;
    await base44.entities.Questions.update(currentQ.id, { [field]: value });
    setQuestions(prev =>
      prev.map(q => q.id === currentQ.id ? { ...q, [field]: value } : q)
    );
  };

  const deleteQuestion = async () => {
    if (!currentQ || !confirm("Delete this question?")) return;
    await base44.entities.Questions.delete(currentQ.id);
    setQuestions(prev => prev.filter(q => q.id !== currentQ.id));
    if (selectedQIdx > 0) setSelectedQIdx(selectedQIdx - 1);
  };

  const partyName = (id) => {
    const p = parties.find(x => x.id === id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : "—";
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0">
        <span className="text-sm font-bold text-cyan-400">Exam Builder</span>
        <div className="w-px h-4 bg-[#1e2a45]" />
        <Select value={selectedWitnessId} onValueChange={v => { setSelectedWitnessId(v); setSelectedQIdx(0); }}>
          <SelectTrigger className="h-7 text-xs w-48 bg-[#131a2e] border-[#1e2a45]">
            <SelectValue placeholder="Select witness…" />
          </SelectTrigger>
          <SelectContent>
            {parties.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {partyName(p.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded border border-[#1e2a45] overflow-hidden">
          {["D", "C"].map((t, i) => (
            <button
              key={t}
              onClick={() => { setExamType(i === 0 ? "Direct" : "Cross"); setSelectedQIdx(0); }}
              className={`px-2.5 py-1 text-[10px] font-medium ${
                examType === (i === 0 ? "Direct" : "Cross")
                  ? (i === 0 ? "bg-green-600 text-white" : "bg-orange-600 text-white")
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700">
            <Plus className="w-3 h-3 mr-1" /> New Question
          </Button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Question List */}
        <div className="w-80 flex-shrink-0 border-r border-[#1e2a45] flex flex-col bg-[#0f1629] overflow-y-auto">
          {witnessQuestions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              No questions for this witness.
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {witnessQuestions.map((q, idx) => {
                const group = evidenceGroups.find(eg => eg.id === q.evidence_group_id);
                const tpCount = (q.trial_point_ids?.length || 0) + (group?.linked_trial_point_ids?.length || 0);
                const isActive = selectedQIdx === idx;
                return (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQIdx(idx)}
                    className={`w-full text-left px-2.5 py-2 rounded border transition-colors ${
                      isActive
                        ? "bg-cyan-500/10 border-cyan-400"
                        : "border-[#1e2a45] hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] text-slate-600 mt-0.5 flex-shrink-0">{idx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-300 line-clamp-2 leading-snug">{q.question_text}</p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {group && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-5">{group.title}</Badge>
                          )}
                          {tpCount > 0 && (
                            <Badge className="text-[8px] px-1 py-0 h-5 bg-cyan-600/30 text-cyan-300">
                              {tpCount} TP
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* CENTER: Question Editor */}
        {currentQ ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Breadcrumb */}
              <div className="text-[10px] text-slate-500 flex items-center gap-2">
                {currentGroup && (
                  <>
                    <span className="text-cyan-400 font-medium">{currentGroup.title}</span>
                    <span>•</span>
                  </>
                )}
                {currentTrialPoints.length > 0 && (
                  <div className="flex gap-1">
                    {currentTrialPoints.map(tp => (
                      <Badge key={tp.id} variant="outline" className="text-[8px] h-5">
                        {tp.point_text?.slice(0, 20)}…
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Question Text */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Question</label>
                <Textarea
                  value={currentQ.question_text || ""}
                  onChange={e => updateQuestion("question_text", e.target.value)}
                  className="bg-[#131a2e] border-[#1e2a45] text-slate-200 mt-1 min-h-20"
                  placeholder="Enter question text…"
                />
              </div>

              {/* Expected Answer */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Expected Answer</label>
                <Textarea
                  value={currentQ.expected_answer || ""}
                  onChange={e => updateQuestion("expected_answer", e.target.value)}
                  className="bg-[#131a2e] border-[#1e2a45] text-slate-200 mt-1 min-h-16"
                  placeholder="What you hope to hear…"
                />
              </div>

              {/* Goal */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Goal / Theme</label>
                <Input
                  value={currentQ.goal || ""}
                  onChange={e => updateQuestion("goal", e.target.value)}
                  className="bg-[#131a2e] border-[#1e2a45] text-slate-200"
                  placeholder="Why this question matters…"
                />
              </div>

              {/* Live Notes */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Live Notes</label>
                <Textarea
                  value={currentQ.live_notes || ""}
                  onChange={e => updateQuestion("live_notes", e.target.value)}
                  className="bg-[#131a2e] border-[#1e2a45] text-slate-200 mt-1 min-h-12"
                  placeholder="Objections, follow-ups, reminders…"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteQuestion}
                  className="ml-auto"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            No questions. Create one above.
          </div>
        )}

        {/* RIGHT: Proof Panel */}
        <div className="w-72 flex-shrink-0 border-l border-[#1e2a45] flex flex-col bg-[#0f1629] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#1e2a45] bg-[#080d1a]">
            <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Proof for this Question</p>
          </div>
          {currentGroup ? (
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              <p className="text-[9px] text-slate-500">
                Inherits {currentGroup.proof_refs?.length || 0} proof from group
              </p>
              {currentGroup.proof_refs && currentGroup.proof_refs.length > 0 ? (
                currentGroup.proof_refs.map((ref, i) => (
                  <div
                    key={i}
                    className="bg-[#131a2e] border border-[#1e2a45] rounded p-2 text-[9px]"
                  >
                    <p className="text-slate-300 font-medium">{ref.label || ref.type}</p>
                    <p className="text-slate-600 mt-0.5">{ref.type}</p>
                  </div>
                ))
              ) : (
                <p className="text-[9px] text-slate-600 text-center py-4">No proof in group.</p>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-3">
              <p className="text-[10px] text-slate-500 text-center">
                Link a question to an Evidence Group to see proof.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}