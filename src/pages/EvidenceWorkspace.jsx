import React, { useState, useEffect, useMemo } from "react";
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
  Plus, Search, Layers, Trash2, Edit2, AlertCircle, Eye, FileText, Film, BookOpen
} from "lucide-react";
import AddProofWizard from "@/components/evidence/AddProofWizard.jsx";
import ProofPreviewPanel from "@/components/evidence/ProofPreviewPanel.jsx";

export default function EvidenceWorkspace() {
  const { activeCase } = useActiveCase();
  const [evidenceGroups, setEvidenceGroups] = useState([]);
  const [proofItems, setProofItems] = useState([]);
  const [parties, setParties] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);
  const [depositions, setDepositions] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [callouts, setCallouts] = useState([]);
  const [depoClips, setDepoClips] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({ name: "", description: "" });
  const [addProofWizardOpen, setAddProofWizardOpen] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState(null);
  const [filterWitness, setFilterWitness] = useState("all");
  const [previewProof, setPreviewProof] = useState(null);

  useEffect(() => {
    if (!activeCase) return;
    loadData();
  }, [activeCase]);

  const loadData = async () => {
    const cid = activeCase.id;
    const [eg, pi, p, tp, dep, ex, co, dc, depo] = await Promise.all([
      base44.entities.EvidenceGroups.filter({ case_id: cid }),
      base44.entities.ProofItems.list(),
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.TrialPoints.filter({ case_id: cid }),
      base44.entities.Depositions.filter({ case_id: cid }),
      base44.entities.ExhibitExtracts.filter({ case_id: cid }),
      base44.entities.ExtractCallout.list(),
      base44.entities.DepoClips.filter({ case_id: cid }),
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
    ]);
    setEvidenceGroups(eg);
    setProofItems(pi);
    setParties(p);
    setTrialPoints(tp);
    setDepositions(dep);
    setExtracts(ex);
    setCallouts(co);
    setDepoClips(dc);
    setDepoExhibits(depo);
    if (eg.length > 0 && !selectedGroup) setSelectedGroup(eg[0]);
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

  const updateGroup = async () => {
    if (!editGroupForm) return;
    await base44.entities.EvidenceGroups.update(editGroupForm.id, {
      trial_point_ids: editGroupForm.trial_point_ids,
      default_testify_party_ids: editGroupForm.default_testify_party_ids,
    });
    setEvidenceGroups(prev => prev.map(g => g.id === editGroupForm.id ? editGroupForm : g));
    setSelectedGroup(editGroupForm);
    setEditGroupOpen(false);
  };

  const deleteGroup = async (groupId) => {
    if (!confirm("Delete this evidence group?")) return;
    await base44.entities.EvidenceGroups.delete(groupId);
    setEvidenceGroups(prev => prev.filter(g => g.id !== groupId));
    if (selectedGroup?.id === groupId) {
      setSelectedGroup(evidenceGroups.find(g => g.id !== groupId) || null);
    }
  };

  const deleteProofItem = async (proofId) => {
    if (!confirm("Delete this proof item?")) return;
    await base44.entities.ProofItems.delete(proofId);
    setProofItems(prev => prev.filter(p => p.id !== proofId));
  };

  const onProofAdded = async () => {
    await loadData();
    setAddProofWizardOpen(false);
  };

  const groupProofItems = selectedGroup
    ? proofItems.filter(p => p.evidence_group_id === selectedGroup.id)
    : [];

  const filteredProofItems = useMemo(() => {
    if (filterWitness === "all") return groupProofItems;
    return groupProofItems.filter(p =>
      p.testify_party_ids && p.testify_party_ids.includes(filterWitness)
    );
  }, [groupProofItems, filterWitness]);

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
              filteredGroups.map(group => {
                const groupProof = proofItems.filter(p => p.evidence_group_id === group.id);
                return (
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
                      {groupProof.length > 0 && (
                        <Badge className="bg-amber-600/20 text-amber-400 text-[9px]">
                          {groupProof.length} proof
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })
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
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700 text-slate-400 hover:text-slate-200"
                  onClick={() => {
                    setEditGroupForm({ ...selectedGroup });
                    setEditGroupOpen(true);
                  }}
                >
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
                    <FileText className="w-4 h-4" /> Proof Items ({filteredProofItems.length})
                  </h3>
                  <Button
                    size="sm"
                    className="bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 text-xs"
                    onClick={() => setAddProofWizardOpen(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Proof
                  </Button>
                </div>

                {/* Witness Filter */}
                {groupProofItems.length > 0 && (
                  <div className="mb-4">
                    <Select value={filterWitness} onValueChange={setFilterWitness}>
                      <SelectTrigger className="h-8 text-xs bg-[#0a0f1e] border-[#1e2a45] text-slate-200">
                        <SelectValue placeholder="Filter by witness" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Witnesses</SelectItem>
                        {parties.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {partyName(p.id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {filteredProofItems.length === 0 ? (
                  <div className="bg-[#0a0f1e] border border-dashed border-[#1e2a45] rounded p-4 text-center">
                    <AlertCircle className="w-4 h-4 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No proof items in this group.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredProofItems.map(proof => {
                      const witnesses = proof.testify_party_ids?.map(pid => partyName(pid)).filter(Boolean) || [];
                      return (
                        <div key={proof.id} className="bg-[#0a0f1e] border border-[#1e2a45] rounded p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {proof.proof_type === "DEPO_CLIP" ? (
                                  <Film className="w-4 h-4 text-violet-400 flex-shrink-0" />
                                ) : (
                                  <Eye className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                                )}
                                <p className="text-sm font-medium text-white">{proof.title}</p>
                              </div>
                              <Badge className="mt-1 text-xs bg-slate-600/20 text-slate-300">
                                {proof.proof_type}
                              </Badge>
                              {proof.notes && (
                                <p className="text-xs text-slate-400 mt-1 italic">{proof.notes}</p>
                              )}
                              {witnesses.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {witnesses.map(w => (
                                    <Badge key={w} className="bg-green-600/20 text-green-400 text-[9px]">
                                      {w}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-cyan-400 hover:text-cyan-300 text-xs h-7"
                                onClick={() => setPreviewProof(proof)}
                              >
                                Preview
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-600 hover:text-red-400 h-7"
                                onClick={() => deleteProofItem(proof.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

      {/* Edit Group Dialog */}
      <Dialog open={editGroupOpen} onOpenChange={setEditGroupOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Evidence Group</DialogTitle>
          </DialogHeader>
          {editGroupForm && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-slate-400">Trial Points</Label>
                <Select
                  value={editGroupForm.trial_point_ids?.[0] || ""}
                  onValueChange={v => {
                    if (!v) setEditGroupForm({ ...editGroupForm, trial_point_ids: [] });
                    else {
                      const current = new Set(editGroupForm.trial_point_ids || []);
                      if (current.has(v)) current.delete(v);
                      else current.add(v);
                      setEditGroupForm({ ...editGroupForm, trial_point_ids: Array.from(current) });
                    }
                  }}
                >
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200">
                    <SelectValue placeholder="Select trial points…" />
                  </SelectTrigger>
                  <SelectContent>
                    {trialPoints.map(tp => (
                      <SelectItem key={tp.id} value={tp.id}>
                        {tp.point_text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 flex flex-wrap gap-1">
                  {editGroupForm.trial_point_ids?.map(tpId => {
                    const tp = trialPoints.find(t => t.id === tpId);
                    return (
                      <Badge key={tpId} className="bg-cyan-600/20 text-cyan-400 text-xs flex items-center gap-1">
                        {tp?.point_text}
                        <button
                          onClick={() =>
                            setEditGroupForm({
                              ...editGroupForm,
                              trial_point_ids: editGroupForm.trial_point_ids.filter(id => id !== tpId),
                            })
                          }
                          className="ml-1"
                        >
                          ✕
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Witnesses</Label>
                <Select
                  value={editGroupForm.default_testify_party_ids?.[0] || ""}
                  onValueChange={v => {
                    if (!v) setEditGroupForm({ ...editGroupForm, default_testify_party_ids: [] });
                    else {
                      const current = new Set(editGroupForm.default_testify_party_ids || []);
                      if (current.has(v)) current.delete(v);
                      else current.add(v);
                      setEditGroupForm({ ...editGroupForm, default_testify_party_ids: Array.from(current) });
                    }
                  }}
                >
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200">
                    <SelectValue placeholder="Select witnesses…" />
                  </SelectTrigger>
                  <SelectContent>
                    {parties.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {partyName(p.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 flex flex-wrap gap-1">
                  {editGroupForm.default_testify_party_ids?.map(pId => (
                    <Badge key={pId} className="bg-green-600/20 text-green-400 text-xs flex items-center gap-1">
                      {partyName(pId)}
                      <button
                        onClick={() =>
                          setEditGroupForm({
                            ...editGroupForm,
                            default_testify_party_ids: editGroupForm.default_testify_party_ids.filter(id => id !== pId),
                          })
                        }
                        className="ml-1"
                      >
                        ✕
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupOpen(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={updateGroup} className="bg-cyan-600 hover:bg-cyan-700">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Proof Wizard */}
      {selectedGroup && addProofWizardOpen && (
        <AddProofWizard
          open={addProofWizardOpen}
          onClose={() => setAddProofWizardOpen(false)}
          evidenceGroup={selectedGroup}
          onProofAdded={onProofAdded}
          parties={parties}
          depositions={depositions}
          extracts={extracts}
          callouts={callouts}
          depoClips={depoClips}
          depoExhibits={depoExhibits}
        />
      )}

      {/* Proof Preview */}
      {previewProof && (
        <ProofPreviewPanel
          proof={previewProof}
          onClose={() => setPreviewProof(null)}
          extracts={extracts}
          callouts={callouts}
          depoClips={depoClips}
          parties={parties}
        />
      )}
    </div>
  );
}