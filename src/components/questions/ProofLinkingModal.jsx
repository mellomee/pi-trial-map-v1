import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Zap } from 'lucide-react';

export default function ProofLinkingModal({
  open,
  onClose,
  question,
  caseId,
  bucketId,
  linkedProofIds = [],
  onLinkProof,
  onUnlinkProof,
  calloutNames = {},
  calloutWitnesses = {},
  proofItemsMap = {},
  allProofItems = [],
}) {
  const [depoClips, setDepoClips] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState(null);

  useEffect(() => {
    if (open && bucketId) {
      loadProofs();
    }
  }, [open, bucketId]);

  const loadProofs = async () => {
    setLoading(true);
    try {
      // Load all depo clips, extracts, and joint exhibits
      const [clips, extractList, joints] = await Promise.all([
        base44.entities.DepoClips.filter({ case_id: caseId }),
        base44.entities.ExhibitExtracts.filter({ case_id: caseId }),
        base44.entities.JointExhibits.filter({ case_id: caseId }),
      ]);
      setDepoClips(clips);
      setExtracts(extractList);
      setJointExhibits(joints);
    } catch (error) {
      console.error('Error loading proofs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkProof = async (proofType, proofId) => {
    // Find or create the proof item in ProofItems
    let proofItem = allProofItems.find(p => p.depo_clip_id === proofId || p.exhibit_extract_id === proofId || p.joint_exhibit_id === proofId);
    
    if (!proofItem) {
      // Create a proof item
      const label = proofType === 'depoClip' 
        ? depoClips.find(c => c.id === proofId)?.clip_title 
        : proofType === 'extract'
        ? extracts.find(e => e.id === proofId)?.title
        : jointExhibits.find(j => j.id === proofId)?.marked_title;

      proofItem = await base44.entities.ProofItems.create({
        case_id: caseId,
        evidence_group_id: bucketId,
        type: proofType,
        depo_clip_id: proofType === 'depoClip' ? proofId : null,
        exhibit_extract_id: proofType === 'extract' ? proofId : null,
        joint_exhibit_id: proofType === 'jointExhibit' ? proofId : null,
        label: label || proofType,
      });
    }

    await onLinkProof(question.id, proofItem.id, bucketId);
  };

  const isLinked = (proofId) => {
    return linkedProofIds.some(pid => {
      const proof = proofItemsMap[pid];
      return proof?.depo_clip_id === proofId || proof?.exhibit_extract_id === proofId || proof?.joint_exhibit_id === proofId;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Proof to Question</DialogTitle>
        </DialogHeader>

        {question && (
          <div className="px-6 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-sm font-medium text-slate-100">{question.question_text}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-slate-400">Loading proofs...</p>
          </div>
        ) : (
          <Tabs defaultValue="depoClips" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="bg-[#0a0f1e] border-b border-[#1e2a45]">
              <TabsTrigger value="depoClips">Depo Clips ({depoClips.length})</TabsTrigger>
              <TabsTrigger value="extracts">Extracts ({extracts.length})</TabsTrigger>
              <TabsTrigger value="jointExhibits">Joint Exhibits ({jointExhibits.length})</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden flex gap-4">
              {/* Proof List */}
              <div className="flex-1 overflow-y-auto border-r border-[#1e2a45] pr-4 py-4">
                <TabsContent value="depoClips" className="space-y-2 m-0">
                  {depoClips.length === 0 ? (
                    <p className="text-xs text-slate-500">No deposition clips</p>
                  ) : (
                    depoClips.map((clip) => (
                      <div
                        key={clip.id}
                        onClick={() => setSelectedPreview({ type: 'depoClip', data: clip })}
                        className={`p-2 border rounded cursor-pointer transition-all ${
                          selectedPreview?.data?.id === clip.id
                            ? 'border-cyan-400 bg-cyan-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-100">{clip.clip_title || 'Untitled Clip'}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{clip.start_cite} - {clip.end_cite}</p>
                          </div>
                          {isLinked(clip.id) && <Badge className="text-[10px] bg-green-500/20 text-green-400">✓</Badge>}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="extracts" className="space-y-2 m-0">
                  {extracts.length === 0 ? (
                    <p className="text-xs text-slate-500">No extracts</p>
                  ) : (
                    extracts.map((extract) => (
                      <div
                        key={extract.id}
                        onClick={() => setSelectedPreview({ type: 'extract', data: extract })}
                        className={`p-2 border rounded cursor-pointer transition-all ${
                          selectedPreview?.data?.id === extract.id
                            ? 'border-cyan-400 bg-cyan-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-100">{extract.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{extract.source_description || 'Extract'}</p>
                          </div>
                          {isLinked(extract.id) && <Badge className="text-[10px] bg-green-500/20 text-green-400">✓</Badge>}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="jointExhibits" className="space-y-2 m-0">
                  {jointExhibits.length === 0 ? (
                    <p className="text-xs text-slate-500">No joint exhibits</p>
                  ) : (
                    jointExhibits.map((joint) => (
                      <div
                        key={joint.id}
                        onClick={() => setSelectedPreview({ type: 'jointExhibit', data: joint })}
                        className={`p-2 border rounded cursor-pointer transition-all ${
                          selectedPreview?.data?.id === joint.id
                            ? 'border-cyan-400 bg-cyan-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-100">{joint.marked_title || `${joint.marked_no}`}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{joint.status}</p>
                          </div>
                          {isLinked(joint.id) && <Badge className="text-[10px] bg-green-500/20 text-green-400">✓</Badge>}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </div>

              {/* Preview Panel */}
              <div className="w-72 bg-[#0a0f1e] rounded-lg p-4 border border-[#1e2a45] overflow-y-auto">
                {selectedPreview ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-semibold">Preview</p>
                      <p className="text-sm font-medium text-slate-100 mt-1">
                        {selectedPreview.type === 'depoClip'
                          ? selectedPreview.data.clip_title || 'Untitled Clip'
                          : selectedPreview.type === 'extract'
                          ? selectedPreview.data.title
                          : selectedPreview.data.marked_title}
                      </p>
                    </div>

                    {selectedPreview.type === 'depoClip' && (
                      <div className="space-y-2">
                        <div>
                          <p className="text-[10px] text-slate-500">Citation</p>
                          <p className="text-xs text-slate-300">{selectedPreview.data.start_cite} - {selectedPreview.data.end_cite}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">Transcript</p>
                          <p className="text-xs text-slate-300 line-clamp-4">{selectedPreview.data.clip_text}</p>
                        </div>
                        {selectedPreview.data.topic_tag && (
                          <div>
                            <p className="text-[10px] text-slate-500">Topic</p>
                            <Badge variant="outline" className="text-[10px]">{selectedPreview.data.topic_tag}</Badge>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedPreview.type === 'extract' && (
                      <div className="space-y-2">
                        <div>
                          <p className="text-[10px] text-slate-500">Source</p>
                          <p className="text-xs text-slate-300">{selectedPreview.data.source_description || 'Extract'}</p>
                        </div>
                        {selectedPreview.data.callout_count !== undefined && (
                          <div>
                            <p className="text-[10px] text-slate-500">Callouts</p>
                            <p className="text-xs text-slate-300">{selectedPreview.data.callout_count || 0}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedPreview.type === 'jointExhibit' && (
                      <div className="space-y-2">
                        <div>
                          <p className="text-[10px] text-slate-500">Marked #</p>
                          <p className="text-xs text-slate-300">{selectedPreview.data.marked_no}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">Status</p>
                          <Badge variant="outline" className="text-[10px]">{selectedPreview.data.status}</Badge>
                        </div>
                        {selectedPreview.data.admitted_no && (
                          <div>
                            <p className="text-[10px] text-slate-500">Admitted #</p>
                            <p className="text-xs text-slate-300">{selectedPreview.data.admitted_no}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      className={`w-full text-xs ${
                        isLinked(selectedPreview.data.id)
                          ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          : 'bg-cyan-600 hover:bg-cyan-700'
                      }`}
                      onClick={() => {
                        if (!isLinked(selectedPreview.data.id)) {
                          handleLinkProof(selectedPreview.type, selectedPreview.data.id);
                        }
                      }}
                      disabled={isLinked(selectedPreview.data.id)}
                    >
                      {isLinked(selectedPreview.data.id) ? '✓ Linked' : 'Link Proof'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Zap className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs text-slate-500">Select a proof to preview</p>
                  </div>
                )}
              </div>
            </div>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}