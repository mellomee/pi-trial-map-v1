import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

const statusColors = {
  NotUsed: "bg-slate-500/20 text-slate-400",
  Marked: "bg-cyan-500/20 text-cyan-400",
  Offered: "bg-blue-500/20 text-blue-400",
  Admitted: "bg-green-500/20 text-green-400",
  Excluded: "bg-red-500/20 text-red-400",
  Withdrawn: "bg-yellow-500/20 text-yellow-400",
};

export default function JointExhibits() {
  const { activeCase } = useActiveCase();
  const [joints, setJoints] = useState([]);
  const [masters, setMasters] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    Promise.all([
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.MasterExhibits.filter({ case_id: cid }),
    ]).then(([j, m]) => { setJoints(j); setMasters(m); });
  };
  useEffect(load, [activeCase]);

  const save = async () => {
    const data = { ...editing, case_id: activeCase.id };
    if (editing.id) await base44.entities.JointExhibits.update(editing.id, data);
    else await base44.entities.JointExhibits.create(data);
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete?")) return;
    await base44.entities.JointExhibits.delete(id);
    load();
  };

  const getMasterTitle = (mid) => masters.find(m => m.id === mid)?.master_title || "Unknown";
  const filtered = joints.filter(j => !search || j.marked_title?.toLowerCase().includes(search.toLowerCase()) || getMasterTitle(j.master_exhibit_id).toLowerCase().includes(search.toLowerCase()));

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Joint Exhibit List</h1>
          <p className="text-sm text-slate-500">Marked exhibits for trial</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setEditing({ master_exhibit_id: "", marked_no: "", marked_title: "", marked_by_side: "Plaintiff", status: "Marked", notes: "" }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Joint Exhibit
        </Button>
      </div>

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
        <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
      </div>

      <div className="space-y-2">
        {filtered.map(j => (
          <Card key={j.id} className="bg-[#131a2e] border-[#1e2a45]">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-cyan-400 min-w-[60px]">#{j.marked_no}</span>
                <div>
                  <p className="text-sm text-white font-medium">{j.marked_title}</p>
                  <p className="text-xs text-slate-500">From: {getMasterTitle(j.master_exhibit_id)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusColors[j.status]}>{j.status}</Badge>
                <Badge variant="outline" className="text-slate-500 border-slate-600 text-xs">{j.marked_by_side}</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-cyan-400" onClick={() => { setEditing({ ...j }); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400" onClick={() => remove(j.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} Joint Exhibit</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-slate-400 text-xs">Master Exhibit</Label>
                <Select value={editing.master_exhibit_id} onValueChange={v => setEditing({ ...editing, master_exhibit_id: v, marked_title: editing.marked_title || masters.find(m => m.id === v)?.master_title || "" })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{masters.map(m => <SelectItem key={m.id} value={m.id}>{m.master_title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-slate-400 text-xs">Marked #</Label><Input value={editing.marked_no} onChange={e => setEditing({ ...editing, marked_no: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" /></div>
                <div><Label className="text-slate-400 text-xs">Title</Label><Input value={editing.marked_title} onChange={e => setEditing({ ...editing, marked_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Marked By</Label>
                  <Select value={editing.marked_by_side} onValueChange={v => setEditing({ ...editing, marked_by_side: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Status</Label>
                  <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{["NotUsed","Marked","Offered","Admitted","Excluded","Withdrawn"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
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