import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

/**
 * Modal shown when a user tries to delete a proof that is linked to questions.
 * Displays which questions use this proof, allows removing all those links, then deleting the proof.
 */
export default function ProofInUseModal({ isOpen, onClose, proof, caseId, onProofDeleted }) {
  const [linkedQuestions, setLinkedQuestions] = useState([]); // { question, linkId }
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (isOpen && proof) loadLinkedQuestions();
    else setLinkedQuestions([]);
  }, [isOpen, proof?.id]);

  const loadLinkedQuestions = async () => {
    setLoading(true);
    try {
      // Find all QuestionProofItems linking to this proof
      const links = await base44.entities.QuestionProofItems.filter({ proof_item_id: proof.id });
      if (links.length === 0) {
        setLinkedQuestions([]);
        setLoading(false);
        return;
      }
      // Fetch all linked questions
      const questionIds = [...new Set(links.map(l => l.question_id))];
      const allCaseQuestions = await base44.entities.Questions.filter({ case_id: caseId });
      const qMap = {};
      allCaseQuestions.forEach(q => { qMap[q.id] = q; });

      const result = questionIds
        .map(qId => ({
          question: qMap[qId],
          links: links.filter(l => l.question_id === qId),
        }))
        .filter(r => r.question); // only include if question still exists

      setLinkedQuestions(result);
    } catch (err) {
      console.error('Error loading linked questions:', err);
    }
    setLoading(false);
  };

  const handleRemoveAllAndDelete = async () => {
    setRemoving(true);
    try {
      // Remove all QuestionProofItems links
      const allLinks = await base44.entities.QuestionProofItems.filter({ proof_item_id: proof.id });
      await Promise.all(allLinks.map(l => base44.entities.QuestionProofItems.delete(l.id)));
      // Now safe to delete
      onProofDeleted();
      onClose();
    } catch (err) {
      console.error('Error removing proof links:', err);
    }
    setRemoving(false);
  };

  const handleRemoveSingleLink = async (questionId) => {
    try {
      const links = await base44.entities.QuestionProofItems.filter({ proof_item_id: proof.id, question_id: questionId });
      await Promise.all(links.map(l => base44.entities.QuestionProofItems.delete(l.id)));
      setLinkedQuestions(prev => prev.filter(r => r.question.id !== questionId));
    } catch (err) {
      console.error('Error removing single link:', err);
    }
  };

  const canDelete = linkedQuestions.length === 0 && !loading;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f1629] border-[#1e2a45] text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Proof In Use
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">"{proof?.label}"</span> is currently linked to the following questions.
            Remove all links before deleting.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading linked questions…</span>
            </div>
          ) : linkedQuestions.length === 0 ? (
            <div className="bg-green-900/20 border border-green-500/30 rounded p-3 text-sm text-green-400">
              ✓ No questions are linked to this proof. You can now delete it.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {linkedQuestions.map(({ question }) => (
                <div key={question.id} className="flex items-start justify-between gap-2 bg-[#131a2e] border border-[#1e2a45] rounded p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 leading-tight">{question.question_text}</p>
                    <div className="flex gap-1 mt-1">
                      <Badge className={question.exam_type === 'Direct' ? 'bg-green-500/20 text-green-400 text-[10px]' : 'bg-red-500/20 text-red-400 text-[10px]'}>
                        {question.exam_type}
                      </Badge>
                      {question.question_type && (
                        <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">{question.question_type}</Badge>
                      )}
                      {question.parent_id && (
                        <Badge variant="outline" className="text-slate-500 border-slate-600 text-[10px]">Child</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 text-slate-500 hover:text-red-400 flex-shrink-0"
                    title="Remove this link"
                    onClick={() => handleRemoveSingleLink(question.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
            Cancel
          </Button>
          {!loading && linkedQuestions.length > 0 && (
            <Button
              onClick={handleRemoveAllAndDelete}
              disabled={removing}
              className="bg-red-600 hover:bg-red-700"
            >
              {removing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Trash2 className="w-3 h-3 mr-2" />}
              Remove All Links & Delete Proof
            </Button>
          )}
          {canDelete && (
            <Button
              onClick={() => { onProofDeleted(); onClose(); }}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Delete Proof
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}