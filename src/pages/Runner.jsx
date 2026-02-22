import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Play, ChevronRight, CheckCircle, AlertTriangle, Bookmark, FileText } from "lucide-react";

export default function Runner() {
  const { activeCase } = useActiveCase();
  const [parties, setParties] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [clips, setClips] = useState([]);
  const [selectedParty, setSelectedParty] = useState("all");

  useEffect(() => {
    if (!activeCase) return;
    const cid = activeCase.id;
    Promise.all([
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.Questions.filter({ case_id: cid }),
      base44.entities.DepoClips.filter({ case_id: cid }),
    ]).then(([p, q, c]) => { setParties(p); setQuestions(q); setClips(c); });
  }, [activeCase]);

  const filtered = questions
    .filter(q => selectedParty === "all" || q.party_id === selectedParty)
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  const updateStatus = async (q, status) => {
    await base44.entities.Questions.update(q.id, { status });
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, status } : x));
  };

  const getPartyName = (pid) => { const p = parties.find(x => x.id === pid); return p ? `${p.first_name} ${p.last_name}` : ""; };

  const statusIcon = (s) => {
    if (s === "Asked") return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (s === "NeedsFollowUp") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    return <Play className="w-4 h-4 text-slate-500" />;
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Trial Runner</h1>
          <p className="text-sm text-slate-500">Live examination flow</p>
        </div>
        <Select value={selectedParty} onValueChange={setSelectedParty}>
          <SelectTrigger className="w-48 bg-[#131a2e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Witnesses</SelectItem>
            {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map((q, i) => (
          <Accordion key={q.id} type="single" collapsible>
            <AccordionItem value={q.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 flex-1 text-left">
                  {statusIcon(q.status)}
                  <span className="text-xs text-slate-500 font-mono">Q{i + 1}</span>
                  <span className="text-sm text-white flex-1">{q.question_text}</span>
                  <Badge className={q.exam_type === "Direct" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>{q.exam_type}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <div className="flex gap-3 text-xs">
                  <span className="text-slate-500">Witness: {getPartyName(q.party_id)}</span>
                  {q.goal && <span className="text-slate-500">Goal: {q.goal}</span>}
                  {q.expected_answer && <span className="text-slate-500">Expected: {q.expected_answer}</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => updateStatus(q, "Asked")}>Mark Asked</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => updateStatus(q, "NeedsFollowUp")}>Follow Up</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-slate-600 text-slate-400 hover:bg-slate-500/10" onClick={() => updateStatus(q, "Skipped")}>Skip</Button>
                </div>
                {q.live_notes && <p className="text-xs text-slate-400 bg-[#0a0f1e] rounded p-2">{q.live_notes}</p>}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-500 py-8">No questions found. Add questions first.</p>}
      </div>
    </div>
  );
}