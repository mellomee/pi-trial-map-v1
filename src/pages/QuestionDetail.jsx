import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Link2, Trash2, Search, Target, BookOpen, FileText, ExternalLink, ChevronRight, StickyNote, Highlighter } from "lucide-react";
import { createPageUrl } from "@/utils";

function TPNode({ tp, depth, getChildren, filteredIds, linkedTpIds, onLink, searching }) {
  const children = getChildren(tp.id);
  const isLinked = linkedTpIds.has(tp.id);
  const isSelectable = !isLinked && (!searching || filteredIds.has(tp.id));

  return (
    <div style={{ paddingLeft: `${depth * 16}px` }}>
      <button
        disabled={isLinked}
        onClick={() => isSelectable && onLink(tp.id)}
        className={`w-full text-left px-3 py-2 rounded mb-0.5 border transition-colors text-sm
          ${isLinked
            ? "bg-cyan-600/10 border-cyan-600/20 text-cyan-600 cursor-default opacity-60"
            : "bg-[#0f1629] border-[#1e2a45] text-slate-200 hover:bg-cyan-600/20 hover:border-cyan-500/40"
          }`}
      >
        <div className="flex items-center gap-1">
          {depth > 0 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
          <span className="flex-1">{tp.point_text}</span>
          <div className="flex gap-1 flex-shrink-0">
            <span className="text-[10px] text-slate-500">{tp.status}</span>
            {tp.theme && <span className="text-[10px] text-slate-500">· {tp.theme}</span>}
          </div>
        </div>
      </button>
      {children.map(child => (
        <TPNode
          key={child.id}
          tp={child}
          depth={depth + 1}
          getChildren={getChildren}
          filteredIds={filteredIds}
          linkedTpIds={linkedTpIds}
          onLink={onLink}
          searching={searching}
        />
      ))}
    </div>
  );
}

export default function QuestionDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const questionId = urlParams.get("id");
  const { activeCase } = useActiveCase();

  const [question, setQuestion] = useState(null);
  const [parties, setParties] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);
  const [questionLinks, setQuestionLinks] = useState([]); // QuestionLinks where link_type=TrialPoint
  const [trialPointLinks, setTrialPointLinks] = useState([]); // TrialPointLinks for linked trial points
  const [jointExhibits, setJointExhibits] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [depoClips, setDepoClips] = useState([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [annLinks, setAnnLinks] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [extractsById, setExtractsById] = useState({});
  const [jointsById, setJointsById] = useState({});

  const load = async () => {
    if (!questionId || !activeCase) return;
    const [qs, pts, ql, jts, de, dc, pa, cats, al, anns, exts] = await Promise.all([
      base44.entities.Questions.filter({ id: questionId }),
      base44.entities.TrialPoints.filter({ case_id: activeCase.id }),
      base44.entities.QuestionLinks.filter({ question_id: questionId, link_type: "TrialPoint" }),
      base44.entities.JointExhibits.filter({ case_id: activeCase.id }),
      base44.entities.DepositionExhibits.filter({ case_id: activeCase.id }),
      base44.entities.DepoClips.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
      base44.entities.TrialPointCategories.filter({ case_id: activeCase.id }),
      base44.entities.AnnotationLinks.filter({ case_id: activeCase.id, link_type: "Question" }),
      base44.entities.ExhibitAnnotations.filter({ case_id: activeCase.id }),
      base44.entities.ExhibitExtracts.filter({ case_id: activeCase.id }),
    ]);
    setQuestion(qs[0] || null);
    setTrialPoints(pts);
    setQuestionLinks(ql);
    setJointExhibits(jts);
    setDepoExhibits(de);
    setDepoClips(dc);
    setParties(pa);
    setCategories(cats);
    setAnnLinks(al.filter(l => l.link_id === questionId));
    setAnnotations(anns);
    const em = {}; exts.forEach(e => { em[e.id] = e; });
    setExtractsById(em);
    const jm = {}; jts.forEach(j => { jm[j.id] = j; });
    setJointsById(jm);

    // Load TrialPointLinks for all linked trial points
    const linkedTpIds = ql.map(l => l.link_id);
    if (linkedTpIds.length > 0) {
      const tpLinks = await base44.entities.TrialPointLinks.filter({ case_id: activeCase.id });
      setTrialPointLinks(tpLinks.filter(l => linkedTpIds.includes(l.trial_point_id)));
    } else {
      setTrialPointLinks([]);
    }
  };

  useEffect(() => { load(); }, [questionId, activeCase]);

  const linkedTpIds = new Set(questionLinks.map(l => l.link_id));
  const linkedTrialPoints = trialPoints.filter(tp => linkedTpIds.has(tp.id));

  // Exhibits linked to this question's trial points via TrialPointLinks (entity_type=MasterExhibit = joint exhibit)
  const exhibitIdsFromTPs = new Set(
    trialPointLinks.filter(l => l.entity_type === "MasterExhibit").map(l => l.entity_id)
  );
  const linkedJointExhibits = jointExhibits.filter(je => exhibitIdsFromTPs.has(je.id));

  // Depo clips linked to trial points
  const clipIdsFromTPs = new Set(
    trialPointLinks.filter(l => l.entity_type === "DepoClip").map(l => l.entity_id)
  );
  const linkedDepoClips = depoClips.filter(c => clipIdsFromTPs.has(c.id));

  const getDepoInfo = (je) => {
    const depoId = je.primary_depo_exhibit_id || (je.source_depo_exhibit_ids || [])[0];
    return depoExhibits.find(d => d.id === depoId) || null;
  };

  const getPartyName = (pid) => {
    const p = parties.find(x => x.id === pid);
    return p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "";
  };

  const linkTrialPoint = async (tpId) => {
    await base44.entities.QuestionLinks.create({
      case_id: activeCase.id,
      question_id: questionId,
      link_type: "TrialPoint",
      link_id: tpId,
    });
    setLinkModalOpen(false);
    setSearch("");
    load();
  };

  const unlinkTrialPoint = async (qlId) => {
    if (!confirm("Remove this link?")) return;
    await base44.entities.QuestionLinks.delete(qlId);
    load();
  };

  // Build hierarchical tree for the modal
  const treeData = useMemo(() => {
    const searchLower = search.toLowerCase();
    const allFiltered = trialPoints.filter(tp =>
      !linkedTpIds.has(tp.id) &&
      (!search || tp.point_text?.toLowerCase().includes(searchLower))
    );
    const filteredIds = new Set(allFiltered.map(tp => tp.id));

    // When searching, include ancestors of matched nodes
    const included = new Set(filteredIds);
    if (search) {
      trialPoints.forEach(tp => {
        if (filteredIds.has(tp.id)) {
          // walk up parent chain
          let cur = tp;
          while (cur?.parent_point_id) {
            const parent = trialPoints.find(x => x.id === cur.parent_point_id);
            if (parent) included.add(parent.id);
            cur = parent;
          }
        }
      });
    }

    const visiblePoints = trialPoints.filter(tp => included.has(tp.id));

    // Group top-level by category
    const sortedCats = [...categories].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    const topLevel = visiblePoints.filter(tp => !tp.parent_point_id).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    const getChildren = (parentId) =>
      visiblePoints.filter(tp => tp.parent_point_id === parentId).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    const cats = [];
    sortedCats.forEach(cat => {
      const points = topLevel.filter(tp => tp.category_id === cat.id);
      if (points.length > 0) cats.push({ cat, points });
    });
    // Uncategorized
    const uncatPoints = topLevel.filter(tp => !tp.category_id);
    if (uncatPoints.length > 0) cats.push({ cat: { id: null, name: "Uncategorized" }, points: uncatPoints });

    return { cats, getChildren, filteredIds };
  }, [trialPoints, categories, linkedTpIds, search]);

  if (!question) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <a href={createPageUrl("Questions")} className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Questions
      </a>

      {/* Question Header */}
      <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-5 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <Badge className={question.exam_type === "Direct" ? "bg-green-500/20 text-green-400 flex-shrink-0" : "bg-red-500/20 text-red-400 flex-shrink-0"}>
            {question.exam_type}
          </Badge>
          {question.party_id && (
            <Badge variant="outline" className="text-slate-300 border-slate-600 flex-shrink-0">
              {getPartyName(question.party_id)}
            </Badge>
          )}
        </div>
        <p className="text-lg font-semibold text-white leading-snug mb-2">{question.question_text}</p>
        {question.goal && <p className="text-xs text-slate-500">Goal: {question.goal}</p>}
        {question.expected_answer && <p className="text-xs text-slate-500">Expected: {question.expected_answer}</p>}
      </div>

      <Tabs defaultValue="trialpoints">
        <TabsList className="bg-[#0f1629] border border-[#1e2a45] mb-4">
          <TabsTrigger value="trialpoints" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400">
            <Target className="w-3.5 h-3.5 mr-1.5" /> Trial Points ({linkedTrialPoints.length})
          </TabsTrigger>
          <TabsTrigger value="exhibits" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Proof — Exhibits ({linkedJointExhibits.length})
          </TabsTrigger>
          <TabsTrigger value="clips" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Proof — Clips ({linkedDepoClips.length})
          </TabsTrigger>
          <TabsTrigger value="annotations" className="data-[state=active]:bg-yellow-600/40 data-[state=active]:text-yellow-300 text-slate-400">
            <StickyNote className="w-3.5 h-3.5 mr-1.5" /> Annotations ({annLinks.length})
          </TabsTrigger>
        </TabsList>

        {/* Trial Points */}
        <TabsContent value="trialpoints">
          <div className="flex justify-end mb-3">
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setLinkModalOpen(true); setSearch(""); }}>
              <Link2 className="w-3.5 h-3.5 mr-1.5" /> Link Trial Point
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {linkedTrialPoints.length === 0 && (
              <p className="text-slate-500 text-sm py-8 w-full text-center">No trial points linked yet.</p>
            )}
            {linkedTrialPoints.map(tp => {
              const ql = questionLinks.find(l => l.link_id === tp.id);
              return (
                <div key={tp.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-3 flex items-start gap-2 max-w-lg">
                  <div className="flex-1">
                    <p className="text-sm text-slate-200">{tp.point_text}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700">{tp.status}</Badge>
                      {tp.theme && <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700">{tp.theme}</Badge>}
                    </div>
                  </div>
                  <button onClick={() => unlinkTrialPoint(ql?.id)} className="text-slate-600 hover:text-red-400 flex-shrink-0 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Exhibits from linked trial points */}
        <TabsContent value="exhibits">
          <p className="text-[10px] text-slate-500 italic mb-3">Joint exhibits linked to this question's trial points.</p>
          <div className="space-y-2">
            {linkedJointExhibits.length === 0 && (
              <p className="text-slate-500 text-sm py-8 text-center">No exhibits found. Link trial points that have exhibits attached.</p>
            )}
            {linkedJointExhibits.map(je => {
              const depo = getDepoInfo(je);
              return (
                <div key={je.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-3 flex items-start gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-x-4">
                    <div>
                      <p className="text-xs font-bold text-cyan-300">Exh. {je.marked_no}</p>
                      <p className="text-sm text-slate-200">{je.marked_title}</p>
                      {je.pages && <p className="text-[10px] text-slate-500">Pg: {je.pages}</p>}
                    </div>
                    {depo && (
                      <div>
                        <p className="text-xs text-slate-400">
                          {depo.depo_exhibit_no && <span className="font-mono mr-1">[{depo.depo_exhibit_no}]</span>}
                          {depo.depo_exhibit_title}
                        </p>
                        {depo.deponent_name && <p className="text-[10px] text-slate-500">{depo.deponent_name}</p>}
                      </div>
                    )}
                  </div>
                  <a href={createPageUrl("JointExhibits")} className="text-slate-500 hover:text-cyan-400 flex-shrink-0" title="View in Joint List">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Depo Clips from linked trial points */}
        <TabsContent value="clips">
          <p className="text-[10px] text-slate-500 italic mb-3">Depo clips linked to this question's trial points.</p>
          <div className="space-y-2">
            {linkedDepoClips.length === 0 && (
              <p className="text-slate-500 text-sm py-8 text-center">No clips found. Link trial points that have depo clips attached.</p>
            )}
            {linkedDepoClips.map(c => (
              <div key={c.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-3">
                {c.topic_tag && <p className="text-xs text-cyan-400 font-medium mb-1">{c.topic_tag}</p>}
                <p className="text-sm text-slate-200">{c.clip_text}</p>
                {c.start_cite && (
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {c.start_cite}{c.end_cite ? ` – ${c.end_cite}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

        {/* Annotations linked to this question */}
        <TabsContent value="annotations">
          <p className="text-[10px] text-slate-500 italic mb-3">Exhibit annotations linked directly to this question (internal only).</p>
          <div className="space-y-2">
            {annLinks.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-8">No annotations linked. Open a Joint Exhibit annotation and link it to this question.</p>
            )}
            {annLinks.map(al => {
              const ann = annotations.find(a => a.id === al.annotation_id);
              if (!ann) return null;
              const jt = jointsById[ann.joint_exhibit_id];
              const ext = jt?.exhibit_extract_id ? extractsById[jt.exhibit_extract_id] : null;
              return (
                <div key={al.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-3 flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {ann.kind === "Highlight"
                      ? <Highlighter className="w-4 h-4 text-yellow-500" />
                      : <StickyNote className="w-4 h-4 text-cyan-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{ann.label_internal}</p>
                    {ann.note_text && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{ann.note_text}</p>}
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {jt && <Badge className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Exh. {jt.marked_no}</Badge>}
                      <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700">p.{ann.page_in_extract}</Badge>
                      {ext && <span className="text-[10px] text-slate-600">{ext.extract_title_internal || ext.extract_title_official}</span>}
                    </div>
                  </div>
                  {jt && (
                    <a
                      href={`${createPageUrl("JointExhibitDetail")}?id=${jt.id}&tab=annotations`}
                      className="text-slate-500 hover:text-yellow-400 flex-shrink-0"
                      title="Open in annotation editor"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Link Trial Point Modal */}
      <Dialog open={linkModalOpen} onOpenChange={() => { setLinkModalOpen(false); setSearch(""); }}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-h-[75vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Link Trial Point</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search trial points…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {treeData.cats.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-6">No trial points available.</p>
            )}
            {treeData.cats.map(({ cat, points }) => (
              <div key={cat.id || "uncat"} className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 py-1 border-b border-[#1e2a45] mb-1">{cat.name}</p>
                {points.map(tp => (
                  <TPNode
                    key={tp.id}
                    tp={tp}
                    depth={0}
                    getChildren={treeData.getChildren}
                    filteredIds={treeData.filteredIds}
                    linkedTpIds={linkedTpIds}
                    onLink={linkTrialPoint}
                    searching={!!search}
                  />
                ))}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => { setLinkModalOpen(false); setSearch(""); }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}