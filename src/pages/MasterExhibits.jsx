import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Pencil, Trash2, Search, ExternalLink, Upload } from "lucide-react";

const sideColors = {
  Plaintiff: "bg-amber-500/20 text-amber-400",
  Defense: "bg-red-500/20 text-red-400",
  Independent: "bg-purple-500/20 text-purple-400",
  Unknown: "bg-slate-500/20 text-slate-400",
};

const EMPTY = { master_title: "", master_description: "", provided_by_side: "Unknown", file_url: "", notes: "" };

export default function MasterExhibits() {
  const { activeCase } = useActiveCase();
  const [exhibits, setExhibits] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [links, setLinks] = useState([]);
  const [parties, setParties] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    Promise.all([
      base44.entities.MasterExhibits.filter({ case_id: cid }),
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
      base44.entities.ExhibitLinks.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
    ]).then(([me, de, el, p]) => { setExhibits(me); setDepoExhibits(de); setLinks(el); setParties(p); });
  };
  useEffect(load, [activeCase]);

  const save = async () => {
    const data = { ...editing, case_id: activeCase.id };
    if (editing.id) await base44.entities.MasterExhibits.update(editing.id, data);
    else await base44.entities.MasterExhibits.create(data);
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this exhibit?")) return;
    await base44.entities.MasterExhibits.delete(id);
    load();
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEditing(prev => ({ ...prev, file_url }));
    setUploading(false);
  };

  const getLinkedDepoExhibits = (masterId) => {
    return links.filter(l => l.master_exhibit_id === masterId).map(l => {
      const de = depoExhibits.find(d => d.id === l.deposition_exhibit_id);
      const party = parties.find(p => p.id === l.deponent_party_id);
      return { ...l, depoExhibit: de, party };
    });
  };

  const filtered = exhibits.filter(e => !search || e.master_title?.toLowerCase().includes(search.toLowerCase()));

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Master Exhibit Library</h1>
          <p className="text-sm text-slate-500">{exhibits.length} exhibits</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setEditing({ ...EMPTY }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Exhibit
        </Button>
      </div>

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
        <Input placeholder="Search exhibits..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
      </div>

      <div className="space-y-2">
        {filtered.map(ex => {
          const linkedDepos = getLinkedDepoExhibits(ex.id);
          return (
            <Accordion key={ex.id} type="single" collapsible>
              <AccordionItem value={ex.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <div className="flex-1">
                      <span className="text-sm text-white font-medium">{ex.master_title}</span>
                      <div className="flex gap-2 mt-1">
                        <Badge className={sideColors[ex.provided_by_side]}>{ex.provided_by_side}</Badge>
                        {linkedDepos.length > 0 && <Badge variant="outline" className="text-slate-500 border-slate-600 text-[10px]">{linkedDepos.length} depo refs</Badge>}
                        {ex.file_url && <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">File attached</Badge>}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {ex.master_description && <p className="text-xs text-slate-400 mb-3">{ex.master_description}</p>}
                  {ex.file_url && (
                    <a href={ex.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline flex items-center gap-1 mb-3">
                      <ExternalLink className="w-3 h-3" /> View File
                    </a>
                  )}
                  {linkedDepos.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-slate-300 mb-1">Deposition References:</p>
                      {linkedDepos.map((ld, i) => (
                        <p key={i} className="text-xs text-slate-400 ml-2">
                          {ld.party ? `${ld.party.first_name} ${ld.party.last_name}` : "Unknown"}: Exh {ld.depo_exhibit_no} "{ld.depo_exhibit_title}"
                        </p>
                      ))}
                    </div>
                  )}
                  {ex.notes && <p className="text-xs text-slate-500 mb-3">{ex.notes}</p>}
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-cyan-400 h-7" onClick={() => { setEditing({ ...ex }); setOpen(true); }}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 h-7" onClick={() => remove(ex.id)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} Exhibit</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label className="text-slate-400 text-xs">Title</Label><Input value={editing.master_title} onChange={e => setEditing({ ...editing, master_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" /></div>
              <div><Label className="text-slate-400 text-xs">Description</Label><Textarea value={editing.master_description || ""} onChange={e => setEditing({ ...editing, master_description: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} /></div>
              <div>
                <Label className="text-slate-400 text-xs">Side</Label>
                <Select value={editing.provided_by_side} onValueChange={v => setEditing({ ...editing, provided_by_side: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Plaintiff","Defense","Independent","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-xs">File</Label>
                <div className="flex gap-2">
                  <Input value={editing.file_url || ""} onChange={e => setEditing({ ...editing, file_url: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 flex-1" placeholder="URL or upload" />
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="border-slate-600" disabled={uploading} asChild>
                      <span><Upload className="w-3 h-3 mr-1" />{uploading ? "..." : "Upload"}</span>
                    </Button>
                    <input type="file" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
                  </label>
                </div>
              </div>
              <div><Label className="text-slate-400 text-xs">Notes</Label><Textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}