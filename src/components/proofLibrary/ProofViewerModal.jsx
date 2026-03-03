import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, Image, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProofViewerModal({ proofItem, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [depoClip, setDepoClip] = useState(null);
  const [deposition, setDeposition] = useState(null);
  const [extract, setExtract] = useState(null);
  const [callouts, setCallouts] = useState([]);
  const [selectedCallout, setSelectedCallout] = useState(null);

  useEffect(() => {
    if (isOpen && proofItem) {
      loadDetails();
    } else {
      setDepoClip(null);
      setExtract(null);
      setCallouts([]);
      setSelectedCallout(null);
    }
  }, [isOpen, proofItem?.id]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      if (proofItem.type === 'depoClip') {
        const [clips] = await Promise.all([
          base44.entities.DepoClips.filter({ id: proofItem.source_id }),
        ]);
        if (clips.length > 0) {
          setDepoClip(clips[0]);
          if (clips[0].deposition_id) {
            const deps = await base44.entities.Depositions.filter({ id: clips[0].deposition_id });
            if (deps.length > 0) setDeposition(deps[0]);
          }
        }
      } else if (proofItem.type === 'extract') {
        const [extracts, cos] = await Promise.all([
          base44.entities.ExhibitExtracts.filter({ id: proofItem.source_id }),
          base44.entities.Callouts.filter({ extract_id: proofItem.source_id }),
        ]);
        if (extracts.length > 0) setExtract(extracts[0]);
        setCallouts(cos.sort((a, b) => (a.page_number || 0) - (b.page_number || 0)));
        if (cos.length > 0) setSelectedCallout(cos[0]);
      }
    } catch (err) {
      console.error('Error loading proof details:', err);
    }
    setLoading(false);
  };

  const selectedCalloutIdx = callouts.findIndex(c => c.id === selectedCallout?.id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f1629] border-[#1e2a45] text-slate-200 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-cyan-300">{proofItem?.label || 'Proof Detail'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <>
            {/* DEPO CLIP VIEW */}
            {depoClip && (
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Badge className="bg-blue-500/20 text-blue-300">Deposition Clip</Badge>
                  {depoClip.direction && (
                    <Badge className={depoClip.direction === 'HelpsUs' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                      {depoClip.direction === 'HelpsUs' ? '✓ Helps Us' : '✗ Hurts Us'}
                    </Badge>
                  )}
                  {depoClip.topic_tag && (
                    <Badge variant="outline" className="text-gray-300">{depoClip.topic_tag}</Badge>
                  )}
                </div>

                {deposition && (
                  <div className="text-xs text-gray-400 bg-[#131a2e] px-3 py-2 rounded">
                    <span className="text-gray-500">Deposition: </span>
                    <span className="text-gray-200">{deposition.sheet_name}</span>
                    {deposition.taken_date && <span className="ml-3 text-gray-500">{deposition.taken_date}</span>}
                  </div>
                )}

                <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-cyan-400 tracking-wider">TESTIMONY</span>
                    <span className="text-xs text-gray-400 ml-auto font-mono">{depoClip.start_cite} – {depoClip.end_cite}</span>
                  </div>
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-mono bg-[#0a0f1e] p-3 rounded max-h-80 overflow-y-auto border border-[#1e2a45]">
                    {depoClip.clip_text || <span className="text-gray-500 italic">No transcript text available</span>}
                  </div>
                </div>

                {depoClip.notes && (
                  <div className="text-xs text-gray-400 bg-[#131a2e] px-3 py-2 rounded border border-[#1e2a45]">
                    <span className="text-gray-500">Notes: </span>{depoClip.notes}
                  </div>
                )}
              </div>
            )}

            {/* EXTRACT VIEW */}
            {extract && (
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap items-center">
                  <Badge className="bg-purple-500/20 text-purple-300">Exhibit Extract</Badge>
                  {extract.extract_page_start && (
                    <Badge variant="outline" className="text-gray-300 text-xs">
                      Pages {extract.extract_page_start}{extract.extract_page_end ? `–${extract.extract_page_end}` : ''}
                    </Badge>
                  )}
                </div>

                <div className="text-sm text-gray-200 bg-[#131a2e] px-3 py-2 rounded">
                  {extract.extract_title_internal || extract.extract_title_official}
                </div>

                {callouts.length > 0 ? (
                  <div className="space-y-3">
                    {/* Callout picker */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-cyan-400 tracking-wider">
                        CALLOUTS ({callouts.length})
                      </span>
                      {callouts.length > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                            disabled={selectedCalloutIdx <= 0}
                            onClick={() => setSelectedCallout(callouts[selectedCalloutIdx - 1])}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-xs text-gray-400">{selectedCalloutIdx + 1} / {callouts.length}</span>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                            disabled={selectedCalloutIdx >= callouts.length - 1}
                            onClick={() => setSelectedCallout(callouts[selectedCalloutIdx + 1])}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Callout thumbnails row */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {callouts.map((c, idx) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCallout(c)}
                          className={`flex-shrink-0 rounded border-2 transition-all ${
                            selectedCallout?.id === c.id
                              ? 'border-cyan-400 shadow-lg shadow-cyan-500/20'
                              : 'border-[#1e2a45] hover:border-gray-500'
                          }`}
                        >
                          {c.snapshot_image_url ? (
                            <img
                              src={c.snapshot_image_url}
                              alt={c.name || `Callout ${idx + 1}`}
                              className="h-16 w-20 object-cover rounded"
                            />
                          ) : (
                            <div className="h-16 w-20 flex items-center justify-center bg-[#131a2e] rounded">
                              <Image className="w-5 h-5 text-gray-600" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Selected callout large view */}
                    {selectedCallout && (
                      <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-cyan-400 font-semibold">{selectedCallout.label || `Callout – Page ${selectedCallout.page_number}`}</span>
                          <span className="text-xs text-gray-500 ml-auto">Pg {selectedCallout.page_number}</span>
                          {selectedCallout.jury_safe && (
                            <Badge className="bg-green-500/20 text-green-400 text-xs">Jury Safe</Badge>
                          )}
                        </div>
                        {selectedCallout.callout_image ? (
                          <img
                            src={selectedCallout.callout_image}
                            alt={selectedCallout.label}
                            className="w-full rounded border border-[#1e2a45] max-h-96 object-contain bg-black"
                          />
                        ) : (
                          <div className="w-full h-48 flex items-center justify-center bg-[#0a0f1e] rounded border border-[#1e2a45] text-gray-500">
                            <div className="text-center">
                              <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p className="text-xs">No callout image captured yet</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-[#131a2e] rounded border border-dashed border-[#1e2a45] text-gray-500">
                    <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No callouts on this extract yet</p>
                    <p className="text-xs mt-1 text-gray-600">Go to Extracts to add callouts and highlights</p>
                  </div>
                )}

                {extract.notes && (
                  <div className="text-xs text-gray-400 bg-[#131a2e] px-3 py-2 rounded border border-[#1e2a45]">
                    <span className="text-gray-500">Notes: </span>{extract.notes}
                  </div>
                )}
              </div>
            )}

            {!depoClip && !extract && !loading && (
              <div className="text-center py-8 text-gray-500">Could not load proof details.</div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}