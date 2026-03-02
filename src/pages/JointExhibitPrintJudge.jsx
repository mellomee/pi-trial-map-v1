import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function JointExhibitPrintJudge() {
  const { activeCase } = useActiveCase();
  const [joints, setJoints] = useState([]);
  const [admitted, setAdmitted] = useState([]);
  const [includeAdmitted, setIncludeAdmitted] = useState(true);

  useEffect(() => {
    if (!activeCase) return;
    Promise.all([
      base44.entities.JointExhibits.filter({ case_id: activeCase.id }),
      base44.entities.AdmittedExhibits.filter({ case_id: activeCase.id }),
    ]).then(([j, a]) => { setJoints(j); setAdmitted(a); });
  }, [activeCase]);

  const admByJoint = {};
  admitted.forEach(a => { admByJoint[a.joint_exhibit_id] = a; });

  const sorted = [...joints].sort((a, b) => (a.marked_no || "").localeCompare(b.marked_no || "", undefined, { numeric: true }));

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          @page { margin: 1in; }
        }
      `}</style>

      <div className="no-print flex items-center gap-3 mb-6">
        <Button onClick={() => window.print()} className="bg-slate-800 text-white hover:bg-slate-700">
          <Printer className="w-4 h-4 mr-2" /> Print
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeAdmitted} onChange={e => setIncludeAdmitted(e.target.checked)} />
          Include Admitted #
        </label>
      </div>

      <h1 className="text-2xl font-bold mb-1">{activeCase.name}</h1>
      <h2 className="text-lg font-semibold mb-4">Joint Exhibit List — For Judge</h2>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left py-2 pr-4 font-bold w-20">Marked #</th>
            {includeAdmitted && <th className="text-left py-2 pr-4 font-bold w-24">Admitted #</th>}
            <th className="text-left py-2 font-bold">Title</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(j => (
            <tr key={j.id} className="border-b border-gray-200">
              <td className="py-2 pr-4 font-mono font-semibold">{j.marked_no}</td>
              {includeAdmitted && <td className="py-2 pr-4 font-mono text-gray-600">{admByJoint[j.id]?.admitted_no || ""}</td>}
              <td className="py-2">{j.marked_title}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="no-print mt-6 text-sm text-gray-400">{sorted.length} exhibits total</p>
    </div>
  );
}