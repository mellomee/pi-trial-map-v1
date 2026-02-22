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
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";

const sideColors = {
  Plaintiff: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Defense: "bg-red-500/20 text-red-400 border-red-500/30",
  Independent: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Unknown: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const EMPTY = { first_name: "", last_name: "", credential_text: "", role_title: "", side: "Unknown", party_type: "", display_name: "", notes: "" };

export default function Parties() {
  const { activeCase } = useActiveCase();
  const [parties, setParties] = useState([]);
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    if (!activeCase) return;
    base44.entities.Parties.filter({ case_id: activeCase.id }).then(setParties);
  };
  useEffect(load, [activeCase]);

  const save = async () => {
    const data = { ...editing, case_id: activeCase.id };
    if (!data.display_name) data.display_name = `${data.first_name} ${data.last_name}`.trim();
    if (editing.id) {
      await base44.entities.Parties.update(editing.id, data);
    } else {
      await base44.entities.Parties.create(data);
    }
    setOpen(false);
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this party?")) return;
    await base44.entities.Parties.delete(id);
    load();
  };

  const filtered = parties.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${p.first_name} ${p.last_name} ${p.role_title}`.toLowerCase().includes(q);
    const matchSide = sideFilter === "all" || p.side === sideFilter;
    return matchSearch && matchSide;
  });

  if (!activeCase) return <div className="p-8 text-slate-400">No active case. Go to Settings.</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Parties</h1>
          <p className="text-sm text-slate-500">{parties.length} total</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setEditing({ ...EMPTY }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Party
        </Button>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Search parties..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
        </div>
        <Select value={sideFilter} onValueChange={setSideFilter}>
          <SelectTrigger className="w-40 bg-[#131a2e] border-[#1e2a45] text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sides</SelectItem>
            <SelectItem value="Plaintiff">Plaintiff</SelectItem>
            <SelectItem value="Defense">Defense</SelectItem>
            <SelectItem value="Independent">Independent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => (
          <Card key={p.id} className="bg-[#131a2e] border-[#1e2a45] hover:border-cyan-500/30 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base text-white">
                    {p.display_name || `${p.first_name} ${p.last_name}`}
                    {p.credential_text && p.credential_text !== "None" && <span className="text-slate-500 text-xs ml-1">, {p.credential_text}</span>}
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">{p.role_title}</p>
                </div>
                <Badge className={`${sideColors[p.side] || sideColors.Unknown} text-[10px] border`}>{p.side}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {p.party_type && <p className="text-xs text-slate-400 mb-2">{p.party_type}</p>}
              {p.notes && <p className="text-xs text-slate-500 line-clamp-2">{p.notes}</p>}
              <div className="flex gap-2 mt-3">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-cyan-400 h-7 px-2" onClick={() => { setEditing({ ...p }); setOpen(true); }}>
                  <Pencil className="w-3 h-3 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 h-7 px-2" onClick={() => remove(p.id)}>
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Party" : "Add Party"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">First Name</Label>
                  <Input value={editing.first_name} onChange={e => setEditing({ ...editing, first_name: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Last Name</Label>
                  <Input value={editing.last_name} onChange={e => setEditing({ ...editing, last_name: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Credentials</Label>
                  <Input value={editing.credential_text} onChange={e => setEditing({ ...editing, credential_text: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Side</Label>
                  <Select value={editing.side} onValueChange={v => setEditing({ ...editing, side: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Plaintiff">Plaintiff</SelectItem>
                      <SelectItem value="Defense">Defense</SelectItem>
                      <SelectItem value="Independent">Independent</SelectItem>
                      <SelectItem value="Unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Role Title</Label>
                  <Input value={editing.role_title} onChange={e => setEditing({ ...editing, role_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Party Type</Label>
                  <Input value={editing.party_type} onChange={e => setEditing({ ...editing, party_type: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Notes</Label>
                <Textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
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