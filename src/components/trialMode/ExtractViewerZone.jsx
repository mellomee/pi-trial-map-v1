import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePresentationState } from '@/components/hooks/usePresentationState';
import SharedProofViewer from '@/components/shared/SharedProofViewer';
import { Monitor, Square, Eye, EyeOff } from 'lucide-react';

// Module-level spotlight callback so TrialMode can sync callout to jury
let _spotlightChangeCallback = null;
export function setSpotlightChangeCallback(fn) { _spotlightChangeCallback = fn; }

export default function ExtractViewerZone({ selectedProof, isPublishing, onPublish, onUnpublish, trialSessionId }) {
  const [extract, setExtract] = useState(null);
  const [callouts, setCallouts] = useState([]);
  const [caseParties, setCaseParties] = useState({});
  const [jx, setJx] = useState(null);
  const [calloutVisible, setCalloutVisible] = useState(true);
  const [activeSpotlight, setActiveSpotlight] = useState(null);

  const viewerRef = useRef(null);
  const syncTimerRef = useRef(null);

  const { state: _ps, setPage: syncPage, setZoom: syncZoom, setScroll: syncScroll } =
    usePresentationState(trialSessionId, true);

  // Spotlight → TrialMode jury callback
  useEffect(() => {
    if (isPublishing && _spotlightChangeCallback) {
      _spotlightChangeCallback(!calloutVisible ? null : (activeSpotlight?.id || null));
    }
  }, [activeSpotlight?.id, isPublishing, calloutVisible]);

  // Load extract + callouts when proof changes
  useEffect(() => {
    if (!selectedProof?.source_id) {
      setExtract(null); setCallouts([]); setCaseParties({}); setJx(null);
      setActiveSpotlight(null);
      return;
    }
    setExtract(null); setCallouts([]); setCaseParties({}); setJx(null);
    setActiveSpotlight(null);

    base44.entities.ExhibitExtracts.filter({ id: selectedProof.source_id }).then(async (r) => {
      const e = r[0];
      if (!e) return;
      setExtract(e);

      const [cos, jxList] = await Promise.all([
        base44.entities.Callouts.filter({ extract_id: e.id }),
        base44.entities.JointExhibits.filter({ exhibit_extract_id: e.id }),
      ]);
      const sorted = [...cos].sort((a, b) => (a.page_number || 0) - (b.page_number || 0));
      setCallouts(sorted);
      setJx(jxList[0] || null);

      // Load witness names for callout sidebar
      if (e.case_id) {
        base44.entities.Parties.filter({ case_id: e.case_id }).then((ps) => {
          const map = {};
          ps.forEach((p) => { map[p.id] = p.display_name || `${p.first_name || ''} ${p.last_name}`.trim(); });
          setCaseParties(map);
        });
      }
    });
  }, [selectedProof?.source_id]);

  // Page change → sync to jury
  const handlePageChange = useCallback((page) => {
    syncPage(page);
  }, [syncPage]);

  // Transform change (zoom+pan) → sync to jury (throttled)
  const handleTransformChange = useCallback((state) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncZoom(state.scale);
      // Use positionX/Y as scroll proxies so jury can mirror
      syncScroll(-state.positionX, -state.positionY);
    }, 90);
  }, [syncZoom, syncScroll]);

  // Spotlight change → propagate to jury via TrialMode
  const handleSpotlightChange = useCallback((callout) => {
    setActiveSpotlight(callout);
  }, []);

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
        <p className="text-xs">Loading…</p>
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
        {isPublishing && activeSpotlight && (
          <button
            onClick={() => setCalloutVisible((v) => !v)}
            className={`p-1.5 rounded touch-manipulation ${calloutVisible ? 'text-amber-300 bg-amber-900/20' : 'text-slate-500'}`}
            title={calloutVisible ? 'Hide callout from jury' : 'Show callout to jury'}
          >
            {calloutVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
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

      {/* Shared viewer body */}
      <SharedProofViewer
        ref={viewerRef}
        extract={extract}
        callouts={callouts}
        caseParties={caseParties}
        proofItem={selectedProof}
        onPageChange={handlePageChange}
        onTransformChange={handleTransformChange}
        onSpotlightChange={handleSpotlightChange}
        readOnly={false}
      />
    </div>
  );
}