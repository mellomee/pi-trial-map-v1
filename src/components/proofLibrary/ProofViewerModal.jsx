import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, Image, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function CalloutImageWithHighlights({ callout, highlights }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState(null);

  if (!callout.snapshot_image_url) {
    return (
      <div className="w-full h-48 flex items-center justify-center bg-[#0a0f1e] rounded border border-[#1e2a45] text-gray-500">
        <div className="text-center">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No snapshot captured yet</p>
        </div>
      </div>
    );
  }

  const colorMap = { yellow: 'rgba(253,224,71,', red: 'rgba(239,68,68,', green: 'rgba(34,197,94,', blue: 'rgba(59,130,246,' };

  return (
    <div ref={containerRef} className="relative w-full">
      <img
        src={callout.snapshot_image_url}
        alt={callout.name}
        className="w-full rounded border border-[#1e2a45] max-h-96 object-contain bg-black"
        onLoad={(e) => setDims({ w: e.target.offsetWidth, h: e.target.offsetHeight })}
      />
      {dims && highlights.map((hl, hi) =>
        (hl.rects_norm || []).map((r, ri) => {
          const base = colorMap[hl.color] || colorMap.yellow;
          return (
            <div
              key={`${hi}-${ri}`}
              style={{
                position: 'absolute',
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
                backgroundColor: `${base}${hl.opacity ?? 0.35})`,
                pointerEvents: 'none',
              }}
            />
          );
        })
      )}
    </div>
  );
}

