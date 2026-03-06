import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer } from "lucide-react";

export default function PrintQuestions() {
  const { activeCase } = useActiveCase();
  const [questions, setQuestions] = useState([]);
  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [checkedIds, setCheckedIds] = useState(new Set());

  useEffect(() => {
    if (!activeCase) return;
    Promise.all([
      base44.entities.Questions.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
    ]).then(([q, p]) => {
      setQuestions(q);
      setParties(p);
    });
  }, [activeCase]);

  const getPartyName = (pid) => {
    const p = parties.find(x => x.id === pid);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name}`.trim()) : "Unassigned";
  };

  const filtered = useMemo(() => questions.filter(q => {
    const matchParty = selectedPartyId === "all" || q.party_id === selectedPartyId;
    const matchType = typeFilter === "all" || q.exam_type === typeFilter;
    return matchParty && matchType;
  }).sort((a, b) => (a.order_index || 0) - (b.order_index || 0)), [questions, selectedPartyId, typeFilter]);

  // Group by parent (root questions first, children nested)
  const rootQuestions = filtered.filter(q => !q.parent_id);
  const childrenOf = (parentId) => questions.filter(q => q.parent_id === parentId);

  const toggleCheck = (id) => {
    setCheckedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const witnessName = selectedPartyId !== "all" ? getPartyName(selectedPartyId) : "All Witnesses";

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Toolbar — hidden on print */}
      <div className="print:hidden sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 z-10 shadow-sm">
        <h1 className="text-lg font-bold text-gray-800 mr-4">Print: Questions</h1>
        <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
          <SelectTrigger className="w-48 h-8 text-sm border-gray-300">
            <SelectValue placeholder="All Witnesses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Witnesses</SelectItem>
            {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-8 text-sm border-gray-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Direct">Direct</SelectItem>
            <SelectItem value="Cross">Cross</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 bg-gray-800 text-white px-4 py-1.5 rounded text-sm hover:bg-gray-700"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      {/* Print content */}
      <div className="max-w-3xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-6 pb-4 border-b border-gray-300">
          <h2 className="text-2xl font-bold">{activeCase.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Questions · {witnessName}
            {typeFilter !== "all" ? ` · ${typeFilter}` : ""}
            · {filtered.length} question{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Questions */}
        <div className="space-y-0">
          {rootQuestions.map((q, idx) => {
            const children = childrenOf(q.id);
            return (
              <div key={q.id} className="border-b border-gray-200 last:border-0">
                {/* Root question row */}
                <div className="flex items-start gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={checkedIds.has(q.id)}
                    onChange={() => toggleCheck(q.id)}
                    className="mt-1 print:block flex-shrink-0 w-4 h-4 border-gray-400 rounded"
                    style={{ printColorAdjust: "exact" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-semibold text-gray-500 w-6 flex-shrink-0">{idx + 1}.</span>
                      <p className="text-sm text-gray-900 leading-relaxed">{q.question_text}</p>
                    </div>
                    <div className="ml-6 mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                      {q.exam_type && <span className={`font-medium ${q.exam_type === "Direct" ? "text-green-700" : "text-red-700"}`}>{q.exam_type}</span>}
                      {q.party_id && selectedPartyId === "all" && <span>· {getPartyName(q.party_id)}</span>}
                      {q.goal && <span>· Goal: {q.goal}</span>}
                      {q.expected_answer && <span>· Expected: {q.expected_answer}</span>}
                    </div>
                    {/* Answer line */}
                    <div className="ml-6 mt-2">
                      <div className="h-6 border-b border-dotted border-gray-300 w-full" />
                    </div>
                  </div>
                </div>

                {/* Child questions */}
                {children.map((child, ci) => (
                  <div key={child.id} className="flex items-start gap-3 py-2 pl-10 bg-gray-50">
                    <input
                      type="checkbox"
                      checked={checkedIds.has(child.id)}
                      onChange={() => toggleCheck(child.id)}
                      className="mt-1 print:block flex-shrink-0 w-4 h-4 border-gray-400 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-400 w-8 flex-shrink-0">{idx + 1}.{ci + 1}</span>
                        <p className="text-sm text-gray-700 leading-relaxed">{child.question_text}</p>
                      </div>
                      {child.question_type && (
                        <span className="ml-8 text-[10px] text-purple-600 font-medium">{child.question_type}</span>
                      )}
                      <div className="ml-8 mt-1.5">
                        <div className="h-5 border-b border-dotted border-gray-300 w-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {rootQuestions.length === 0 && (
            <p className="text-gray-400 text-center py-10">No questions found for this filter.</p>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 0.75in; size: letter portrait; }
          body { font-size: 12px; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}