import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useActiveCase from '@/components/hooks/useActiveCase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search } from 'lucide-react';
import EvidenceGroupCard from '@/components/proofLibrary/EvidenceGroupCard';
import ProofItemCard from '@/components/proofLibrary/ProofItemCard';
import AddProofModal from '@/components/proofLibrary/AddProofModal';
import { createPageUrl } from '@/utils';

export default function ProofLibrary() {
  const { activeCase } = useActiveCase();
  const [evidenceGroups, setEvidenceGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [proofItems, setProofItems] = useState([]);
  const [trialPoints, setTrialPoints] = useState([]);
  const [witnesses, setWitnesses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showAddProofModal, setShowAddProofModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [newGroupData, setNewGroupData] = useState({ title: '', description: '', priority: 'Med', tags: '' });

  useEffect(() => {
    if (activeCase?.id) {
      loadData();
    }
  }, [activeCase?.id]);

  useEffect(() => {
    if (selectedGroupId) {
      loadGroupDetails();
    }
  }, [selectedGroupId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groups, tps, wits] = await Promise.all([
        base44.entities.EvidenceGroups.filter({ case_id: activeCase.id }),
        base44.entities.TrialPoints.filter({ case_id: activeCase.id }),
        base44.entities.Parties.filter({ case_id: activeCase.id }),
      ]);
      setEvidenceGroups(groups);
      setTrialPoints(tps);
      setWitnesses(wits);
      if (groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groups[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupDetails = async () => {
    try {
      const [groupProofLinks, groupTPLinks] = await Promise.all([
        base44.entities.EvidenceGroupProofItems.filter({ evidence_group_id: selectedGroupId }),
        base44.entities.EvidenceGroupTrialPoints.filter({ evidence_group_id: selectedGroupId }),
      ]);

      // Load full proof items
      const proofIds = groupProofLinks.map((link) => link.proof_item_id);
      const allProof = [];
      for (const pId of proofIds) {
        const proof = await base44.entities.ProofItems.filter({ id: pId });
        if (proof.length > 0) allProof.push(proof[0]);
      }

      // Load trial point details
      const tpIds = groupTPLinks.map((link) => link.trial_point_id);
      const tps = [];
      for (const tpId of tpIds) {
        const tp = await base44.entities.TrialPoints.filter({ id: tpId });
        if (tp.length > 0) tps.push(tp[0]);
      }

      setProofItems(allProof);
    } catch (error) {
      console.error('Error loading group details:', error);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupData.title) return;
    try {
      const tags = newGroupData.tags ? newGroupData.tags.split(',').map((t) => t.trim()) : [];
      await base44.entities.EvidenceGroups.create({
        case_id: activeCase.id,
        title: newGroupData.title,
        description: newGroupData.description,
        priority: newGroupData.priority,
        tags,
      });
      setNewGroupData({ title: '', description: '', priority: 'Med', tags: '' });
      setShowNewGroupModal(false);
      await loadData();
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup?.title) return;
    try {
      const tags = editingGroup.tags || [];
      await base44.entities.EvidenceGroups.update(editingGroup.id, {
        title: editingGroup.title,
        description: editingGroup.description,
        priority: editingGroup.priority,
        tags,
      });
      setShowEditGroupModal(false);
      setEditingGroup(null);
      await loadData();
    } catch (error) {
      console.error('Error updating group:', error);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (confirm('Delete this evidence group? Proof items will not be deleted.')) {
      try {
        // Delete links first
        const links = await base44.entities.EvidenceGroupProofItems.filter({ evidence_group_id: groupId });
        for (const link of links) {
          await base44.entities.EvidenceGroupProofItems.delete(link.id);
        }
        // Delete group
        await base44.entities.EvidenceGroups.delete(groupId);
        setSelectedGroupId(null);
        await loadData();
      } catch (error) {
        console.error('Error deleting group:', error);
      }
    }
  };

  const handleRemoveProof = async (proofItemId) => {
    try {
      const links = await base44.entities.EvidenceGroupProofItems.filter({
        evidence_group_id: selectedGroupId,
        proof_item_id: proofItemId,
      });
      for (const link of links) {
        await base44.entities.EvidenceGroupProofItems.delete(link.id);
      }
      await loadGroupDetails();
    } catch (error) {
      console.error('Error removing proof:', error);
    }
  };

  const selectedGroup = evidenceGroups.find((g) => g.id === selectedGroupId);
  const filteredProof = proofItems.filter((p) => p.label?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-screen flex flex-col bg-[#0a0f1e] text-slate-200">
      {/* Header */}
      <div className="border-b border-gray-700 p-4 bg-[#0f1629] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-cyan-400">Proof Library</h1>
          <p className="text-sm text-gray-400">Gather and organize evidence by argument themes</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.href = createPageUrl('Dashboard')}
          className="text-xs"
        >
          ← Back
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Evidence Groups */}
        <div className="w-72 border-r border-gray-700 flex flex-col bg-[#0f1629] overflow-hidden">
          <div className="p-4 border-b border-gray-700 space-y-3">
            <Button
              onClick={() => setShowNewGroupModal(true)}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Evidence Group
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {evidenceGroups.map((group) => (
              <EvidenceGroupCard
                key={group.id}
                group={group}
                isSelected={selectedGroupId === group.id}
                onSelect={setSelectedGroupId}
                onEdit={(g) => {
                  setEditingGroup(g);
                  setShowEditGroupModal(true);
                }}
                onDelete={handleDeleteGroup}
              />
            ))}
            {evidenceGroups.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <p className="text-sm">No evidence groups yet</p>
                <p className="text-xs mt-2">Create one to organize proof by theme</p>
              </div>
            )}
          </div>
        </div>

        {/* Center Panel: Proof Items */}
        <div className="flex-1 flex flex-col bg-[#0a0f1e] overflow-hidden">
          {selectedGroup ? (
            <>
              <div className="p-4 border-b border-gray-700 space-y-3">
                <div>
                  <h2 className="text-lg font-bold text-cyan-300">{selectedGroup.title}</h2>
                  {selectedGroup.description && <p className="text-sm text-gray-400">{selectedGroup.description}</p>}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <Input
                      placeholder="Search proof..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-gray-800 border-gray-700"
                    />
                  </div>
                  <Button
                    onClick={() => setShowAddProofModal(true)}
                    size="sm"
                    className="bg-cyan-600 hover:bg-cyan-700"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredProof.length > 0 ? (
                  filteredProof.map((proof) => (
                    <ProofItemCard
                      key={proof.id}
                      proofItem={proof}
                      onRemove={handleRemoveProof}
                      witnesses={witnesses.filter((w) => w.id === proof.witness_id)}
                    />
                  ))
                ) : (
                  <div className="text-center text-gray-500 mt-8">
                    <p className="text-sm">No proof in this evidence group</p>
                    <p className="text-xs mt-2">Add depo clips or exhibit extracts to get started</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg">Select an evidence group to view proof</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Dialog open={showNewGroupModal} onOpenChange={setShowNewGroupModal}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle>Create Evidence Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                placeholder="e.g., Sightlines Blocked"
                value={newGroupData.title}
                onChange={(e) => setNewGroupData({ ...newGroupData, title: e.target.value })}
                className="mt-1 bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe this argument theme..."
                value={newGroupData.description}
                onChange={(e) => setNewGroupData({ ...newGroupData, description: e.target.value })}
                className="mt-1 bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={newGroupData.priority} onValueChange={(v) => setNewGroupData({ ...newGroupData, priority: v })}>
                <SelectTrigger className="mt-1 bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Med">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Tags (comma-separated)</label>
              <Input
                placeholder="e.g., liability, damages"
                value={newGroupData.tags}
                onChange={(e) => setNewGroupData({ ...newGroupData, tags: e.target.value })}
                className="mt-1 bg-gray-800 border-gray-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroupModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} className="bg-cyan-600 hover:bg-cyan-700">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditGroupModal} onOpenChange={setShowEditGroupModal}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle>Edit Evidence Group</DialogTitle>
          </DialogHeader>
          {editingGroup && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={editingGroup.title}
                  onChange={(e) => setEditingGroup({ ...editingGroup, title: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editingGroup.description || ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select value={editingGroup.priority} onValueChange={(v) => setEditingGroup({ ...editingGroup, priority: v })}>
                  <SelectTrigger className="mt-1 bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Med">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditGroupModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateGroup} className="bg-cyan-600 hover:bg-cyan-700">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddProofModal
        isOpen={showAddProofModal}
        onClose={() => setShowAddProofModal(false)}
        caseId={activeCase?.id}
        evidenceGroupId={selectedGroupId}
        onProofAdded={() => {
          setShowAddProofModal(false);
          loadGroupDetails();
        }}
      />
    </div>
  );
}