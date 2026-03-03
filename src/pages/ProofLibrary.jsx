import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useActiveCase from '@/components/hooks/useActiveCase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import EvidenceGroupCard from '@/components/proofLibrary/EvidenceGroupCard';
import ProofItemCard from '@/components/proofLibrary/ProofItemCard';
import AddProofModal from '@/components/proofLibrary/AddProofModal';
import ProofDetailsModal from '@/components/proofLibrary/ProofDetailsModal';
import QuestionProofLinker from '@/components/proofLibrary/QuestionProofLinker';
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
  const [questionsRefreshKey, setQuestionsRefreshKey] = useState(0);
  const [selectedProofItem, setSelectedProofItem] = useState(null);
  const [showProofDetails, setShowProofDetails] = useState(false);

  // Modal states
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showAddProofModal, setShowAddProofModal] = useState(false);
  const [showAddTrialPointModal, setShowAddTrialPointModal] = useState(false);
  const [showAssignWitnessModal, setShowAssignWitnessModal] = useState(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [newGroupData, setNewGroupData] = useState({ title: '', description: '', priority: 'Med', tags: '' });
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (activeCase?.id) {
      loadData();
      // Load persisted group selection
      const saved = sessionStorage.getItem(`evidence-group-${activeCase.id}`);
      if (saved) setSelectedGroupId(saved);
    }
  }, [activeCase?.id]);

  useEffect(() => {
    if (selectedGroupId) {
      // Clear stale data immediately so previous group doesn't flash
      setProofItems([]);
      setLinkedTrialPoints([]);
      setLinkedWitnesses([]);
      setLinkedQuestions([]);
      loadGroupDetails(selectedGroupId);
    }
  }, [selectedGroupId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const groups = await base44.entities.EvidenceGroups.filter({ case_id: activeCase.id });
      setEvidenceGroups(groups);
      if (groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groups[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };



  const loadGroupDetails = async (groupId) => {
    const gId = groupId || selectedGroupId;
    if (!gId) return;
    try {
      // Fetch all link tables in parallel
      const [groupProofLinks, groupTPLinks, groupQuestions, allProofInCase, allTPsInCase, allPartiesInCase, allQsInCase, allProofWitLinks] = await Promise.all([
        base44.entities.EvidenceGroupProofItems.filter({ evidence_group_id: gId }),
        base44.entities.EvidenceGroupTrialPoints.filter({ evidence_group_id: gId }),
        base44.entities.QuestionEvidenceGroups.filter({ evidence_group_id: gId }),
        base44.entities.ProofItems.filter({ case_id: activeCase.id }),
        base44.entities.TrialPoints.filter({ case_id: activeCase.id }),
        base44.entities.Parties.filter({ case_id: activeCase.id }),
        base44.entities.Questions.filter({ case_id: activeCase.id }),
        base44.entities.ProofItemWitnesses.filter({ case_id: activeCase.id }),
      ]);

      const proofIds = new Set(groupProofLinks.map(l => l.proof_item_id));
      const tpIds = new Set(groupTPLinks.map(l => l.trial_point_id));
      const qIds = new Set(groupQuestions.map(l => l.question_id));

      const allProof = allProofInCase.filter(p => proofIds.has(p.id));
      const tps = allTPsInCase.filter(tp => tpIds.has(tp.id));
      const qs = allQsInCase.filter(q => qIds.has(q.id));

      const witIdsForGroup = [...new Set(
        allProofWitLinks.filter(l => proofIds.has(l.proof_item_id)).map(l => l.witness_id)
      )];
      const wits = allPartiesInCase.filter(p => witIdsForGroup.includes(p.id));

      setProofItems(allProof);
      setLinkedTrialPoints(tps);
      setLinkedWitnesses(wits);
      setLinkedQuestions(qs);
      // Cache trial points & witnesses globally so add modals are fast
      setAllTrialPoints(allTPsInCase);
      setAllWitnesses(allPartiesInCase);
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

  const handleCreateQuestion = async (questionData) => {
    try {
      const newQ = await base44.entities.Questions.create({
        ...questionData,
        case_id: activeCase.id,
        primary_evidence_group_id: selectedGroupId,
      });
      // Create the QuestionEvidenceGroups link so loadGroupDetails can find it
      await base44.entities.QuestionEvidenceGroups.create({
        case_id: activeCase.id,
        question_id: newQ.id,
        evidence_group_id: selectedGroupId,
      });
      setLinkedQuestions(qs => [...qs, newQ]);
      return newQ;
    } catch (error) {
      console.error('Error creating question:', error);
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
      // Also remove any question-to-proof mappings
      const qpLinks = await base44.entities.QuestionProofItems.filter({ proof_item_id: proofItemId });
      for (const link of qpLinks) {
        await base44.entities.QuestionProofItems.delete(link.id);
      }
      // Remove proof item witness associations
      const piWits = await base44.entities.ProofItemWitnesses.filter({ proof_item_id: proofItemId });
      for (const link of piWits) {
        await base44.entities.ProofItemWitnesses.delete(link.id);
      }
      await loadGroupDetails(selectedGroupId);
    } catch (error) {
      console.error('Error removing proof:', error);
    }
  };

  const linkWitnessesToProof = async (proofItem) => {
    try {
      let witnessIds = [];
      if (proofItem.type === 'depoClip') {
        const clips = await base44.entities.DepoClips.filter({ id: proofItem.source_id });
        if (clips.length > 0 && clips[0].deposition_id) {
          const deps = await base44.entities.Depositions.filter({ id: clips[0].deposition_id });
          if (deps.length > 0 && deps[0].party_id) {
            witnessIds = [deps[0].party_id];
          }
        }
      } else if (proofItem.type === 'extract') {
        const extracts = await base44.entities.ExtractWitnesses.filter({ extract_id: proofItem.source_id });
        witnessIds = extracts.map(e => e.witness_id);
      }
      for (const witId of witnessIds) {
        const existing = await base44.entities.ProofItemWitnesses.filter({
          proof_item_id: proofItem.id,
          witness_id: witId,
        });
        if (existing.length === 0) {
          await base44.entities.ProofItemWitnesses.create({
            case_id: activeCase.id,
            proof_item_id: proofItem.id,
            witness_id: witId,
          });
        }
      }
    } catch (error) {
      console.error('Error linking witnesses to proof:', error);
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



  const handleRemoveQuestion = async (questionId) => {
    try {
      const links = await base44.entities.QuestionEvidenceGroups.filter({
        question_id: questionId,
        evidence_group_id: selectedGroupId,
      });
      for (const link of links) {
        await base44.entities.QuestionEvidenceGroups.delete(link.id);
      }
      setLinkedQuestions(qs => qs.filter(q => q.id !== questionId));
    } catch (error) {
      console.error('Error removing question:', error);
    }
  };

  const getPartyName = (pid) => {
    const p = allWitnesses.find(x => x.id === pid);
    return p ? `${p.first_name} ${p.last_name}` : "Unassigned";
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
                  <p className="text-xs text-gray-500 mt-1">Group ID: {selectedGroupId}</p>
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
                        <div key={proof.id} className="bg-gray-800 border border-gray-700 rounded p-3 cursor-pointer hover:border-cyan-500/50" onClick={() => { setSelectedProofItem(proof); setShowProofDetails(true); }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-100">{proof.label}</p>
                              <p className="text-xs text-gray-500 mt-1">{proof.type === 'depoClip' ? 'Deposition Clip' : 'Exhibit Extract'}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); handleRemoveProof(proof.id); }}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-400"
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
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
                  <div key={questionsRefreshKey} className="space-y-3">
                    <Button
                      onClick={() => { setEditing({ party_id: '', exam_type: 'Direct', question_text: '', goal: '', expected_answer: '', status: 'NotAsked', importance: 'Med', ask_if_time: true }); setShowAddQuestionModal(true); }}
                      className="bg-cyan-600 hover:bg-cyan-700 w-full"
                    >
                      <Plus className="w-3 h-3 mr-2" />
                      Add Question
                    </Button>
                    {linkedQuestions.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400">Questions for this group ({linkedQuestions.length}):</p>
                        {linkedQuestions.map((q) => (
                          <div key={q.id} className="bg-gray-800 border border-gray-700 rounded p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-100">{q.question_text}</p>
                                <p className="text-xs text-gray-500 mt-1">{q.exam_type} • {getPartyName(q.party_id)}</p>
                              </div>
                              <div className="flex gap-1">
                                <QuestionProofLinker
                                  questionId={q.id}
                                  evidenceGroupId={selectedGroupId}
                                  caseId={activeCase.id}
                                  proofItems={proofItems}
                                />
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
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 mt-4 py-4 border border-dashed border-gray-700 rounded">
                        <p className="text-sm">No questions yet</p>
                        <p className="text-xs mt-1">Create questions linked to this evidence group</p>
                      </div>
                    )}
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
        <DialogContent className="bg-white border-gray-300">
          <DialogHeader>
            <DialogTitle>Create Evidence Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-900">Title *</label>
              <Input
                placeholder="e.g., Sightlines Blocked"
                value={newGroupData.title}
                onChange={(e) => setNewGroupData({ ...newGroupData, title: e.target.value })}
                className="mt-1 bg-white border-gray-300 text-gray-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Description</label>
              <Textarea
                placeholder="Describe this argument theme..."
                value={newGroupData.description}
                onChange={(e) => setNewGroupData({ ...newGroupData, description: e.target.value })}
                className="mt-1 bg-white border-gray-300 text-gray-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Priority</label>
              <Select value={newGroupData.priority} onValueChange={(v) => setNewGroupData({ ...newGroupData, priority: v })}>
                <SelectTrigger className="mt-1 bg-white border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Med">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Tags (comma-separated)</label>
              <Input
                placeholder="e.g., liability, damages"
                value={newGroupData.tags}
                onChange={(e) => setNewGroupData({ ...newGroupData, tags: e.target.value })}
                className="mt-1 bg-white border-gray-300 text-gray-900"
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
        <DialogContent className="bg-white border-gray-300">
          <DialogHeader>
            <DialogTitle>Edit Evidence Group</DialogTitle>
          </DialogHeader>
          {editingGroup && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-900">Title</label>
                <Input
                  value={editingGroup.title}
                  onChange={(e) => setEditingGroup({ ...editingGroup, title: e.target.value })}
                  className="mt-1 bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-900">Description</label>
                <Textarea
                  value={editingGroup.description || ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                  className="mt-1 bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-900">Priority</label>
                <Select value={editingGroup.priority} onValueChange={(v) => setEditingGroup({ ...editingGroup, priority: v })}>
                  <SelectTrigger className="mt-1 bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
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
        onProofAdded={async (proofItem) => {
          setShowAddProofModal(false);
          await linkWitnessesToProof(proofItem);
          await loadGroupDetails();
        }}
      />

      {/* Add Trial Points Modal */}
      <Dialog open={showAddTrialPointModal} onOpenChange={setShowAddTrialPointModal}>
        <DialogContent className="bg-white border-gray-300">
          <DialogHeader>
            <DialogTitle>Link Trial Points</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
          {allTrialPoints.map((tp) => {
            const isLinked = linkedTrialPoints.some((l) => l.id === tp.id);
            return (
              <label key={tp.id} className="flex items-start gap-3 p-2 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
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
                    <p className="text-sm font-medium text-gray-900">{tp.point_text}</p>
                    <p className="text-xs text-gray-600">{tp.theme}</p>
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
        <DialogContent className="bg-white border-gray-300">
          <DialogHeader>
            <DialogTitle>Assign Witnesses</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {allWitnesses.map((wit) => {
              const isAssigned = linkedWitnesses.some((l) => l.id === wit.id);
              return (
                <label key={wit.id} className="flex items-start gap-3 p-2 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
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
                    <p className="text-sm font-medium text-gray-900">{wit.display_name || wit.last_name}</p>
                    <p className="text-xs text-gray-600">{wit.party_type}</p>
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

      {/* Add Question Modal */}
      <Dialog open={showAddQuestionModal} onOpenChange={setShowAddQuestionModal}>
        <DialogContent className="bg-white border-gray-300">
          <DialogHeader>
            <DialogTitle>Add Question for {selectedGroup?.title}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-900">Question *</label>
                <Textarea
                  value={editing.question_text}
                  onChange={(e) => setEditing({ ...editing, question_text: e.target.value })}
                  className="mt-1 bg-white border-gray-300 text-gray-900"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-900">Witness *</label>
                <Select value={editing.party_id || ""} onValueChange={(v) => setEditing({ ...editing, party_id: v })}>
                  <SelectTrigger className="mt-1 bg-white border-gray-300 text-gray-900">
                    <SelectValue placeholder="Select witness..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    {linkedWitnesses.map(w => <SelectItem key={w.id} value={w.id}>{w.first_name} {w.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-900">Type</label>
                  <Select value={editing.exam_type} onValueChange={(v) => setEditing({ ...editing, exam_type: v })}>
                    <SelectTrigger className="mt-1 bg-white border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      <SelectItem value="Direct">Direct</SelectItem>
                      <SelectItem value="Cross">Cross</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-900">Importance</label>
                  <Select value={editing.importance || "Med"} onValueChange={(v) => setEditing({ ...editing, importance: v })}>
                    <SelectTrigger className="mt-1 bg-white border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Med">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-900">Goal</label>
                <Input
                  value={editing.goal || ""}
                  onChange={(e) => setEditing({ ...editing, goal: e.target.value })}
                  className="mt-1 bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-900">Expected Answer</label>
                <Input
                  value={editing.expected_answer || ""}
                  onChange={(e) => setEditing({ ...editing, expected_answer: e.target.value })}
                  className="mt-1 bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddQuestionModal(false); setEditing(null); }}>
              Cancel
            </Button>
            <Button onClick={async () => { await handleCreateQuestion(editing); setShowAddQuestionModal(false); setEditing(null); }} className="bg-cyan-600 hover:bg-cyan-700">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProofDetailsModal proofItem={selectedProofItem} isOpen={showProofDetails} onClose={() => setShowProofDetails(false)} />
    </div>
  );
}