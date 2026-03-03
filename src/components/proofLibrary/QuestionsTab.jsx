import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Video, BookOpen, ChevronRight } from 'lucide-react';
import ProofViewerModal from './ProofViewerModal';

export default function QuestionsTab({ evidenceGroup, witnesses, proofItems, caseId, linkedTrialPoints }) {
  const [questions, setQuestions] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ question_text: '', party_id: '', exam_type: 'Direct', expected_answer: '', goal: '', importance: 'Med' });
  const [loading, setLoading] = useState(false);

  // Proof viewer
  const [selectedProofItem, setSelectedProofItem] = useState(null);
  const [showProofModal, setShowProofModal] = useState(false);

  // Per-question: which proof items are linked via QuestionProofItems
  const [questionProofMap, setQuestionProofMap] = useState({}); // questionId -> ProofItem[]

  // Callout metadata for display
  const [calloutNames, setCalloutNames] = useState({}); // calloutId -> name
  const [calloutWitnesses, setCalloutWitnesses] = useState({}); // calloutId -> witness name

  useEffect(() => {
    if (evidenceGroup?.id) loadQuestions();
  }, [evidenceGroup?.id, proofItems.length]);

  const loadQuestions = async () => {
    try {
      const allQ = await base44.entities.Questions.filter({ case_id: caseId });
      // Filter to questions linked to this evidence group
      const egLinks = await base44.entities.QuestionEvidenceGroups.filter({ evidence_group_id: evidenceGroup.id });
      const egQIds = new Set(egLinks.map(l => l.question_id));
      const filtered = allQ.filter(q => egQIds.has(q.id));
      setQuestions(filtered);

      // Load QuestionProofItems links
      const proofMap = {};
      const allQPLinks = await base44.entities.QuestionProofItems.filter({ evidence_group_id: evidenceGroup.id });
      for (const q of filtered) {
        const links = allQPLinks.filter(l => l.question_id === q.id);
        const linkedItems = links.map(l => proofItems.find(p => p.id === l.proof_item_id)).filter(Boolean);
        proofMap[q.id] = linkedItems;
      }
      setQuestionProofMap(proofMap);

      // Load callout names + witnesses for extract proofs
      const allCalloutIds = [...new Set(proofItems.filter(p => p.type === 'extract' && p.callout_id).map(p => p.callout_id))];
      if (allCalloutIds.length > 0) {
        const nameMap = {};
        const witMap = {};
        const partiesInCase = await base44.entities.Parties.filter({ case_id: caseId });
        const partyLookup = {};
        partiesInCase.forEach(p => { partyLookup[p.id] = p.display_name || `${p.first_name || ''} ${p.last_name}`.trim(); });
        for (const cid of allCalloutIds) {
          const cos = await base44.entities.Callouts.filter({ id: cid });
          if (cos.length > 0) {
            nameMap[cid] = cos[0].name;
            if (cos[0].witness_id) witMap[cid] = partyLookup[cos[0].witness_id] || null;
          }
        }
        setCalloutNames(nameMap);
        setCalloutWitnesses(witMap);
      }
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
        expected_answer: newQuestion.expected_answer,
        goal: newQuestion.goal,
        importance: newQuestion.importance,
        primary_evidence_group_id: evidenceGroup.id,
        order_index: questions.length,
      });
      await base44.entities.QuestionEvidenceGroups.create({
        case_id: caseId,
        question_id: q.id,
        evidence_group_id: evidenceGroup.id,
      });
      setQuestions(prev => [...prev, q]);
      setQuestionProofMap(prev => ({ ...prev, [q.id]: [] }));
      setNewQuestion({ question_text: '', party_id: '', exam_type: 'Direct', expected_answer: '', goal: '', importance: 'Med' });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding question:', error);
    }
    setLoading(false);
  };

  const handleRemoveQuestion = async (questionId) => {
    if (!confirm('Remove this question from this evidence group?')) return;
    try {
      const links = await base44.entities.QuestionEvidenceGroups.filter({
        question_id: questionId, evidence_group_id: evidenceGroup.id,
      });
      for (const link of links) await base44.entities.QuestionEvidenceGroups.delete(link.id);
      setQuestions(qs => qs.filter(q => q.id !== questionId));
    } catch (error) {
      console.error('Error removing question:', error);
    }
  };

  const getWitness = (witId) => witnesses.find(w => w.id === witId);

  const getProofIcon = (proof) => {
    if (proof.type === 'depoClip') return <Video className="w-3 h-3 text-blue-400" />;
    return <FileText className="w-3 h-3 text-purple-400" />;
  };

  const getProofSubtitle = (proof) => {
    if (proof.type === 'depoClip') return 'Clip';
    if (proof.callout_id) {
      const name = calloutNames[proof.callout_id];
      const wit = calloutWitnesses[proof.callout_id];
      return [name, wit].filter(Boolean).join(' · ') || 'Extract';
    }
    return 'Extract';
  };

  if (!evidenceGroup) {
    return <div className="text-center text-gray-500 py-8">Select an evidence group to view questions</div>;
  }

  return (
    <div className="space-y-3">
      <Button onClick={() => setShowAddModal(true)} className="bg-cyan-600 hover:bg-cyan-700 w-full" size="sm">
        <Plus className="w-3 h-3 mr-2" />
        Add Question
      </Button>

      {questions.length > 0 ? (
        <div className="space-y-2">
          {questions.map((q, idx) => {
            const witness = getWitness(q.party_id);
            const linkedProofs = questionProofMap[q.id] || [];
            const hasProof = linkedProofs.length > 0;

            return (
              <div key={q.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg overflow-hidden">
                {/* Question row */}
                <div className="flex items-start gap-2 px-3 py-3">
                  {/* Number badge */}
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-600/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100 leading-snug">{q.question_text}</p>

                    {/* Meta row */}
                    <div className="flex gap-2 mt-1.5 flex-wrap items-center">
                      {witness && (
                        <Badge variant="outline" className="text-[10px] text-cyan-300 border-cyan-700 px-1.5 py-0">
                          {witness.display_name || `${witness.first_name || ''} ${witness.last_name}`.trim()}
                        </Badge>
                      )}
                      <Badge className={`text-[10px] px-1.5 py-0 ${q.exam_type === 'Direct' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {q.exam_type}
                      </Badge>
                      {q.importance && q.importance !== 'Med' && (
                        <Badge className={`text-[10px] px-1.5 py-0 ${q.importance === 'High' ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {q.importance}
                        </Badge>
                      )}
                      {/* Proof indicator */}
                      {hasProof && (
                        <span className="text-[10px] text-purple-400 font-medium flex items-center gap-0.5">
                          <BookOpen className="w-3 h-3" /> {linkedProofs.length} proof
                        </span>
                      )}
                      {/* Trial points from group */}
                      {(linkedTrialPoints || []).slice(0, 1).map(tp => (
                        <Badge key={tp.id} variant="outline" className="text-[10px] text-yellow-400 border-yellow-700 px-1.5 py-0 max-w-[120px] truncate">
                          {tp.point_text}
                        </Badge>
                      ))}
                    </div>

                    {/* Expected answer */}
                    {q.expected_answer && (
                      <p className="text-[11px] text-gray-500 mt-1.5 border-l-2 border-gray-700 pl-2 italic">
                        A: {q.expected_answer}
                      </p>
                    )}

                    {/* Proof items — clickable to open viewer */}
                    {hasProof && (
                      <div className="mt-2 flex flex-col gap-1">
                        {linkedProofs.map(proof => (
                          <button
                            key={proof.id}
                            onClick={() => { setSelectedProofItem(proof); setShowProofModal(true); }}
                            className="flex items-center gap-1.5 text-left bg-[#0a0f1e] border border-[#1e2a45] rounded px-2 py-1.5 hover:border-cyan-500/50 hover:bg-cyan-900/20 transition-colors group"
                          >
                            {getProofIcon(proof)}
                            <span className="text-[11px] text-gray-300 group-hover:text-cyan-300 flex-1 truncate">{proof.label}</span>
                            {getProofSubtitle(proof) !== proof.label && (
                              <span className="text-[10px] text-gray-500 truncate">{getProofSubtitle(proof)}</span>
                            )}
                            <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-cyan-400 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleRemoveQuestion(q.id)}
                    className="h-6 w-6 flex-shrink-0 text-gray-600 hover:text-red-400 text-sm leading-none mt-0.5"
                    title="Remove from group"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8 border border-dashed border-gray-700 rounded-lg">
          <p className="text-sm">No questions for this group yet</p>
          <p className="text-xs mt-1">Add questions and they'll be linked to this evidence group</p>
        </div>
      )}

      {/* Add Question Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-[#0f1629] border-[#1e2a45]">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Add Question — {evidenceGroup.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300">Question *</label>
              <Textarea
                placeholder="Enter your question..."
                value={newQuestion.question_text}
                onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                className="mt-1 bg-[#0a0f1e] border-[#1e2a45] text-slate-100 placeholder:text-slate-600"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-300">Witness *</label>
                <Select value={newQuestion.party_id} onValueChange={(v) => setNewQuestion({ ...newQuestion, party_id: v })}>
                  <SelectTrigger className="mt-1 bg-[#0a0f1e] border-[#1e2a45] text-slate-100">
                    <SelectValue placeholder="Select witness..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#131a2e] border-[#1e2a45]">
                    {witnesses.map((w) => (
                      <SelectItem key={w.id} value={w.id} className="text-slate-100 focus:bg-cyan-600 focus:text-white">
                        {w.display_name || `${w.first_name || ''} ${w.last_name}`.trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">Type</label>
                <Select value={newQuestion.exam_type} onValueChange={(v) => setNewQuestion({ ...newQuestion, exam_type: v })}>
                  <SelectTrigger className="mt-1 bg-[#0a0f1e] border-[#1e2a45] text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#131a2e] border-[#1e2a45]">
                    <SelectItem value="Direct" className="text-slate-100 focus:bg-cyan-600 focus:text-white">Direct</SelectItem>
                    <SelectItem value="Cross" className="text-slate-100 focus:bg-cyan-600 focus:text-white">Cross</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Expected Answer</label>
              <Input
                placeholder="What answer do you expect?"
                value={newQuestion.expected_answer}
                onChange={(e) => setNewQuestion({ ...newQuestion, expected_answer: e.target.value })}
                className="mt-1 bg-[#0a0f1e] border-[#1e2a45] text-slate-100 placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Goal</label>
              <Input
                placeholder="What are you trying to establish?"
                value={newQuestion.goal}
                onChange={(e) => setNewQuestion({ ...newQuestion, goal: e.target.value })}
                className="mt-1 bg-[#0a0f1e] border-[#1e2a45] text-slate-100 placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Importance</label>
              <Select value={newQuestion.importance} onValueChange={(v) => setNewQuestion({ ...newQuestion, importance: v })}>
                <SelectTrigger className="mt-1 bg-[#0a0f1e] border-[#1e2a45] text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#131a2e] border-[#1e2a45]">
                  <SelectItem value="High" className="text-slate-100 focus:bg-cyan-600 focus:text-white">High</SelectItem>
                  <SelectItem value="Med" className="text-slate-100 focus:bg-cyan-600 focus:text-white">Medium</SelectItem>
                  <SelectItem value="Low" className="text-slate-100 focus:bg-cyan-600 focus:text-white">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} className="border-[#1e2a45] text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleAddQuestion} className="bg-cyan-600 hover:bg-cyan-700" disabled={loading}>
              {loading ? 'Creating...' : 'Add Question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProofViewerModal
        proofItem={selectedProofItem}
        isOpen={showProofModal}
        onClose={() => setShowProofModal(false)}
      />
    </div>
  );
}