import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Target, Library, Bookmark, CheckSquare } from "lucide-react";

export default function Dashboard() {
  const { activeCase, loading } = useActiveCase();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!activeCase) return;
    const cid = activeCase.id;
    Promise.all([
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.Depositions.filter({ case_id: cid }),
      base44.entities.TrialPoints.filter({ case_id: cid }),
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
      base44.entities.DepoClips.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
    ]).then(([parties, depos, tp, me, clips, je]) => {
      setStats({
        parties: parties.length,
        depositions: depos.length,
        trialPoints: tp.length,
        exhibits: me.length,
        clips: clips.length,
        jointExhibits: je.length,
        plaintiffParties: parties.filter(p => p.side === "Plaintiff").length,
        defenseParties: parties.filter(p => p.side === "Defense").length,
      });
    });
  }, [activeCase]);

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>;
  if (!activeCase) return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-2">PI Trial Map</h1>
      <p className="text-slate-400">No active case selected. Go to <span className="text-cyan-400">Settings</span> to create or select a case.</p>
    </div>
  );

  const cards = [
    { label: "Parties", value: stats?.parties || 0, icon: Users, color: "text-cyan-400", sub: `${stats?.plaintiffParties || 0} Plaintiff · ${stats?.defenseParties || 0} Defense` },
    { label: "Depositions", value: stats?.depositions || 0, icon: FileText, color: "text-blue-400" },
    { label: "Trial Points", value: stats?.trialPoints || 0, icon: Target, color: "text-amber-400" },
    { label: "Depo Exhibits", value: stats?.exhibits || 0, icon: Library, color: "text-purple-400" },
    { label: "Clips", value: stats?.clips || 0, icon: Bookmark, color: "text-green-400" },
    { label: "Joint Exhibits", value: stats?.jointExhibits || 0, icon: CheckSquare, color: "text-rose-400" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-slate-500 text-sm mb-8">{activeCase.name}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <Card key={c.label} className="bg-[#131a2e] border-[#1e2a45]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-slate-400">{c.label}</CardTitle>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{c.value}</p>
              {c.sub && <p className="text-xs text-slate-500 mt-1">{c.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}