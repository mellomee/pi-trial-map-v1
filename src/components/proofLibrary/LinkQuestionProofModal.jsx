import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image, ChevronLeft, ChevronRight } from 'lucide-react';
import ProofViewerModal from '@/components/proofLibrary/ProofViewerModal';

export default function LinkQuestionProofModal({
  isOpen,
  onClose,
  question,
  evidenceGroupId,
  caseId,
  onProofLinked,
}) {
  const [loading, setLoading] = useState(false);
  const [proofItems, setProofItems] = useState([]);
  const [filteredProofs, setFilteredProofs] = useState([]);
  const [selectedProof, setSelectedProof] = useState(null);
  const [showProofViewer, setShowProofViewer] = useState(false);
  const [caseParties, setCaseParties] = useState({});
  const [previewProof, setPreviewProof] = useState(null);

  useEffect(() => {
    if (isOpen && evidenceGroupId && question?.party_id) {
      loadProofs();
    }
  }, [isOpen, evidenceGroupId, question?.party_id]);

  const loadProofs = async () => {
    setLoading(true);
    try {
      // 1. Load all ProofItems in this evidence group
      const groupLinks = await base44.entities.EvidenceGroupProofItems.filter({
        evidence_group_id: evidenceGroupId,
      });

      if (groupLinks.length === 0) {
        setProofItems([]);
        setFilteredProofs([]);
        setLoading(false);
        return;
      }

      const proofIds = groupLinks.map((l) => l.proof_item_id);

      // 2. Fetch all ProofItems in parallel
      const proofResults = await Promise.all(proofIds.map(pid => base44.entities.ProofItems.filter({ id: pid })));
      const allProofs = proofResults.flatMap(r => r.length > 0 ? [r[0]] : []);

      // 3. Load case parties for witness name resolution
      const parts = await base44.entities.Parties.filter({ case_id: caseId });
      const partyMap = {};
      parts.forEach((p) => {
        partyMap[p.id] = p.display_name || `${p.first_name || ''} ${p.last_name}`.trim();
      });
      setCaseParties(partyMap);

      setProofItems(allProofs);

      // 4. Filter proofs and load callout names
      const extractProofs = allProofs.filter(p => p.type === 'extract' && p.callout_id);
      const calloutResults = await Promise.all(extractProofs.map(p => base44.entities.Callouts.filter({ id: p.callout_id })));
      const calloutMap = {};
      extractProofs.forEach((p, i) => {
        if (calloutResults[i].length > 0) calloutMap[p.callout_id] = calloutResults[i][0];
      });

      const filtered = [];
      for (const proof of allProofs) {
        if (proof.type === 'depoClip') {
          filtered.push({ ...proof, _calloutName: null });
        } else if (proof.type === 'extract') {
          if (!proof.callout_id) {
            // No callout — include as-is
            filtered.push({ ...proof, _calloutName: null });
          } else {
            const callout = calloutMap[proof.callout_id];
            if (callout && callout.witness_id === question.party_id) {
              filtered.push({ ...proof, _calloutName: callout.name || null });
            }
          }
        }
      }

      setFilteredProofs(filtered);
      setSelectedProof(null);
    } catch (error) {
      console.error('Error loading proofs for linking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProofSelect = (proof) => {
    setSelectedProof(proof);
  };

  const handlePreview = () => {
    if (selectedProof) {
      setPreviewProof(selectedProof);
      setShowProofViewer(true);
    }
  };

  const handleLinkProof = async () => {
    if (!selectedProof?.id || !question?.id || !evidenceGroupId) return;

    try {
      // Create link between question and proof
      await base44.entities.QuestionProofItems.create({
        case_id: caseId,
        evidence_group_id: evidenceGroupId,
        question_id: question.id,
        proof_item_id: selectedProof.id,
      });

      onProofLinked?.();
      onClose();
    } catch (error) {
      console.error('Error linking proof to question:', error);
    }
  };

  const handleProofCalloutSelected = async (proofId, callout) => {
    // Automatically link this proof to the question
    if (!question?.id || !evidenceGroupId) return;

    try {
      // Create link between question and proof
      await base44.entities.QuestionProofItems.create({
        case_id: caseId,
        evidence_group_id: evidenceGroupId,
        question_id: question.id,
        proof_item_id: proofId,
      });

      // Link witness if callout has one
      if (callout.witness_id) {
        const existing = await base44.entities.ProofItemWitnesses.filter({
          proof_item_id: proofId,
          witness_id: callout.witness_id,
        });
        if (existing.length === 0) {
          await base44.entities.ProofItemWitnesses.create({
            case_id: caseId,
            proof_item_id: proofId,
            witness_id: callout.witness_id,
          });
        }
      }

      onProofLinked?.();
      setShowProofViewer(false);
      onClose();
    } catch (error) {
      console.error('Error linking proof to question:', error);
    }
  };

  return (
    <>
      <Dialog open={isOpen && !showProofViewer} onOpenChange={onClose}>
        <DialogContent className="bg-[#0f1629] border-[#1e2a45] text-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-cyan-300">
              Link Proof to "{question?.question_text?.slice(0, 40)}..."
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-12 text-gray-400">
              Loading proofs from this evidence group...
            </div>
          ) : filteredProofs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No proofs found for this witness in this evidence group.</p>
            </div>
          ) : (
           <div className="space-y-3">
             <p className="text-xs font-semibold text-cyan-400 uppercase">
               Available Proofs ({filteredProofs.length})
             </p>
             <div className="grid gap-2">
               {filteredProofs.map((proof) => (
                 <button
                   key={proof.id}
                   onClick={() => handleProofSelect(proof)}
                   className={`text-left p-3 rounded border transition-colors ${
                     selectedProof?.id === proof.id
                       ? 'bg-cyan-500/10 border-cyan-400 ring-1 ring-cyan-400/50'
                       : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                   }`}
                 >
                   <div className="flex items-start justify-between gap-2">
                     <div className="flex-1 min-w-0">
                       <p className="text-sm font-medium text-gray-100 truncate">
                         {proof.label}
                       </p>
                       {proof._calloutName && (
                         <p className="text-xs text-cyan-400 mt-0.5">↳ {proof._calloutName}</p>
                       )}
                       <Badge className="mt-1 text-[10px] bg-cyan-500/20 text-cyan-300 border-cyan-400/30">
                         {proof.type === 'depoClip'
                           ? 'Deposition Clip'
                           : 'Exhibit Extract'}
                       </Badge>
                     </div>
                   </div>
                 </button>
               ))}
             </div>
           </div>
          )}

          <div className="flex gap-2 pt-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePreview}
              disabled={!selectedProof}
              className="text-gray-400 hover:text-white flex-1 border-gray-600"
              variant="outline"
            >
              Preview
            </Button>
            <Button
              onClick={handleLinkProof}
              disabled={!selectedProof}
              className="bg-cyan-600 hover:bg-cyan-700 flex-1"
            >
              Link Proof
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ProofViewerModal for preview only */}
      {previewProof && (
        <ProofViewerModal
          proofItem={previewProof}
          isOpen={showProofViewer}
          onClose={() => {
            setShowProofViewer(false);
            setPreviewProof(null);
          }}
        />
      )}
    </>
  );
}