import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Link2 } from 'lucide-react';

export default function QuestionProofLinker({ questionId, evidenceGroupId, caseId, proofItems, calloutNames = {}, calloutWitnesses = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [linkedProofIds, setLinkedProofIds] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && questionId) {
      loadLinkedProofs();
    }
  }, [isOpen, questionId]);

  const loadLinkedProofs = async () => {
    try {
      const links = await base44.entities.QuestionProofItems.filter({
        question_id: questionId,
        evidence_group_id: evidenceGroupId,
      });
      setLinkedProofIds(links.map(l => l.proof_item_id));
    } catch (error) {
      console.error('Error loading linked proofs:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Delete existing links
      const existing = await base44.entities.QuestionProofItems.filter({
        question_id: questionId,
        evidence_group_id: evidenceGroupId,
      });
      for (const link of existing) {
        await base44.entities.QuestionProofItems.delete(link.id);
      }

      // Create new links
      for (let i = 0; i < linkedProofIds.length; i++) {
        await base44.entities.QuestionProofItems.create({
          case_id: caseId,
          question_id: questionId,
          proof_item_id: linkedProofIds[i],
          evidence_group_id: evidenceGroupId,
          order_index: i,
        });
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving linked proofs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProof = (proofId) => {
    setLinkedProofIds(ids =>
      ids.includes(proofId)
        ? ids.filter(id => id !== proofId)
        : [...ids, proofId]
    );
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsOpen(true)}
        className="h-7 w-7 p-0 text-gray-400 hover:text-cyan-400"
        title="Link to proofs"
      >
        <Link2 className="w-3 h-3" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-cyan-300">Link Proofs to Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {proofItems.length === 0 ? (
              <p className="text-sm text-slate-400">No proofs in this evidence group</p>
            ) : (
              proofItems.map(proof => {
                const calloutName = proof.type === 'extract' && proof.callout_id ? calloutNames[proof.callout_id] : null;
                const calloutWitness = proof.type === 'extract' && proof.callout_id ? calloutWitnesses[proof.callout_id] : null;
                return (
                  <label
                    key={proof.id}
                    className="flex items-start gap-3 p-2.5 border border-[#1e2a45] rounded cursor-pointer hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-colors"
                  >
                    <Checkbox
                      checked={linkedProofIds.includes(proof.id)}
                      onCheckedChange={() => handleToggleProof(proof.id)}
                      className="mt-0.5 border-slate-400 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100">{proof.label}</p>
                      {calloutName && <p className="text-xs text-cyan-400 mt-0.5">↳ {calloutName}</p>}
                      {calloutWitness && <p className="text-xs text-blue-400 mt-0.5">👤 {calloutWitness}</p>}
                      <p className="text-xs text-slate-500 mt-0.5">{proof.type === 'depoClip' ? 'Depo Clip' : 'Exhibit Extract'}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} className="border-slate-500 text-slate-300 hover:bg-slate-700">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} className="bg-cyan-600 hover:bg-cyan-700">
              Save Links
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}