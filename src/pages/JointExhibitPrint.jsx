import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

export default function JointExhibitPrint() {
  const { activeCase } = useActiveCase();
  const [mode, setMode] = useState("internal"); // "internal" | "judge"
  const [joints, setJoints] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [parties, setParties] = useState([]);
  const [trialPointLinks, setTrialPointLinks] = useState([]);
  const [questionLinks, setQuestionLinks] = useState([]);
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    if (!activeCase) return;
    const cid = activeCase.id;
    Promise.all([
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.TrialPointLinks.filter({ case_id: cid }),
      base44.entities.QuestionLinks.filter({ case_id: cid }),
      base44.entities.Questions.filter({ case_id: cid }),
    ]).then(([j, de, pa, tpl, ql, q]) => {
      setJoints(j.sort((a, b) => (a.marked_no || "").localeCompare(b.marked_no || "", undefined, { numeric: true })));
      setDepoExhibits(de);
      setParties(pa);
      setTrialPointLinks(tpl);
      setQuestionLinks(ql);
      setQuestions(q);
    });
  }, [activeCase]);

  const getDepoInfo = (je) => {
    const depoId = je.primary_depo_exhibit_id || (je.source_depo_exhibit_ids || [])[0];
    return depoExhibits.find(d => d.id === depoId) || null;
  };

  const getPartyName = (pid) => {
    const p = parties.find(x => x.id === pid);
    return p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "";
  };

  // Compute "Used For" — party names of questions that reference this joint exhibit
  // via TrialPointLinks (MasterExhibit) -> QuestionLinks (TrialPoint)
  const getUsedFor = (je) => {
    // Find trial point IDs that have this joint exhibit linked
    const tpIds = new Set(
      trialPointLinks
        .filter(l => l.entity_type === "MasterExhibit" && l.entity_id === je.id)
        .map(l => l.trial_point_id)
    );
    // Find questions linked to those trial points
    const qIds = new Set(
      questionLinks
        .filter(l => l.link_type === "TrialPoint" && tpIds.has(l.link_id))
        .map(l => l.question_id)
    );
    // Get unique party IDs from those questions
    const partyIds = new Set(
      questions.filter(q => qIds.has(q.id) && q.party_id).map(q => q.party_id)
    );
    return [...partyIds].map(getPartyName).filter(Boolean);
  };

  const exportCSV = () => {
    const headers = mode === "judge"
      ? ["Marked #", "Title"]
      : ["Marked #", "Title", "Original Title", "Depo Exhibit #", "Deponent", "Pages", "Used For", "Notes"];

    const rows = joints.map(je => {
      const depo = getDepoInfo(je);
      if (mode === "judge") return [je.marked_no || "", je.marked_title || ""];
      const usedFor = getUsedFor(je).join("; ");
      return [
        je.marked_no || "",
        je.marked_title || "",
        depo?.depo_exhibit_title || depo?.display_title || "",
        depo?.depo_exhibit_no || "",
        depo?.deponent_name || "",
        je.pages || "",
        usedFor,
        je.notes || "",
      ];
    });

    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `joint-exhibits-${mode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Controls */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white">Joint Exhibit List — Print</h1>
          <p className="text-sm text-slate-500">{activeCase.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[#1e2a45]">
            <button
              onClick={() => setMode("internal")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${mode === "internal" ? "bg-cyan-600 text-white" : "bg-[#131a2e] text-slate-400 hover:text-white"}`}
            >
              Internal
            </button>
            <button
              onClick={() => setMode("judge")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${mode === "judge" ? "bg-cyan-600 text-white" : "bg-[#131a2e] text-slate-400 hover:text-white"}`}
            >
              Judge
            </button>
          </div>
          <Button variant="outline" className="border-slate-600 text-slate-300" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h2 className="text-xl font-bold">{activeCase.name} — Joint Exhibit List ({mode === "judge" ? "Court Copy" : "Internal"})</h2>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse print:text-black">
          <thead>
            <tr className="border-b border-[#1e2a45] print:border-gray-300">
              <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider print:text-gray-600 font-semibold w-20">Exh #</th>
              <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider print:text-gray-600 font-semibold">Title</th>
              {mode === "internal" && (
                <>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider print:text-gray-600 font-semibold">Original Title</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider print:text-gray-600 font-semibold w-24">Depo #</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider print:text-gray-600 font-semibold">Deponent</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider print:text-gray-600 font-semibold w-20">Pages</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider print:text-gray-600 font-semibold">Used For</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider print:text-gray-600 font-semibold">Notes</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {joints.map((je, i) => {
              const depo = getDepoInfo(je);
              const usedFor = mode === "internal" ? getUsedFor(je) : [];
              return (
                <tr
                  key={je.id}
                  className={`border-b border-[#1e2a45] print:border-gray-200 ${i % 2 === 0 ? "bg-[#131a2e] print:bg-gray-50" : "bg-transparent"}`}
                >
                  <td className="py-2.5 px-3 font-mono font-semibold text-cyan-300 print:text-blue-700">{je.marked_no}</td>
                  <td className="py-2.5 px-3 text-slate-200 print:text-gray-900 font-medium">{je.marked_title}</td>
                  {mode === "internal" && (
                    <>
                      <td className="py-2.5 px-3 text-slate-400 print:text-gray-600 text-xs">{depo?.depo_exhibit_title || depo?.display_title || ""}</td>
                      <td className="py-2.5 px-3 text-slate-400 print:text-gray-600 text-xs font-mono">{depo?.depo_exhibit_no || ""}</td>
                      <td className="py-2.5 px-3 text-slate-400 print:text-gray-600 text-xs">{depo?.deponent_name || ""}</td>
                      <td className="py-2.5 px-3 text-slate-400 print:text-gray-600 text-xs">{je.pages || ""}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {usedFor.map(name => (
                            <span key={name} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 print:bg-gray-200 print:text-gray-700">{name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 print:text-gray-500 text-xs">{je.notes || ""}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {joints.length === 0 && (
          <p className="text-center text-slate-500 py-12">No joint exhibits found.</p>
        )}
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}