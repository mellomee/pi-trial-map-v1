import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, ChevronDown, Trash2 } from 'lucide-react';
import ProofViewerModal from './ProofViewerModal';

export default function QuestionsTab({ evidenceGroup, witnesses, proofItems, caseId }) {
  const [questions, setQuestions] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ question_text: '', party_id: '', exam_type: 'Direct' });
  const [loading, setLoading] = useState(false);
  const [selectedProofItem, setSelectedProofItem] = useState(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [linkedProof, setLinkedProof] = useState({});

  useEffect(() => {
    if (evidenceGroup?.id) loadQuestions();
  }, [evidenceGroup?.id]);

  const loadQuestions = async () => {
    try {
      const witIds = witnesses.map(w => w.id);
      if (witIds.length === 0) {
        setQuestions([]);
        return;
      }

      const allQ = await base44.entities.Questions.filter({ case_id: caseId });
      const filtered = allQ.filter(q => witIds.includes(q.party_id));
      setQuestions(filtered);

      // Load all links in parallel
      const linkResults = await Promise.all(
        filtered.map(q => base44.entities.QuestionLinks.filter({ question_id: q.id }))
      );
      const proofMap = {};
      filtered.forEach((q, i) => {
        proofMap[q.id] = linkResults[i].filter(l => l.link_type === 'DepoClip' || l.link_type === 'JointExhibit' || l.link_type === 'ProofItem');
      });
      setLinkedProof(proofMap);
    } catch (error) {
      console.error('Error loading questions:', error);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.question_text || !newQuestion.party_id) {
      alert('Please enter question text and select a witness');
      return;
    }
    
    setLoading(true);
    try {
      const q = await base44.entities.Questions.create({
        case_id: caseId,
        question_text: newQuestion.question_text,
        party_id: newQuestion.party_id,
        exam_type: newQuestion.exam_type,
        primary_evidence_group_id: evidenceGroup.id,
        order_index: questions.length,
      });
      
      // Create link to evidence group
      await base44.entities.QuestionEvidenceGroups.create({
        case_id: caseId,
        question_id: q.id,
        evidence_group_id: evidenceGroup.id,
      });

      setQuestions([...questions, q]);
      setNewQuestion({ question_text: '', party_id: '', exam_type: 'Direct' });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding question:', error);
    }
    setLoading(false);
  };

  const handleLinkProof = async (questionId, proofItem) => {
    try {
      await base44.entities.QuestionLinks.create({
        case_id: caseId,
        question_id: questionId,
        link_type: 'ProofItem',
        link_id: proofItem.id,
      });
      await loadQuestions();
    } catch (error) {
      console.error('Error linking proof:', error);
    }
  };

  const handleUnlinkProof = async (questionId, linkId) => {
    try {
      await base44.entities.QuestionLinks.delete(linkId);
      setLinkedProof(prev => ({
        ...prev,
        [questionId]: prev[questionId].filter(l => l.id !== linkId),
      }));
    } catch (error) {
      console.error('Error unlinking proof:', error);
    }
  };

  const handleRemoveQuestion = async (questionId) => {
    if (!confirm('Delete this question?')) return;
    try {
      await base44.entities.Questions.delete(questionId);
      setQuestions(qs => qs.filter(q => q.id !== questionId));
    } catch (error) {
      console.error('Error deleting question:', error);
    }
  };

  const getWitness = (witId) => witnesses.find(w => w.id === witId);

  // Build hierarchy from parent_id relationships
  const buildQuestionTree = (allQuestions) => {
    const tree = [];
    const qMap = {};

    // First pass: index all questions
    allQuestions.forEach(q => {
      qMap[q.id] = { ...q, children: [] };
    });

    // Second pass: build parent-child relationships
    allQuestions.forEach(q => {
      if (q.parent_id && qMap[q.parent_id]) {
        // This is a child question
        qMap[q.parent_id].children.push(qMap[q.id]);
      } else {
        // This is a root question
        tree.push(qMap[q.id]);
      }
    });

    return tree;
  };

  const questionTree = buildQuestionTree(questions);

  // Render question and its children recursively
  const renderQuestion = (q, depth = 0) => {
    const witness = getWitness(q.party_id);
    const links = linkedProof[q.id] || [];
    const isExpanded = expandedQuestion === q.id;
    const hasChildren = q.children && q.children.length > 0;

    return (
      <div key={q.id}>
        <div style={{ marginLeft: `${depth * 20}px` }}>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-3">
              <Collapsible open={isExpanded} onOpenChange={(open) => setExpandedQuestion(open ? q.id : null)}>
                <div className="flex items-start gap-2">
                  {hasChildren ? (
                    <CollapsibleTrigger asChild>
                      <button className="text-gray-400 hover:text-white flex-shrink-0 pt-0.5">
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </CollapsibleTrigger>
                  ) : (
                    <div className="w-4 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100">{q.question_text}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs text-gray-400">{witness?.first_name} {witness?.last_name}</Badge>
                      <Badge className={q.exam_type === 'Direct' ? 'bg-green-500/20 text-green-400 text-xs' : 'bg-red-500/20 text-red-400 text-xs'}>
                        {q.exam_type}
                      </Badge>
                      {q.question_type && <Badge className="bg-blue-500/20 text-blue-300 text-xs">{q.question_type}</Badge>}
                      <Badge variant="outline" className="text-xs text-gray-400">{links.length} proof</Badge>
                    </div>
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

                <CollapsibleContent className="mt-3 space-y-2 border-t border-gray-700 pt-2">
                  {/* Linked Proof Section */}
                  {links.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400 font-semibold">LINKED PROOF</p>
                      {links.map((link) => {
                        const proof = proofItems.find(p => 
                          (link.link_type === 'DepoClip' && p.source_id === link.link_id && p.type === 'depoClip') ||
                          (link.link_type === 'JointExhibit' && p.source_id === link.link_id && p.type === 'jointExhibit')
                        );
                        return (
                          <div key={link.id} className="flex items-start justify-between gap-2 bg-[#131a2e] p-2 rounded text-xs">
                            <button
                              onClick={() => proof && (setSelectedProofItem(proof), setShowProofModal(true))}
                              className="flex-1 text-left text-gray-300 hover:text-cyan-400 truncate"
                            >
                              {proof?.label}
                            </button>
                            <button
                              onClick={() => handleUnlinkProof(q.id, link.id)}
                              className="text-gray-400 hover:text-red-400 flex-shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Proof Section */}
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-semibold">ADD PROOF</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {proofItems.map((proof) => {
                        const isLinked = links.some(l => l.link_id === proof.source_id);
                        return (
                          <button
                            key={proof.id}
                            onClick={() => !isLinked && handleLinkProof(q.id, proof)}
                            disabled={isLinked}
                            className={`w-full text-left p-2 rounded text-xs transition-colors ${
                              isLinked
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-[#0a0f1e] text-gray-300 hover:bg-cyan-900 hover:text-cyan-300'
                            }`}
                          >
                            {proof.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Render child questions */}
                  {hasChildren && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-cyan-400 font-semibold">{q.children.length} {q.question_type === 'Follow-Up' ? 'FOLLOW-UPS' : 'IMPEACHMENTS'}</p>
                      <div className="space-y-2">
                        {q.children.map(child => renderQuestion(child, depth + 1))}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  if (!evidenceGroup) {
    return <div className="text-center text-gray-500 py-8">Select an evidence group to view questions</div>;
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={() => setShowAddModal(true)}
        className="bg-cyan-600 hover:bg-cyan-700 w-full"
      >
        <Plus className="w-3 h-3 mr-2" />
        Add Question to {evidenceGroup.title}
      </Button>

      {questionTree.length > 0 ? (
        <div className="space-y-2">
          {questionTree.map(q => renderQuestion(q))}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">No questions for witnesses in this group</p>
        </div>
      )}

      {/* Add Question Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle>Add Question to {evidenceGroup.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Question *</label>
              <textarea
                placeholder="Enter your question..."
                value={newQuestion.question_text}
                onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded p-2 text-sm text-gray-100"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Witness *</label>
                <Select value={newQuestion.party_id} onValueChange={(v) => setNewQuestion({ ...newQuestion, party_id: v })}>
                  <SelectTrigger className="mt-1 bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Select witness..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {witnesses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.first_name} {w.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={newQuestion.exam_type} onValueChange={(v) => setNewQuestion({ ...newQuestion, exam_type: v })}>
                  <SelectTrigger className="mt-1 bg-gray-800 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="Direct">Direct</SelectItem>
                    <SelectItem value="Cross">Cross</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddQuestion} className="bg-cyan-600 hover:bg-cyan-700" disabled={loading}>
              {loading ? 'Creating...' : 'Add Question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProofViewerModal proofItem={selectedProofItem} isOpen={showProofModal} onClose={() => setShowProofModal(false)} />
    </div>
  );
}