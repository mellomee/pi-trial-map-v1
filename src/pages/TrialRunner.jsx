import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Play, ChevronLeft, ChevronRight,
  FileText, BookOpen, Target, ShieldAlert, X, Copy, ExternalLink, Link2
} from "lucide-react";
import { createPageUrl } from "@/utils";

const STATUS_OPTS = ["NotAsked", "Asked", "NeedsFollowUp", "Skipped"];
const QUALITY_OPTS = [
  { value: "AsExpected", label: "As Expected", color: "bg-green-500/20 text-green-400" },
  { value: "Unexpected", label: "Unexpected", color: "bg-amber-500/20 text-amber-400" },
  { value: "Harmful", label: "Harmful", color: "bg-red-500/20 text-red-400" },
  { value: "GreatAdmission", label: "Great Admission", color: "bg-cyan-500/20 text-cyan-400" },
];

export default function TrialRunner() {
  const { activeCase } = useActiveCase();
  const [parties, setParties] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedParty, setSelectedParty] = useState("all");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [proofOpen, setProofOpen] = useState(false);

  // Proof data
  const [questionLinks, setQuestionLinks] = useState([]); // all QuestionLinks for current case
  const [trialPoints, setTrialPoints] = useState([]);
  const [trialPointLinks, setTrialPointLinks] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [depoClips, setDepoClips] = useState([]);

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
    ]).then(([p, q, ql, tp, tpl, je, de, dc]) => {
      setParties(p);
      setQuestions(q.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
      setQuestionLinks(ql);
      setTrialPoints(tp);
      setTrialPointLinks(tpl);
      setJointExhibits(je);
      setDepoExhibits(de);
      setDepoClips(dc);
    });
  }, [activeCase]);

  const filtered = questions.filter(q => selectedParty === "all" || q.party_id === selectedParty);
  const current = filtered[currentIdx] || null;

  const updateQuestion = async (field, value) => {
    if (!current) return;
    await base44.entities.Questions.update(current.id, { [field]: value });
    setQuestions(prev => prev.map(x => x.id === current.id ? { ...x, [field]: value } : x));
  };

  const getPartyName = (pid) => {
    const p = parties.find(x => x.id === pid);
    return p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "";
  };

  // Compute proof for current question
  const proofData = React.useMemo(() => {
    if (!current) return { trialPoints: [], exhibits: [], clips: [] };

    const linkedTpIds = new Set(
      questionLinks.filter(l => l.question_id === current.id && l.link_type === "TrialPoint").map(l => l.link_id)
    );
    const linkedTPs = trialPoints.filter(tp => linkedTpIds.has(tp.id));

    const relevantTPLinks = trialPointLinks.filter(l => linkedTpIds.has(l.trial_point_id));

    const exhibitIds = new Set(relevantTPLinks.filter(l => l.entity_type === "MasterExhibit").map(l => l.entity_id));
    const clipIds = new Set(relevantTPLinks.filter(l => l.entity_type === "DepoClip").map(l => l.entity_id));

    return {
      trialPoints: linkedTPs,
      exhibits: jointExhibits.filter(je => exhibitIds.has(je.id)),
      clips: depoClips.filter(c => clipIds.has(c.id)),
    };
  }, [current, questionLinks, trialPoints, trialPointLinks, jointExhibits, depoClips]);

  const needsProof = current?.answer_quality === "Unexpected" || current?.answer_quality === "Harmful";

  const getDepoInfo = (je) => {
    const depoId = je.primary_depo_exhibit_id || (je.source_depo_exhibit_ids || [])[0];
    return depoExhibits.find(d => d.id === depoId) || null;
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="flex h-full">
      {/* Main Runner */}
      <div className={`flex-1 flex flex-col p-6 transition-all ${proofOpen ? "mr-96" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Trial Runner</h1>
            <p className="text-sm text-slate-500">
              {filtered.length > 0 ? `Question ${currentIdx + 1} of ${filtered.length}` : "No questions"}
            </p>
          </div>
          <Select value={selectedParty} onValueChange={v => { setSelectedParty(v); setCurrentIdx(0); }}>
            <SelectTrigger className="w-48 bg-[#131a2e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Witnesses</SelectItem>
              {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {!current ? (
          <p className="text-center text-slate-500 py-16">No questions found.</p>
        ) : (
          <div className="flex-1 space-y-4 max-w-3xl mx-auto w-full">
            {/* Question Card */}
            <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge className={current.exam_type === "Direct" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                  {current.exam_type}
                </Badge>
                {current.party_id && (
                  <Badge variant="outline" className="text-slate-400 border-slate-600">{getPartyName(current.party_id)}</Badge>
                )}
                <Badge variant="outline" className="text-slate-500 border-slate-700 text-[10px]">{current.status}</Badge>
              </div>
              <p className="text-2xl font-semibold text-white leading-relaxed mb-4">{current.question_text}</p>
              <a
                href={`${createPageUrl("QuestionDetail")}?id=${current.id}`}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-400 mb-2"
              >
                <Link2 className="w-3 h-3" /> Manage Trial Point Links
              </a>
              {current.goal && <p className="text-sm text-slate-500 mb-1">🎯 Goal: {current.goal}</p>}
              {current.expected_answer && <p className="text-sm text-slate-500">💬 Expected: {current.expected_answer}</p>}
            </div>

            {/* Status Controls */}
            <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Status</p>
              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTS.map(s => (
                  <button
                    key={s}
                    onClick={() => updateQuestion("status", s)}
                    className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                      current.status === s
                        ? "bg-cyan-600 border-cyan-500 text-white"
                        : "bg-[#0f1629] border-[#1e2a45] text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Quality */}
            <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Answer Quality</p>
              <div className="flex gap-2 flex-wrap">
                {QUALITY_OPTS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateQuestion("answer_quality", current.answer_quality === opt.value ? "" : opt.value)}
                    className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                      current.answer_quality === opt.value
                        ? `${opt.color} border-current`
                        : "bg-[#0f1629] border-[#1e2a45] text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {needsProof && (
                <button
                  onClick={() => setProofOpen(true)}
                  className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium w-full justify-center"
                >
                  <ShieldAlert className="w-4 h-4" /> Pull Proof
                </button>
              )}
            </div>

            {/* Admission + Notes */}
            <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={current.admission_obtained || false}
                  onCheckedChange={v => updateQuestion("admission_obtained", v)}
                />
                <Label className="text-sm text-slate-300">Admission Obtained</Label>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Live Notes</p>
                <Textarea
                  value={current.live_notes || ""}
                  onChange={e => updateQuestion("live_notes", e.target.value)}
                  placeholder="Notes during examination…"
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-sm"
                  rows={3}
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(i => i - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-slate-500 text-sm">{currentIdx + 1} / {filtered.length}</span>
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300"
                disabled={currentIdx >= filtered.length - 1}
                onClick={() => setCurrentIdx(i => i + 1)}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Proof Drawer */}
      {proofOpen && (
        <div className="fixed right-0 top-0 h-full w-96 bg-[#0f1629] border-l border-[#1e2a45] flex flex-col z-40 shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a45]">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-white">Proof Panel</span>
            </div>
            <button onClick={() => setProofOpen(false)} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <Tabs defaultValue="trialpoints" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="bg-transparent border-b border-[#1e2a45] rounded-none px-2 flex-shrink-0">
              <TabsTrigger value="trialpoints" className="data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-400 text-slate-500 text-xs">
                <Target className="w-3 h-3 mr-1" /> Points ({proofData.trialPoints.length})
              </TabsTrigger>
              <TabsTrigger value="exhibits" className="data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-400 text-slate-500 text-xs">
                <BookOpen className="w-3 h-3 mr-1" /> Exhibits ({proofData.exhibits.length})
              </TabsTrigger>
              <TabsTrigger value="clips" className="data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-400 text-slate-500 text-xs">
                <FileText className="w-3 h-3 mr-1" /> Clips ({proofData.clips.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trialpoints" className="flex-1 overflow-y-auto p-3 space-y-2 mt-0">
              {proofData.trialPoints.length === 0 && <p className="text-slate-500 text-xs text-center py-6">No trial points linked.</p>}
              {proofData.trialPoints.map(tp => (
                <div key={tp.id} className="bg-[#131a2e] border border-[#1e2a45] rounded p-3">
                  <p className="text-sm text-slate-200">{tp.point_text}</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700">{tp.status}</Badge>
                    {tp.theme && <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700">{tp.theme}</Badge>}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="exhibits" className="flex-1 overflow-y-auto p-3 space-y-2 mt-0">
              {proofData.exhibits.length === 0 && <p className="text-slate-500 text-xs text-center py-6">No exhibits found.</p>}
              {proofData.exhibits.map(je => {
                const depo = getDepoInfo(je);
                return (
                  <div key={je.id} className="bg-[#131a2e] border border-[#1e2a45] rounded p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-cyan-300">Exh. {je.marked_no}</p>
                        <p className="text-sm text-slate-200">{je.marked_title}</p>
                        {je.pages && <p className="text-[10px] text-slate-500">Pg: {je.pages}</p>}
                        {depo && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {depo.depo_exhibit_no && `[${depo.depo_exhibit_no}] `}{depo.deponent_name}
                          </p>
                        )}
                      </div>
                      <a href={createPageUrl("JointExhibits")} className="text-slate-500 hover:text-cyan-400 flex-shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="clips" className="flex-1 overflow-y-auto p-3 space-y-2 mt-0">
              {proofData.clips.length === 0 && <p className="text-slate-500 text-xs text-center py-6">No depo clips found.</p>}
              {proofData.clips.map(c => (
                <div key={c.id} className="bg-[#131a2e] border border-[#1e2a45] rounded p-3">
                  {c.topic_tag && <p className="text-xs text-cyan-400 font-medium mb-1">{c.topic_tag}</p>}
                  <p className="text-sm text-slate-200 leading-relaxed">{c.clip_text}</p>
                  <div className="flex items-center justify-between mt-2">
                    {c.start_cite && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {c.start_cite}{c.end_cite ? ` – ${c.end_cite}` : ""}
                      </span>
                    )}
                    <button
                      onClick={() => navigator.clipboard?.writeText(c.clip_text)}
                      className="text-slate-500 hover:text-cyan-400 ml-auto"
                      title="Copy text"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}