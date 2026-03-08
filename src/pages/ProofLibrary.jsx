import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useActiveCase from '@/components/hooks/useActiveCase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, ExternalLink, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import EvidenceGroupCard from '@/components/proofLibrary/EvidenceGroupCard';
import ProofItemCard from '@/components/proofLibrary/ProofItemCard';
import AddProofModal from '@/components/proofLibrary/AddProofModal';
import ProofViewerModal from '@/components/proofLibrary/ProofViewerModal';
import ProofInUseModal from '@/components/proofLibrary/ProofInUseModal';
import QuestionProofLinker from '@/components/proofLibrary/QuestionProofLinker';
import HierarchicalQuestionsList from '@/components/proofLibrary/HierarchicalQuestionsList';
import { createPageUrl } from '@/utils';

export default function ProofLibrary() {
  const { activeCase } = useActiveCase();
  const [evidenceGroups, setEvidenceGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [proofItems, setProofItems] = useState([]);
  const [calloutNames, setCalloutNames] = useState({}); // calloutId -> callout name
  const [calloutWitnesses, setCalloutWitnesses] = useState({}); // proofItemId -> witness name string
  const [allTrialPoints, setAllTrialPoints] = useState([]);
  const [linkedTrialPoints, setLinkedTrialPoints] = useState([]);
  const [allWitnesses, setAllWitnesses] = useState([]);
  const [linkedWitnesses, setLinkedWitnesses] = useState([]);
  const [proofWitnessesForGroup, setProofWitnessesForGroup] = useState([]); // deduplicated witnesses from proof items
  const [linkedQuestions, setLinkedQuestions] = useState([]);
  const [questionProofLinks, setQuestionProofLinks] = useState({}); // questionId -> array of proofItemIds
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [centerTab, setCenterTab] = useState('proof');

  const [selectedProofItem, setSelectedProofItem] = useState(null);
  const [showProofDetails, setShowProofDetails] = useState(false);

  // Modal states
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showAddProofModal, setShowAddProofModal] = useState(false);
  const [showAddTrialPointModal, setShowAddTrialPointModal] = useState(false);
  const [showAssignWitnessModal, setShowAssignWitnessModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [newGroupData, setNewGroupData] = useState({ title: '', description: '', priority: 'Med', tags: '' });
  const [editing, setEditing] = useState(null);
  const [proofInUseModalProof, setProofInUseModalProof] = useState(null); // proof being deleted (if in use)
  const [bucketsOpen, setBucketsOpen] = useState(true);

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
      setProofWitnessesForGroup([]);
      setCalloutWitnesses({});
      setQuestionProofLinks({});
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
      // Include parent questions AND all their child questions (child questions are not in QuestionEvidenceGroups)
      const parentQs = allQsInCase.filter(q => qIds.has(q.id));
      const parentQIds = new Set(parentQs.map(q => q.id));
      const childQs = allQsInCase.filter(q => q.parent_id && parentQIds.has(q.parent_id));
      const qs = [...parentQs, ...childQs];

      const witIdsForGroup = [...new Set(
        allProofWitLinks.filter(l => proofIds.has(l.proof_item_id)).map(l => l.witness_id)
      )];
      const wits = allPartiesInCase.filter(p => witIdsForGroup.includes(p.id));

      setProofItems(allProof);

      // Load callout data (name + witness_id) for extract-type proof items
      const calloutMap = {};
      const calloutWitMap = {}; // proofItemId -> witness name
      const extractProofs = allProof.filter(p => p.type === 'extract' && p.callout_id);
      const partyMap = {};
      allPartiesInCase.forEach(p => { partyMap[p.id] = p.display_name || `${p.first_name || ''} ${p.last_name}`.trim(); });

      if (extractProofs.length > 0) {
        const calloutIds = [...new Set(extractProofs.map(p => p.callout_id))];
        for (const cid of calloutIds) {
          const cos = await base44.entities.Callouts.filter({ id: cid });
          if (cos.length > 0) {
            calloutMap[cid] = cos[0].name;
            if (cos[0].witness_id) {
              calloutWitMap[cid] = partyMap[cos[0].witness_id] || null;
            }
          }
        }
      }
      setCalloutNames(calloutMap);
      setCalloutWitnesses(calloutWitMap);

      // Build deduplicated witness list from ALL proof items in this group:
      // depoClip witnesses from ProofItemWitnesses + callout witnesses from extract proofs
      const witIdSet = new Set(witIdsForGroup);
      extractProofs.forEach(p => {
        const witName = p.callout_id ? calloutWitMap[p.callout_id] : null;
        // We don't have the id directly from name — we need to find by matching name
      });
      // Better: collect witness_ids from callouts directly
      const extractCalloutIds = extractProofs.map(p => p.callout_id).filter(Boolean);
      // Already fetched above in cos loop — rebuild with witness_ids
      const calloutWitIds = [];
      for (const cid of extractCalloutIds) {
        const cos = await base44.entities.Callouts.filter({ id: cid });
        if (cos.length > 0 && cos[0].witness_id) calloutWitIds.push(cos[0].witness_id);
      }
      calloutWitIds.forEach(id => witIdSet.add(id));
      const allWitsForGroup = allPartiesInCase.filter(p => witIdSet.has(p.id));

      setLinkedTrialPoints(tps);
      setLinkedWitnesses(wits); // keep existing (depoClip witnesses via ProofItemWitnesses)
      setProofWitnessesForGroup(allWitsForGroup); // full list including callout witnesses
      setLinkedQuestions(qs);
      // Cache trial points & witnesses globally so add modals are fast
      setAllTrialPoints(allTPsInCase);
      setAllWitnesses(allPartiesInCase);

      // Load question-proof links
      const qpLinks = await base44.entities.QuestionProofItems.filter({ evidence_group_id: gId });
      const qMap = {};
      qpLinks.forEach(link => {
        if (!qMap[link.question_id]) qMap[link.question_id] = [];
        qMap[link.question_id].push(link.proof_item_id);
      });
      setQuestionProofLinks(qMap);
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
      // For linking to evidence group (parent questions only)
      if (!questionData.parent_id) {
        await base44.entities.QuestionEvidenceGroups.create({
          case_id: activeCase.id,
          question_id: questionData.id || null,
          evidence_group_id: selectedGroupId,
        });
      }
    } catch (error) {
      console.error('Error linking question to evidence group:', error);
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

  const handleRemoveProof = async (proof) => {
    try {
      // Check if any questions use this proof
      const qpLinks = await base44.entities.QuestionProofItems.filter({ proof_item_id: proof.id });
      if (qpLinks.length > 0) {
        // Show the "in use" modal instead of deleting
        setProofInUseModalProof(proof);
        return;
      }
      // Safe to delete: remove from evidence group
      await doDeleteProof(proof.id);
    } catch (error) {
      console.error('Error removing proof:', error);
    }
  };

  const doDeleteProof = async (proofItemId) => {
    try {
      const links = await base44.entities.EvidenceGroupProofItems.filter({
        evidence_group_id: selectedGroupId,
        proof_item_id: proofItemId,
      });
      for (const link of links) {
        await base44.entities.EvidenceGroupProofItems.delete(link.id);
      }
      // Remove proof item witness associations
      const piWits = await base44.entities.ProofItemWitnesses.filter({ proof_item_id: proofItemId });
      for (const link of piWits) {
        await base44.entities.ProofItemWitnesses.delete(link.id);
      }
      await loadGroupDetails(selectedGroupId);
    } catch (error) {
      console.error('Error deleting proof:', error);
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
      await loadGroupDetails(selectedGroupId);
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
      await loadGroupDetails(selectedGroupId);
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
      await loadGroupDetails(selectedGroupId);
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
      await loadGroupDetails(selectedGroupId);
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
          <p className="text-sm text-gray-400">Gather and organize evidence by bucket</p>
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
        <div className={`${bucketsOpen ? 'w-72' : 'w-10'} border-r border-gray-700 flex flex-col bg-[#0f1629] overflow-hidden transition-all duration-200 flex-shrink-0`}>
          <div className={`p-4 border-b border-gray-700 flex items-center justify-between gap-2 ${bucketsOpen ? '' : 'px-2'}`}>
            {bucketsOpen && <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Buckets</p>}
            <button onClick={() => setBucketsOpen(v => !v)} className="text-slate-500 hover:text-slate-200 flex-shrink-0" title={bucketsOpen ? 'Collapse' : 'Expand'}>
              {bucketsOpen ? <Pencil className="w-3.5 h-3.5 rotate-45 opacity-50" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          {bucketsOpen && <div className="px-4 pb-3 pt-2 border-b border-gray-700">
            <Button
              onClick={() => setShowNewGroupModal(true)}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Bucket
            </Button>
          </div>}
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
                              {proof.type === 'extract' && proof.callout_id && calloutNames[proof.callout_id] ? (
                                <p className="text-xs text-cyan-400 mt-0.5">↳ {calloutNames[proof.callout_id]}</p>
                              ) : null}
                              {proof.type === 'extract' && proof.callout_id && calloutWitnesses[proof.callout_id] ? (
                                <p className="text-xs text-blue-400 mt-0.5">👤 {calloutWitnesses[proof.callout_id]}</p>
                              ) : null}
                              <p className="text-xs text-gray-500 mt-1">{proof.type === 'depoClip' ? 'Deposition Clip' : 'Exhibit Extract'}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); handleRemoveProof(proof); }}
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
                  <HierarchicalQuestionsList
                    questions={linkedQuestions}
                    evidenceGroupId={selectedGroupId}
                    caseId={activeCase.id}
                    proofItems={proofItems}
                    calloutNames={calloutNames}
                    calloutWitnesses={calloutWitnesses}
                    allWitnesses={allWitnesses}
                    onQuestionCreated={(newQ) => {
                      setLinkedQuestions(qs => [...qs, newQ]);
                      // Link to evidence group if parent
                      if (!newQ.parent_id) {
                        base44.entities.QuestionEvidenceGroups.create({
                          case_id: activeCase.id,
                          question_id: newQ.id,
                          evidence_group_id: selectedGroupId,
                        });
                      }
                    }}
                    onQuestionUpdated={(updatedQ) => {
                      setLinkedQuestions(qs => qs.map(q => q.id === updatedQ.id ? updatedQ : q));
                    }}
                    onQuestionRemoved={(questionId) => {
                      setLinkedQuestions(qs => qs.filter(q => q.id !== questionId));
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg">Select a bucket to view proof</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Dialog open={showNewGroupModal} onOpenChange={setShowNewGroupModal}>
        <DialogContent className="bg-white border-gray-300">
          <DialogHeader>
            <DialogTitle>Create Bucket</DialogTitle>
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
            <DialogTitle>Edit Bucket</DialogTitle>
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
          await loadGroupDetails(selectedGroupId);
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



      <ProofViewerModal
        proofItem={selectedProofItem}
        isOpen={showProofDetails}
        onClose={() => setShowProofDetails(false)}
        onCalloutSelected={(proofItemId, callout) => {
          setCalloutNames(prev => ({ ...prev, [callout.id]: callout.name }));
          setProofItems(prev => prev.map(p => p.id === proofItemId ? { ...p, callout_id: callout.id } : p));
          setSelectedProofItem(prev => prev?.id === proofItemId ? { ...prev, callout_id: callout.id } : prev);
        }}
      />

      <ProofInUseModal
        isOpen={!!proofInUseModalProof}
        proof={proofInUseModalProof}
        caseId={activeCase?.id}
        onClose={() => setProofInUseModalProof(null)}
        onProofDeleted={() => {
          if (proofInUseModalProof) doDeleteProof(proofInUseModalProof.id);
          setProofInUseModalProof(null);
        }}
      />
    </div>
  );
}