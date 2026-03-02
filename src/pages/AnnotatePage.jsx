import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, FileText, Link2, Highlighter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import useActiveCase from "@/components/hooks/useActiveCase";
import AnnotationsSection from "@/components/exhibits/AnnotationsSection";

export default function AnnotatePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const extractId = urlParams.get("extractId");

  const { activeCase } = useActiveCase();
  const [extract, setExtract] = useState(null);
  const [depoExhibit, setDepoExhibit] = useState(null);
  const [joints, setJoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!extractId) { setLoading(false); return; }
    base44.entities.ExhibitExtracts.filter({ id: extractId }).then(async ([ex]) => {
      if (!ex) { setLoading(false); return; }
      setExtract(ex);

      const [depoExhibits, jointList] = await Promise.all([
        ex.source_depo_exhibit_id
          ? base44.entities.DepositionExhibits.filter({ id: ex.source_depo_exhibit_id })
          : Promise.resolve([]),
        base44.entities.JointExhibits.filter({ exhibit_extract_id: extractId }),
      ]);

      setDepoExhibit(depoExhibits[0] || null);
      setJoints(jointList);
      setLoading(false);
    });
  }, [extractId]);

  if (!extractId) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center text-slate-500">
        <div className="text-center">
          <Highlighter className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No extract selected.</p>
          <Link to={createPageUrl("Extracts")} className="text-cyan-400 hover:underline text-sm mt-2 inline-block">← Go to Extracts</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center text-slate-500 text-sm">Loading…</div>;
  }

  if (!extract) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center text-slate-500">
        <div className="text-center">
          <p>Extract not found.</p>
          <Link to={createPageUrl("Extracts")} className="text-cyan-400 hover:underline text-sm mt-2 inline-block">← Go to Extracts</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-[#0f1629] border-b border-[#1e2a45] px-5 py-3">
        <div className="flex items-start gap-3">
          <Link
            to={createPageUrl("Extracts")}
            className="mt-0.5 p-1 text-slate-500 hover:text-slate-200 flex-shrink-0"
            title="Back to Extracts"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {extract.extract_title_internal && (
                <span className="text-[11px] text-slate-500 italic">"{extract.extract_title_internal}"</span>
              )}
              {joints.map(j => (
                <Badge key={j.id} className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  Joint #{j.marked_no}
                </Badge>
              ))}
              {joints.some(j => j.status === "Admitted" || j.admitted_no) && (
                <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
                  Admitted #{joints.find(j => j.admitted_no)?.admitted_no}
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold text-white leading-snug mt-0.5">
              {extract.extract_title_official}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {depoExhibit && (
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {depoExhibit.depo_exhibit_no ? `Exhibit #${depoExhibit.depo_exhibit_no} — ` : ""}
                  {depoExhibit.deponent_name || depoExhibit.depo_exhibit_title}
                </span>
              )}
              {(extract.extract_page_start || extract.extract_page_end) && (
                <span className="text-[10px] text-slate-500">
                  pp. {extract.extract_page_start}–{extract.extract_page_end}
                </span>
              )}
              {extract.extract_file_url && (
                <a href={extract.extract_file_url} target="_blank" rel="noreferrer"
                  className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5">
                  <Link2 className="w-3 h-3" /> View File
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Annotations editor — full height */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <AnnotationsSection
          extractId={extractId}
          extractFileUrl={extract.extract_file_url}
        />
      </div>
    </div>
  );
}