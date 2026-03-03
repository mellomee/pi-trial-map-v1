import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight, Link2, ExternalLink, Copy } from 'lucide-react';
import ProofViewerModal from '@/components/proofLibrary/ProofViewerModal';
import AddQuestionProofModal from '@/components/proofLibrary/AddQuestionProofModal.jsx';

export default function HierarchicalQuestionsList({
  questions,
  evidenceGroupId,
  caseId,
  proofItems,
  calloutNames,
  calloutWitnesses,
  allWitnesses,
  questionProofLinks,
  onQuestionCreated,
  onQuestionUpdated,
  onQuestionRemoved,
}) {
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [parentQuestionForChild, setParentQuestionForChild] = useState(null);
  const [linkedProofsByQuestion, setLinkedProofsByQuestion] = useState(questionProofLinks || {});
  const [selectedProofItem, setSelectedProofItem] = useState(null);
  const [showProofDetails, setShowProofDetails] = useState(false);
  const [showAddProofModal, setShowAddProofModal] = useState(false);
  const [selectedQuestionForProof, setSelectedQuestionForProof] = useState(null);
  const [cachedProofItems, setCachedProofItems] = useState({});
  const [collapseAll, setCollapseAll] = useState(false);

  useEffect(() => {
    loadLinkedProofs();
    loadProofItemsCache();
  }, [questions, evidenceGroupId, proofItems]);
  
  useEffect(() => {
    if (collapseAll) {
      setExpandedParents(new Set());
      setCollapseAll(false);
    }
  }, [collapseAll]);

  const loadProofItemsCache = () => {
    const pMap = {};
    proofItems.forEach(p => {
      pMap[p.id] = p;
    });
    setCachedProofItems(pMap);
  };

  const loadLinkedProofs = async () => {
    if (!evidenceGroupId) return;
    try {
      const links = await base44.entities.QuestionProofItems.filter({
        evidence_group_id: evidenceGroupId,
      });
      const proofMap = {};
      links.forEach(link => {
        if (!proofMap[link.question_id]) proofMap[link.question_id] = [];
        proofMap[link.question_id].push(link.proof_item_id);
      });
      setLinkedProofsByQuestion(proofMap);
    } catch (error) {
      console.error('Error loading linked proofs:', error);
    }
  };

  const getChildQuestions = (parentId) => {
    return questions.filter(q => q.parent_id === parentId).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  };

  const getParentQuestions = () => {
    return questions.filter(q => !q.parent_id).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  };

  const updateQuestionOrder = async (updatedQuestions) => {
    try {
      const updates = updatedQuestions.map((q, i) => 
        base44.entities.Questions.update(q.id, { order_index: i })
      );
      await Promise.allSettled(updates);
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const getWitnessName = (partyId) => {
    const p = allWitnesses.find(w => w.id === partyId);
    return p ? (p.display_name || `${p.first_name} ${p.last_name}`.trim()) : 'Unassigned';
  };

  const toggleParent = (parentId) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const handleAddChild = (parentQuestion, childType) => {
    setParentQuestionForChild(parentQuestion);
    setEditingQuestion({
      party_id: parentQuestion.party_id,
      exam_type: parentQuestion.exam_type,
      question_text: '',
      goal: '',
      expected_answer: '',
      status: 'NotAsked',
      importance: 'Med',
      live_notes: '',
      question_type: childType,
      parent_id: parentQuestion.id,
      case_id: caseId,
      primary_evidence_group_id: evidenceGroupId,
    });
    setShowModal(true);
  };

  const handleEditQuestion = (q) => {
    setParentQuestionForChild(q.parent_id ? questions.find(x => x.id === q.parent_id) : null);
    setEditingQuestion({ ...q });
    setShowModal(true);
  };

  const handleSaveQuestion = async () => {
    if (!editingQuestion.question_text) return;
    try {
      if (editingQuestion.id) {
        await base44.entities.Questions.update(editingQuestion.id, editingQuestion);
        onQuestionUpdated && onQuestionUpdated(editingQuestion);
      } else {
        const newQ = await base44.entities.Questions.create(editingQuestion);
        onQuestionCreated && onQuestionCreated(newQ);
        if (parentQuestionForChild) {
          setExpandedParents(prev => new Set([...prev, parentQuestionForChild.id]));
        }
      }
      setShowModal(false);
      setEditingQuestion(null);
      setParentQuestionForChild(null);
    } catch (error) {
      console.error('Error saving question:', error);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!confirm('Delete this question?')) return;
    try {
      // Delete all child questions first
      const children = getChildQuestions(questionId);
      for (const child of children) {
        await base44.entities.Questions.delete(child.id);
      }
      // Delete proof links
      const proofLinks = await base44.entities.QuestionProofItems.filter({ question_id: questionId });
      for (const link of proofLinks) {
        await base44.entities.QuestionProofItems.delete(link.id);
      }
      // Delete the question itself
      await base44.entities.Questions.delete(questionId);
      onQuestionRemoved && onQuestionRemoved(questionId);
    } catch (error) {
      console.error('Error deleting question:', error);
    }
  };

  const renderQuestion = (q, isChild = false, index = 0, parentCount = 0) => {
    const linkedProofIds = linkedProofsByQuestion[q.id] || [];
    const children = getChildQuestions(q.id);
    const isExpanded = expandedParents.has(q.id);
    const num = isChild ? '' : `${index + 1}.`;

    return (
      <div key={q.id} className="space-y-2">
        <div className={`bg-gray-700 border border-gray-600 rounded p-3 ${isChild ? 'ml-6 bg-gray-750' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex gap-2 items-start">
                {children.length > 0 && (
                  <button
                    onClick={() => toggleParent(q.id)}
                    className="text-cyan-400 hover:text-cyan-300 flex-shrink-0 mt-0.5"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100">{num && <span className="text-cyan-400">{num}</span>} {q.question_text}</p>
                  <div className="flex gap-2 mt-1 flex-wrap items-center">
                    <Badge className="bg-blue-500/20 text-blue-400 text-xs">{q.exam_type}</Badge>
                    {q.question_type && <Badge className="bg-purple-500/20 text-purple-400 text-xs">{q.question_type}</Badge>}
                    <Badge variant="outline" className="text-gray-400 border-gray-600 text-xs">{getWitnessName(q.party_id)}</Badge>
                    {q.goal && <span className="text-xs text-gray-400">Goal: {q.goal}</span>}
                    {q.expected_answer && <span className="text-xs text-cyan-400">Expected: {q.expected_answer}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-0.5 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setSelectedQuestionForProof(q); setShowAddProofModal(true); }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-cyan-400"
                title="Link proof"
              >
                <Link2 className="w-3 h-3" />
              </Button>
              {!q.parent_id && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddChild(q, 'Follow-Up')}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-blue-400"
                    title="Add follow-up"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddChild(q, 'Impeachment')}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-purple-400"
                    title="Add impeachment"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEditQuestion(q)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-cyan-400"
                title="Edit"
              >
                <Pencil className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteQuestion(q.id)}
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Linked proofs */}
          {linkedProofIds.length > 0 && (
            <div className="border-t border-gray-600 mt-2 pt-2 space-y-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase">Linked Proof:</p>
              {linkedProofIds.map(proofId => {
                const proof = proofItems.find(p => p.id === proofId);
                if (!proof) return null;
                return (
                  <div key={proofId} className="text-xs text-gray-200 bg-gray-600/30 rounded p-2 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-100">{proof.label}</p>
                      {proof.type === 'extract' && proof.callout_id && calloutNames[proof.callout_id] && (
                        <p className="text-gray-400">↳ {calloutNames[proof.callout_id]}</p>
                      )}
                      {proof.type === 'extract' && proof.callout_id && calloutWitnesses[proof.callout_id] && (
                        <p className="text-blue-400">👤 {calloutWitnesses[proof.callout_id]}</p>
                      )}
                      <p className="text-gray-500">{proof.type === 'depoClip' ? 'Deposition Clip' : 'Exhibit Extract'}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setSelectedProofItem(proof); setShowProofDetails(true); }}
                      className="h-5 w-5 p-0 text-gray-500 hover:text-cyan-400 flex-shrink-0"
                      title="View proof"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}


        </div>

        {/* Child questions */}
        {isExpanded && children.length > 0 && (
          <div className="space-y-2">
            {children.map(child => renderQuestion(child, true))}
          </div>
        )}
      </div>
    );
  };

  const parentQuestions = getParentQuestions();

  return (
    <>
      <div className="space-y-3">
        <Button
          onClick={() => {
            setParentQuestionForChild(null);
            setEditingQuestion({
              party_id: '',
              exam_type: 'Direct',
              question_text: '',
              goal: '',
              expected_answer: '',
              status: 'NotAsked',
              importance: 'Med',
              live_notes: '',
              case_id: caseId,
              primary_evidence_group_id: evidenceGroupId,
            });
            setShowModal(true);
          }}
          className="bg-cyan-600 hover:bg-cyan-700 w-full"
        >
          <Plus className="w-3 h-3 mr-2" />
          Add Question
        </Button>

        {parentQuestions.length > 0 ? (
          <div className="space-y-2">
            {parentQuestions.map(q => renderQuestion(q))}
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-4 py-4 border border-dashed border-gray-700 rounded">
            <p className="text-sm">No questions yet</p>
          </div>
        )}
      </div>

      {/* Proof viewer modal */}
      <ProofViewerModal
        proofItem={selectedProofItem}
        isOpen={showProofDetails}
        onClose={() => setShowProofDetails(false)}
      />

      {/* Add proof to question modal */}
      {selectedQuestionForProof && (
        <AddQuestionProofModal
          isOpen={showAddProofModal}
          onClose={() => { setShowAddProofModal(false); setSelectedQuestionForProof(null); }}
          question={selectedQuestionForProof}
          evidenceGroupId={evidenceGroupId}
          caseId={caseId}
          onProofLinked={async () => {
            setShowAddProofModal(false);
            setSelectedQuestionForProof(null);
            // Reload linked proofs
            const links = await base44.entities.QuestionProofItems.filter({
              evidence_group_id: evidenceGroupId,
            });
            const proofMap = {};
            links.forEach(link => {
              if (!proofMap[link.question_id]) proofMap[link.question_id] = [];
              proofMap[link.question_id].push(link.proof_item_id);
            });
            setLinkedProofsByQuestion(proofMap);
          }}
        />
      )}

      {/* Add/Edit Question Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-100">
              {editingQuestion?.id ? 'Edit' : 'Add'} Question
              {parentQuestionForChild && (
                <p className="text-xs text-cyan-400 font-normal mt-2">
                  Child of: {parentQuestionForChild.question_text}
                </p>
              )}
            </DialogTitle>
          </DialogHeader>

          {editingQuestion && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-400">Question *</label>
                <Textarea
                  value={editingQuestion.question_text}
                  onChange={e => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700 text-gray-100"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-400">Witness *</label>
                  <Select
                    value={editingQuestion.party_id || ''}
                    onValueChange={v => setEditingQuestion({ ...editingQuestion, party_id: v })}
                    disabled={!!parentQuestionForChild}
                  >
                    <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-gray-100">
                      <SelectValue placeholder="Select witness..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allWitnesses.map(w => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.display_name || `${w.first_name} ${w.last_name}`.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-400">Type</label>
                  <Select
                    value={editingQuestion.exam_type}
                    onValueChange={v => setEditingQuestion({ ...editingQuestion, exam_type: v })}
                    disabled={!!parentQuestionForChild}
                  >
                    <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-gray-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Direct">Direct</SelectItem>
                      <SelectItem value="Cross">Cross</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editingQuestion.question_type && (
                <div className="text-xs text-purple-400 bg-purple-500/10 p-2 rounded">
                  Question Type: <strong>{editingQuestion.question_type}</strong>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-400">Goal</label>
                <Input
                  value={editingQuestion.goal || ''}
                  onChange={e => setEditingQuestion({ ...editingQuestion, goal: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700 text-gray-100"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400">Expected Answer</label>
                <Input
                  value={editingQuestion.expected_answer || ''}
                  onChange={e => setEditingQuestion({ ...editingQuestion, expected_answer: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700 text-gray-100"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400">Importance</label>
                <Select
                  value={editingQuestion.importance || 'Med'}
                  onValueChange={v => setEditingQuestion({ ...editingQuestion, importance: v })}
                >
                  <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Med">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400">Live Notes</label>
                <Textarea
                  value={editingQuestion.live_notes || ''}
                  onChange={e => setEditingQuestion({ ...editingQuestion, live_notes: e.target.value })}
                  className="mt-1 bg-gray-800 border-gray-700 text-gray-100"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setEditingQuestion(null);
                setParentQuestionForChild(null);
              }}
              className="border-gray-700 text-gray-300"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveQuestion} className="bg-cyan-600 hover:bg-cyan-700">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}