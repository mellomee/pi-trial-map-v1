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
import { Plus, Pencil, Trash2, Search, CheckSquare } from "lucide-react";

export default function AdmittedExhibits() {
  const { activeCase } = useActiveCase();
  const [admitted, setAdmitted] = useState([]);
  const [joints, setJoints] = useState([]);
  const [masters, setMasters] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    Promise.all([
      base44.entities.AdmittedExhibits.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.MasterExhibits.filter({ case_id: cid }),
    ]).then(([a, j, m]) => { setAdmitted(a); setJoints(j); setMasters(m); });
  };
  useEffect(load, [activeCase]);

  const save = async () => {
    const data = { ...editing, case_id: activeCase.id };
    if (!data.date_admitted) data.date_admitted = new Date().toISOString().split("T")[0];
    if (editing.id) await base44.entities.AdmittedExhibits.update(editing.id, data);
    else {
      await base44.entities.AdmittedExhibits.create(data);
      // Update joint exhibit status
      if (data.joint_exhibit_id) {
        await base44.entities.JointExhibits.update(data.joint_exhibit_id, { status: "Admitted" });
      }
    }
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete?")) return;
    await base44.entities.AdmittedExhibits.delete(id);
    load();
  };

  const getJointInfo = (jid) => {
    const j = joints.find(x => x.id === jid);
    if (!j) return { markedNo: "?", title: "Unknown", masterTitle: "" };
    const m = masters.find(x => x.id === j.master_exhibit_id);
    return { markedNo: j.marked_no, title: j.marked_title, masterTitle: m?.master_title || "" };
  };

  const admittedJointIds = new Set(admitted.map(a => a.joint_exhibit_id));
  const availableJoints = joints.filter(j => !admittedJointIds.has(j.id) || editing?.joint_exhibit_id === j.id);

  const filtered = admitted.filter(a => {
    const info = getJointInfo(a.joint_exhibit_id);
    return !search || info.title.toLowerCase().includes(search.toLowerCase()) || a.admitted_no.includes(search);
  });

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Admitted Exhibits</h1>
          <p className="text-sm text-slate-500">Jury exhibit list</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setEditing({ joint_exhibit_id: "", admitted_no: "", admitted_by_side: "Plaintiff", date_admitted: new Date().toISOString().split("T")[0], notes: "" }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Admit Exhibit
        </Button>
      </div>

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
        <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
      </div>

      <div className="space-y-2">
        {filtered.map(a => {
          const info = getJointInfo(a.joint_exhibit_id);
          return (
            <Card key={a.id} className="bg-[#131a2e] border-[#1e2a45]">
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-400">#{a.admitted_no}</p>
                    <p className="text-[10px] text-slate-500">Jury</p>
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{info.title}</p>
                    <p className="text-xs text-slate-500">
                      Marked #{info.markedNo} · Originally: {info.masterTitle}
                    </p>
                    <p className="text-xs text-slate-500">Admitted: {a.date_admitted}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-slate-500 border-slate-600 text-xs">{a.admitted_by_side}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-cyan-400" onClick={() => { setEditing({ ...a }); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400" onClick={() => remove(a.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Admit"} Exhibit</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-slate-400 text-xs">Joint Exhibit</Label>
                <Select value={editing.joint_exhibit_id} onValueChange={v => setEditing({ ...editing, joint_exhibit_id: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{availableJoints.map(j => <SelectItem key={j.id} value={j.id}>#{j.marked_no} - {j.marked_title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-slate-400 text-xs">Admitted #</Label><Input value={editing.admitted_no} onChange={e => setEditing({ ...editing, admitted_no: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" /></div>
                <div><Label className="text-slate-400 text-xs">Date</Label><Input type="date" value={editing.date_admitted || ""} onChange={e => setEditing({ ...editing, date_admitted: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" /></div>
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Admitted By</Label>
                <Select value={editing.admitted_by_side} onValueChange={v => setEditing({ ...editing, admitted_by_side: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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