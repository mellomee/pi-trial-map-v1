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
  const [questions, setQuestions] = useState([]);
  const [linkModal, setLinkModal] = useState(null); // "DepoClip" | "DepoExhibit" | "Question"
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!pointId || !activeCase) return;
    const [pt, lks, cl, de, qs] = await Promise.all([
      base44.entities.TrialPoints.filter({ id: pointId }),
      base44.entities.TrialPointLinks.filter({ trial_point_id: pointId }),
      base44.entities.DepoClips.filter({ case_id: activeCase.id }),
      base44.entities.DepositionExhibits.filter({ case_id: activeCase.id }),
      base44.entities.Questions.filter({ case_id: activeCase.id }),
    ]);
    setPoint(pt[0] || null);
    setLinks(lks);
    setClips(cl);
    setDepoExhibits(de);
    setQuestions(qs);
  };

  useEffect(() => { load(); }, [pointId, activeCase]);

  const addLink = async (entityType, entityId) => {
    // Map internal modal type to the entity_type enum value
    const entityTypeMap = { DepoExhibit: "MasterExhibit", DepoClip: "DepoClip", Question: "Question" };
    await base44.entities.TrialPointLinks.create({
      case_id: activeCase.id,
      trial_point_id: pointId,
      entity_type: entityTypeMap[entityType] || entityType,
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
  const linkedExhibits = depoExhibits.filter(e => linkedIds("MasterExhibit").has(e.id));
  const linkedQuestions = questions.filter(q => linkedIds("Question").has(q.id));

  // Search candidates for link modal
  const modalItems = () => {
    const q = search.toLowerCase();
    if (linkModal === "DepoClip")
      return clips.filter(c => !linkedIds("DepoClip").has(c.id) && (c.clip_text?.toLowerCase().includes(q) || c.topic_tag?.toLowerCase().includes(q)));
    if (linkModal === "DepoExhibit")
      return depoExhibits.filter(e =>
        !linkedIds("DepoExhibit").has(e.id) &&
        ((e.display_title || e.depo_exhibit_title)?.toLowerCase().includes(q) ||
          e.depo_exhibit_no?.toLowerCase().includes(q) ||
          e.deponent_name?.toLowerCase().includes(q))
      );
    if (linkModal === "Question")
      return questions.filter(q2 => !linkedIds("Question").has(q2.id) && q2.question_text?.toLowerCase().includes(q));
    return [];
  };

  const itemLabel = (item) => {
    if (linkModal === "DepoClip") return item.topic_tag ? `[${item.topic_tag}] ${item.clip_text?.slice(0, 100)}` : item.clip_text?.slice(0, 120);
    if (linkModal === "DepoExhibit") {
      const title = item.display_title || item.depo_exhibit_title;
      return `${item.depo_exhibit_no ? `[${item.depo_exhibit_no}] ` : ""}${title}${item.deponent_name ? ` · ${item.deponent_name}` : ""}`;
    }
    if (linkModal === "Question") return item.question_text?.slice(0, 120);
    return "";
  };

  if (!point) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <a href={createPageUrl("TrialPoints")} className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Trial Points
      </a>

      {/* Header */}
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

      {/* Tabs */}
      <Tabs defaultValue="clips">
        <TabsList className="bg-[#0f1629] border border-[#1e2a45] mb-4">
          <TabsTrigger value="clips" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Transcript Clips ({linkedClips.length})
          </TabsTrigger>
          <TabsTrigger value="exhibits" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Depo Exhibits ({linkedExhibits.length})
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

        {/* Exhibits */}
        <TabsContent value="exhibits">
          <div className="flex justify-end mb-3">
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setLinkModal("DepoExhibit"); setSearch(""); }}>
              <Link2 className="w-3.5 h-3.5 mr-1.5" /> Link Exhibit
            </Button>
          </div>
          <div className="space-y-2">
            {linkedExhibits.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No exhibits linked yet.</p>}
            {linkedExhibits.map(e => {
              const lk = links.find(l => l.entity_id === e.id);
              const title = e.display_title || e.depo_exhibit_title;
              return (
                <div key={e.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-4 flex gap-3 items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {e.depo_exhibit_no && <span className="text-[11px] font-mono text-slate-500">[{e.depo_exhibit_no}]</span>}
                      <p className="text-sm font-medium text-slate-200">{title}</p>
                    </div>
                    {e.deponent_name && <p className="text-xs text-slate-500 mt-0.5">{e.deponent_name}</p>}
                  </div>
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
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Link {linkModal === "DepoClip" ? "Transcript Clip" : linkModal === "DepoExhibit" ? "Depo Exhibit" : "Question"}</DialogTitle>
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
            {modalItems().slice(0, 50).map(item => (
              <button
                key={item.id}
                onClick={() => addLink(linkModal, item.id)}
                className="w-full text-left px-3 py-2.5 rounded bg-[#0f1629] hover:bg-cyan-600/20 border border-[#1e2a45] hover:border-cyan-500/40 text-sm text-slate-300 transition-colors"
              >
                {itemLabel(item)}
              </button>
            ))}
            {modalItems().length === 0 && <p className="text-slate-500 text-sm text-center py-6">No items found.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => { setLinkModal(null); setSearch(""); }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}