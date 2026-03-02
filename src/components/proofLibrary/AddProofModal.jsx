import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

export default function AddProofModal({ isOpen, onClose, caseId, onProofAdded, evidenceGroupId }) {
  const [activeTab, setActiveTab] = useState('depoClips');
  const [depoClips, setDepoClips] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [selectedClip, setSelectedClip] = useState('');
  const [selectedExtract, setSelectedExtract] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProof();
    }
  }, [isOpen, caseId]);

  const loadProof = async () => {
    setLoading(true);
    try {
      const [clips, exts] = await Promise.all([
        base44.entities.DepoClips.filter({ case_id: caseId }),
        base44.entities.ExhibitExtracts.filter({ case_id: caseId }),
      ]);
      setDepoClips(clips);
      setExtracts(exts);
    } catch (error) {
      console.error('Error loading proof:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClip = async () => {
    if (!selectedClip || !evidenceGroupId) return;
    setLoading(true);
    setError('');
    try {
      const clip = depoClips.find((c) => c.id === selectedClip);
      if (!clip) {
        setError('Clip not found');
        setLoading(false);
        return;
      }

      const label = clip.topic_tag || `${clip.start_cite} - ${clip.end_cite}`;
      const existing = await base44.entities.ProofItems.filter({
        case_id: caseId,
        type: 'depoClip',
        source_id: clip.id,
      });

      let proofItem;
      if (existing.length === 0) {
        proofItem = await base44.entities.ProofItems.create({
          case_id: caseId,
          type: 'depoClip',
          source_id: clip.id,
          label,
          notes: clip.notes || '',
          witness_id: clip.deponent_party_id || clip.witness_id || undefined,
        });
      } else {
        proofItem = existing[0];
        // Backfill witness_id if missing
        if (!proofItem.witness_id && (clip.deponent_party_id || clip.witness_id)) {
          proofItem = await base44.entities.ProofItems.update(proofItem.id, {
            witness_id: clip.deponent_party_id || clip.witness_id,
          });
        }
      }

      // CREATE THE BRIDGE RECORD
      const existingLink = await base44.entities.EvidenceGroupProofItems.filter({
        evidence_group_id: evidenceGroupId,
        proof_item_id: proofItem.id,
      });

      if (existingLink.length === 0) {
        await base44.entities.EvidenceGroupProofItems.create({
          evidence_group_id: evidenceGroupId,
          proof_item_id: proofItem.id,
          order_index: 0,
        });
      }

      setSelectedClip('');
      setLoading(false);
      onProofAdded(proofItem);
    } catch (err) {
      console.error('Error adding clip:', err);
      setError(err.message || 'Failed to add proof');
      setLoading(false);
    }
  };

  const handleAddExtract = async () => {
    if (!selectedExtract || !evidenceGroupId) return;
    setLoading(true);
    setError('');
    try {
      const extract = extracts.find((e) => e.id === selectedExtract);
      if (!extract) {
        setError('Extract not found');
        setLoading(false);
        return;
      }

      const label = extract.extract_title_internal || extract.extract_title_official;
      const existing = await base44.entities.ProofItems.filter({
        case_id: caseId,
        type: 'extract',
        source_id: extract.id,
      });

      let proofItem;
      if (existing.length === 0) {
        proofItem = await base44.entities.ProofItems.create({
          case_id: caseId,
          type: 'extract',
          source_id: extract.id,
          label,
          notes: extract.notes || '',
          witness_id: extract.deponent_party_id || extract.witness_id || undefined,
        });
      } else {
        proofItem = existing[0];
        // Backfill witness_id if missing
        if (!proofItem.witness_id && (extract.deponent_party_id || extract.witness_id)) {
          proofItem = await base44.entities.ProofItems.update(proofItem.id, {
            witness_id: extract.deponent_party_id || extract.witness_id,
          });
        }
      }

      // CREATE THE BRIDGE RECORD
      const existingLink = await base44.entities.EvidenceGroupProofItems.filter({
        evidence_group_id: evidenceGroupId,
        proof_item_id: proofItem.id,
      });

      if (existingLink.length === 0) {
        await base44.entities.EvidenceGroupProofItems.create({
          evidence_group_id: evidenceGroupId,
          proof_item_id: proofItem.id,
          order_index: 0,
        });
      }

      setSelectedExtract('');
      setLoading(false);
      onProofAdded(proofItem);
    } catch (err) {
      console.error('Error adding extract:', err);
      setError(err.message || 'Failed to add proof');
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white border-gray-300">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Add Proof to Evidence Group</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-100">
            <TabsTrigger value="depoClips" className="text-xs">
              Deposition Clips
            </TabsTrigger>
            <TabsTrigger value="extracts" className="text-xs">
              Exhibit Extracts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="depoClips" className="space-y-3 mt-4">
            <Select value={selectedClip} onValueChange={setSelectedClip}>
              <SelectTrigger className="bg-white border-gray-300">
                <SelectValue placeholder="Select a deposition clip..." />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300">
                {depoClips.map((clip) => (
                  <SelectItem key={clip.id} value={clip.id} className="text-gray-100">
                    {clip.topic_tag || `${clip.start_cite} - ${clip.end_cite}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddClip} className="w-full" disabled={!selectedClip || loading}>
              {loading ? 'Adding...' : 'Add Clip'}
            </Button>
          </TabsContent>

          <TabsContent value="extracts" className="space-y-3 mt-4">
            <Select value={selectedExtract} onValueChange={setSelectedExtract}>
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue placeholder="Select an exhibit extract..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {extracts.map((extract) => (
                  <SelectItem key={extract.id} value={extract.id} className="text-gray-100">
                    {extract.extract_title_internal || extract.extract_title_official}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddExtract} className="w-full" disabled={!selectedExtract || loading}>
              {loading ? 'Adding...' : 'Add Extract'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}