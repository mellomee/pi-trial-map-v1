import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Pencil, Trash2, ExternalLink, Link as LinkIcon } from 'lucide-react';

export default function QuestionsListWithProofs({
  questions,
  evidenceGroupId,
  caseId,
  proofItems,
  calloutNames,
  calloutWitnesses,
  allWitnesses,
  onQuestionEdit,
  onQuestionRemove,
  onProofAdded,
}) {
  const [questionProofLinks, setQuestionProofLinks] = useState({});
  const [showProofSelector, setShowProofSelector] = useState(null);
  const [selectedWitnessForProof, setSelectedWitnessForProof] = useState(null);

  useEffect(() => {
    loadQuestionProofLinks();
  }, [evidenceGroupId, questions]);

  const loadQuestionProofLinks = async () => {
    if (!evidenceGroupId) return;
    try {
      const links = await base44.entities.QuestionProofItems.filter({
        evidence_group_id: evidenceGroupId,
      });
      const linkMap = {};
      links.forEach(link => {
        if (!linkMap[link.question_id]) linkMap[link.question_id] = [];
        linkMap[link.question_id].push(link.proof_item_id);
      });
      setQuestionProofLinks(linkMap);
    } catch (error) {
      console.error('Error loading question proof links:', error);
    }
  };

  const getWitnessName = (partyId) => {
    const w = allWitnesses.find(x => x.id === partyId);
    return w ? (w.display_name || `${w.first_name || ''} ${w.last_name || ''}`.trim()) : 'Unassigned';
  };

  const getLinkedProofsForQuestion = (questionId) => {
    const linkedProofIds = questionProofLinks[questionId] || [];
    return proofItems.filter(p => linkedProofIds.includes(p.id));
  };

  const getProofsForWitness = (witnessId) => {
    // Filter proof items by witness
    return proofItems.filter(p => {
      if (p.type === 'depoClip') {
        // For depo clips, check if the witness is the deponent
        return true; // TODO: check deposition witness
      } else if (p.type === 'extract') {
        // For extracts, check callout witness
        return calloutWitnesses[p.callout_id] ? true : false;
      }
      return false;
    });
  };

  const handleAttachProof = async (questionId, proofItemId) => {
    try {
      // Check if already linked
      const existing = questionProofLinks[questionId] || [];
      if (existing.includes(proofItemId)) return;

      // Create the link
      await base44.entities.QuestionProofItems.create({
        case_id: caseId,
        question_id: questionId,
        evidence_group_id: evidenceGroupId,
        proof_item_id: proofItemId,
      });

      // Update local state
      setQuestionProofLinks(prev => ({
        ...prev,
        [questionId]: [...(prev[questionId] || []), proofItemId],
      }));

      setShowProofSelector(null);
      onProofAdded && onProofAdded(proofItemId);
    } catch (error) {
      console.error('Error attaching proof:', error);
    }
  };

  const handleRemoveProofLink = async (questionId, proofItemId) => {
    try {
      const links = await base44.entities.QuestionProofItems.filter({
        question_id: questionId,
        proof_item_id: proofItemId,
      });
      if (links.length > 0) {
        await base44.entities.QuestionProofItems.delete(links[0].id);
        setQuestionProofLinks(prev => ({
          ...prev,
          [questionId]: (prev[questionId] || []).filter(id => id !== proofItemId),
        }));
      }
    } catch (error) {
      console.error('Error removing proof link:', error);
    }
  };

  const parentQuestions = questions.filter(q => !q.parent_id).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  return (
    <>
      <div className="space-y-3">
        {parentQuestions.length > 0 ? (
          <div className="space-y-2">
            {parentQuestions.map((q) => {
              const linkedProofs = getLinkedProofsForQuestion(q.id);
              const witnessName = getWitnessName(q.party_id);

              return (
                <div key={q.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-4 space-y-3">
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100">{q.question_text}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-xs">
                        <span className="text-slate-400">{q.exam_type}</span>
                        <span className="text-cyan-400 flex items-center gap-0.5">👤 {witnessName}</span>
                        {q.goal && (
                          <span className="text-slate-400">
                            Goal: <span className="text-cyan-300">{q.goal}</span>
                          </span>
                        )}
                        {q.expected_answer && (
                          <span className="text-slate-400">
                            Expected: <span className="text-cyan-300">{q.expected_answer}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onQuestionEdit(q)}
                        className="h-6 w-6 p-0 text-slate-500 hover:text-cyan-400"
                        title="Edit question"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onQuestionRemove(q.id)}
                        className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                        title="Remove question"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>

                  {/* Linked Proofs Section */}
                  <div className="border-t border-[#1e2a45] pt-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      LINKED PROOF:
                    </p>
                    {linkedProofs.length > 0 ? (
                      <div className="space-y-1.5 mb-2">
                        {linkedProofs.map((proof) => (
                          <div
                            key={proof.id}
                            className="text-xs bg-[#0f1629] rounded p-2.5 flex items-start justify-between gap-2 border border-[#1e2a45]"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-200">{proof.label}</p>
                              {proof.type === 'extract' && proof.callout_id && calloutNames[proof.callout_id] && (
                                <p className="text-slate-500 text-[11px]">↳ {calloutNames[proof.callout_id]}</p>
                              )}
                              {proof.type === 'extract' && proof.callout_id && calloutWitnesses[proof.callout_id] && (
                                <p className="text-cyan-500 text-[11px] flex items-center gap-0.5 mt-0.5">
                                  👤 {calloutWitnesses[proof.callout_id]}
                                </p>
                              )}
                              <p className="text-slate-600 text-[10px] mt-1">
                                {proof.type === 'depoClip' ? 'Deposition Clip' : 'Exhibit Extract'}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemoveProofLink(q.id, proof.id)}
                              className="h-5 w-5 p-0 text-slate-500 hover:text-red-400 flex-shrink-0 mt-0.5"
                              title="Remove proof link"
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 italic mb-2">No proof linked yet</p>
                    )}

                    {/* Add Proof Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedWitnessForProof(q.party_id);
                        setShowProofSelector(q.id);
                      }}
                      className="w-full h-7 text-xs border-[#1e2a45] text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Proof
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-slate-600 mt-4 py-6 border border-dashed border-[#1e2a45] rounded">
            <p className="text-sm">No questions for this group</p>
          </div>
        )}
      </div>

      {/* Proof Selector Modal */}
      <Dialog open={!!showProofSelector} onOpenChange={() => setShowProofSelector(null)}>
        <DialogContent className="bg-[#0a0f1e] border-[#1e2a45] max-w-2xl max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Select Proof for {getWitnessName(selectedWitnessForProof)}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto pr-4">
            <div className="space-y-2">
              {/* Deposition Clips */}
              {proofItems
                .filter(p => p.type === 'depoClip')
                .map(proof => (
                  <div
                    key={proof.id}
                    className="bg-[#131a2e] border border-[#1e2a45] rounded p-3 hover:border-cyan-500/50 cursor-pointer transition-colors"
                    onClick={() => handleAttachProof(showProofSelector, proof.id)}
                  >
                    <p className="text-sm font-medium text-slate-200">{proof.label}</p>
                    <p className="text-xs text-slate-600 mt-1">Deposition Clip</p>
                  </div>
                ))}

              {/* Exhibit Extracts with Callouts */}
              {proofItems
                .filter(p => p.type === 'extract')
                .map(proof => (
                  <div
                    key={proof.id}
                    className="bg-[#131a2e] border border-[#1e2a45] rounded p-3 hover:border-cyan-500/50 cursor-pointer transition-colors"
                    onClick={() => handleAttachProof(showProofSelector, proof.id)}
                  >
                    <p className="text-sm font-medium text-slate-200">{proof.label}</p>
                    {proof.callout_id && calloutNames[proof.callout_id] && (
                      <p className="text-xs text-cyan-400 mt-1">↳ {calloutNames[proof.callout_id]}</p>
                    )}
                    {proof.callout_id && calloutWitnesses[proof.callout_id] && (
                      <p className="text-xs text-slate-500 mt-0.5">👤 {calloutWitnesses[proof.callout_id]}</p>
                    )}
                    <p className="text-xs text-slate-600 mt-1">Exhibit Extract</p>
                  </div>
                ))}

              {proofItems.length === 0 && (
                <p className="text-center text-slate-600 py-8">No proof items available</p>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowProofSelector(null)}
              className="border-[#1e2a45] text-slate-400"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}