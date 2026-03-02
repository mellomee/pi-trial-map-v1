import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Layers, FileText, BookOpen, Trash2, Edit2, AlertCircle
} from "lucide-react";

export default function EvidenceWorkspace() {
  const { activeCase } = useActiveCase();
  const [evidenceGroups, setEvidenceGroups] = useState([]);
  const [proofItems, setProofItems] = useState([]);
  const [parties, setParties] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({ name: "", description: "" });

  useEffect(() => {
    if (!activeCase) return;
    loadData();
  }, [activeCase]);

  const loadData = async () => {
    const cid = activeCase.id;
    const [eg, pi, p, tp] = await Promise.all([
      base44.entities.EvidenceGroups.filter({ case_id: cid }),
      base44.entities.ProofItems.list(),
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.TrialPoints.filter({ case_id: cid }),
    ]);
    setEvidenceGroups(eg);
    setProofItems(pi);
    setParties(p);
    setTrialPoints(tp);
    if (eg.length > 0) setSelectedGroup(eg[0]);
  };

  const createGroup = async () => {
    if (!newGroupForm.name.trim()) return;
    const group = await base44.entities.EvidenceGroups.create({
      case_id: activeCase.id,
      name: newGroupForm.name,
      description: newGroupForm.description,
      trial_point_ids: [],
      default_testify_party_ids: [],
    });
    setEvidenceGroups(prev => [...prev, group]);
    setSelectedGroup(group);
    setNewGroupForm({ name: "", description: "" });
    setNewGroupOpen(false);
  };

  const deleteGroup = async (groupId) => {
    if (!confirm("Delete this evidence group?")) return;
    await base44.entities.EvidenceGroups.delete(groupId);
    setEvidenceGroups(prev => prev.filter(g => g.id !== groupId));
    if (selectedGroup?.id === groupId) {
      setSelectedGroup(evidenceGroups.find(g => g.id !== groupId) || null);
    }
  };

  const groupProofItems = selectedGroup
    ? proofItems.filter(p => p.evidence_group_id === selectedGroup.id)
    : [];

  const filteredGroups = evidenceGroups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const partyName = (id) => {
    const p = parties.find(x => x.id === id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : "—";
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          <h1 className="text-xl font-bold text-white">Evidence Workspace</h1>
        </div>
        <Button
          onClick={() => setNewGroupOpen(true)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> New Group
        </Button>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Left: Evidence Groups List */}
        <div className="w-80 flex flex-col bg-[#131a2e] border border-[#1e2a45] rounded-lg flex-shrink-0 overflow-hidden">
          <div className="p-3 border-b border-[#1e2a45] flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-600" />
              <Input
                placeholder="Search groups…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredGroups.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">No evidence groups yet.</div>
            ) : (
              filteredGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  className={`w-full text-left px-4 py-3 border-b border-[#1e2a45] transition-colors ${
                    selectedGroup?.id === group.id
                      ? "bg-cyan-500/10 border-l-2 border-l-cyan-400"
                      : "hover:bg-white/5 border-l-2 border-l-transparent"
                  }`}
                >
                  <p className="font-medium text-sm text-white line-clamp-1">{group.name}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{group.description || "—"}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {group.trial_point_ids && group.trial_point_ids.length > 0 && (
                      <Badge className="bg-cyan-600/20 text-cyan-400 text-[9px]">
                        {group.trial_point_ids.length} TP
                      </Badge>
                    )}
                    {group.default_testify_party_ids && group.default_testify_party_ids.length > 0 && (
                      <Badge className="bg-green-600/20 text-green-400 text-[9px]">
                        {group.default_testify_party_ids.length} witness
                      </Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Group Details */}
        {selectedGroup ? (
          <div className="flex-1 flex flex-col bg-[#131a2e] border border-[#1e2a45] rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1e2a45] bg-[#0f1629] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedGroup.name}</h2>
                {selectedGroup.description && (
                  <p className="text-sm text-slate-400 mt-1">{selectedGroup.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="border-slate-700 text-slate-400 hover:text-slate-200">
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-700/40 text-red-400 hover:bg-red-900/20"
                  onClick={() => deleteGroup(selectedGroup.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Trial Points */}
              <div>
                <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-1">
                  <FileText className="w-4 h-4" /> Trial Points ({selectedGroup.trial_point_ids?.length || 0})
                </h3>
                {selectedGroup.trial_point_ids && selectedGroup.trial_point_ids.length > 0 ? (
                  <div className="space-y-2">
                    {selectedGroup.trial_point_ids.map(tpId => {
                      const tp = trialPoints.find(t => t.id === tpId);
                      return (
                        <div key={tpId} className="bg-[#0a0f1e] border border-[#1e2a45] rounded p-3">
                          <p className="text-sm text-white">{tp?.point_text || "—"}</p>
                          {tp?.status && (
                            <Badge className="mt-2 text-xs bg-slate-600/20 text-slate-300">{tp.status}</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No trial points linked.</p>
                )}
              </div>

              {/* Witnesses */}
              <div>
                <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-1">
                  <BookOpen className="w-4 h-4" /> Witnesses ({selectedGroup.default_testify_party_ids?.length || 0})
                </h3>
                {selectedGroup.default_testify_party_ids && selectedGroup.default_testify_party_ids.length > 0 ? (
                  <div className="space-y-2">
                    {selectedGroup.default_testify_party_ids.map(partyId => (
                      <Badge key={partyId} className="bg-green-600/20 text-green-400 text-xs">
                        {partyName(partyId)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No witnesses assigned.</p>
                )}
              </div>

              {/* Proof Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-1">
                    <FileText className="w-4 h-4" /> Proof Items ({groupProofItems.length})
                  </h3>
                  <Button size="sm" className="bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Add Proof
                  </Button>
                </div>
                {groupProofItems.length === 0 ? (
                  <div className="bg-[#0a0f1e] border border-dashed border-[#1e2a45] rounded p-4 text-center">
                    <AlertCircle className="w-4 h-4 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No proof items in this group.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupProofItems.map(proof => (
                      <div key={proof.id} className="bg-[#0a0f1e] border border-[#1e2a45] rounded p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">{proof.title}</p>
                            <Badge className="mt-1 text-xs bg-slate-600/20 text-slate-300">
                              {proof.proof_type}
                            </Badge>
                            {proof.notes && (
                              <p className="text-xs text-slate-400 mt-1 italic">{proof.notes}</p>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" className="text-slate-600 hover:text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <p>Select or create an evidence group to begin.</p>
          </div>
        )}
      </div>

      {/* New Group Dialog */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle>New Evidence Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-400">Group Name</Label>
              <Input
                value={newGroupForm.name}
                onChange={e => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
                placeholder="e.g., Scene Photos"
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1"
                onKeyDown={e => e.key === "Enter" && createGroup()}
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Description (optional)</Label>
              <Textarea
                value={newGroupForm.description}
                onChange={e => setNewGroupForm({ ...newGroupForm, description: e.target.value })}
                placeholder="What is this evidence group about?"
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1 resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={createGroup}
              disabled={!newGroupForm.name.trim()}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}