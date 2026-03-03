import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import ProofViewerModal from '@/components/proofLibrary/ProofViewerModal';

export default function AddQuestionProofModal({ isOpen, onClose, question, evidenceGroupId, caseId, onProofLinked }) {
  const [proofItems, setProofItems] = useState([]);
  const [filteredProofs, setFilteredProofs] = useState([]);
  const [selectedProof, setSelectedProof] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showProofViewer, setShowProofViewer] = useState(false);
  const [proofItemWitnesses, setProofItemWitnesses] = useState({});

  // Load proofs from this evidence group
  useEffect(() => {
    if (!isOpen || !evidenceGroupId) return;
    loadEvidenceGroupProofs();
  }, [isOpen, evidenceGroupId]);

  // Filter proofs by witness when question changes
  useEffect(() => {
    if (!question?.party_id) {
      setFilteredProofs([]);
      return;
    }
    filterProofsByWitness();
  }, [proofItems, question?.party_id]);

  const loadEvidenceGroupProofs = async () => {
    setLoading(true);
    try {
      // Get all proofs linked to this evidence group
      const groupLinks = await base44.entities.EvidenceGroupProofItems.filter({
        evidence_group_id: evidenceGroupId,
      });

      // Load the actual proof items
      const proofs = [];
      const witnessMap = {};
      for (const link of groupLinks) {
        const pItems = await base44.entities.ProofItems.filter({ id: link.proof_item_id });
        if (pItems.length > 0) {
          proofs.push(pItems[0]);
          
          // Load witnesses for this proof
          const witLinks = await base44.entities.ProofItemWitnesses.filter({ proof_item_id: pItems[0].id });
          witnessMap[pItems[0].id] = witLinks;
        }
      }

      setProofItems(proofs);
      setProofItemWitnesses(witnessMap);
    } catch (error) {
      console.error('Error loading evidence group proofs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProofsByWitness = async () => {
    if (!question?.party_id) {
      setFilteredProofs([]);
      return;
    }

    // Filter proofs that have this witness
    const filtered = proofItems.filter(proof => {
      const witLinks = proofItemWitnesses[proof.id] || [];
      return witLinks.some(wl => wl.witness_id === question.party_id);
    });

    setFilteredProofs(filtered);
  };

  const handleSelectProof = (proof) => {
    setSelectedProof(proof);
    setShowProofViewer(true);
  };

  const handleLinkProof = async () => {
    if (!selectedProof || !question?.id) return;
    try {
      // Create link between question and proof
      await base44.entities.QuestionProofItems.create({
        case_id: caseId,
        evidence_group_id: evidenceGroupId,
        question_id: question.id,
        proof_item_id: selectedProof.id,
      });
      onProofLinked && onProofLinked();
      onClose();
    } catch (error) {
      console.error('Error linking proof:', error);
    }
  };

  const getProofTypeLabel = (proof) => {
    return proof.type === 'depoClip' ? 'Deposition Clip' : 'Exhibit Extract';
  };

  return (
    <>
      <Dialog open={isOpen && !showProofViewer} onOpenChange={onClose}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-100">
              Link Proof to "{question?.question_text?.slice(0, 40)}..."
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading proofs...</div>
          ) : filteredProofs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No proofs available for this witness in this evidence group.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase">Available Proofs ({filteredProofs.length})</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredProofs.map(proof => (
                    <button
                      key={proof.id}
                      onClick={() => handleSelectProof(proof)}
                      className={`w-full text-left p-3 rounded border transition-colors ${
                        selectedProof?.id === proof.id
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-100">{proof.label}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{getProofTypeLabel(proof)}</p>
                        </div>
                        <Badge className="bg-blue-500/20 text-blue-300 text-[10px] flex-shrink-0">
                          {proof.type === 'depoClip' ? 'Clip' : 'Extract'}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedProof && (
                <div className="border-t border-gray-700 pt-3 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowProofViewer(true)}
                    className="text-cyan-400 hover:text-cyan-300 gap-1 p-0 h-auto"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Preview Selected Proof
                  </Button>
                </div>
              )}

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300">
                  Cancel
                </Button>
                <Button
                  onClick={handleLinkProof}
                  disabled={!selectedProof}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  Link Proof
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Use the existing ProofViewerModal for preview */}
      <ProofViewerModal
        proofItem={selectedProof}
        isOpen={showProofViewer}
        onClose={() => setShowProofViewer(false)}
      />
    </>
  );
}