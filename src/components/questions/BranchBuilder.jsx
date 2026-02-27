import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, GitBranch, ChevronRight } from "lucide-react";

const CONDITION_OPTS = [
  { value: "ANSWER_EXPECTED", label: "Answer — As Expected", color: "text-green-400" },
  { value: "ANSWER_UNEXPECTED", label: "Answer — Unexpected", color: "text-amber-400" },
  { value: "ANSWER_HARMFUL", label: "Answer — Harmful", color: "text-red-400" },
  { value: "ANSWER_GREAT", label: "Answer — Great Admission", color: "text-cyan-400" },
  { value: "ADMISSION_YES", label: "Admission — Yes (obtained)", color: "text-green-400" },
  { value: "ADMISSION_NO", label: "Admission — No", color: "text-slate-400" },
  { value: "WITNESS_DENIES", label: "Witness Denies", color: "text-red-400" },
  { value: "WITNESS_CANT_RECALL", label: "Witness Can't Recall", color: "text-amber-400" },
  { value: "WITNESS_BLAMES_OTHER", label: "Witness Blames Other", color: "text-orange-400" },
  { value: "CUSTOM", label: "Custom Condition", color: "text-slate-400" },
];

const EMPTY_BRANCH = {
  condition_type: "ANSWER_UNEXPECTED",
  condition_text: "",
  to_question_id: "",
  priority: 1,
  auto_jump: true,
  notes: "",
};

export default function BranchBuilder({ question, caseId, allQuestions }) {
  const [branches, setBranches] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY_BRANCH });
  const [saving, setSaving] = useState(false);

  const samePartyQs = allQuestions.filter(
    q => q.id !== question.id &&
      (!question.party_id || q.party_id === question.party_id)
  ).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  const load = async () => {
    const rows = await base44.entities.QuestionBranches.filter({ from_question_id: question.id });
    setBranches(rows.sort((a, b) => (a.priority || 1) - (b.priority || 1)));
  };

  useEffect(() => { load(); }, [question.id]);

  const saveBranch = async () => {
    if (!draft.to_question_id) return;
    setSaving(true);
    await base44.entities.QuestionBranches.create({
      ...draft,
      case_id: caseId,
      from_question_id: question.id,
    });
    setAdding(false);
    setDraft({ ...EMPTY_BRANCH });
    setSaving(false);
    load();
  };

  const deleteBranch = async (id) => {
    if (!confirm("Delete branch rule?")) return;
    await base44.entities.QuestionBranches.delete(id);
    load();
  };

  const getQText = (id) => {
    const q = allQuestions.find(x => x.id === id);
    if (!q) return "Unknown";
    return q.question_text?.length > 60 ? q.question_text.slice(0, 60) + "…" : q.question_text;
  };

  const getCondLabel = (val) => CONDITION_OPTS.find(o => o.value === val)?.label || val;
  const getCondColor = (val) => CONDITION_OPTS.find(o => o.value === val)?.color || "text-slate-400";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300">Branch Rules</span>
          <Badge className="bg-violet-500/20 text-violet-400 text-[10px]">{branches.length}</Badge>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" className="border-violet-700 text-violet-400 hover:bg-violet-500/10 h-7 text-xs"
            onClick={() => { setAdding(true); setDraft({ ...EMPTY_BRANCH }); }}>
            <Plus className="w-3 h-3 mr-1" /> Add Branch Rule
          </Button>
        )}
      </div>

      {question.branch_prompt && (
        <p className="text-xs text-slate-500 italic border-l-2 border-violet-700 pl-2">{question.branch_prompt}</p>
      )}

      {/* Existing branches */}
      {branches.length === 0 && !adding && (
        <p className="text-xs text-slate-600 italic">No branch rules yet. Add a rule to control the next question based on the witness response.</p>
      )}

      <div className="space-y-2">
        {branches.map(b => (
          <div key={b.id} className="bg-[#0a0f1e] border border-violet-900/50 rounded-lg px-3 py-2.5 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium ${getCondColor(b.condition_type)}`}>
                  {getCondLabel(b.condition_type)}
                </span>
                {b.condition_text && (
                  <span className="text-[10px] text-slate-500 italic">"{b.condition_text}"</span>
                )}
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="text-xs text-slate-300 truncate">{getQText(b.to_question_id)}</span>
              </div>
              <div className="flex gap-2 mt-1">
                <span className="text-[9px] text-slate-600">Priority {b.priority}</span>
                {b.auto_jump && <span className="text-[9px] text-violet-500">auto-jump</span>}
                {b.notes && <span className="text-[9px] text-slate-600 italic">{b.notes}</span>}
              </div>
            </div>
            <button onClick={() => deleteBranch(b.id)} className="text-slate-600 hover:text-red-400 flex-shrink-0 mt-0.5">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-[#0a0f1e] border border-violet-700/40 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">New Branch Rule</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-slate-500">When condition</Label>
              <Select value={draft.condition_type} onValueChange={v => setDraft({ ...draft, condition_type: v })}>
                <SelectTrigger className="bg-[#131a2e] border-[#1e2a45] text-slate-200 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTS.map(o => (
                    <SelectItem key={o.value} value={o.value} className={o.color}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">Go to question</Label>
              <Select value={draft.to_question_id} onValueChange={v => setDraft({ ...draft, to_question_id: v })}>
                <SelectTrigger className="bg-[#131a2e] border-[#1e2a45] text-slate-200 h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {samePartyQs.map(q => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.order_index ? `#${q.order_index} ` : ""}{q.question_text?.slice(0, 50)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {draft.condition_type === "CUSTOM" && (
            <div>
              <Label className="text-[10px] text-slate-500">Custom condition text</Label>
              <Input
                value={draft.condition_text}
                onChange={e => setDraft({ ...draft, condition_text: e.target.value })}
                className="bg-[#131a2e] border-[#1e2a45] text-slate-200 h-8 text-xs"
                placeholder="Describe the condition…"
              />
            </div>
          )}

          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-slate-500">Priority</Label>
              <Input
                type="number"
                value={draft.priority}
                onChange={e => setDraft({ ...draft, priority: parseInt(e.target.value) || 1 })}
                className="bg-[#131a2e] border-[#1e2a45] text-slate-200 h-7 w-16 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={draft.auto_jump}
                onCheckedChange={v => setDraft({ ...draft, auto_jump: v })}
              />
              <Label className="text-[10px] text-slate-400">Auto-suggest in Runner</Label>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="border-slate-600 text-slate-400 h-7 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 h-7 text-xs" onClick={saveBranch} disabled={saving || !draft.to_question_id}>
              Save Rule
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}