import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Swords } from "lucide-react";

export default function BattleCards() {
  const { activeCase } = useActiveCase();
  const [cards, setCards] = useState([]);
  const [parties, setParties] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    if (!activeCase) return;
    Promise.all([
      base44.entities.BattleCards.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
    ]).then(([c, p]) => { setCards(c); setParties(p); });
  };
  useEffect(load, [activeCase]);

  const getPartyName = (pid) => { const p = parties.find(x => x.id === pid); return p ? `${p.first_name} ${p.last_name}` : "—"; };

  const save = async () => {
    const data = { ...editing, case_id: activeCase.id };
    if (editing.id) await base44.entities.BattleCards.update(editing.id, data);
    else await base44.entities.BattleCards.create(data);
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete?")) return;
    await base44.entities.BattleCards.delete(id);
    load();
  };

  const plaintiffParties = parties.filter(p => p.side === "Plaintiff");
  const defenseParties = parties.filter(p => p.side === "Defense");

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Battle Cards</h1>
          <p className="text-sm text-slate-500">Expert vs Expert matchups</p>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { setEditing({ battle_role_title: "", plaintiff_party_id: "", defense_party_id: "", strategy_notes: "" }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Battle Card
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cards.map(c => (
          <Card key={c.id} className="bg-[#131a2e] border-[#1e2a45]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-cyan-400" />
                  <CardTitle className="text-base text-white">{c.battle_role_title}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-cyan-400" onClick={() => { setEditing({ ...c }); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400" onClick={() => remove(c.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                  <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-1">Plaintiff</p>
                  <p className="text-sm text-white">{getPartyName(c.plaintiff_party_id)}</p>
                </div>
                <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                  <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Defense</p>
                  <p className="text-sm text-white">{getPartyName(c.defense_party_id)}</p>
                </div>
              </div>
              {c.strategy_notes && <p className="text-xs text-slate-400 mt-3">{c.strategy_notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} Battle Card</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label className="text-slate-400 text-xs">Role Title (e.g., "Human Factors")</Label><Input value={editing.battle_role_title} onChange={e => setEditing({ ...editing, battle_role_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Plaintiff Expert</Label>
                  <Select value={editing.plaintiff_party_id || ""} onValueChange={v => setEditing({ ...editing, plaintiff_party_id: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{plaintiffParties.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Defense Expert</Label>
                  <Select value={editing.defense_party_id || ""} onValueChange={v => setEditing({ ...editing, defense_party_id: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{defenseParties.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-slate-400 text-xs">Strategy Notes</Label><Textarea value={editing.strategy_notes || ""} onChange={e => setEditing({ ...editing, strategy_notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={4} /></div>
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