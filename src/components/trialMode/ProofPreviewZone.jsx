import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { base44 } from '@/api/base44Client';
import { Monitor, Square, Video, Lock } from 'lucide-react';
import ExtractViewerZone from './ExtractViewerZone';

// ---------- DepoClip Preview ----------
function DepoClipPreview({ proof }) {
  const [clip, setClip] = useState(null);
  const [depo, setDepo] = useState(null);

  useEffect(() => {
    if (!proof?.source_id) return;
    setClip(null);
    setDepo(null);
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
          <div className="divide-y divide-[#1e2a45]/60">
            {lines.map((line, i) => {
              const parts = line.match(/^(\d+:\d+)\s+(.*)$/);
              if (parts) {
                return (
                  <div key={i} className="flex flex-col px-3 py-1.5 hover:bg-white/3 group">
                    <span className="font-mono text-cyan-400 text-[10px] font-bold tracking-wider leading-none mb-1">{parts[1]}</span>
                    <span className="text-[13px] text-white leading-snug">{parts[2]}</span>
                  </div>
                );
              }
              return <div key={i} className="text-[13px] text-slate-300 px-3 py-1.5">{line}</div>;
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ---------- Main ProofPreviewZone ----------
export default function ProofPreviewZone({ selectedProof, isPublishing, onPublish, onUnpublish, trialSessionId }) {
  // For extract type, delegate entirely to ExtractViewerZone (which has its own full-height layout)
  if (selectedProof?.type === 'extract') {
    return (
      <ExtractViewerZone
        selectedProof={selectedProof}
        isPublishing={isPublishing}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        trialSessionId={trialSessionId}
      />
    );
  }


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