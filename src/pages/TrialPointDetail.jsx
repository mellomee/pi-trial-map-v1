import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Link2, Trash2, FileText, BookOpen, HelpCircle, Search, ExternalLink } from "lucide-react";
import { createPageUrl } from "@/utils";

const proofColors = {
  Missing: "border-red-500/40 text-red-400",
  Proven: "border-green-500/40 text-green-400",
  Contested: "border-amber-500/40 text-amber-400",
  Weak: "border-purple-500/40 text-purple-400",
};

export default function TrialPointDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const pointId = urlParams.get("id");
  const { activeCase } = useActiveCase();

  const [point, setPoint] = useState(null);
  const [links, setLinks] = useState([]);
  const [clips, setClips] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [linkModal, setLinkModal] = useState(null); // "DepoClip" | "JointExhibit" | "Question"
  const [search, setSearch] = useState("");
  const [annLinks, setAnnLinks] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [extractsById, setExtractsById] = useState({});
  const [jointsById, setJointsById] = useState({});

  const load = async () => {
    if (!pointId || !activeCase) return;
    const [pt, lks, cl, de, je, qs, al, anns, exts] = await Promise.all([
      base44.entities.TrialPoints.filter({ id: pointId }),
      base44.entities.TrialPointLinks.filter({ trial_point_id: pointId }),
      base44.entities.DepoClips.filter({ case_id: activeCase.id }),
      base44.entities.DepositionExhibits.filter({ case_id: activeCase.id }),
      base44.entities.JointExhibits.filter({ case_id: activeCase.id }),
      base44.entities.Questions.filter({ case_id: activeCase.id }),
      base44.entities.AnnotationLinks.filter({ case_id: activeCase.id, link_type: "TrialPoint" }),
      base44.entities.ExhibitAnnotations.filter({ case_id: activeCase.id }),
      base44.entities.ExhibitExtracts.filter({ case_id: activeCase.id }),
    ]);
    setPoint(pt[0] || null);
    setLinks(lks);
    setClips(cl);
    setDepoExhibits(de);
    setJointExhibits(je);
    setQuestions(qs);
    setAnnLinks(al.filter(l => l.link_id === pointId));
    setAnnotations(anns);
    const em = {}; exts.forEach(e => { em[e.id] = e; });
    setExtractsById(em);
    const jm = {}; je.forEach(j => { jm[j.id] = j; });
    setJointsById(jm);
  };

  useEffect(() => { load(); }, [pointId, activeCase]);

  const addLink = async (entityType, entityId) => {
    await base44.entities.TrialPointLinks.create({
      case_id: activeCase.id,
      trial_point_id: pointId,
      entity_type: entityType,
      entity_id: entityId,
    });
    setLinkModal(null);
    setSearch("");
    load();
  };

  const removeLink = async (linkId) => {
    if (!confirm("Remove this link?")) return;
    await base44.entities.TrialPointLinks.delete(linkId);
    load();
  };

  const linkedIds = (type) => new Set(links.filter(l => l.entity_type === type).map(l => l.entity_id));

  const linkedClips = clips.filter(c => linkedIds("DepoClip").has(c.id));
  // Joint exhibits linked via entity_type = "MasterExhibit" (reusing existing enum)
  const linkedJointExhibits = jointExhibits.filter(j => linkedIds("MasterExhibit").has(j.id));
  const linkedQuestions = questions.filter(q => linkedIds("Question").has(q.id));

  // Enrich a joint exhibit with its primary depo exhibit info
  const getDepoInfo = (je) => {
    const depoId = je.primary_depo_exhibit_id || (je.source_depo_exhibit_ids || [])[0];
    return depoExhibits.find(d => d.id === depoId) || null;
  };

  // Modal candidates
  const modalItems = () => {
    const q = search.toLowerCase();
    if (linkModal === "DepoClip")
      return clips.filter(c =>
        !linkedIds("DepoClip").has(c.id) &&
        (c.clip_text?.toLowerCase().includes(q) || c.topic_tag?.toLowerCase().includes(q))
      );
    if (linkModal === "JointExhibit")
      return jointExhibits.filter(je =>
        !linkedIds("MasterExhibit").has(je.id) &&
        (je.marked_no?.toLowerCase().includes(q) ||
          je.marked_title?.toLowerCase().includes(q) ||
          (() => { const d = getDepoInfo(je); return d && ((d.depo_exhibit_no || "").toLowerCase().includes(q) || (d.deponent_name || "").toLowerCase().includes(q) || (d.depo_exhibit_title || "").toLowerCase().includes(q)); })())
      );
    if (linkModal === "Question")
      return questions.filter(q2 => !linkedIds("Question").has(q2.id) && q2.question_text?.toLowerCase().includes(q));
    return [];
  };

  if (!point) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <a href={createPageUrl("TrialPoints")} className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Trial Points
      </a>

      <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-5 mb-6">
        <p className="text-xl font-bold text-white leading-snug mb-3">{point.point_text}</p>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className={`text-xs ${proofColors[point.status] || ""}`}>{point.status}</Badge>
          <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">{point.priority}</Badge>
          {(point.elements || []).map(el => (
            <Badge key={el} variant="outline" className="text-xs text-slate-300 border-slate-600">{el}</Badge>
          ))}
        </div>
        {point.notes && <p className="text-sm text-slate-500 mt-2">{point.notes}</p>}
      </div>

      <Tabs defaultValue="clips">
        <TabsList className="bg-[#0f1629] border border-[#1e2a45] mb-4">
          <TabsTrigger value="clips" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Transcript Clips ({linkedClips.length})
          </TabsTrigger>
          <TabsTrigger value="exhibits" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Joint Exhibits ({linkedJointExhibits.length})
          </TabsTrigger>
          <TabsTrigger value="questions" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400">
            <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> Questions ({linkedQuestions.length})
          </TabsTrigger>
        </TabsList>

        {/* Clips */}
        <TabsContent value="clips">
          <div className="flex justify-end mb-3">
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setLinkModal("DepoClip"); setSearch(""); }}>
              <Link2 className="w-3.5 h-3.5 mr-1.5" /> Link Clip
            </Button>
          </div>
          <div className="space-y-2">
            {linkedClips.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No clips linked yet.</p>}
            {linkedClips.map(c => {
              const lk = links.find(l => l.entity_id === c.id);
              return (
                <div key={c.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-4 flex gap-3">
                  <div className="flex-1 min-w-0">
                    {c.topic_tag && <p className="text-xs text-cyan-400 font-medium mb-1">{c.topic_tag}</p>}
                    <p className="text-sm text-slate-200">{c.clip_text}</p>
                    {c.start_cite && <p className="text-xs text-slate-500 mt-1">{c.start_cite}{c.end_cite ? ` – ${c.end_cite}` : ""}</p>}
                  </div>
                  <button onClick={() => removeLink(lk?.id)} className="text-slate-600 hover:text-red-400 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Joint Exhibits */}
        <TabsContent value="exhibits">
          <div className="flex justify-end mb-3">
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setLinkModal("JointExhibit"); setSearch(""); }}>
              <Link2 className="w-3.5 h-3.5 mr-1.5" /> Link Joint Exhibit
            </Button>
          </div>
          <div className="space-y-2">
            {linkedJointExhibits.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No exhibits linked yet.</p>}
            {linkedJointExhibits.map(je => {
              const lk = links.find(l => l.entity_id === je.id);
              const depo = getDepoInfo(je);
              return (
                <div key={je.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-4 flex gap-3 items-start">
                  <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-6 gap-y-1">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Joint Exhibit</p>
                      <p className="text-sm font-semibold text-cyan-300">Exh. {je.marked_no}</p>
                      <p className="text-sm text-slate-200">{je.marked_title}</p>
                      {je.marked_by_side && <span className="text-[10px] text-slate-500">{je.marked_by_side}</span>}
                    </div>
                    {depo && (
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Original Depo Exhibit</p>
                        <p className="text-xs text-slate-300">{depo.depo_exhibit_no && <span className="font-mono text-slate-400 mr-1">[{depo.depo_exhibit_no}]</span>}{depo.depo_exhibit_title}</p>
                        {depo.deponent_name && <p className="text-xs text-slate-500 mt-0.5">Deponent: {depo.deponent_name}</p>}
                      </div>
                    )}
                  </div>
                  <a href={createPageUrl("JointExhibits")} className="p-1 text-slate-500 hover:text-cyan-400 flex-shrink-0" title="View in Joint List"><ExternalLink className="w-3.5 h-3.5" /></a>
                  <button onClick={() => removeLink(lk?.id)} className="text-slate-600 hover:text-red-400 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Questions */}
        <TabsContent value="questions">
          <div className="flex justify-end mb-3">
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setLinkModal("Question"); setSearch(""); }}>
              <Link2 className="w-3.5 h-3.5 mr-1.5" /> Link Question
            </Button>
          </div>
          <div className="space-y-2">
            {linkedQuestions.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No questions linked yet.</p>}
            {linkedQuestions.map(q => {
              const lk = links.find(l => l.entity_id === q.id);
              return (
                <div key={q.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-4 flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">{q.question_text}</p>
                    {q.goal && <p className="text-xs text-slate-500 mt-0.5">Goal: {q.goal}</p>}
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">{q.exam_type}</Badge>
                      <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">{q.status}</Badge>
                    </div>
                  </div>
                  <button onClick={() => removeLink(lk?.id)} className="text-slate-600 hover:text-red-400 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Link Modal */}
      <Dialog open={!!linkModal} onOpenChange={() => { setLinkModal(null); setSearch(""); }}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {linkModal === "DepoClip" ? "Link Transcript Clip" : linkModal === "JointExhibit" ? "Link Joint List Exhibit" : "Link Question"}
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
            />
          </div>
          <div className="overflow-y-auto flex-1 space-y-1.5">
            {linkModal === "JointExhibit" ? (
              <>
                {/* Header row */}
                {modalItems().length > 0 && (
                  <div className="grid grid-cols-[60px_1fr_1fr] gap-3 px-3 pb-1 border-b border-[#1e2a45]">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Exh #</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Joint Title</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Original Depo Exhibit</span>
                  </div>
                )}
                {modalItems().map(je => {
                  const depo = getDepoInfo(je);
                  return (
                    <button
                      key={je.id}
                      onClick={() => addLink("MasterExhibit", je.id)}
                      className="w-full text-left grid grid-cols-[60px_1fr_1fr] gap-3 px-3 py-2.5 rounded bg-[#0f1629] hover:bg-cyan-600/20 border border-[#1e2a45] hover:border-cyan-500/40 transition-colors"
                    >
                      <span className="text-sm font-semibold text-cyan-300 self-start">{je.marked_no}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 leading-snug">{je.marked_title}</p>
                        <div className="flex gap-2 flex-wrap mt-0.5">
                          {je.marked_by_side && <p className="text-[10px] text-slate-500">{je.marked_by_side}</p>}
                          {je.pages && <p className="text-[10px] text-slate-400">Pg: {je.pages}</p>}
                        </div>
                        {je.notes && <p className="text-[10px] text-slate-500 italic mt-0.5 truncate">{je.notes}</p>}
                      </div>
                      <div className="min-w-0">
                        {depo ? (
                          <>
                            <p className="text-xs text-slate-300 leading-snug">
                              {depo.depo_exhibit_no && <span className="font-mono text-slate-400 mr-1">[{depo.depo_exhibit_no}]</span>}
                              {depo.depo_exhibit_title}
                            </p>
                            {depo.deponent_name && <p className="text-[10px] text-slate-500 mt-0.5">{depo.deponent_name}</p>}
                          </>
                        ) : (
                          <p className="text-xs text-slate-600 italic">No depo exhibit linked</p>
                        )}
                      </div>
                    </button>
                  );
                })}
                {modalItems().length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-6">No joint exhibits found.</p>
                )}
              </>
            ) : (
              <>
                {modalItems().slice(0, 50).map(item => (
                  <button
                    key={item.id}
                    onClick={() => addLink(linkModal, item.id)}
                    className="w-full text-left px-3 py-2.5 rounded bg-[#0f1629] hover:bg-cyan-600/20 border border-[#1e2a45] hover:border-cyan-500/40 text-sm text-slate-300 transition-colors"
                  >
                    {linkModal === "DepoClip"
                      ? (item.topic_tag ? `[${item.topic_tag}] ${item.clip_text?.slice(0, 100)}` : item.clip_text?.slice(0, 120))
                      : item.question_text?.slice(0, 120)}
                  </button>
                ))}
                {modalItems().length === 0 && <p className="text-slate-500 text-sm text-center py-6">No items found.</p>}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => { setLinkModal(null); setSearch(""); }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}