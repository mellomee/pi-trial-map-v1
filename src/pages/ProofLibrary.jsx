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
  const [allTrialPoints, setAllTrialPoints] = useState([]);
  const [linkedTrialPoints, setLinkedTrialPoints] = useState([]);
  const [allWitnesses, setAllWitnesses] = useState([]);
  const [linkedWitnesses, setLinkedWitnesses] = useState([]);
  const [linkedQuestions, setLinkedQuestions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [centerTab, setCenterTab] = useState('proof');

  // Modal states
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showAddProofModal, setShowAddProofModal] = useState(false);
  const [showAddTrialPointModal, setShowAddTrialPointModal] = useState(false);
  const [showAssignWitnessModal, setShowAssignWitnessModal] = useState(false);
  const [showGenerateQuestionModal, setShowGenerateQuestionModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [newGroupData, setNewGroupData] = useState({ title: '', description: '', priority: 'Med', tags: '' });
  const [generateQuestionData, setGenerateQuestionData] = useState({ witness_id: '', exam_type: 'Direct', question_text: '' });
  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);
  const [showDeleteQuestionsModal, setShowDeleteQuestionsModal] = useState(false);

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
      setAllTrialPoints(tps);
      setAllWitnesses(wits);
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
      const [groupProofLinks, groupTPLinks, groupWitLinks, groupQuestions] = await Promise.all([
        base44.entities.EvidenceGroupProofItems.filter({ evidence_group_id: selectedGroupId }),
        base44.entities.EvidenceGroupTrialPoints.filter({ evidence_group_id: selectedGroupId }),
        base44.entities.EvidenceGroupWitnesses.filter({ evidence_group_id: selectedGroupId }),
        base44.entities.QuestionEvidenceGroups.filter({ evidence_group_id: selectedGroupId }),
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

      // Load witness details
      const witIds = groupWitLinks.map((link) => link.witness_id);
      const wits = [];
      for (const witId of witIds) {
        const wit = await base44.entities.Parties.filter({ id: witId });
        if (wit.length > 0) wits.push(wit[0]);
      }

      // Load linked questions
      const qIds = groupQuestions.map((link) => link.question_id);
      const qs = [];
      for (const qId of qIds) {
        const q = await base44.entities.Questions.filter({ id: qId });
        if (q.length > 0) qs.push(q[0]);
      }

      setProofItems(allProof);
      setLinkedTrialPoints(tps);
      setLinkedWitnesses(wits);
      setLinkedQuestions(qs);
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

  const handleAddTrialPoints = async (selectedTPIds) => {
    try {
      for (const tpId of selectedTPIds) {
        const existing = await base44.entities.EvidenceGroupTrialPoints.filter({
          evidence_group_id: selectedGroupId,
          trial_point_id: tpId,
        });
        if (existing.length === 0) {
          await base44.entities.EvidenceGroupTrialPoints.create({
            evidence_group_id: selectedGroupId,
            trial_point_id: tpId,
            role: 'Supports',
          });
        }
      }
      setShowAddTrialPointModal(false);
      await loadGroupDetails();
    } catch (error) {
      console.error('Error adding trial points:', error);
    }
  };

  const handleRemoveTrialPoint = async (tpId) => {
    try {
      const links = await base44.entities.EvidenceGroupTrialPoints.filter({
        evidence_group_id: selectedGroupId,
        trial_point_id: tpId,
      });
      for (const link of links) {
        await base44.entities.EvidenceGroupTrialPoints.delete(link.id);
      }
      await loadGroupDetails();
    } catch (error) {
      console.error('Error removing trial point:', error);
    }
  };

  const handleAssignWitnesses = async (selectedWitIds) => {
    try {
      for (const witId of selectedWitIds) {
        const existing = await base44.entities.EvidenceGroupWitnesses.filter({
          evidence_group_id: selectedGroupId,
          witness_id: witId,
        });
        if (existing.length === 0) {
          await base44.entities.EvidenceGroupWitnesses.create({
            evidence_group_id: selectedGroupId,
            witness_id: witId,
          });
        }
      }
      setShowAssignWitnessModal(false);
      await loadGroupDetails();
    } catch (error) {
      console.error('Error assigning witnesses:', error);
    }
  };

  const handleRemoveWitness = async (witId) => {
    try {
      const links = await base44.entities.EvidenceGroupWitnesses.filter({
        evidence_group_id: selectedGroupId,
        witness_id: witId,
      });
      for (const link of links) {
        await base44.entities.EvidenceGroupWitnesses.delete(link.id);
      }
      await loadGroupDetails();
    } catch (error) {
      console.error('Error removing witness:', error);
    }
  };

  const handleGenerateQuestion = async () => {
    if (!generateQuestionData.witness_id || !generateQuestionData.question_text.trim()) return;
    if (isCreatingQuestion) return; // Prevent double submission
    
    setIsCreatingQuestion(true);
    console.log('[QUESTION_CREATE] Starting creation:', { generateQuestionData, timestamp: new Date().toISOString() });
    
    try {
      const newQuestion = await base44.entities.Questions.create({
        case_id: activeCase.id,
        party_id: generateQuestionData.witness_id,
        exam_type: generateQuestionData.exam_type,
        question_text: generateQuestionData.question_text,
        status: 'NotAsked',
        importance: 'Med',
      });
      
      console.log('[QUESTION_CREATE] Question created with ID:', newQuestion.id);

      // Link to evidence group
      await base44.entities.QuestionEvidenceGroups.create({
        question_id: newQuestion.id,
        evidence_group_id: selectedGroupId,
        is_primary: false,
      });

      // Link to trial points in this evidence group
      const tpLinks = await base44.entities.EvidenceGroupTrialPoints.filter({
        evidence_group_id: selectedGroupId,
      });
      for (const link of tpLinks) {
        const existing = await base44.entities.QuestionLinks.filter({
          question_id: newQuestion.id,
          trial_point_id: link.trial_point_id,
        });
        if (existing.length === 0) {
          await base44.entities.QuestionLinks.create({
            question_id: newQuestion.id,
            trial_point_id: link.trial_point_id,
          });
        }
      }

      console.log('[QUESTION_CREATE] All links created successfully');
      setGenerateQuestionData({ witness_id: '', exam_type: 'Direct', question_text: '' });
      setShowGenerateQuestionModal(false);
      await loadGroupDetails();
    } catch (error) {
      console.error('Error generating question:', error);
    } finally {
      setIsCreatingQuestion(false);
    }
  };

  const handleDeleteQuestionsInGroup = async () => {
    try {
      for (const q of linkedQuestions) {
        const links = await base44.entities.QuestionEvidenceGroups.filter({
          question_id: q.id,
          evidence_group_id: selectedGroupId,
        });
        for (const link of links) {
          await base44.entities.QuestionEvidenceGroups.delete(link.id);
        }
      }
      setShowDeleteQuestionsModal(false);
      await loadGroupDetails();
    } catch (error) {
      console.error('Error deleting questions:', error);
    }
  };

  const handleRemoveQuestion = async (questionId) => {
    try {
      const links = await base44.entities.QuestionEvidenceGroups.filter({
        question_id: questionId,
        evidence_group_id: selectedGroupId,
      });
      for (const link of links) {
        await base44.entities.QuestionEvidenceGroups.delete(link.id);
      }
      await loadGroupDetails();
    } catch (error) {
      console.error('Error removing question:', error);
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

        {/* Center Panel: Proof Items / Trial Points / Witnesses / Questions */}
        <div className="flex-1 flex flex-col bg-[#0a0f1e] overflow-hidden">
          {selectedGroup ? (
            <>
              <div className="p-4 border-b border-gray-700 space-y-3">
                <div>
                  <h2 className="text-lg font-bold text-cyan-300">{selectedGroup.title}</h2>
                  {selectedGroup.description && <p className="text-sm text-gray-400">{selectedGroup.description}</p>}
                </div>
                {/* Tab buttons */}
                <div className="flex gap-2 border-b border-gray-700 -mx-4 px-4">
                  {['proof', 'trialPoints', 'witnesses', 'questions'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setCenterTab(tab)}
                      className={`py-2 px-2 text-xs font-medium border-b-2 transition-colors ${
                        centerTab === tab
                          ? 'border-cyan-400 text-cyan-300'
                          : 'border-transparent text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {tab === 'proof' && `Proof (${proofItems.length})`}
                      {tab === 'trialPoints' && `Trial Points (${linkedTrialPoints.length})`}
                      {tab === 'witnesses' && `Witnesses (${linkedWitnesses.length})`}
                      {tab === 'questions' && `Questions (${linkedQuestions.length})`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Proof Tab */}
                {centerTab === 'proof' && (
                  <>
                    <div className="flex gap-2 -mx-4 px-4 pb-3 mb-3 border-b border-gray-700">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <Input
                          placeholder="Search proof..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 bg-gray-800 border-gray-700 text-xs"
                        />
                      </div>
                      <Button
                        onClick={() => setShowAddProofModal(true)}
                        size="sm"
                        className="bg-cyan-600 hover:bg-cyan-700 text-xs"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    {filteredProof.length > 0 ? (
                      filteredProof.map((proof) => (
                        <ProofItemCard
                          key={proof.id}
                          proofItem={proof}
                          onRemove={handleRemoveProof}
                          witnesses={allWitnesses.filter((w) => w.id === proof.witness_id)}
                        />
                      ))
                    ) : (
                      <div className="text-center text-gray-500 mt-8">
                        <p className="text-sm">No proof in this evidence group</p>
                        <p className="text-xs mt-2">Add depo clips or exhibit extracts to get started</p>
                      </div>
                    )}
                  </>
                )}

                {/* Trial Points Tab */}
                {centerTab === 'trialPoints' && (
                  <>
                    <Button
                      onClick={() => setShowAddTrialPointModal(true)}
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-700 w-full"
                    >
                      <Plus className="w-3 h-3 mr-2" />
                      Add Trial Point
                    </Button>
                    {linkedTrialPoints.length > 0 ? (
                      linkedTrialPoints.map((tp) => (
                        <div key={tp.id} className="bg-gray-800 border border-gray-700 rounded p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-100">{tp.point_text}</p>
                              <p className="text-xs text-gray-500 mt-1">Theme: {tp.theme}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveTrialPoint(tp.id)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-400"
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 mt-8">
                        <p className="text-sm">No trial points linked</p>
                      </div>
                    )}
                  </>
                )}

                {/* Witnesses Tab */}
                {centerTab === 'witnesses' && (
                  <>
                    <Button
                      onClick={() => setShowAssignWitnessModal(true)}
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-700 w-full"
                    >
                      <Plus className="w-3 h-3 mr-2" />
                      Assign Witness
                    </Button>
                    {linkedWitnesses.length > 0 ? (
                      linkedWitnesses.map((wit) => (
                        <div key={wit.id} className="bg-gray-800 border border-gray-700 rounded p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-100">{wit.display_name || wit.last_name}</p>
                              <p className="text-xs text-gray-500 mt-1">{wit.party_type}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveWitness(wit.id)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-400"
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 mt-8">
                        <p className="text-sm">No witnesses assigned</p>
                      </div>
                    )}
                  </>
                )}

                {/* Questions Tab */}
                {centerTab === 'questions' && (
                  <>
                    <Button
                      onClick={() => setShowGenerateQuestionModal(true)}
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-700 w-full"
                    >
                      <Plus className="w-3 h-3 mr-2" />
                      Generate Question
                    </Button>
                    {linkedQuestions.length > 0 ? (
                      linkedQuestions.map((q) => (
                        <div key={q.id} className="bg-gray-800 border border-gray-700 rounded p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-100">{q.question_text}</p>
                              <p className="text-xs text-gray-500 mt-1">{q.exam_type}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveQuestion(q.id)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-400"
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 mt-8">
                        <p className="text-sm">No questions linked</p>
                      </div>
                    )}
                  </>
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

      {/* Add Trial Points Modal */}
      <Dialog open={showAddTrialPointModal} onOpenChange={setShowAddTrialPointModal}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle>Link Trial Points</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {allTrialPoints.map((tp) => {
              const isLinked = linkedTrialPoints.some((l) => l.id === tp.id);
              return (
                <label key={tp.id} className="flex items-start gap-3 p-2 border border-gray-700 rounded cursor-pointer hover:bg-gray-800">
                  <input
                    type="checkbox"
                    checked={isLinked}
                    disabled={isLinked}
                    onChange={() => {
                      if (!isLinked) {
                        handleAddTrialPoints([tp.id]);
                      }
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100">{tp.point_text}</p>
                    <p className="text-xs text-gray-500">{tp.theme}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTrialPointModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Witnesses Modal */}
      <Dialog open={showAssignWitnessModal} onOpenChange={setShowAssignWitnessModal}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle>Assign Witnesses</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {allWitnesses.map((wit) => {
              const isAssigned = linkedWitnesses.some((l) => l.id === wit.id);
              return (
                <label key={wit.id} className="flex items-start gap-3 p-2 border border-gray-700 rounded cursor-pointer hover:bg-gray-800">
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    disabled={isAssigned}
                    onChange={() => {
                      if (!isAssigned) {
                        handleAssignWitnesses([wit.id]);
                      }
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100">{wit.display_name || wit.last_name}</p>
                    <p className="text-xs text-gray-500">{wit.party_type}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignWitnessModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Question Modal */}
      <Dialog open={showGenerateQuestionModal} onOpenChange={setShowGenerateQuestionModal}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-lg" style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle className="text-gray-100">Create Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-200">Question Text *</label>
              <Textarea
                placeholder="Type your question here..."
                value={generateQuestionData.question_text}
                onChange={(e) => setGenerateQuestionData({ ...generateQuestionData, question_text: e.target.value })}
                className="mt-1 bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-200">Witness *</label>
              <Select value={generateQuestionData.witness_id} onValueChange={(v) => setGenerateQuestionData({ ...generateQuestionData, witness_id: v })}>
                <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-gray-100">
                  <SelectValue placeholder="Select witness..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 z-[10000]">
                  {linkedWitnesses.length > 0 ? (
                    linkedWitnesses.map((wit) => (
                      <SelectItem key={wit.id} value={wit.id} className="text-gray-100">
                        {wit.display_name || wit.last_name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-xs text-gray-400">Assign witnesses to this evidence group first</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-200">Exam Type</label>
              <Select value={generateQuestionData.exam_type} onValueChange={(v) => setGenerateQuestionData({ ...generateQuestionData, exam_type: v })}>
                <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-gray-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 z-[10000]">
                  <SelectItem value="Direct" className="text-gray-100">Direct</SelectItem>
                  <SelectItem value="Cross" className="text-gray-100">Cross</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowGenerateQuestionModal(false)}
              className="text-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                console.log('Create Question clicked', { generateQuestionData, isDisabled: !generateQuestionData.witness_id || !generateQuestionData.question_text.trim() });
                handleGenerateQuestion();
              }}
              disabled={!generateQuestionData.witness_id || !generateQuestionData.question_text.trim()}
              className="bg-cyan-600 hover:bg-cyan-700 text-white relative z-[10001]"
            >
              Create Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}