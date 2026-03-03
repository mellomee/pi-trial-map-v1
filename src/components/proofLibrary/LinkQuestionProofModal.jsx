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
      const allProofs = [];

      // 2. Fetch all ProofItems (batch to avoid rate limits)
      for (const pid of proofIds) {
        const items = await base44.entities.ProofItems.filter({ id: pid });
        if (items.length > 0) allProofs.push(items[0]);
      }

      // 3. Load case parties for witness name resolution
      const parts = await base44.entities.Parties.filter({ case_id: caseId });
      const partyMap = {};
      parts.forEach((p) => {
        partyMap[p.id] = p.display_name || `${p.first_name || ''} ${p.last_name}`.trim();
      });
      setCaseParties(partyMap);

      setProofItems(allProofs);

      // 4. Filter to proofs with callouts matching question's witness
      const filtered = [];
      for (const proof of allProofs) {
        if (proof.type === 'depoClip') {
          // For depo clips, always include (they're witness-aware via deposition)
          filtered.push(proof);
        } else if (proof.type === 'extract' && proof.callout_id) {
          // For extracts, check if callout's witness matches question's witness
          const callouts = await base44.entities.Callouts.filter({
            id: proof.callout_id,
          });
          if (
            callouts.length > 0 &&
            callouts[0].witness_id === question.party_id
          ) {
            filtered.push(proof);
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

      {/* ProofViewerModal for preview and linking */}
      {selectedProof && (
        <ProofViewerModal
          proofItem={selectedProof}
          isOpen={showProofViewer}
          onClose={() => {
            setShowProofViewer(false);
            setSelectedProof(null);
          }}
          onCalloutSelected={handleProofCalloutSelected}
        />
      )}
    </>
  );
}