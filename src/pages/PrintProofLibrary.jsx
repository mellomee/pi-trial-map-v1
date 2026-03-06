import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Printer } from "lucide-react";

export default function PrintProofLibrary() {
  const { activeCase } = useActiveCase();
  const [groups, setGroups] = useState([]);
  const [groupDetails, setGroupDetails] = useState({}); // groupId -> { proofItems, questions }
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCase) return;
    const load = async () => {
      setLoading(true);
      const [grps, pts] = await Promise.all([
        base44.entities.EvidenceGroups.filter({ case_id: activeCase.id }),
        base44.entities.Parties.filter({ case_id: activeCase.id }),
      ]);
      setGroups(grps);
      setParties(pts);

      // Load details for each group
      const allProofLinks = await base44.entities.EvidenceGroupProofItems.filter({ case_id: activeCase.id });
      const allQLinks = await base44.entities.QuestionEvidenceGroups.filter({ case_id: activeCase.id });
      const allProofs = await base44.entities.ProofItems.filter({ case_id: activeCase.id });
      const allQs = await base44.entities.Questions.filter({ case_id: activeCase.id });

      const details = {};
      for (const grp of grps) {
        const proofIds = new Set(allProofLinks.filter(l => l.evidence_group_id === grp.id).map(l => l.proof_item_id));
        const qIds = new Set(allQLinks.filter(l => l.evidence_group_id === grp.id).map(l => l.question_id));
        details[grp.id] = {
          proofItems: allProofs.filter(p => proofIds.has(p.id)),
          questions: allQs.filter(q => qIds.has(q.id)).sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
        };
      }
      setGroupDetails(details);
      setLoading(false);
    };
    load();
  }, [activeCase]);

  const getPartyName = (pid) => {
    const p = parties.find(x => x.id === pid);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name}`.trim()) : "";
  };

  if (!activeCase) return <div className="p-8">No active case.</div>;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 z-10 shadow-sm">
        <h1 className="text-lg font-bold text-gray-800">Print: Proof Library (Buckets)</h1>
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 bg-gray-800 text-white px-4 py-1.5 rounded text-sm hover:bg-gray-700"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-6 pb-4 border-b border-gray-300">
          <h2 className="text-2xl font-bold">{activeCase.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Proof Library · {groups.length} bucket{groups.length !== 1 ? "s" : ""}</p>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-12">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No evidence groups found.</p>
        ) : groups.map((grp, gi) => {
          const det = groupDetails[grp.id] || { proofItems: [], questions: [] };
          return (
            <div key={grp.id} className="mb-8 page-break-inside-avoid">
              {/* Group header */}
              <div className="bg-gray-100 border border-gray-300 rounded px-4 py-2 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider w-6">{gi + 1}</span>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{grp.title}</h3>
                    {grp.description && <p className="text-xs text-gray-500">{grp.description}</p>}
                  </div>
                  {grp.priority && (
                    <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded ${
                      grp.priority === "High" ? "bg-red-100 text-red-700" :
                      grp.priority === "Med" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                    }`}>{grp.priority}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Proof Items */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Proof ({det.proofItems.length})
                  </p>
                  {det.proofItems.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">None attached</p>
                  ) : (
                    <ul className="space-y-1">
                      {det.proofItems.map(p => (
                        <li key={p.id} className="flex items-start gap-1.5 text-xs text-gray-700">
                          <span className="text-gray-400 mt-0.5 flex-shrink-0">▸</span>
                          <div>
                            <span className="font-medium">{p.label}</span>
                            <span className="text-gray-400 ml-1 text-[10px]">
                              {p.type === "depoClip" ? "Clip" : "Extract"}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Questions */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Questions ({det.questions.length})
                  </p>
                  {det.questions.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">None linked</p>
                  ) : (
                    <ul className="space-y-1">
                      {det.questions.map((q, qi) => (
                        <li key={q.id} className="flex items-start gap-1.5 text-xs text-gray-700">
                          <span className="text-gray-400 mt-0.5 flex-shrink-0">{qi + 1}.</span>
                          <div>
                            <p className="leading-snug">{q.question_text}</p>
                            {q.party_id && (
                              <span className="text-[10px] text-gray-400">{getPartyName(q.party_id)}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @media print {
          @page { margin: 0.75in; size: letter portrait; }
          .print\\:hidden { display: none !important; }
          .page-break-inside-avoid { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}