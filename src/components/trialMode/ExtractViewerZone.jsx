import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { usePresentationState } from '@/components/hooks/usePresentationState';
import SharedPdfViewer from '@/components/pdf/SharedPdfViewer';
import { Monitor, Square, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';

// Spotlight callback for TrialMode
let _spotlightChangeCallback = null;
export function setSpotlightChangeCallback(fn) {
  _spotlightChangeCallback = fn;
}

// Spotlight overlay component
function SpotlightOverlay({ callout, onClose }) {
  if (!callout?.snapshot_image_url) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 bg-red-900/80 hover:bg-red-700 text-red-300 p-1.5 rounded-lg z-40"
      >
        ✕
      </button>
      <img
        src={callout.snapshot_image_url}
        alt={callout.name || 'Callout'}
        className="block shadow-2xl rounded-lg border border-white/10"
        style={{ maxWidth: '92%', maxHeight: '88%', objectFit: 'contain' }}
        draggable={false}
      />
      {callout.name && (
        <div className="absolute bottom-3 left-0 right-0 text-center z-40">
          <span className="text-slate-300 text-xs bg-black/70 px-3 py-1 rounded-full">{callout.name}</span>
        </div>
      )}
    </div>
  );
}

// Callout sidebar item
function CalloutItem({ callout, witnessName, isActive, isLinked, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-1.5 transition-all space-y-1 ${
        isActive
          ? 'border-cyan-300 bg-cyan-500/20 border-2'
          : isLinked
          ? 'border-cyan-500/40 bg-cyan-900/20'
          : 'border-[#1e2a45] hover:border-slate-500 bg-[#0f1629]'
      }`}
    >
      {callout.snapshot_image_url ? (
        <div className="w-full aspect-video rounded overflow-hidden bg-black">
          <img src={callout.snapshot_image_url} alt={callout.name} className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="w-full aspect-video rounded bg-[#0a0f1e] flex items-center justify-center">
          <ImageIcon className="w-3 h-3 text-slate-600" />
        </div>
      )}
      {callout.name && <p className="text-[9px] text-slate-300 truncate leading-tight">{callout.name}</p>}
      {witnessName && <p className="text-[9px] text-cyan-400 truncate leading-tight">{witnessName}</p>}
      {isActive && (
        <span className="flex items-center gap-0.5 text-[8px] text-amber-400 font-medium">
          <Eye className="w-2 h-2" /> Spotlighted
        </span>
      )}
    </button>
  );
}

export default function ExtractViewerZone({ selectedProof, isPublishing, onPublish, onUnpublish, trialSessionId }) {
  const [extract, setExtract] = useState(null);
  const [allCallouts, setAllCallouts] = useState([]);
  const [witnessByCallout, setWitnessByCallout] = useState({});
  const [jx, setJx] = useState(null);
  const [spotlightCallout, setSpotlightCallout] = useState(null);
  const [calloutVisible, setCalloutVisible] = useState(true);

  const { state: presentationState, setPage, setViewport } = usePresentationState(trialSessionId, true);

  const handleViewportChange = useCallback((viewport) => {
    setViewport(viewport);
  }, [setViewport]);

  // Sync spotlight to jury
  useEffect(() => {
    if (isPublishing && _spotlightChangeCallback) {
      _spotlightChangeCallback(!calloutVisible ? null : (spotlightCallout?.id || null));
    }
  }, [spotlightCallout?.id, isPublishing, calloutVisible]);

  // Load extract + callouts
  useEffect(() => {
    if (!selectedProof?.source_id) {
      setExtract(null);
      setAllCallouts([]);
      setWitnessByCallout({});
      setJx(null);
      setSpotlightCallout(null);
      return;
    }

    setExtract(null);
    setAllCallouts([]);
    setWitnessByCallout({});
    setJx(null);
    setSpotlightCallout(null);

    base44.entities.ExhibitExtracts.filter({ id: selectedProof.source_id }).then(async (r) => {
      const e = r[0];
      if (!e) return;
      setExtract(e);

      const [callouts, jxList] = await Promise.all([
        base44.entities.Callouts.filter({ extract_id: e.id }),
        base44.entities.JointExhibits.filter({ exhibit_extract_id: e.id }),
      ]);
      const sorted = [...callouts].sort((a, b) => (a.page_number || 0) - (b.page_number || 0));
      setAllCallouts(sorted);
      setJx(jxList[0] || null);

      const wids = [...new Set(sorted.map((c) => c.witness_id).filter(Boolean))];
      const wMap = {};
      await Promise.all(
        wids.map(async (wid) => {
          const pts = await base44.entities.Parties.filter({ id: wid });
          if (pts[0]) wMap[wid] = pts[0].display_name || `${pts[0].first_name || ''} ${pts[0].last_name}`.trim();
        })
      );
      setWitnessByCallout(wMap);

      // Jump to callout page and auto-select if linked
      if (selectedProof.callout_id) {
        const linked = sorted.find((c) => c.id === selectedProof.callout_id);
        if (linked) {
          setSpotlightCallout(linked);
          if (linked.page_number) {
            setPage(linked.page_number);
          }
        }
      }
    });
  }, [selectedProof?.source_id, setPage, setPan]);

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
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 flex-wrap z-10">
        {exhibitLabel && (
          <span className="text-xs font-semibold text-green-300 bg-green-900/30 border border-green-700/30 px-2 py-0.5 rounded mr-1">
            {exhibitLabel}
          </span>
        )}

        <div className="flex-1" />

        {isPublishing && spotlightCallout && (
          <button
            onClick={() => setCalloutVisible((v) => !v)}
            className={`p-1.5 rounded ${calloutVisible ? 'text-amber-300 bg-amber-900/20' : 'text-slate-500'}`}
            title={calloutVisible ? 'Hide callout from jury' : 'Show callout to jury'}
          >
            {calloutVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
        )}

        {isPublishing ? (
          <Button size="sm" onClick={onUnpublish} className="h-7 text-xs bg-red-700 hover:bg-red-600 px-2 gap-1">
            <Square className="w-3 h-3" /> Unpublish
          </Button>
        ) : (
          <Button size="sm" onClick={() => onPublish(selectedProof)} className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 px-2 gap-1">
            <Monitor className="w-3 h-3" /> Publish
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Spotlight overlay */}
        {spotlightCallout && (
          <SpotlightOverlay callout={spotlightCallout} onClose={() => setSpotlightCallout(null)} />
        )}

        {/* PDF Viewer - bounded frame for jury sync */}
          <div className="flex-1 flex items-center justify-center bg-[#0a0f1e] overflow-hidden">
            <div style={{ width: '92%', height: '92%', maxWidth: '92vw', maxHeight: '92vh' }}>
              <SharedPdfViewer
                fileUrl={extract.extract_file_url}
                page={presentationState?.proof_current_page || 1}
                zoom={presentationState?.proof_zoom_level || 1}
                panX={presentationState?.proof_pan_x || 0}
                panY={presentationState?.proof_pan_y || 0}
                onPageChange={setPage}
                onViewportChange={handleViewportChange}
                readOnly={false}
                showControls={true}
                showToolbar={true}
              />
            </div>
          </div>

        {/* Callout sidebar */}
        {allCallouts.length > 0 && (
          <div className="w-28 flex-shrink-0 bg-[#0f1629] border-l border-[#1e2a45] overflow-y-auto">
            <div className="p-1.5 space-y-1.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold px-1 pt-1">
                Callouts ({allCallouts.length})
              </p>
              {allCallouts.map((c) => (
                <CalloutItem
                  key={c.id}
                  callout={c}
                  witnessName={c.witness_id ? witnessByCallout[c.witness_id] : null}
                  isActive={spotlightCallout?.id === c.id}
                  isLinked={selectedProof?.callout_id === c.id}
                  onClick={() => {
                    setSpotlightCallout((prev) => (prev?.id === c.id ? null : c));
                    if (c.page_number) setPage(c.page_number);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}