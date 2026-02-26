import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Link2, Trash2, Users, Target, HelpCircle, FileText, Search, ExternalLink, Plus } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function ExhibitDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const exhibitId = urlParams.get("id");
  const { activeCase } = useActiveCase();

  const [exhibit, setExhibit] = useState(null);
  // Links FROM trial points to this exhibit (TrialPointLinks)
  const [tpLinks, setTpLinks] = useState([]);
  // Links FROM questions to this exhibit (QuestionLinks)
  const [qLinks, setQLinks] = useState([]);
  // DepoClip links (TrialPointLinks with entity_type DepoClip pointing to exhibit — we reuse a direct field)
  // Party usage
  const [partyUsages, setPartyUsages] = useState([]);

  const [trialPoints, setTrialPoints] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [parties, setParties] = useState([]);

  const [linkModal, setLinkModal] = useState(null); // "TrialPoint" | "Question"
  const [search, setSearch] = useState("");
  const [partyModal, setPartyModal] = useState(false);
  const [partyForm, setPartyForm] = useState({ party_id: "", depo_exhibit_number: "", depo_page_reference: "", notes: "" });

  const load = async () => {
    if (!exhibitId || !activeCase) return;
    const [ex, tpl, ql, pu, tp, qs, ps] = await Promise.all([
      base44.entities.MasterExhibits.filter({ id: exhibitId }),
      base44.entities.TrialPointLinks.filter({ entity_type: "MasterExhibit", entity_id: exhibitId }),
      base44.entities.QuestionLinks.filter({ link_type: "MasterExhibit", link_id: exhibitId }),
      base44.entities.ExhibitPartyUsage.filter({ exhibit_id: exhibitId }),
      base44.entities.TrialPoints.filter({ case_id: activeCase.id }),
      base44.entities.Questions.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
    ]);
    setExhibit(ex[0] || null);
    setTpLinks(tpl);
    setQLinks(ql);
    setPartyUsages(pu);
    setTrialPoints(tp);
    setQuestions(qs);
    setParties(ps);
  };

  useEffect(() => { load(); }, [exhibitId, activeCase]);

  const linkedTPIds = new Set(tpLinks.map(l => l.trial_point_id));
  const linkedQIds = new Set(qLinks.map(l => l.question_id));

  const linkedTPs = trialPoints.filter(p => linkedTPIds.has(p.id));
  const linkedQs = questions.filter(q => linkedQIds.has(q.id));

  const addTPLink = async (tpId) => {
    await base44.entities.TrialPointLinks.create({
      case_id: activeCase.id,
      trial_point_id: tpId,
      entity_type: "MasterExhibit",
      entity_id: exhibitId,
    });
    setLinkModal(null);
    setSearch("");
    load();
  };

  const removeTPLink = async (linkId) => {
    if (!confirm("Remove this link?")) return;
    await base44.entities.TrialPointLinks.delete(linkId);
    load();
  };

  const addQLink = async (qId) => {
    // Find the question's case_id
    const q = questions.find(q2 => q2.id === qId);
    await base44.entities.QuestionLinks.create({
      case_id: activeCase.id,
      question_id: qId,
      link_type: "MasterExhibit",
      link_id: exhibitId,
    });
    setLinkModal(null);
    setSearch("");
    load();
  };

  const removeQLink = async (linkId) => {
    if (!confirm("Remove this link?")) return;
    await base44.entities.QuestionLinks.delete(linkId);
    load();
  };

  const addPartyUsage = async () => {
    await base44.entities.ExhibitPartyUsage.create({
      case_id: activeCase.id,
      exhibit_id: exhibitId,
      ...partyForm,
    });
    setPartyModal(false);
    setPartyForm({ party_id: "", depo_exhibit_number: "", depo_page_reference: "", notes: "" });
    load();
  };

  const removePartyUsage = async (id) => {
    if (!confirm("Remove this party usage?")) return;
    await base44.entities.ExhibitPartyUsage.delete(id);
    load();
  };

  // Modal search
  const modalItems = () => {
    const q = search.toLowerCase();
    if (linkModal === "TrialPoint")
      return trialPoints.filter(p => !linkedTPIds.has(p.id) && p.point_text?.toLowerCase().includes(q));
    if (linkModal === "Question")
      return questions.filter(q2 => !linkedQIds.has(q2.id) && q2.question_text?.toLowerCase().includes(q));
    return [];
  };

  const partyName = (id) => {
    const p = parties.find(p => p.id === id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name}`.trim()) : id;
  };

  if (!exhibit) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <a href={createPageUrl("MasterExhibits")} className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Exhibits
      </a>

      {/* Header */}
      <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-white leading-snug mb-2">{exhibit.master_title}</p>
            {exhibit.master_description && <p className="text-sm text-slate-400 mb-3">{exhibit.master_description}</p>}
            <div className="flex gap-2 flex-wrap">
              {exhibit.provided_by_side && (
                <Badge variant="outline" className="text-xs text-slate-300 border-slate-600">{exhibit.provided_by_side}</Badge>
              )}
            </div>
          </div>
          {exhibit.file_url && (
            <a href={exhibit.file_url} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:text-white flex-shrink-0">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open File
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="parties">
        <TabsList className="bg-[#0f1629] border border-[#1e2a45] mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="parties" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Used With ({partyUsages.length})
          </TabsTrigger>
          <TabsTrigger value="trialpoints" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400">
            <Target className="w-3.5 h-3.5 mr-1.5" /> Trial Points ({linkedTPs.length})
          </TabsTrigger>
          <TabsTrigger value="questions" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400">
            <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> Questions ({linkedQs.length})
          </TabsTrigger>
        </TabsList>

        {/* Party Usage */}
        <TabsContent value="parties">
          <div className="flex justify-end mb-3">
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setPartyModal(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Party Usage
            </Button>
          </div>
          <div className="space-y-2">
            {partyUsages.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No party usage recorded yet.</p>}
            {partyUsages.map(pu => (
              <div key={pu.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-4 flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{partyName(pu.party_id)}</p>
                  <div className="flex gap-3 mt-1 text-xs text-slate-500">
                    {pu.depo_exhibit_number && <span>Exhibit #{pu.depo_exhibit_number}</span>}
                    {pu.depo_page_reference && <span>Page: {pu.depo_page_reference}</span>}
                  </div>
                  {pu.notes && <p className="text-xs text-slate-500 mt-1">{pu.notes}</p>}
                </div>
                <button onClick={() => removePartyUsage(pu.id)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Trial Points */}
        <TabsContent value="trialpoints">
          <div className="flex justify-end mb-3">
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setLinkModal("TrialPoint"); setSearch(""); }}>
              <Link2 className="w-3.5 h-3.5 mr-1.5" /> Link Trial Point
            </Button>
          </div>
          <div className="space-y-2">
            {linkedTPs.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No trial points linked yet.</p>}
            {linkedTPs.map(tp => {
              const lk = tpLinks.find(l => l.trial_point_id === tp.id);
              return (
                <div key={tp.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-4 flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">{tp.point_text}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">{tp.status}</Badge>
                      <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">{tp.priority}</Badge>
                    </div>
                  </div>
                  <a href={`${createPageUrl("TrialPointDetail")}?id=${tp.id}`} className="p-1 text-slate-500 hover:text-cyan-400"><ExternalLink className="w-4 h-4" /></a>
                  <button onClick={() => removeTPLink(lk?.id)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
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
            {linkedQs.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No questions linked yet.</p>}
            {linkedQs.map(q => {
              const lk = qLinks.find(l => l.question_id === q.id);
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
                  <button onClick={() => removeQLink(lk?.id)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Link Modal (Trial Point or Question) */}
      <Dialog open={!!linkModal} onOpenChange={() => { setLinkModal(null); setSearch(""); }}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Link {linkModal === "TrialPoint" ? "Trial Point" : "Question"}</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
          </div>
          <div className="overflow-y-auto flex-1 space-y-1.5">
            {modalItems().slice(0, 50).map(item => (
              <button
                key={item.id}
                onClick={() => linkModal === "TrialPoint" ? addTPLink(item.id) : addQLink(item.id)}
                className="w-full text-left px-3 py-2.5 rounded bg-[#0f1629] hover:bg-cyan-600/20 border border-[#1e2a45] hover:border-cyan-500/40 text-sm text-slate-300 transition-colors"
              >
                {linkModal === "TrialPoint" ? item.point_text?.slice(0, 120) : item.question_text?.slice(0, 120)}
              </button>
            ))}
            {modalItems().length === 0 && <p className="text-slate-500 text-sm text-center py-6">No items found.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => { setLinkModal(null); setSearch(""); }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Party Usage Modal */}
      <Dialog open={partyModal} onOpenChange={setPartyModal}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>Add Party Usage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-slate-400 text-xs">Party</Label>
              <Select value={partyForm.party_id} onValueChange={v => setPartyForm({ ...partyForm, party_id: v })}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select party…" /></SelectTrigger>
                <SelectContent>
                  {parties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name || `${p.first_name || ""} ${p.last_name}`.trim()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Depo Exhibit Number</Label>
              <Input value={partyForm.depo_exhibit_number} onChange={e => setPartyForm({ ...partyForm, depo_exhibit_number: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="e.g. 14" />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Page Reference (optional)</Label>
              <Input value={partyForm.depo_page_reference} onChange={e => setPartyForm({ ...partyForm, depo_page_reference: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="e.g. 42:10" />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Notes (optional)</Label>
              <Textarea value={partyForm.notes} onChange={e => setPartyForm({ ...partyForm, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setPartyModal(false)}>Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={addPartyUsage} disabled={!partyForm.party_id}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}