export default function ProofViewerModal({ proofItem, isOpen, onClose, onSelectCallout }) {
  const [loading, setLoading] = useState(false);
  const [depoClip, setDepoClip] = useState(null);
  const [deposition, setDeposition] = useState(null);
  const [extract, setExtract] = useState(null);
  const [extractMeta, setExtractMeta] = useState(null); // { sourceDepoExhibit, deponent, jointExhibit, admittedExhibit }
  const [callouts, setCallouts] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [selectedCallout, setSelectedCallout] = useState(null);

  useEffect(() => {
    if (isOpen && proofItem) {
      loadDetails();
    } else {
      setDepoClip(null);
      setDeposition(null);
      setExtract(null);
      setExtractMeta(null);
      setCallouts([]);
      setHighlights([]);
      setSelectedCallout(null);
    }
  }, [isOpen, proofItem?.id]);

  useEffect(() => {
    if (selectedCallout?.id) {
      base44.entities.Highlights.filter({ callout_id: selectedCallout.id })
        .then(setHighlights)
        .catch(() => setHighlights([]));
    } else {
      setHighlights([]);
    }
  }, [selectedCallout?.id]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      if (proofItem.type === 'depoClip') {
        const clips = await base44.entities.DepoClips.filter({ id: proofItem.source_id });
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
        if (extracts.length > 0) {
          const ext = extracts[0];
          setExtract(ext);
          // Load metadata in parallel
          const [sources, jointExhibits] = await Promise.all([
            base44.entities.ExtractSources.filter({ exhibit_extract_id: ext.id }),
            base44.entities.JointExhibits.filter({ exhibit_extract_id: ext.id }),
          ]);
          let sourceDepoExhibit = null, deponent = null;
          if (sources.length > 0) {
            const src = sources[0];
            const [depoExhibits, parties] = await Promise.all([
              src.source_depo_exhibit_id ? base44.entities.DepositionExhibits.filter({ id: src.source_depo_exhibit_id }) : Promise.resolve([]),
              src.source_deponent_party_id ? base44.entities.Parties.filter({ id: src.source_deponent_party_id }) : Promise.resolve([]),
            ]);
            if (depoExhibits.length > 0) sourceDepoExhibit = depoExhibits[0];
            if (parties.length > 0) deponent = parties[0];
          }
          let admittedExhibit = null;
          if (jointExhibits.length > 0 && jointExhibits[0].admitted_no) {
            admittedExhibit = { admitted_no: jointExhibits[0].admitted_no, admitted_date: jointExhibits[0].admitted_date };
          }
          setExtractMeta({ sourceDepoExhibit, deponent, sources, jointExhibits, admittedExhibit });
        }
        const sorted = cos.sort((a, b) => (a.page_number || 0) - (b.page_number || 0));
        setCallouts(sorted);
        if (sorted.length > 0) setSelectedCallout(sorted[0]);
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

                <div className="text-sm font-medium text-gray-100 bg-[#131a2e] px-3 py-2 rounded">
                  {extract.extract_title_internal || extract.extract_title_official}
                </div>

                {/* Metadata grid */}
                {extractMeta && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {extractMeta.sourceDepoExhibit && (
                      <div className="bg-[#131a2e] border border-[#1e2a45] rounded px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">Source Exhibit</p>
                        <p className="text-gray-200">{extractMeta.sourceDepoExhibit.depo_exhibit_title || extractMeta.sourceDepoExhibit.display_title}</p>
                        {extractMeta.sourceDepoExhibit.depo_exhibit_no && (
                          <p className="text-gray-400 mt-0.5">Exh #{extractMeta.sourceDepoExhibit.depo_exhibit_no}</p>
                        )}
                      </div>
                    )}
                    {extractMeta.deponent && (
                      <div className="bg-[#131a2e] border border-[#1e2a45] rounded px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">Source Deponent</p>
                        <p className="text-gray-200">{extractMeta.deponent.display_name || `${extractMeta.deponent.first_name || ''} ${extractMeta.deponent.last_name}`.trim()}</p>
                        {extractMeta.sources[0]?.source_depo_exhibit_no && (
                          <p className="text-gray-400 mt-0.5">Depo Exh #{extractMeta.sources[0].source_depo_exhibit_no}</p>
                        )}
                      </div>
                    )}
                    {extractMeta.jointExhibits.length > 0 ? (
                      <div className="bg-[#131a2e] border border-[#1e2a45] rounded px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">Joint List</p>
                        <p className="text-gray-200">Marked #{extractMeta.jointExhibits[0].marked_no}</p>
                        {extractMeta.jointExhibits[0].marked_title && (
                          <p className="text-gray-400 mt-0.5 truncate">{extractMeta.jointExhibits[0].marked_title}</p>
                        )}
                        <Badge className={`mt-1 text-[10px] ${extractMeta.jointExhibits[0].status === 'Admitted' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {extractMeta.jointExhibits[0].status}
                        </Badge>
                      </div>
                    ) : (
                      <div className="bg-[#131a2e] border border-[#1e2a45] rounded px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">Joint List</p>
                        <p className="text-gray-500 italic">Not on joint list</p>
                      </div>
                    )}
                    {extractMeta.admittedExhibit ? (
                      <div className="bg-[#131a2e] border border-green-500/30 rounded px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">Admitted</p>
                        <p className="text-green-300 font-semibold">Admitted #{extractMeta.admittedExhibit.admitted_no}</p>
                        {extractMeta.admittedExhibit.admitted_date && (
                          <p className="text-gray-400 mt-0.5">{extractMeta.admittedExhibit.admitted_date}</p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-[#131a2e] border border-[#1e2a45] rounded px-3 py-2">
                        <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">Admitted</p>
                        <p className="text-gray-500 italic">Not admitted</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Callouts */}
                {callouts.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-cyan-400 tracking-wider">
                        CALLOUTS ({callouts.length})
                      </span>
                      {callouts.length > 1 && (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                            disabled={selectedCalloutIdx <= 0}
                            onClick={() => setSelectedCallout(callouts[selectedCalloutIdx - 1])}>
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-xs text-gray-400">{selectedCalloutIdx + 1} / {callouts.length}</span>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                            disabled={selectedCalloutIdx >= callouts.length - 1}
                            onClick={() => setSelectedCallout(callouts[selectedCalloutIdx + 1])}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Thumbnails */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {callouts.map((c, idx) => (
                        <button key={c.id} onClick={() => setSelectedCallout(c)}
                          className={`flex-shrink-0 rounded border-2 transition-all ${selectedCallout?.id === c.id ? 'border-cyan-400 shadow-lg shadow-cyan-500/20' : 'border-[#1e2a45] hover:border-gray-500'}`}>
                          {c.snapshot_image_url ? (
                            <img src={c.snapshot_image_url} alt={c.name || `Callout ${idx + 1}`} className="h-16 w-20 object-cover rounded" />
                          ) : (
                            <div className="h-16 w-20 flex items-center justify-center bg-[#131a2e] rounded">
                              <Image className="w-5 h-5 text-gray-600" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Selected callout */}
                    {selectedCallout && (
                      <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-cyan-400 font-semibold">{selectedCallout.name || `Callout – Page ${selectedCallout.page_number}`}</span>
                          <span className="text-xs text-gray-500 ml-auto">Pg {selectedCallout.page_number}</span>
                          {selectedCallout.jury_safe && (
                            <Badge className="bg-green-500/20 text-green-400 text-xs">Jury Safe</Badge>
                          )}
                          {onSelectCallout && (
                            <Button size="sm"
                              className="h-6 text-xs bg-cyan-600 hover:bg-cyan-700 px-2"
                              onClick={() => { onSelectCallout(selectedCallout); onClose(); }}>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Use This Callout
                            </Button>
                          )}
                        </div>
                        <CalloutImageWithHighlights callout={selectedCallout} highlights={highlights} />
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