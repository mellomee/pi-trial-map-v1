import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Image } from 'lucide-react';
import ProofViewerModal from '@/components/proofLibrary/ProofViewerModal';



export default function AddQuestionProofModal({ isOpen, onClose, question, evidenceGroupId, caseId, onProofLinked }) {
  const [proofTab, setProofTab] = useState('depoClip');
  const [depoClips, setDepoClips] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [selectedExtract, setSelectedExtract] = useState(null);
  const [selectedCallout, setSelectedCallout] = useState(null);
  const [callouts, setCallouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parties, setParties] = useState({});
  const [depositions, setDepositions] = useState({});
  const [showProofViewer, setShowProofViewer] = useState(false);
  const [viewerProofItem, setViewerProofItem] = useState(null);

  // Get witness name
  const getWitnessName = (witId) => {
    const p = parties[witId];
    if (!p) return 'Unknown';
    return p.display_name || `${p.first_name || ''} ${p.last_name}`.trim();
  };

  // Load initial data
  useEffect(() => {
    if (!isOpen || !question?.party_id) return;
    loadProofsForWitness();
  }, [isOpen, question?.party_id]);

  const loadProofsForWitness = async () => {
    setLoading(true);
    try {
      const [allParties, allDeps, allClips, allExtracts, allDepoExhibits, allJointExhibits] = await Promise.all([
        base44.entities.Parties.filter({ case_id: caseId }),
        base44.entities.Depositions.filter({ case_id: caseId }),
        base44.entities.DepoClips.filter({ case_id: caseId }),
        base44.entities.ExhibitExtracts.filter({ case_id: caseId }),
        base44.entities.DepositionExhibits.filter({ case_id: caseId }),
        base44.entities.JointExhibits.filter({ case_id: caseId }),
      ]);

      // Build maps
      const partiesMap = {};
      allParties.forEach(p => { partiesMap[p.id] = p; });
      setParties(partiesMap);

      const depsMap = {};
      allDeps.forEach(d => { depsMap[d.id] = d; });
      setDepositions(depsMap);

      const depoExMap = {};
      allDepoExhibits.forEach(dx => { depoExMap[dx.id] = dx; });
      setDepoExhibits(depoExMap);

      const jxMap = {};
      allJointExhibits.forEach(jx => { jxMap[jx.id] = jx; });
      setJointExhibits(jxMap);

      // Filter clips for witness
      const witClips = [];
      for (const clip of allClips) {
        if (clip.deposition_id) {
          const dep = depsMap[clip.deposition_id];
          if (dep && dep.party_id === question.party_id) {
            witClips.push(clip);
          }
        }
      }
      setDepoClips(witClips);

      // Filter extracts for witness (via callouts)
      const witExtracts = [];
      for (const extract of allExtracts) {
        const extractCallouts = await base44.entities.Callouts.filter({ extract_id: extract.id });
        if (extractCallouts.some(co => co.witness_id === question.party_id)) {
          witExtracts.push(extract);
        }
      }
      setExtracts(witExtracts);
    } catch (error) {
      console.error('Error loading proofs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load callouts for selected extract
  useEffect(() => {
    if (!selectedExtract?.id) return;
    base44.entities.Callouts.filter({ extract_id: selectedExtract.id }).then(setCallouts);
  }, [selectedExtract?.id]);

  // Handle adding clip as proof
  const handleAddClipProof = async () => {
    if (!selectedClip) return;
    try {
      // Create proof item
      const proofItem = await base44.entities.ProofItems.create({
        case_id: caseId,
        type: 'depoClip',
        label: selectedClip.clip_title || `Depo Clip (${selectedClip.start_cite})`,
        source_id: selectedClip.id,
        notes: selectedClip.notes,
      });

      // Link to evidence group
      await base44.entities.EvidenceGroupProofItems.create({
        evidence_group_id: evidenceGroupId,
        proof_item_id: proofItem.id,
      });

      // Link to question
      await base44.entities.QuestionProofItems.create({
        case_id: caseId,
        evidence_group_id: evidenceGroupId,
        question_id: question.id,
        proof_item_id: proofItem.id,
      });

      // Link witness
      await base44.entities.ProofItemWitnesses.create({
        case_id: caseId,
        proof_item_id: proofItem.id,
        witness_id: question.party_id,
      });

      onProofLinked();
    } catch (error) {
      console.error('Error adding clip proof:', error);
    }
  };

  // Handle adding extract + callout as proof
  const handleAddExtractProof = async () => {
    if (!selectedExtract || !selectedCallout) return;
    try {
      // Create proof item with callout
      const proofItem = await base44.entities.ProofItems.create({
        case_id: caseId,
        type: 'extract',
        label: selectedExtract.title || 'Exhibit Extract',
        source_id: selectedExtract.id,
        callout_id: selectedCallout.id,
      });

      // Link to evidence group
      await base44.entities.EvidenceGroupProofItems.create({
        evidence_group_id: evidenceGroupId,
        proof_item_id: proofItem.id,
      });

      // Link to question
      await base44.entities.QuestionProofItems.create({
        case_id: caseId,
        evidence_group_id: evidenceGroupId,
        question_id: question.id,
        proof_item_id: proofItem.id,
      });

      // Link witness from callout
      if (selectedCallout.witness_id) {
        await base44.entities.ProofItemWitnesses.create({
          case_id: caseId,
          proof_item_id: proofItem.id,
          witness_id: selectedCallout.witness_id,
        });
      }

      onProofLinked();
    } catch (error) {
      console.error('Error adding extract proof:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-100">
            Link Proof to "{question?.question_text?.slice(0, 40)}..."
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading proofs...</div>
        ) : (
          <Tabs value={proofTab} onValueChange={setProofTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="depoClip">Deposition Clips</TabsTrigger>
              <TabsTrigger value="extract">Exhibit Extracts</TabsTrigger>
            </TabsList>

            {/* Deposition Clips Tab */}
            <TabsContent value="depoClip" className="space-y-3 mt-4">
              {/* Clips List - Full width */}
              <div className="border border-gray-700 rounded bg-gray-950">
                <div className="px-3 py-2 border-b border-gray-700">
                  <p className="text-xs font-semibold text-gray-400 uppercase">Deposition Clips ({depoClips.length})</p>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2 max-h-32 overflow-y-auto">
                  {depoClips.map(clip => (
                    <button
                      key={clip.id}
                      onClick={() => setSelectedClip(clip)}
                      className={`text-left p-2 rounded border transition-colors ${
                        selectedClip?.id === clip.id
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex gap-1 items-center">
                        <p className="text-xs font-medium text-gray-200 truncate flex-1">{clip.topic_tag || clip.clip_title || clip.start_cite}</p>
                        {clip.direction && (
                          <Badge className={clip.direction === 'HelpsUs' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} size="sm">
                            {clip.direction === 'HelpsUs' ? '✓' : '✗'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{clip.start_cite}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clip Details Preview - Full width */}
              {selectedClip && (
                <div className="border border-gray-700 rounded bg-gray-950 p-4 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-cyan-300">{selectedClip.clip_title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Citation: {selectedClip.start_cite} – {selectedClip.end_cite}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className="bg-blue-500/20 text-blue-300 text-[10px]">Deposition Clip</Badge>
                      {selectedClip.direction && (
                        <Badge className={selectedClip.direction === 'HelpsUs' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} size="sm">
                          {selectedClip.direction === 'HelpsUs' ? '✓ Helps Us' : '✗ Hurts Us'}
                        </Badge>
                      )}
                      {selectedClip.topic_tag && <Badge variant="outline" className="text-gray-300 border-gray-600 text-[10px]">{selectedClip.topic_tag}</Badge>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Testimony</p>
                    <div className="bg-gray-900 rounded border border-gray-700 p-3">
                      <p className="text-xs text-gray-200 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{selectedClip.clip_text}</p>
                    </div>
                  </div>
                  {selectedClip.notes && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Notes</p>
                      <p className="text-xs text-gray-300">{selectedClip.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleAddClipProof}
                  disabled={!selectedClip}
                  className="bg-cyan-600 hover:bg-cyan-700 flex-1"
                >
                  Link Clip
                </Button>
              </div>
            </TabsContent>

            {/* Exhibit Extracts Tab */}
            <TabsContent value="extract" className="space-y-3 mt-4">
              {/* Extracts list - Full width */}
              <div className="border border-gray-700 rounded bg-gray-950">
                <div className="px-3 py-2 border-b border-gray-700">
                  <p className="text-xs font-semibold text-gray-400 uppercase">Exhibit Extracts ({extracts.length})</p>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2 max-h-40 overflow-y-auto">
                  {extracts.length > 0 ? (
                    extracts.map(extract => (
                      <button
                        key={extract.id}
                        onClick={() => { setSelectedExtract(extract); setSelectedCallout(null); }}
                        className={`text-left rounded border transition-colors overflow-hidden ${
                          selectedExtract?.id === extract.id
                            ? 'border-cyan-400 bg-cyan-500/10'
                            : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                        }`}
                      >
                        {extract.extract_file_url && (
                          <img 
                            src={extract.extract_file_url} 
                            alt={extract.title} 
                            className="w-full h-24 object-cover"
                          />
                        )}
                        <div className="p-2">
                          <p className="text-xs font-medium text-gray-200 truncate">{extract.title}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">#{extract.marked_no}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-4 text-gray-500 text-xs">No extracts available</div>
                  )}
                </div>
              </div>

              {/* Extract Details - ProofViewerModal */}
              {selectedExtract && (
                <div className="space-y-3">
                  <div className="border border-gray-700 rounded bg-gray-950 p-3">
                    <p className="text-xs font-semibold text-cyan-400 uppercase mb-3">Preview</p>
                    <Button
                      onClick={() => {
                        const proofItem = {
                          id: selectedExtract.id,
                          type: 'extract',
                          label: selectedExtract.title,
                          source_id: selectedExtract.id,
                        };
                        setViewerProofItem(proofItem);
                        setShowProofViewer(true);
                      }}
                      className="w-full bg-cyan-600 hover:bg-cyan-700"
                    >
                      View Extract
                    </Button>
                  </div>

                  {/* Callouts row - only show if there are callouts */}
                  {callouts.length > 0 && (
                    <div className="border border-gray-700 rounded bg-gray-950 p-3 space-y-3">
                      <p className="text-xs font-semibold text-cyan-400 uppercase">Callouts ({callouts.length})</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {callouts.map((callout) => (
                          <button
                            key={callout.id}
                            onClick={() => setSelectedCallout(callout)}
                            className={`flex-shrink-0 rounded border-2 transition-all ${
                              selectedCallout?.id === callout.id
                                ? 'border-cyan-400 shadow-lg shadow-cyan-500/20'
                                : 'border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            {callout.snapshot_image_url ? (
                              <img src={callout.snapshot_image_url} alt={callout.name} className="h-20 w-24 object-cover rounded" />
                            ) : (
                              <div className="h-20 w-24 flex items-center justify-center bg-gray-800 rounded">
                                <Image className="w-5 h-5 text-gray-600" />
                              </div>
                            )}
                            {callout.name && <p className="text-[9px] text-gray-400 text-center px-1 py-0.5 truncate w-24">{callout.name}</p>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleAddExtractProof}
                  disabled={!selectedExtract || !selectedCallout}
                  className="bg-cyan-600 hover:bg-cyan-700 flex-1"
                >
                  Link Callout
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}