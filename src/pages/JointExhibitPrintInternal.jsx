import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function JointExhibitPrintInternal() {
  const { activeCase } = useActiveCase();
  const [joints, setJoints] = useState([]);
  const [admitted, setAdmitted] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [trialPointLinks, setTrialPointLinks] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);
  const [parties, setParties] = useState([]);

  useEffect(() => {
    if (!activeCase) return;
    const cid = activeCase.id;
    Promise.all([
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.AdmittedExhibits.filter({ case_id: cid }),
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
      base44.entities.TrialPointLinks.filter({ case_id: cid }),
      base44.entities.TrialPoints.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
    ]).then(([j, a, de, tpl, tp, p]) => { setJoints(j); setAdmitted(a); setDepoExhibits(de); setTrialPointLinks(tpl); setTrialPoints(tp); setParties(p); });
  }, [activeCase]);

  const admByJoint = useMemo(() => {
    const m = {};
    admitted.forEach(a => { m[a.joint_exhibit_id] = a; });
    return m;
  }, [admitted]);

  const deposByJoint = useMemo(() => {
    const m = {};
    depoExhibits.forEach(d => {
      if (d.joint_exhibit_id) {
        if (!m[d.joint_exhibit_id]) m[d.joint_exhibit_id] = [];
        m[d.joint_exhibit_id].push(d);
      }
    });
    return m;
  }, [depoExhibits]);

  const tpsByJoint = useMemo(() => {
    const m = {};
    trialPointLinks.filter(l => l.link_type === "JointExhibit").forEach(l => {
      if (!m[l.link_id]) m[l.link_id] = [];
      const tp = trialPoints.find(t => t.id === l.trial_point_id);
      if (tp) m[l.link_id].push(tp);
    });
    return m;
  }, [trialPointLinks, trialPoints]);

  const sorted = [...joints].sort((a, b) => (a.marked_no || "").localeCompare(b.marked_no || "", undefined, { numeric: true }));

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="min-h-screen bg-white text-black p-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; font-size: 10px; }
          @page { margin: 0.75in; size: landscape; }
          tr { page-break-inside: avoid; }
        }
        table { font-size: 11px; }
      `}</style>

      <div className="no-print flex items-center gap-3 mb-6">
        <Button onClick={() => window.print()} className="bg-slate-800 text-white hover:bg-slate-700">
          <Printer className="w-4 h-4 mr-2" /> Print
        </Button>
      </div>

      <h1 className="text-xl font-bold mb-0.5">{activeCase.name}</h1>
      <h2 className="text-base font-semibold mb-4">Joint Exhibit List — Internal Reference</h2>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left py-1.5 pr-3 font-bold w-16">Marked</th>
            <th className="text-left py-1.5 pr-3 font-bold w-16">Admit #</th>
            <th className="text-left py-1.5 pr-3 font-bold w-48">Title</th>
            <th className="text-left py-1.5 pr-3 font-bold">Internal Name</th>
            <th className="text-left py-1.5 pr-3 font-bold">Source Deponent</th>
            <th className="text-left py-1.5 pr-3 font-bold">Trial Points</th>
            <th className="text-left py-1.5 font-bold">Notes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(j => {
            const adm = admByJoint[j.id];
            const depos = deposByJoint[j.id] || [];
            const tps = tpsByJoint[j.id] || [];
            return (
              <tr key={j.id} className="border-b border-gray-200 align-top">
                <td className="py-1.5 pr-3 font-mono font-semibold">{j.marked_no}</td>
                <td className="py-1.5 pr-3 font-mono text-gray-600">{adm?.admitted_no || ""}</td>
                <td className="py-1.5 pr-3">{j.marked_title}</td>
                <td className="py-1.5 pr-3 text-gray-500 italic">{j.internal_name || ""}</td>
                <td className="py-1.5 pr-3 text-gray-600">{depos.map(d => d.deponent_name || d.depo_exhibit_no).filter(Boolean).join(", ")}</td>
                <td className="py-1.5 pr-3 text-gray-500">{tps.map(t => t.point_text?.slice(0, 40)).join(" | ")}</td>
                <td className="py-1.5 text-gray-500 italic text-xs">{j.notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="no-print mt-4 text-sm text-gray-400">{sorted.length} exhibits</p>
    </div>
  );
}