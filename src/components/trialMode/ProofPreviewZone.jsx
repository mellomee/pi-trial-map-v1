import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { base44 } from '@/api/base44Client';
import { Monitor, Square, Eye, EyeOff, Video, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

function DepoClipPreview({ proof }) {
  const [clip, setClip] = useState(null);
  const [depo, setDepo] = useState(null);

  useEffect(() => {
    if (!proof?.source_id) return;
    base44.entities.DepoClips.filter({ id: proof.source_id }).then(r => {
      if (r[0]) {
        setClip(r[0]);
        if (r[0].deposition_id) {
          base44.entities.Depositions.filter({ id: r[0].deposition_id }).then(d => setDepo(d[0] || null));
        }
      }
    });
  }, [proof?.source_id]);

  if (!clip) return <div className="text-xs text-slate-500 p-4">Loading clip...</div>;

  const lines = (clip.clip_text || '').split('\n').filter(Boolean);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-[10px]">
        {depo && (
          <span className="bg-[#0f1629] border border-[#1e2a45] rounded px-2 py-1 text-slate-400">
            {depo.sheet_name}{depo.taken_date ? ` · ${depo.taken_date}` : ''}
          </span>
        )}
        <span className="bg-[#0f1629] border border-[#1e2a45] rounded px-2 py-1 font-mono text-cyan-300">
          {clip.start_cite} – {clip.end_cite}
        </span>
      </div>
      <div className="bg-[#0f1629] rounded-lg border border-[#1e2a45] overflow-hidden">
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {lines.map((line, i) => {
              const parts = line.match(/^(\d+:\d+)\s+(.*)$/);
              if (parts) {
                return (
                  <div key={i} className="flex gap-0 group">
                    <span className="text-[11px] font-mono text-cyan-500 font-bold w-14 flex-shrink-0 py-1.5 px-2 bg-[#0a0f1e]/60 border-r border-[#1e2a45]">{parts[1]}</span>
                    <span className="text-[12px] text-slate-100 leading-relaxed py-1.5 px-3 flex-1">{parts[2]}</span>
                  </div>
                );
              }
              return <div key={i} className="text-[12px] text-slate-300 py-1.5 px-2">{line}</div>;
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

const HIGHLIGHT_COLORS = {
  yellow: { fill: 'rgba(251,191,36,0.35)', stroke: 'rgba(251,191,36,0.9)' },
  red:    { fill: 'rgba(239,68,68,0.32)',  stroke: 'rgba(239,68,68,0.9)' },
  green:  { fill: 'rgba(34,197,94,0.32)',  stroke: 'rgba(34,197,94,0.9)' },
  blue:   { fill: 'rgba(59,130,246,0.32)', stroke: 'rgba(59,130,246,0.9)' },
};

function CalloutImage({ callout }) {
  const imgRef = React.useRef(null);
  const [imgSize, setImgSize] = React.useState(null);
  const [highlights, setHighlights] = React.useState([]);

  React.useEffect(() => {
    if (!callout?.id) return;
    base44.entities.Highlights.filter({ callout_id: callout.id }).then(setHighlights);
  }, [callout?.id]);

  return (
    <div className="relative inline-block w-full">
      <img
        ref={imgRef}
        src={callout.snapshot_image_url}
        alt={callout.name || 'Callout'}
        className="block w-full"
        draggable={false}
        onLoad={(e) => {
          const el = e.currentTarget;
          setImgSize({ width: el.clientWidth, height: el.clientHeight });
        }}
      />
      {imgSize && highlights.map(hl => {
        const colors = HIGHLIGHT_COLORS[hl.color] || HIGHLIGHT_COLORS.yellow;
        return (hl.rects_norm || []).map((r, ri) => (
          <div
            key={`${hl.id}-${ri}`}
            style={{
              position: 'absolute',
              left: r.x * imgSize.width,
              top: r.y * imgSize.height,
              width: r.w * imgSize.width,
              height: r.h * imgSize.height,
              backgroundColor: colors.fill,
              border: `1.5px solid ${colors.stroke}`,
              borderRadius: 2,
              pointerEvents: 'none',
            }}
          />
        ));
      })}
    </div>
  );
}

function ExtractPreview({ proof, showCallout, onPublish, isPublishing }) {
  const [callouts, setCallouts] = useState([]);
  const [jx, setJx] = useState(null);
  const [selectedCalloutIdx, setSelectedCalloutIdx] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!proof?.source_id) return;
    setSelectedCalloutIdx(0);
    setZoom(1);
    base44.entities.ExhibitExtracts.filter({ id: proof.source_id }).then(r => {
      if (r[0]) {
        base44.entities.Callouts.filter({ extract_id: r[0].id }).then(cs => {
          if (proof.callout_id) {
            const sorted = [...cs].sort((a, b) => (a.id === proof.callout_id ? -1 : b.id === proof.callout_id ? 1 : 0));
            setCallouts(sorted);
          } else {
            setCallouts(cs);
          }
        });
        base44.entities.JointExhibits.filter({ exhibit_extract_id: r[0].id }).then(j => setJx(j[0] || null));
      }
    });
  }, [proof?.source_id, proof?.callout_id]);

  const currentCallout = callouts[selectedCalloutIdx] || null;
  const internalName = jx?.internal_name || jx?.marked_title || '—';

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs flex-wrap">
        <div className="bg-[#0f1629] border border-[#1e2a45] rounded px-2 py-1">
          <span className="text-slate-500 text-[10px]">Internal: </span>
          <span className="text-slate-200">{internalName}</span>
        </div>
        {jx?.marked_no && (
          <div className="bg-[#0f1629] border border-[#1e2a45] rounded px-2 py-1">
            <span className="text-slate-500 text-[10px]">Marked: </span>
            <span className="text-yellow-300 font-bold">#{jx.marked_no}</span>
          </div>
        )}
        {jx?.admitted_no && (
          <div className="bg-[#0f1629] border border-[#1e2a45] rounded px-2 py-1">
            <span className="text-slate-500 text-[10px]">Admitted: </span>
            <span className="text-green-300 font-bold">#{jx.admitted_no}</span>
          </div>
        )}
      </div>

      {callouts.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {callouts.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => setSelectedCalloutIdx(idx)}
              className={`relative flex-shrink-0 w-16 h-20 rounded border overflow-hidden transition-all ${
                idx === selectedCalloutIdx ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-[#1e2a45] hover:border-cyan-500/40'
              }`}
            >
              {c.snapshot_image_url ? (
                <img src={c.snapshot_image_url} alt={`p${idx + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#0f1629] flex items-center justify-center">
                  <span className="text-[9px] text-slate-500">pg {idx + 1}</span>
                </div>
              )}
              <span className="absolute bottom-0 right-0 bg-black/70 text-[8px] text-slate-300 px-1 py-0.5">{idx + 1}</span>
            </button>
          ))}
        </div>
      )}

      {callouts.length > 0 && currentCallout?.snapshot_image_url && showCallout ? (
        <div className="relative bg-black rounded-lg border border-[#1e2a45] overflow-hidden">
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))} className="bg-black/60 hover:bg-black/80 text-white p-1 rounded">
              <ZoomIn className="w-3 h-3" />
            </button>
            <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="bg-black/60 hover:bg-black/80 text-white p-1 rounded">
              <ZoomOut className="w-3 h-3" />
            </button>
            <button onClick={() => setZoom(1)} className="bg-black/60 hover:bg-black/80 text-white px-1.5 py-1 rounded text-[9px]">
              {Math.round(zoom * 100)}%
            </button>
          </div>
          <ScrollArea className="max-h-72">
            <div className="overflow-x-auto" style={{ transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: 'top left', width: zoom !== 1 ? `${100 / zoom}%` : '100%' }}>
              <CalloutImage callout={currentCallout} />
            </div>
          </ScrollArea>
          {callouts.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
              <button onClick={() => setSelectedCalloutIdx(i => Math.max(i - 1, 0))} disabled={selectedCalloutIdx === 0} className="bg-black/60 hover:bg-black/80 text-white p-1 rounded disabled:opacity-30">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="bg-black/60 text-[10px] text-slate-300 px-2 py-1 rounded">{selectedCalloutIdx + 1} / {callouts.length}</span>
              <button onClick={() => setSelectedCalloutIdx(i => Math.min(i + 1, callouts.length - 1))} disabled={selectedCalloutIdx === callouts.length - 1} className="bg-black/60 hover:bg-black/80 text-white p-1 rounded disabled:opacity-30">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : callouts.length === 0 ? (
        <div className="bg-[#0f1629] border border-dashed border-[#1e2a45] rounded-lg p-6 text-center">
          <p className="text-xs text-slate-600">No callouts found for this extract</p>
        </div>
      ) : (
        <div className="bg-[#0f1629] border border-dashed border-[#1e2a45] rounded-lg p-6 text-center">
          <EyeOff className="w-5 h-5 text-slate-600 mx-auto mb-1" />
          <p className="text-xs text-slate-600">Callout hidden</p>
        </div>
      )}
    </div>
  );
}

export default function ProofPreviewZone({ selectedProof, isPublishing, onPublish, onUnpublish }) {
  const [showCallout, setShowCallout] = useState(true);

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

  const clipTitle = selectedProof.type === 'depoClip'
    ? (selectedProof.clip_title || selectedProof.topic_tag || null)
    : null;

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45]">
      <div className="px-3 py-2 border-b border-[#1e2a45] flex items-center justify-between flex-shrink-0 gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          {clipTitle && <span className="text-[11px] font-semibold text-amber-300 truncate">{clipTitle}</span>}
          <span className="text-[10px] text-slate-500 truncate">{selectedProof.label}</span>
          {isPublishing && (
            <Badge className="bg-red-700 text-red-100 text-[10px] px-1.5 py-0 animate-pulse w-fit mt-0.5">LIVE</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedProof.type === 'extract' && (
            <button
              onClick={() => setShowCallout(v => !v)}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${showCallout ? 'border-cyan-500 text-cyan-300' : 'border-[#1e2a45] text-slate-500'}`}
            >
              {showCallout ? <Eye className="w-3 h-3 inline mr-1" /> : <EyeOff className="w-3 h-3 inline mr-1" />}
              Callout
            </button>
          )}
          {isPublishing ? (
            <Button size="sm" onClick={onUnpublish} className="h-7 text-xs bg-red-700 hover:bg-red-600 px-2 gap-1">
              <Square className="w-3 h-3" />
              Unpublish
            </Button>
          ) : (
            <Button size="sm" onClick={() => onPublish(selectedProof)} className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 px-2 gap-1">
              <Monitor className="w-3 h-3" />
              Publish
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {selectedProof.type === 'depoClip' && <DepoClipPreview proof={selectedProof} />}
          {selectedProof.type === 'extract' && (
            <ExtractPreview proof={selectedProof} showCallout={showCallout} onPublish={onPublish} isPublishing={isPublishing} />
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