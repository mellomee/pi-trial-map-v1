import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, FileText, Highlighter, Search, StickyNote, ChevronRight, Eye, EyeOff
} from "lucide-react";
import { createPageUrl } from "@/utils";
import AnnotationViewer from "@/components/annotations/AnnotationViewer";
import AnnotationEditor from "@/components/annotations/AnnotationEditor";

export default function JointExhibitDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const jointId = urlParams.get("id");
  const initTab = urlParams.get("tab") || "annotations";
  const { activeCase } = useActiveCase();

  const [joint, setJoint] = useState(null);
  const [extract, setExtract] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [admittedRec, setAdmittedRec] = useState(null);

  // Annotation UI state
  const [selectedAnnotation, setSelectedAnnotation] = useState(null); // null | annotation obj | "new-note" | "new-highlight"
  const [page, setPage] = useState(1);
  const [searchQ, setSearchQ] = useState("");
  const [filterKind, setFilterKind] = useState("all"); // all | Note | Highlight
  const [drawMode, setDrawMode] = useState(false);
  const [showNumberOverlay, setShowNumberOverlay] = useState(false);
  const [pendingRect, setPendingRect] = useState(null); // highlight_rect_json awaiting save

  const load = async () => {
    if (!jointId || !activeCase) return;
    const cid = activeCase.id;
    const [joints, anns, tps, qs, admitted, extracts] = await Promise.all([
      base44.entities.JointExhibits.filter({ id: jointId }),
      base44.entities.ExhibitAnnotations.filter({ joint_exhibit_id: jointId }),
      base44.entities.TrialPoints.filter({ case_id: cid }),
      base44.entities.Questions.filter({ case_id: cid }),
      base44.entities.AdmittedExhibits.filter({ case_id: cid }),
      base44.entities.ExhibitExtracts.filter({ case_id: cid }),
    ]);
    const j = joints[0];
    setJoint(j);
    setAnnotations(anns);
    setTrialPoints(tps);
    setQuestions(qs);
    setAdmittedRec(admitted.find(a => a.joint_exhibit_id === jointId) || null);
    if (j?.exhibit_extract_id) {
      setExtract(extracts.find(e => e.id === j.exhibit_extract_id) || null);
    }
  };

  useEffect(() => { load(); }, [jointId, activeCase]);

  const displayNo = useMemo(() => {
    if (!joint) return "";
    const no = admittedRec?.admitted_no || joint.marked_no;
    return `Exh. ${no}`;
  }, [joint, admittedRec]);

  const filteredAnnotations = useMemo(() => {
    return annotations.filter(a => {
      const matchKind = filterKind === "all" || a.kind === filterKind;
      const matchSearch = !searchQ || a.label_internal?.toLowerCase().includes(searchQ.toLowerCase()) || a.note_text?.toLowerCase().includes(searchQ.toLowerCase());
      return matchKind && matchSearch;
    }).sort((a, b) => {
      if (a.page_in_extract !== b.page_in_extract) return a.page_in_extract - b.page_in_extract;
      return new Date(a.created_date) - new Date(b.created_date);
    });
  }, [annotations, filterKind, searchQ]);

  // Annotations for the currently shown page (for overlay)
  const pageAnnotations = useMemo(() =>
    annotations.filter(a => a.page_in_extract === page),
    [annotations, page]
  );

  const startNewNote = () => {
    setDrawMode(false);
    setPendingRect(null);
    setSelectedAnnotation({ joint_exhibit_id: jointId, page_in_extract: page, kind: "Note" });
  };

  const startNewHighlight = () => {
    setDrawMode(true);
    setPendingRect(null);
    setSelectedAnnotation(null);
  };

  const handleRectDrawn = (rectJson) => {
    setDrawMode(false);
    setPendingRect(rectJson);
    setSelectedAnnotation({ joint_exhibit_id: jointId, page_in_extract: page, kind: "Highlight", highlight_rect_json: rectJson });
  };

  const handleSave = (saved) => {
    setAnnotations(prev => {
      const idx = prev.findIndex(a => a.id === saved.id);
      return idx >= 0 ? prev.map(a => a.id === saved.id ? saved : a) : [...prev, saved];
    });
    setSelectedAnnotation(saved); // keep selected so user can add links
    setPendingRect(null);
  };

  const handleDelete = () => {
    setAnnotations(prev => prev.filter(a => a.id !== selectedAnnotation?.id));
    setSelectedAnnotation(null);
  };

  const handleCancel = () => {
    setSelectedAnnotation(null);
    setDrawMode(false);
    setPendingRect(null);
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;
  if (!joint) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-[#0f1629] border-b border-[#1e2a45] px-5 py-3">
        <div className="flex items-center gap-3">
          <a href={createPageUrl("JointExhibits")} className="text-slate-400 hover:text-cyan-400">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-cyan-400">{displayNo}</span>
              <span className="text-base font-semibold text-white truncate">{joint.marked_title}</span>
              {admittedRec && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                  Admitted #{admittedRec.admitted_no}
                </Badge>
              )}
              {!joint.exhibit_extract_id && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                  No extract
                </Badge>
              )}
            </div>
            {extract && (
              <p className="text-xs text-slate-500 mt-0.5">
                Extract: {extract.extract_title_internal || extract.extract_title_official}
              </p>
            )}
          </div>
          <span className="text-xs text-slate-600">{annotations.length} annotation{annotations.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <Tabs defaultValue={initTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-5 pt-3 bg-[#0a0f1e] border-b border-[#1e2a45]">
          <TabsList className="bg-[#0f1629] border border-[#1e2a45]">
            <TabsTrigger value="annotations" className="data-[state=active]:bg-yellow-600/30 data-[state=active]:text-yellow-300 text-slate-400">
              <StickyNote className="w-3.5 h-3.5 mr-1.5" /> Annotations ({annotations.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="annotations" className="flex-1 overflow-hidden m-0">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1e2a45] bg-[#0f1629] flex-wrap">
            {/* Page selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Page</span>
              <Input
                type="number"
                min={1}
                value={page}
                onChange={e => setPage(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-7 bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs"
              />
            </div>
            <div className="w-px h-5 bg-[#1e2a45]" />
            <Button size="sm" className="h-7 bg-cyan-600/20 text-cyan-400 border border-cyan-600/30 hover:bg-cyan-600/40 text-xs gap-1" onClick={startNewNote}>
              <Plus className="w-3 h-3" /> Add Note
            </Button>
            <Button
              size="sm"
              className={`h-7 text-xs gap-1 border ${drawMode ? "bg-yellow-500/30 text-yellow-300 border-yellow-500/50" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30 hover:bg-yellow-600/40"}`}
              onClick={startNewHighlight}
            >
              <Highlighter className="w-3 h-3" /> {drawMode ? "Drawing…" : "Add Highlight"}
            </Button>
            <div className="w-px h-5 bg-[#1e2a45]" />
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1.5 w-3 h-3 text-slate-500" />
              <Input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search…"
                className="pl-7 h-7 w-36 bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs"
              />
            </div>
            {/* Kind filter */}
            <Select value={filterKind} onValueChange={setFilterKind}>
              <SelectTrigger className="h-7 w-28 bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Note">Notes</SelectItem>
                <SelectItem value="Highlight">Highlights</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            {/* Number overlay toggle */}
            <button
              onClick={() => setShowNumberOverlay(v => !v)}
              className={`flex items-center gap-1 h-7 px-2 rounded border text-xs transition-colors ${showNumberOverlay ? "bg-white/10 text-white border-white/20" : "text-slate-500 border-[#1e2a45] hover:text-slate-300"}`}
              title="Toggle exhibit number overlay"
            >
              {showNumberOverlay ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} #{displayNo}
            </button>
          </div>

          {/* Body: list | viewer | editor */}
          <div className="flex h-full overflow-hidden" style={{ height: "calc(100% - 48px)" }}>
            {/* Left: annotation list */}
            <div className="w-56 flex-shrink-0 border-r border-[#1e2a45] overflow-y-auto bg-[#0f1629]">
              {filteredAnnotations.length === 0 ? (
                <div className="p-4 text-xs text-slate-600 text-center pt-8">
                  {annotations.length === 0 ? "No annotations yet." : "No match."}
                </div>
              ) : (
                <div className="py-1">
                  {filteredAnnotations.map(ann => {
                    const isSelected = selectedAnnotation?.id === ann.id;
                    return (
                      <button
                        key={ann.id}
                        onClick={() => { setSelectedAnnotation(ann); setPage(ann.page_in_extract); setDrawMode(false); }}
                        className={`w-full text-left px-3 py-2.5 border-b border-[#1e2a45] transition-colors flex items-start gap-2 ${isSelected ? "bg-yellow-600/15 border-l-2 border-l-yellow-400" : "hover:bg-white/5 border-l-2 border-l-transparent"}`}
                      >
                        {ann.kind === "Highlight"
                          ? <Highlighter className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                          : <StickyNote className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0 mt-0.5" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-200 leading-snug line-clamp-2">{ann.label_internal}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">p.{ann.page_in_extract}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Center: viewer */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#0a0f1e]">
              <AnnotationViewer
                fileUrl={extract?.extract_file_url || null}
                page={page}
                annotations={pageAnnotations}
                selectedId={selectedAnnotation?.id}
                drawMode={drawMode}
                onRectDrawn={handleRectDrawn}
                displayNo={displayNo}
                showNumberOverlay={showNumberOverlay}
              />
            </div>

            {/* Right: editor */}
            <div className="w-72 flex-shrink-0 border-l border-[#1e2a45] bg-[#0f1629] flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#1e2a45]">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {selectedAnnotation?.id ? "Edit Annotation" : selectedAnnotation ? "New Annotation" : "Annotation"}
                </p>
              </div>
              {activeCase && (
                <AnnotationEditor
                  annotation={selectedAnnotation}
                  caseId={activeCase.id}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onCancel={handleCancel}
                  trialPoints={trialPoints}
                  questions={questions}
                />
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}