import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GitBranch, ChevronRight } from "lucide-react";

const CONDITION_TYPES = [
  { value: "ANSWER_EXPECTED", label: "Answer: As Expected" },
  { value: "ANSWER_UNEXPECTED", label: "Answer: Unexpected" },
  { value: "ANSWER_HARMFUL", label: "Answer: Harmful" },
  { value: "ANSWER_GREAT", label: "Answer: Great Admission" },
  { value: "ADMISSION_YES", label: "Admission Obtained: Yes" },
  { value: "ADMISSION_NO", label: "Admission: No" },
  { value: "WITNESS_DENIES", label: "Witness: Denies" },
  { value: "WITNESS_CANT_RECALL", label: "Witness: Can't Recall" },
  { value: "WITNESS_BLAMES_OTHER", label: "Witness: Blames Other" },
  { value: "CUSTOM", label: "Custom…" },
];

export default function BranchBuilder({ question, allQuestions, caseId, onQuickCreate }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  const sameWitnessQuestions = allQuestions.filter(
    q => q.id !== question.id && q.party_id === question.party_id && q.exam_type === question.exam_type
  );

  useEffect(() => {
    if (!question?.id) return;
    base44.entities.QuestionBranches.filter({ from_question_id: question.id })
      .then(b => { setBranches(b.sort((a, b) => (a.priority || 1) - (b.priority || 1))); setLoading(false); });
  }, [question?.id]);

  const addBranch = async () => {
    const created = await base44.entities.QuestionBranches.create({
      case_id: caseId,
      from_question_id: question.id,
      condition_type: "ANSWER_UNEXPECTED",
      to_question_id: "",
      priority: branches.length + 1,
      auto_jump: true,
    });
    setBranches(prev => [...prev, created]);
  };

  const updateBranch = async (id, field, value) => {
    await base44.entities.QuestionBranches.update(id, { [field]: value });
    setBranches(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const deleteBranch = async (id) => {
    await base44.entities.QuestionBranches.delete(id);
    setBranches(prev => prev.filter(b => b.id !== id));
  };

  if (loading) return <p className="text-xs text-slate-500 py-2">Loading branches…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-cyan-400">Branching Rules</span>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs border-slate-600 text-slate-300" onClick={addBranch}>
          <Plus className="w-3 h-3 mr-1" /> Add Branch Rule
        </Button>
      </div>

      {branches.length === 0 && (
        <p className="text-xs text-slate-600 italic">No branch rules yet. Add rules to guide the Runner to the next question based on how the witness answers.</p>
      )}

      <div className="space-y-2">
        {branches.map((b, idx) => (
          <div key={b.id} className="bg-[#0a0f1e] border border-[#1e2a45] rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 font-mono w-4">#{idx + 1}</span>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-slate-500 mb-0.5 block">If…</Label>
                  <Select value={b.condition_type} onValueChange={v => updateBranch(b.id, "condition_type", v)}>
                    <SelectTrigger className="h-7 text-xs bg-[#131a2e] border-[#1e2a45] text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500 mb-0.5 block">Then go to…</Label>
                  <Select value={b.to_question_id || ""} onValueChange={v => updateBranch(b.id, "to_question_id", v)}>
                    <SelectTrigger className="h-7 text-xs bg-[#131a2e] border-[#1e2a45] text-slate-200">
                      <SelectValue placeholder="Select question…" />
                    </SelectTrigger>
                    <SelectContent>
                      {sameWitnessQuestions.map(q => (
                        <SelectItem key={q.id} value={q.id}>
                          <span className="text-slate-400 mr-1">#{q.order_index}</span> {q.question_text.slice(0, 60)}{q.question_text.length > 60 ? "…" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <button onClick={() => deleteBranch(b.id)} className="text-slate-600 hover:text-red-400 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {b.condition_type === "CUSTOM" && (
              <Input
                placeholder="Describe the condition…"
                value={b.condition_text || ""}
                onChange={e => updateBranch(b.id, "condition_text", e.target.value)}
                className="h-7 text-xs bg-[#131a2e] border-[#1e2a45] text-slate-200"
              />
            )}

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-slate-500">Priority</Label>
                <Input
                  type="number"
                  value={b.priority || 1}
                  onChange={e => updateBranch(b.id, "priority", parseInt(e.target.value) || 1)}
                  className="h-6 w-14 text-xs bg-[#131a2e] border-[#1e2a45] text-slate-200 text-center"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={b.auto_jump !== false}
                  onCheckedChange={v => updateBranch(b.id, "auto_jump", v)}
                  className="scale-75"
                />
                <Label className="text-[10px] text-slate-500">Auto-suggest in Runner</Label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {branches.length > 0 && (
        <div className="bg-[#0a0f1e] border border-cyan-900/30 rounded p-3">
          <p className="text-[10px] text-slate-500 font-semibold uppercase mb-2">Preview: Branch Logic</p>
          <div className="space-y-1">
            {branches.sort((a, b) => (a.priority || 1) - (b.priority || 1)).map(b => {
              const nextQ = allQuestions.find(q => q.id === b.to_question_id);
              const cond = CONDITION_TYPES.find(c => c.value === b.condition_type);
              return (
                <div key={b.id} className="flex items-center gap-2 text-[10px]">
                  <span className="text-amber-400">{cond?.label || b.condition_type}</span>
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span className="text-cyan-300">{nextQ ? nextQ.question_text.slice(0, 50) : <span className="text-slate-600 italic">not set</span>}</span>
                  {b.auto_jump && <span className="text-green-600 ml-1">●</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {onQuickCreate && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs border-slate-700 text-slate-400 hover:text-cyan-300" onClick={() => onQuickCreate("follow-up")}>
            <Plus className="w-3 h-3 mr-1" /> Follow-up Question
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-slate-700 text-slate-400 hover:text-amber-300" onClick={() => onQuickCreate("impeachment")}>
            <Plus className="w-3 h-3 mr-1" /> Impeachment Question
          </Button>
        </div>
      )}
    </div>
  );
}