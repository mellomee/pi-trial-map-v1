import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, CheckCircle, Archive, GripVertical } from "lucide-react";
import TrialPointCategoriesManager from "@/components/settings/TrialPointCategoriesManager";

export default function SettingsPage() {
  const { activeCase, switchCase, refresh } = useActiveCase();
  const [cases, setCases] = useState([]);
  const [newName, setNewName] = useState("");

  const loadCases = async () => {
    const all = await base44.entities.Cases.list();
    setCases(all);
  };
  useEffect(() => { loadCases(); }, []);

  const createCase = async () => {
    if (!newName.trim()) return;
    const c = await base44.entities.Cases.create({ name: newName.trim(), archived: false });
    setNewName("");
    loadCases();
    await switchCase(c.id);
  };

  const activate = async (id) => {
    await switchCase(id);
  };

  const archiveCase = async (id) => {
    if (!confirm("Archive this case?")) return;
    await base44.entities.Cases.update(id, { archived: true });
    if (activeCase?.id === id) {
      const remaining = cases.filter(c => c.id !== id && !c.archived);
      await switchCase(remaining.length ? remaining[0].id : null);
    }
    loadCases();
  };

  const [wipingId, setWipingId] = useState(null);
  const [wipeProgress, setWipeProgress] = useState("");

  const wipeCase = async (id) => {
    if (!confirm("This will DELETE all data for this case (parties, transcripts, exhibits, etc). Continue?")) return;
    if (!confirm("Are you SURE? This cannot be undone.")) return;
    setWipingId(id);
    let index = 0;
    let done = false;
    while (!done) {
      setWipeProgress(`Wiping... (${index}/15)`);
      const res = await base44.functions.invoke("wipeCase", { case_id: id, entity_index: index });
      const data = res.data;
      done = data.done;
      index = data.next_index;
    }
    setWipingId(null);
    setWipeProgress("");
    refresh();
    alert("Case data wiped.");
  };

  const activeCases = cases.filter(c => !c.archived);
  const archivedCases = cases.filter(c => c.archived);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-8">Manage cases and app configuration</p>

      <Card className="bg-[#131a2e] border-[#1e2a45] mb-6">
        <CardHeader><CardTitle className="text-white text-base">Create New Case</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Case name..." className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" onKeyDown={e => e.key === "Enter" && createCase()} />
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={createCase}><Plus className="w-4 h-4 mr-2" /> Create</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#131a2e] border-[#1e2a45] mb-6">
        <CardHeader><CardTitle className="text-white text-base">Active Cases</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {activeCases.map(c => (
            <div key={c.id} className={`flex items-center justify-between p-3 rounded-lg border ${activeCase?.id === c.id ? "border-cyan-500/50 bg-cyan-500/5" : "border-[#1e2a45]"}`}>
              <div className="flex items-center gap-3">
                {activeCase?.id === c.id && <CheckCircle className="w-4 h-4 text-cyan-400" />}
                <span className="text-sm text-white">{c.name}</span>
                {activeCase?.id === c.id && <Badge className="bg-cyan-500/20 text-cyan-400 text-[10px]">Active</Badge>}
              </div>
              <div className="flex gap-2">
                {activeCase?.id !== c.id && (
                  <Button size="sm" variant="outline" className="h-7 text-xs border-cyan-600 text-cyan-400" onClick={() => activate(c.id)}>Activate</Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-amber-400" onClick={() => archiveCase(c.id)}>
                  <Archive className="w-3 h-3 mr-1" /> Archive
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-red-400" onClick={() => wipeCase(c.id)} disabled={wipingId === c.id}>
                  <Trash2 className="w-3 h-3 mr-1" /> {wipingId === c.id ? wipeProgress : "Clear Case Data"}
                </Button>
              </div>
            </div>
          ))}
          {activeCases.length === 0 && <p className="text-sm text-slate-500">No cases yet. Create one above.</p>}
        </CardContent>
      </Card>

      {archivedCases.length > 0 && (
        <Card className="bg-[#131a2e] border-[#1e2a45] mb-6">
          <CardHeader><CardTitle className="text-white text-base">Archived</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {archivedCases.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-[#1e2a45]">
                <span className="text-sm text-slate-500">{c.name}</span>
                <Button size="sm" variant="outline" className="h-7 text-xs border-slate-600 text-slate-400" onClick={async () => { await base44.entities.Cases.update(c.id, { archived: false }); loadCases(); }}>Unarchive</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Trial Point Categories — only show when a case is active */}
      {activeCase && (
        <TrialPointCategoriesManager caseId={activeCase.id} />
      )}
    </div>
  );
}