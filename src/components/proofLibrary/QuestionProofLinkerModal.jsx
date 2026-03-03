import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ProofViewerModal from '@/components/proofLibrary/ProofViewerModal';

export default function QuestionProofLinkerModal({
  isOpen,
  onClose,
  question,
  evidenceGroupId,
  caseId,
  proofItems,
  onProofLinked,
}) {
  const [filteredProofItems, setFilteredProofItems] = useState([]);
  const [selectedProof, setSelectedProof] = useState(null);

  // Load and filter proof items for this witness
  useEffect(() => {
    if (!isOpen || !question?.party_id || !proofItems) return;
    
    // Filter proofs to only those with matching witness (via callouts for extracts)
    const filtered = proofItems.filter(p => {
      if (p.type === 'depoClip') {
        // For depo clips, we don't have witness filtering in this simple version
        // You could enhance this to check DepoClips.deposition_id -> Depositions.party_id
        return true;
      }
      // For extracts, filter by callout witness - but we need to load callout data
      // Keep all for now, filtering happens in ProofViewerModal with witnessFilter prop
      return true;
    });
    
    setFilteredProofItems(filtered);
    setSelectedProof(null);
  }, [isOpen, question?.party_id, proofItems]);

  const handleProofSelected = async (proof) => {
    if (!proof || !question) return;
    try {
      // Create the link between question and proof
      await base44.entities.QuestionProofItems.create({
        case_id: caseId,
        evidence_group_id: evidenceGroupId,
        question_id: question.id,
        proof_item_id: proof.id,
      });

      onProofLinked?.();
      onClose();
    } catch (error) {
      console.error('Error linking proof to question:', error);
    }
  };

  return (
    <ProofViewerModal
      isOpen={isOpen}
      onClose={onClose}
      proofItem={null}
      selectionMode={true}
      availableProofItems={filteredProofItems}
      onProofSelected={handleProofSelected}
      witnessFilter={question?.party_id}
    />
  );
}