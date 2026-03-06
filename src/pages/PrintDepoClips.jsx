import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer } from "lucide-react";

export default function PrintDepoClips() {
  const { activeCase } = useActiveCase();
  const [clips, setClips] = useState([]);
  const [depositions, setDepositions] = useState([]);
  const [parties, setParties] = useState([]);
  const [filterDepo, setFilterDepo] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");

  useEffect(() => {
    if (!activeCase) return;
    Promise.all([
      base44.entities.DepoClips.filter({ case_id: activeCase.id }),
      base44.entities.Depositions.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
    ]).then(([cls, deps, pts]) => {
      setClips(cls);
      setDepositions(deps);
      setParties(pts);
    });
  }, [activeCase]);

  const getDepoName = (depoId) => {
    const d = depositions.find(x => x.id === depoId);
    if (!d) return "—";
    const p = parties.find(x => x.id === d.party_id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : d.sheet_name;
  };

  const filtered = useMemo(() => clips.filter(c => {
    const matchDepo = filterDepo === "all" || c.deposition_id === filterDepo;
    const matchDir = filterDirection === "all" || c.direction === filterDirection;
    return matchDepo && matchDir;
  }), [clips, filterDepo, filterDirection]);

  // Group by deponent for display
  const byDepo = useMemo(() => {
    const map = {};
    filtered.forEach(c => {
      const key = c.deposition_id || "__none__";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [filtered]);

  const selectedDepoLabel = filterDepo !== "all" ? getDepoName(filterDepo) : "All Deponents";

  if (!activeCase) return <div className="p-8">No active case.</div>;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 z-10 shadow-sm">
        <h1 className="text-lg font-bold text-gray-800">Print: Depo Clips</h1>
        <Select value={filterDepo} onValueChange={setFilterDepo}>
          <SelectTrigger className="w-48 h-8 text-sm border-gray-300">
            <SelectValue placeholder="All Deponents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deponents</SelectItem>
            {depositions.map(d => {
              const p = parties.find(x => x.id === d.party_id);
              const label = p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : d.sheet_name;
              return <SelectItem key={d.id} value={d.id}>{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Select value={filterDirection} onValueChange={setFilterDirection}>
          <SelectTrigger className="w-36 h-8 text-sm border-gray-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="HelpsUs">Helps Us</SelectItem>
            <SelectItem value="HurtsUs">Hurts Us</SelectItem>
          </SelectContent>
        </Select>
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
          <p className="text-sm text-gray-500 mt-1">
            Depo Clips · {selectedDepoLabel}
            {filterDirection !== "all" ? ` · ${filterDirection}` : ""}
            · {filtered.length} clip{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {filtered.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No clips found for this filter.</p>
        ) : (
          Object.entries(byDepo).map(([depoId, depoClips]) => (
            <div key={depoId} className="mb-8">
              {filterDepo === "all" && (
                <div className="bg-gray-100 border-l-4 border-gray-400 px-3 py-1.5 mb-3 rounded-r">
                  <p className="text-sm font-bold text-gray-700">{getDepoName(depoId)}</p>
                </div>
              )}
              <div className="space-y-4">
                {depoClips.map((clip, i) => (
                  <div key={clip.id} className="border border-gray-200 rounded overflow-hidden page-break-inside-avoid">
                    {/* Clip header */}
                    <div className="flex items-start justify-between gap-3 bg-gray-50 px-3 py-2 border-b border-gray-200">
                      <div className="flex items-start gap-2">
                        <span className="text-[11px] text-gray-400 font-mono mt-0.5">{i + 1}.</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {clip.clip_title || clip.topic_tag || clip.start_cite}
                          </p>
                          <p className="text-[11px] text-gray-500 font-mono">
                            {clip.start_cite}{clip.end_cite ? ` → ${clip.end_cite}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 text-[10px] flex-shrink-0">
                        {clip.direction && (
                          <span className={`px-1.5 py-0.5 rounded font-semibold ${
                            clip.direction === "HelpsUs" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}>{clip.direction}</span>
                        )}
                        {clip.impeachment_ready && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Impeachment</span>}
                      </div>
                    </div>
                    {/* Transcript text */}
                    {clip.clip_text && (
                      <div className="px-3 py-2 bg-white">
                        <div className="space-y-0.5">
                          {clip.clip_text.split("\n").map((line, li) => {
                            const tabIdx = line.indexOf("\t");
                            const cite = tabIdx >= 0 ? line.substring(0, tabIdx) : "";
                            const text = tabIdx >= 0 ? line.substring(tabIdx + 1) : line;
                            return (
                              <div key={li} className="flex gap-3">
                                <span className="text-[10px] font-mono text-gray-400 w-20 flex-shrink-0">{cite}</span>
                                <span className="text-xs text-gray-800 leading-snug">{text}</span>
                              </div>
                            );
                          })}
                        </div>
                        {clip.notes && (
                          <p className="text-[11px] text-gray-400 italic mt-2 border-t border-gray-100 pt-1">{clip.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
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