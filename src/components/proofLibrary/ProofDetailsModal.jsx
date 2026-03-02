import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function ProofDetailsModal({ proofItem, isOpen, onClose }) {
  const [depoClip, setDepoClip] = useState(null);
  const [extract, setExtract] = useState(null);
  const [witness, setWitness] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && proofItem) {
      loadDetails();
    }
  }, [isOpen, proofItem]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      if (proofItem.type === 'depoClip') {
        const clips = await base44.entities.DepoClips.filter({ id: proofItem.source_id });
        if (clips.length > 0) setDepoClip(clips[0]);
      } else if (proofItem.type === 'extract') {
        const extracts = await base44.entities.ExhibitExtracts.filter({ id: proofItem.source_id });
        if (extracts.length > 0) setExtract(extracts[0]);
      }
      if (proofItem.witness_id) {
        const witnesses = await base44.entities.Parties.filter({ id: proofItem.witness_id });
        if (witnesses.length > 0) setWitness(witnesses[0]);
      }
    } catch (error) {
      console.error('Error loading details:', error);
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{proofItem?.label || 'Proof Details'}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="space-y-4">
            {witness && (
              <Card className="bg-[#0a0f1e] border-[#1e2a45]">
                <CardContent className="pt-4">
                  <p className="text-xs text-slate-400 mb-1">WITNESS</p>
                  <p className="text-sm font-medium text-slate-200">{witness.first_name} {witness.last_name}</p>
                </CardContent>
              </Card>
            )}

            {depoClip && (
              <Card className="bg-[#0a0f1e] border-[#1e2a45]">
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">TESTIMONY REFERENCE</p>
                    <p className="text-sm font-mono text-slate-200">{depoClip.start_cite} – {depoClip.end_cite}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">TESTIMONY TEXT</p>
                    <div className="text-sm text-slate-300 bg-[#131a2e] p-3 rounded max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {depoClip.clip_text}
                    </div>
                  </div>
                  {depoClip.topic_tag && (
                    <div>
                      <Badge className={depoClip.direction === 'HelpsUs' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {depoClip.topic_tag} • {depoClip.direction === 'HelpsUs' ? 'Helps Us' : 'Hurts Us'}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {extract && (
              <Card className="bg-[#0a0f1e] border-[#1e2a45]">
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">EXHIBIT EXTRACT</p>
                    <p className="text-sm font-medium text-slate-200">{extract.display_title || extract.original_title}</p>
                  </div>
                  {extract.extract_text && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">EXTRACT TEXT</p>
                      <p className="text-sm text-slate-300 bg-[#131a2e] p-3 rounded max-h-48 overflow-y-auto">{extract.extract_text}</p>
                    </div>
                  )}
                  {extract.pages && (
                    <p className="text-xs text-slate-400">Pages: {extract.pages}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {proofItem.notes && (
              <Card className="bg-[#0a0f1e] border-[#1e2a45]">
                <CardContent className="pt-4">
                  <p className="text-xs text-slate-400 mb-1">NOTES</p>
                  <p className="text-sm text-slate-300">{proofItem.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}