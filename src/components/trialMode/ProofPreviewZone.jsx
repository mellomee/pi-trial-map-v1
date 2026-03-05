import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { base44 } from '@/api/base44Client';
import { Send, Square, Eye, EyeOff, Monitor, Info, Video } from 'lucide-react';

function DepoClipPreview({ proof }) {
  const [clip, setClip] = useState(null);
  const [depo, setDepo] = useState(null);

  useEffect(() => {
    if (proof?.source_id) {
      base44.entities.DepoClips.filter({ id: proof.source_id }).then(r => {
        if (r[0]) {
          setClip(r[0]);
          if (r[0].deposition_id) {
            base44.entities.Depositions.filter({ id: r[0].deposition_id }).then(d => setDepo(d[0] || null));
          }
        }
      });
    }
  }, [proof?.source_id]);

  if (!clip) return <div className="text-xs text-slate-500 p-4">Loading clip...</div>;

  // Parse lines into LASTNAME-Page-Line format
  const lines = (clip.clip_text || '').split('\n').filter(Boolean);

  return (
    <div className="space-y-3">
      {depo && (
        <div className="text-xs text-slate-400 bg-[#0f1629] px-3 py-2 rounded border border-[#1e2a45]">
          <span className="text-slate-500">Deposition: </span>{depo.sheet_name}
          {depo.taken_date && <span className="ml-2 text-slate-500">{depo.taken_date}</span>}
        </div>
      )}
      <div className="text-xs text-slate-400">
        <span className="text-slate-500">Cite: </span>
        <span className="font-mono text-cyan-300">{clip.start_cite} – {clip.end_cite}</span>
      </div>
      {/* 2-column transcript view */}
      <div className="bg-[#0f1629] rounded border border-[#1e2a45] overflow-hidden">
        <div className="grid grid-cols-2 text-[10px] text-slate-500 px-3 py-1.5 border-b border-[#1e2a45]">
          <span>CITE</span>
          <span>TEXT</span>
        </div>
        <ScrollArea className="max-h-48">
          <div className="p-2 space-y-0.5">
            {lines.map((line, i) => {
              const parts = line.match(/^(\d+:\d+)\s+(.*)$/);
              if (parts) {
                return (
                  <div key={i} className="grid grid-cols-2 gap-2 py-0.5">
                    <span className="text-[11px] font-mono text-cyan-400">{parts[1]}</span>
                    <span className="text-[11px] text-slate-200">{parts[2]}</span>
                  </div>
                );
              }
              return (
                <div key={i} className="col-span-2 text-[11px] text-slate-300 py-0.5">{line}</div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ExtractPreview({ proof, showCallout, showHighlight }) {
  const [extract, setExtract] = useState(null);
  const [callout, setCallout] = useState(null);
  const [jx, setJx] = useState(null);

  useEffect(() => {
    if (proof?.source_id) {
      base44.entities.ExhibitExtracts.filter({ id: proof.source_id }).then(r => {
        if (r[0]) {
          setExtract(r[0]);
          if (proof.callout_id) {
            base44.entities.Callouts.filter({ id: proof.callout_id }).then(c => setCallout(c[0] || null));
          }
          // Find joint exhibit
          base44.entities.JointExhibits.filter({ exhibit_extract_id: r[0].id }).then(j => setJx(j[0] || null));
        }
      });
    }
  }, [proof?.source_id, proof?.callout_id]);

  if (!extract) return <div className="text-xs text-slate-500 p-4">Loading extract...</div>;

  // Resolve the internal_name from the extract or its linked joint exhibit
  const internalName = extract.internal_name || jx?.internal_name || extract.title || jx?.marked_title || '—';

  return (
    <div className="space-y-3">
      {/* Metadata */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-[#0f1629] border border-[#1e2a45] rounded p-2">
          <p className="text-[10px] text-slate-500 mb-0.5">Internal Name</p>
          <p className="text-slate-200 font-medium">{internalName}</p>
        </div>
        <div className="bg-[#0f1629] border border-[#1e2a45] rounded p-2">
          <p className="text-[10px] text-slate-500 mb-0.5">Marked #</p>
          <p className="text-yellow-300 font-bold">{jx?.marked_no ? `#${jx.marked_no}` : '—'}</p>
        </div>
        <div className="bg-[#0f1629] border border-[#1e2a45] rounded p-2">
          <p className="text-[10px] text-slate-500 mb-0.5">Admitted #</p>
          <p className="text-green-300 font-bold">{jx?.admitted_no ? `#${jx.admitted_no}` : '—'}</p>
        </div>
        {callout && (
          <div className="bg-[#0f1629] border border-[#1e2a45] rounded p-2">
            <p className="text-[10px] text-slate-500 mb-0.5">Callout</p>
            <p className="text-slate-200">{callout.name || `Page ${callout.page_number}`}</p>
          </div>
        )}
      </div>
      {/* Callout image */}
      {callout?.snapshot_image_url && showCallout && (
        <div className="bg-black rounded border border-[#1e2a45] overflow-hidden">
          <img
            src={callout.snapshot_image_url}
            alt={callout.name}
            className="w-full max-h-64 object-contain"
          />
        </div>
      )}
      {!showCallout && (
        <div className="bg-[#0f1629] border border-dashed border-[#1e2a45] rounded p-6 text-center">
          <EyeOff className="w-6 h-6 text-slate-600 mx-auto mb-1" />
          <p className="text-xs text-slate-600">Callout hidden</p>
        </div>
      )}
    </div>
  );
}

export default function ProofPreviewZone({
  selectedProof,
  isPublishing,
  onPublish,
  onUnpublish,
}) {
  const [showCallout, setShowCallout] = useState(true);
  const [showHighlight, setShowHighlight] = useState(true);

  if (!selectedProof) {
    return (
      <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45]">
        <div className="px-4 py-2 border-b border-[#1e2a45]">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preview</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-600">
          <p className="text-xs">Select a proof to preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1e2a45] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-300 truncate">{selectedProof.label}</span>
          {isPublishing && (
            <Badge className="bg-red-700 text-red-100 text-[10px] px-1.5 py-0 animate-pulse flex-shrink-0">
              LIVE
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {selectedProof.type === 'extract' && (
            <>
              <button
                onClick={() => setShowCallout(v => !v)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${showCallout ? 'border-cyan-500 text-cyan-300' : 'border-[#1e2a45] text-slate-500'}`}
              >
                {showCallout ? <Eye className="w-3 h-3 inline mr-1" /> : <EyeOff className="w-3 h-3 inline mr-1" />}
                Callout
              </button>
              <button
                onClick={() => setShowHighlight(v => !v)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${showHighlight ? 'border-cyan-500 text-cyan-300' : 'border-[#1e2a45] text-slate-500'}`}
              >
                Highlight
              </button>
            </>
          )}
          {isPublishing ? (
            <Button
              size="sm"
              onClick={onUnpublish}
              className="h-7 text-xs bg-red-700 hover:bg-red-600 px-2 gap-1"
            >
              <Square className="w-3 h-3" />
              Unpublish
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onPublish(selectedProof)}
              className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 px-2 gap-1"
            >
              <Monitor className="w-3 h-3" />
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {selectedProof.type === 'depoClip' && <DepoClipPreview proof={selectedProof} />}
          {selectedProof.type === 'extract' && (
            <ExtractPreview
              proof={selectedProof}
              showCallout={showCallout}
              showHighlight={showHighlight}
            />
          )}
          {selectedProof.type === 'videoClip' && (
            <div className="text-center py-8 text-slate-500">
              <Video className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Video playback coming soon</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}