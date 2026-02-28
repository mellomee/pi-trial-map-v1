import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Eye, EyeOff } from "lucide-react";
import useActiveCase from "@/components/hooks/useActiveCase";
import { exhibitDisplayNo } from "@/components/exhibitHelpers";

export default function JointExhibitPrint() {
  const { activeCase } = useActiveCase();
  const [joints, setJoints] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [parties, setParties] = useState([]);
  const [depositions, setDepositions] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);
  const [tpLinks, setTpLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCase) return;
    Promise.all([
      base44.entities.JointExhibits.filter({ case_id: activeCase.id }),
      base44.entities.ExhibitExtracts.filter({ case_id: activeCase.id }),
      base44.entities.DepositionExhibits.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
      base44.entities.Depositions.filter({ case_id: activeCase.id }),
      base44.entities.TrialPoints.filter({ case_id: activeCase.id }),
      base44.entities.QuestionLinks.filter({ case_id: activeCase.id }),
    ]).then(([j, ex, de, pts, deps, tp, ql]) => {
      setJoints(j.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || (a.marked_no || "").localeCompare(b.marked_no || "", undefined, { numeric: true })));
      setExtracts(ex);
      setDepoExhibits(de);
      setParties(pts);
      setDepositions(deps);
      setTrialPoints(tp);
      setTpLinks(ql);
      setLoading(false);
    });
  }, [activeCase]);

  const extractById = useMemo(() => {
    const m = {}; extracts.forEach(e => m[e.id] = e); return m;
  }, [extracts]);

  const depoExhibitById = useMemo(() => {
    const m = {}; depoExhibits.forEach(e => m[e.id] = e); return m;
  }, [depoExhibits]);

  const trialPointsForJoint = (jointId) =>
    tpLinks.filter(l => l.link_type === "JointExhibit" && l.link_id === jointId)
      .map(l => trialPoints.find(t => t.id === l.question_id || t.id === l.link_id))
      .filter(Boolean);

  const sourceInfo = (j) => {
    const extract = j.exhibit_extract_id ? extractById[j.exhibit_extract_id] : null;
    if (!extract) return null;
    const srcDE = extract.source_depo_exhibit_id ? depoExhibitById[extract.source_depo_exhibit_id] : null;
    return { extract, srcDE };
  };

  const admitted = joints.filter(j => j.status === "Admitted");
  const forJudge = joints.filter(j => j.status !== "Withdrawn" && j.status !== "NotUsed");

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200">
      <div className="sticky top-0 z-10 bg-[#0f1629] border-b border-[#1e2a45] px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Printer className="w-5 h-5 text-cyan-400" /> Print Views
        </h1>
        <Button onClick={() => window.print()}
          className="bg-cyan-600/20 text-cyan-400 border border-cyan-600/40 hover:bg-cyan-600/30 gap-1.5 text-xs">
          <Printer className="w-3.5 h-3.5" /> Print
        </Button>
      </div>

      <div className="px-6 py-4 max-w-5xl">
        <Tabs defaultValue="judge">
          <TabsList className="bg-[#0f1629] border border-[#1e2a45] mb-6">
            <TabsTrigger value="judge" className="data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-400">
              Judge List (Marked)
            </TabsTrigger>
            <TabsTrigger value="internal" className="data-[state=active]:bg-violet-600/20 data-[state=active]:text-violet-400">
              Internal List
            </TabsTrigger>
            <TabsTrigger value="admitted" className="data-[state=active]:bg-green-600/20 data-[state=active]:text-green-400">
              Admitted (Jury)
            </TabsTrigger>
          </TabsList>

          {/* Judge List */}
          <TabsContent value="judge">
            <div className="print-section">
              <h2 className="text-lg font-bold text-slate-100 mb-4 print:text-black">Joint Exhibit List — {activeCase.name}</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#1e2a45]">
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider w-24">No.</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider">Title</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider w-28">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2a45]">
                  {forJudge.map(j => (
                    <tr key={j.id} className="hover:bg-white/5">
                      <td className="py-2 px-3 font-mono text-amber-400 text-xs">{j.marked_no}</td>
                      <td className="py-2 px-3 text-slate-200">{j.marked_title}</td>
                      <td className="py-2 px-3 text-xs text-slate-500">{j.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {forJudge.length === 0 && <p className="text-slate-600 text-sm py-6 text-center">No exhibits yet.</p>}
            </div>
          </TabsContent>

          {/* Internal List */}
          <TabsContent value="internal">
            <div className="print-section">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Internal Exhibit List — {activeCase.name}</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#1e2a45]">
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider w-20">No.</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider">Official Title</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider">Internal Name</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider">Source</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider w-28">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2a45]">
                  {joints.map(j => {
                    const src = sourceInfo(j);
                    return (
                      <tr key={j.id} className="hover:bg-white/5">
                        <td className="py-2 px-3 font-mono text-amber-400 text-xs">{j.marked_no}</td>
                        <td className="py-2 px-3 text-slate-200 text-xs">{j.marked_title}</td>
                        <td className="py-2 px-3 text-violet-400 text-xs italic">
                          {j.internal_name || src?.extract?.extract_title_internal || "—"}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-xs">
                          {src?.srcDE ? `#${src.srcDE.depo_exhibit_no} ${src.srcDE.depo_exhibit_title || ""}` : "—"}
                        </td>
                        <td className="py-2 px-3 text-xs text-slate-500">{j.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Admitted List */}
          <TabsContent value="admitted">
            <div className="print-section">
              <h2 className="text-lg font-bold text-slate-100 mb-4">Admitted Exhibit List — {activeCase.name}</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#1e2a45]">
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider w-28">Admitted No.</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider">Title</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider w-32">Admitted By</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-500 uppercase tracking-wider w-28">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2a45]">
                  {admitted.map(j => (
                    <tr key={j.id} className="hover:bg-white/5">
                      <td className="py-2 px-3 font-mono text-green-400 text-xs font-bold">{j.admitted_no}</td>
                      <td className="py-2 px-3 text-slate-200">{j.marked_title}</td>
                      <td className="py-2 px-3 text-slate-500 text-xs">{j.admitted_by || "—"}</td>
                      <td className="py-2 px-3 text-slate-500 text-xs">{j.admitted_date || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {admitted.length === 0 && <p className="text-slate-600 text-sm py-6 text-center">No admitted exhibits yet.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}