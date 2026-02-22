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
import { Plus, Pencil, Trash2, Target, Search } from "lucide-react";

const themeColors = {
  Liability: "bg-red-500/20 text-red-400",
  Causation: "bg-orange-500/20 text-orange-400",
  Damages: "bg-amber-500/20 text-amber-400",
  Credibility: "bg-purple-500/20 text-purple-400",
  Defense: "bg-blue-500/20 text-blue-400",
  Other: "bg-slate-500/20 text-slate-400",
};

const statusColors = {
  Missing: "border-red-500/40 text-red-400",
  In: "border-green-500/40 text-green-400",
  Disputed: "border-amber-500/40 text-amber-400",
  NeedsRehab: "border-purple-500/40 text-purple-400",
};

const EMPTY = { theme: "Liability", point_text: "", priority: "Med", status: "Missing", notes: "" };

export default function TrialPoints() {
  const { activeCase } = useActiveCase();
  const [points, setPoints] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    if (!activeCase) return;
    base44.entities.TrialPoints.filter({ case_id: activeCase.id }).then(setPoints);
  };
  useEffect(load, [activeCase]);

  const save = async () => {
    const data = { ...editing, case_id: activeCase.id };
    if (editing.id) await base44.entities.TrialPoints.update(editing.id, data);
    else await base44.entities.TrialPoints.create(data);
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this trial point?")) return;
    await base44.entities.TrialPoints.delete(id);
    load();
  };

  const filtered = points.filter(p => !search || p.point_text?.toLowerCase().includes(search.toLowerCase()));

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Trial Points</h1>
          <p className="text-sm text-slate-500">Key facts to prove at trial</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setEditing({ ...EMPTY }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Point
        </Button>
      </div>

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
        <Input placeholder="Search points..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
      </div>

      <div className="space-y-3">
        {filtered.map(p => (
          <Card key={p.id} className="bg-[#131a2e] border-[#1e2a45]">
            <CardContent className="py-4 flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <Target className="w-4 h-4 text-cyan-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">{p.point_text}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge className={themeColors[p.theme]}>{p.theme}</Badge>
                    <Badge variant="outline" className={statusColors[p.status]}>{p.status}</Badge>
                    <Badge variant="outline" className="text-slate-500 border-slate-600">{p.priority}</Badge>
                  </div>
                  {p.notes && <p className="text-xs text-slate-500 mt-2">{p.notes}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-cyan-400" onClick={() => { setEditing({ ...p }); setOpen(true); }}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400" onClick={() => remove(p.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} Trial Point</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label className="text-slate-400 text-xs">Point</Label><Textarea value={editing.point_text} onChange={e => setEditing({ ...editing, point_text: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Theme</Label>
                  <Select value={editing.theme} onValueChange={v => setEditing({ ...editing, theme: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Liability","Causation","Damages","Credibility","Defense","Other"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Priority</Label>
                  <Select value={editing.priority} onValueChange={v => setEditing({ ...editing, priority: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{["High","Med","Low"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Status</Label>
                  <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Missing","In","Disputed","NeedsRehab"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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