import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePresentationState } from '@/components/hooks/usePresentationState';
import SharedProofViewerBody from '@/components/shared/SharedProofViewerBody';
import { Monitor, Square, Eye, EyeOff } from 'lucide-react';

// Module-level spotlight callback so TrialMode can subscribe without prop-drilling
let _spotlightChangeCallback = null;
export function setSpotlightChangeCallback(fn) { _spotlightChangeCallback = fn; }

export default function ExtractViewerZone({
  selectedProof,
  isPublishing,
  onPublish,
  onUnpublish,
  trialSessionId,
}) {
  const [extract, setExtract] = useState(null);
  const [callouts, setCallouts] = useState([]);
  const [witnessNames, setWitnessNames] = useState({});
  const [highlights, setHighlights] = useState([]);
  const [selectedCallout, setSelectedCallout] = useState(null);
  const [calloutVisible, setCalloutVisible] = useState(true);
  const [jx, setJx] = useState(null);

  // Shared presentation state — attorney writes, jury reads
  const { state: _ps, setPage: _syncPage } = usePresentationState(trialSessionId, true);

  // Notify TrialMode when spotlight changes (so it can push callout_id to jury)
  useEffect(() => {
    if (isPublishing && _spotlightChangeCallback) {
      _spotlightChangeCallback(!calloutVisible ? null : (selectedCallout?.id || null));
    }
  }, [selectedCallout?.id, isPublishing, calloutVisible]);

  // Load extract + callouts when proof changes
  useEffect(() => {
    if (!selectedProof?.source_id) {
      setExtract(null); setCallouts([]); setWitnessNames({});
      setHighlights([]); setSelectedCallout(null); setJx(null);
      return;
    }
    setExtract(null); setCallouts([]); setWitnessNames({});
    setHighlights([]); setSelectedCallout(null); setJx(null);

    base44.entities.ExhibitExtracts.filter({ id: selectedProof.source_id }).then(async (r) => {
      const e = r[0];
      if (!e) return;
      setExtract(e);

      const [allCallouts, jxList] = await Promise.all([
        base44.entities.Callouts.filter({ extract_id: e.id }),
        base44.entities.JointExhibits.filter({ exhibit_extract_id: e.id }),
      ]);

      const sorted = [...allCallouts].sort((a, b) => (a.page_number || 0) - (b.page_number || 0));
      setCallouts(sorted);
      setJx(jxList[0] || null);

      // Auto-jump to linked callout page on proof load
      if (selectedProof.callout_id) {
        const linked = sorted.find((c) => c.id === selectedProof.callout_id);
        if (linked) {
          setSelectedCallout(linked);
          if (linked.page_number) _syncPage(linked.page_number);
        }
      }

      // Load witness names
      const wids = [...new Set(sorted.map((c) => c.witness_id).filter(Boolean))];
      const wMap = {};
      await Promise.all(wids.map(async (wid) => {
        const pts = await base44.entities.Parties.filter({ id: wid });
        if (pts[0]) wMap[wid] = pts[0].display_name || `${pts[0].first_name || ''} ${pts[0].last_name}`.trim();
      }));
      setWitnessNames(wMap);
    });
  }, [selectedProof?.source_id]);

  // Load highlights when callout changes
  useEffect(() => {
    if (!selectedCallout?.id) { setHighlights([]); return; }
    base44.entities.Highlights.filter({ callout_id: selectedCallout.id })
      .then(setHighlights)
      .catch(() => setHighlights([]));
  }, [selectedCallout?.id]);

  const handleSelectCallout = useCallback((callout) => {
    setSelectedCallout(callout);
    // Jump to page when clicking callout
    if (callout?.page_number) _syncPage(callout.page_number);
  }, [_syncPage]);

  // ── Empty states ──────────────────────────────────────────────────────────
  if (!selectedProof) {
    return (
      <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45] items-center justify-center text-slate-600">
        <p className="text-xs">Select a proof to preview</p>
      </div>
    );
  }
  if (selectedProof.type !== 'extract') return null;
  if (!extract) {
    return (
      <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45] items-center justify-center text-slate-500">
        <p className="text-xs">Loading...</p>
      </div>
    );
  }

  const exhibitLabel = jx?.admitted_no
    ? `Exhibit ${jx.admitted_no}`
    : jx?.marked_no
    ? `Exhibit ${jx.marked_no}`
    : null;

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 flex-wrap z-10">
        {exhibitLabel && (
          <span className="text-xs font-semibold text-green-300 bg-green-900/30 border border-green-700/30 px-2 py-0.5 rounded">
            {exhibitLabel}
          </span>
        )}
        {isPublishing && (
          <Badge className="bg-red-700 text-red-100 text-[10px] px-1.5 py-0 animate-pulse">LIVE</Badge>
        )}
        <div className="flex-1" />
        {isPublishing && selectedCallout && (
          <button
            onClick={() => setCalloutVisible((v) => !v)}
            className={`p-1.5 rounded touch-manipulation ${calloutVisible ? 'text-amber-300 bg-amber-900/20' : 'text-slate-500 hover:text-slate-300'}`}
            title={calloutVisible ? 'Hide callout from jury' : 'Show callout to jury'}
          >
            {calloutVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
        )}
        {isPublishing ? (
          <Button size="sm" onClick={onUnpublish} className="h-7 text-xs bg-red-700 hover:bg-red-600 px-2 gap-1 touch-manipulation">
            <Square className="w-3 h-3" /> Unpublish
          </Button>
        ) : (
          <Button size="sm" onClick={() => onPublish(selectedProof)} className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 px-2 gap-1 touch-manipulation">
            <Monitor className="w-3 h-3" /> Publish
          </Button>
        )}
      </div>

      {/* Shared viewer body — flex-1, same as the modal */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <SharedProofViewerBody
          extract={extract}
          callouts={callouts}
          witnessNames={witnessNames}
          selectedCallout={selectedCallout}
          onSelectCallout={handleSelectCallout}
          proofItemCalloutId={selectedProof?.callout_id}
          highlights={highlights}
          onSetAsProof={null}
        />
      </div>
    </div>
  );
}