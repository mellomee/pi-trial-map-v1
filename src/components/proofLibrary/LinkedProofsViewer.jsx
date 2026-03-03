import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Trash2, Eye } from 'lucide-react';

export default function LinkedProofsViewer({ questionId, evidenceGroupId, onPreview, onUnlink }) {
  const [linkedProofs, setLinkedProofs] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isExpanded && questionId) {
      loadLinkedProofs();
    }
  }, [isExpanded, questionId]);

  const loadLinkedProofs = async () => {
    setLoading(true);
    try {
      const links = await base44.entities.QuestionProofItems.filter({
        question_id: questionId,
        evidence_group_id: evidenceGroupId,
      });
      const sortedLinks = links.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      
      const proofs = [];
      for (const link of sortedLinks) {
        const proof = await base44.entities.ProofItems.filter({ id: link.proof_item_id });
        if (proof.length > 0) {
          proofs.push({ ...proof[0], linkId: link.id });
        }
      }
      setLinkedProofs(proofs);
    } catch (error) {
      console.error('Error loading linked proofs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (linkedProofs.length === 0 && !isExpanded) {
    return null;
  }

  return (
    <div className="mt-2 border-t border-gray-700 pt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300"
      >
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Linked Proofs {linkedProofs.length > 0 && `(${linkedProofs.length})`}
      </button>
      
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <p className="text-xs text-gray-500">Loading...</p>
          ) : linkedProofs.length === 0 ? (
            <p className="text-xs text-gray-500">No proofs linked to this question</p>
          ) : (
            linkedProofs.map(proof => (
              <Card key={proof.id} className="bg-gray-700 border-gray-600">
                <CardContent className="p-2">
                  <p className="text-xs font-medium text-gray-200">{proof.label}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{proof.type}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}