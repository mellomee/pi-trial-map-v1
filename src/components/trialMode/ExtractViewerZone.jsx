import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PdfViewerWithGestures from '@/components/shared/PdfViewerWithGestures';
import { usePresentationState } from '@/components/hooks/usePresentationState';
import { Monitor, Square, ZoomIn, ZoomOut, X, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';

// ---------- Highlight overlay ----------
function HighlightOverlay({ highlights }) {
  if (!highlights?.length) return null;
  const colorMap = {
    yellow: 'rgba(253,224,71,0.5)', red: 'rgba(239,68,68,0.45)',
    green: 'rgba(34,197,94,0.45)', blue: 'rgba(59,130,246,0.45)',
  };
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {highlights.map((h, hi) =>
        (h.rects_norm || []).map((rect, ri) => (
          <div key={`${hi}-${ri}`} style={{
            position: 'absolute',
            left: `${rect.x * 100}%`, top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`, height: `${rect.h * 100}%`,
            backgroundColor: colorMap[h.color] || colorMap.yellow,
          }} />
        ))
      )}
    </div>
  );
}

// ---------- Spotlight overlay ----------
function SpotlightOverlay({ extractFileUrl, callout, highlights, onClose, pdfZoom = 1, maxWidth = '95%' }) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(pdfZoom);

  // Sync with PDF zoom
  useEffect(() => {
    setZoom(pdfZoom);
  }, [pdfZoom]);

  return (
    <div className="absolute inset-0 z-20 overflow-hidden" style={{ background: 'rgba(0,0,0,0.0)' }} ref={containerRef}>
      {/* Background: dimmed extract file */}
      {extractFileUrl && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
          <img src={extractFileUrl} alt="Extract" className="block max-w-full max-h-full object-contain"
            style={{ opacity: 0.15, filter: 'blur(1px)', userSelect: 'none' }} draggable={false} />
        </div>
      )}
      <div className="absolute inset-0" style={{ background: 'rgba(5,8,22,0.2)', zIndex: 2 }} />

      {/* Controls - positioned near callout top-right */}
      <div className="absolute flex items-center gap-2 z-40" style={{ top: '12px', right: '12px' }}>
        <button onClick={onClose} className="bg-red-900/80 hover:bg-red-700 border border-red-600/40 text-red-300 p-2 rounded-lg touch-manipulation"><X className="w-4 h-4" /></button>
      </div>

      {/* Callout — centered, bright, width-constrained */}
      <div className="absolute inset-0 flex items-center justify-center pr-28" style={{ zIndex: 3 }}>
        <div className="overflow-auto" style={{ maxWidth, maxHeight: '90%' }}>
          <div className="relative inline-block shadow-2xl rounded-lg border border-white/10"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s' }}>
            <img src={callout.snapshot_image_url} alt={callout.name || 'Callout'}
              className="block" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} draggable={false} />
            <HighlightOverlay highlights={highlights} />
          </div>
        </div>
      </div>

      {callout.name && (
        <div className="absolute bottom-4 left-0 right-0 text-center z-40">
          <span className="text-slate-300 text-sm bg-black/70 px-4 py-1.5 rounded-full font-medium">{callout.name}</span>
        </div>
      )}
    </div>
  );
}

// ---------- Callout sidebar item ----------
function CalloutItem({ callout, witnessName, isActive, isLinked, onClick, isDisabled }) {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full text-left rounded-lg border p-2 transition-all touch-manipulation space-y-1 ${
        isActive ? 'border-cyan-300 bg-cyan-500/40 border-2 border-cyan-300' : isLinked ? 'border-2 border-cyan-300 bg-cyan-500/30' : isDisabled ? 'border-[#1e2a45] bg-[#0a0f1e] opacity-40 cursor-not-allowed' : 'border-[#1e2a45] hover:border-slate-500 bg-[#0f1629] hover:bg-[#131a2e]'
      }`}
    >
      {callout.snapshot_image_url ? (
        <div className={`relative w-full aspect-video rounded overflow-hidden bg-black ${isLinked && !isActive ? 'ring-1 ring-red-500/60' : ''}`}>
          <img src={callout.snapshot_image_url} alt={callout.name} className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className={`w-full aspect-video rounded bg-[#0a0f1e] flex items-center justify-center ${isLinked && !isActive ? 'ring-1 ring-red-500/60' : ''}`}>
          <ImageIcon className="w-4 h-4 text-slate-600" />
        </div>
      )}
      {callout.name && <p className={`text-[10px] truncate font-medium leading-tight ${isActive ? 'text-slate-100' : isDisabled ? 'text-slate-500' : 'text-slate-300'}`}>{callout.name}</p>}
      {witnessName && <p className={`text-[10px] truncate leading-tight ${isActive ? 'text-cyan-200' : isDisabled ? 'text-slate-600' : 'text-cyan-400'}`}>{witnessName}</p>}
      {callout.page_number && <p className={`text-[10px] font-mono ${isActive ? 'text-amber-300' : isDisabled ? 'text-slate-600' : 'text-slate-400'}`}>Pg. {callout.page_number}</p>}
      {isActive && (
        <span className="flex items-center gap-0.5 text-[9px] text-amber-400 font-medium">
          <Eye className="w-2.5 h-2.5" /> Spotlighted
        </span>
      )}
    </button>
  );
}

// ---------- Main component ----------
// Module-level spotlight callback so TrialMode can subscribe without prop-drilling through frozen ProofPreviewZone
let _spotlightChangeCallback = null;
export function setSpotlightChangeCallback(fn) { _spotlightChangeCallback = fn; }

export default function ExtractViewerZone({ selectedProof, isPublishing, onPublish, onUnpublish, trialSessionId }) {
  const [extract, setExtract] = useState(null);
  const [allCallouts, setAllCallouts] = useState([]);
  const [highlightsByCallout, setHighlightsByCallout] = useState({});
  const [witnessByCallout, setWitnessByCallout] = useState({});
  const [jx, setJx] = useState(null);
  const [spotlightCallout, setSpotlightCallout] = useState(null);
  const [calloutVisible, setCalloutVisible] = useState(true);

  const imgContainerRef = useRef(null);
  const lastDist = useRef(null);
  const sidebarRef = useRef(null);

  // Use shared presentation state (attorney is the writer, jury is the reader)
  const { state: presentationState, setPage, setZoom, setScroll } = usePresentationState(trialSessionId, true);
  const zoom = presentationState?.proof_zoom_level || 1;
  const currentPage = presentationState?.proof_current_page || 1;

  // When spotlight changes while publishing, notify TrialMode via module-level callback
  useEffect(() => {
    if (isPublishing && _spotlightChangeCallback) {
      _spotlightChangeCallback(!calloutVisible ? null : (spotlightCallout?.id || null));
    }
  }, [spotlightCallout?.id, isPublishing, calloutVisible]);

  const handleZoomChange = useCallback((newZoom) => {
    setZoom(newZoom);
  }, [setZoom]);

  const handlePageChange = useCallback((newPage) => {
    setPage(newPage);
  }, [setPage]);

  const handleScrollChange = useCallback((sl, st) => {
    setScroll(sl, st);
  }, [setScroll]);

  useEffect(() => {
    if (!selectedProof?.source_id) {
      setExtract(null); setAllCallouts([]); setHighlightsByCallout({});
      setWitnessByCallout({}); setJx(null); setSpotlightCallout(null);
      return;
    }
    setExtract(null); setAllCallouts([]); setHighlightsByCallout({});
    setWitnessByCallout({}); setJx(null); setSpotlightCallout(null);

    base44.entities.ExhibitExtracts.filter({ id: selectedProof.source_id }).then(async r => {
      const ext = r[0];
      if (!ext) return;
      setExtract(ext);

      const allCs = await base44.entities.Callouts.filter({ extract_id: ext.id });
      const sorted = [...allCs].sort((a, b) => (a.page_number || 0) - (b.page_number || 0));
      setAllCallouts(sorted);

      // Load highlights for all callouts
      const hMap = {};
      await Promise.all(sorted.map(async c => {
        const hs = await base44.entities.Highlights.filter({ callout_id: c.id });
        hMap[c.id] = hs;
      }));
      setHighlightsByCallout(hMap);

      // Load witness names
      const wMap = {};
      const witnessIds = [...new Set(sorted.map(c => c.witness_id).filter(Boolean))];
      await Promise.all(witnessIds.map(async wid => {
        const pts = await base44.entities.Parties.filter({ id: wid });
        if (pts[0]) wMap[wid] = pts[0].display_name || `${pts[0].first_name || ''} ${pts[0].last_name}`.trim();
      }));
      setWitnessByCallout(wMap);

      // If proof has a linked callout, jump to its page
      if (selectedProof.callout_id && isPdf) {
        const linkedCallout = sorted.find(c => c.id === selectedProof.callout_id);
        if (linkedCallout?.page_number) {
          setPage(linkedCallout.page_number);
        } else {
          setPage(1);
        }
      } else {
        // No linked callout: initialize to page 1
        setPage(1);
      }

      base44.entities.JointExhibits.filter({ exhibit_extract_id: ext.id }).then(j => setJx(j[0] || null));
    });
  }, [selectedProof?.source_id, selectedProof?.callout_id, isPdf, setPage]);

  const exhibitLabel = jx?.admitted_no ? `Exhibit ${jx.admitted_no}` : jx?.marked_no ? `Exhibit ${jx.marked_no}` : null;
  const extractFileUrl = extract?.extract_file_url || null;
  const spotlightHighlights = spotlightCallout ? (highlightsByCallout[spotlightCallout.id] || []) : [];
  const isPdf = extractFileUrl?.match(/\.pdf(\?|$)/i);
  
  // Calculate max width for spotlight based on sidebar visibility
  const sidebarWidth = allCallouts.length > 0 ? 112 : 0; // w-28 = 112px
  const spotlightMaxWidth = `calc(100% - ${sidebarWidth + 24}px)`; // 24px padding

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
        <p className="text-xs">Loading extract...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45] relative overflow-hidden">

      {/* Toolbar — always above spotlight */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 flex-wrap relative z-50">
        {exhibitLabel && (
          <span className="text-xs font-semibold text-green-300 bg-green-900/30 border border-green-700/30 px-2 py-0.5 rounded mr-1">
            {exhibitLabel}
          </span>
        )}
        {isPdf ? (
          // PDF viewer has its own controls
          null
        ) : (
          <>
            <button onClick={() => handleZoomChange(Math.max(zoom - 0.25, 0.25))} className="p-1 rounded hover:bg-white/10 touch-manipulation">
              <ZoomOut className="w-3.5 h-3.5 text-slate-300" />
            </button>
            <button onClick={() => handleZoomChange(1)} className="text-[10px] text-slate-300 font-mono px-1.5 py-0.5 rounded hover:bg-white/10 min-w-[36px] text-center touch-manipulation">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={() => handleZoomChange(Math.min(zoom + 0.25, 5))} className="p-1 rounded hover:bg-white/10 touch-manipulation">
              <ZoomIn className="w-3.5 h-3.5 text-slate-300" />
            </button>
          </>
        )}
        <div className="flex-1" />
        {isPublishing && spotlightCallout && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCalloutVisible(v => !v)}
            className={`h-7 text-xs px-2 gap-1 touch-manipulation border-slate-600 ${calloutVisible ? 'text-amber-300 bg-amber-900/20' : 'text-slate-400'}`}
            title={calloutVisible ? 'Hide callout from jury' : 'Show callout to jury'}
          >
            {calloutVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </Button>
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

      {/* Body: extract file + callout sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* Spotlight overlay — scoped to body only, toolbar always above */}
        {spotlightCallout && (
          <SpotlightOverlay
            extractFileUrl={extractFileUrl}
            callout={spotlightCallout}
            highlights={spotlightHighlights}
            onClose={() => setSpotlightCallout(null)}
            pdfZoom={zoom}
            maxWidth={spotlightMaxWidth}
          />
        )}

        {/* Main extract file viewer — gesture wrapper ONLY wraps PDF content, not toolbar */}
         <div className="flex-1 overflow-hidden bg-[#080c18] relative flex flex-col" ref={imgContainerRef}>
          {extractFileUrl ? (
            isPdf ? (
              <PdfViewerWithGestures
                fileUrl={extractFileUrl}
                currentPage={currentPage}
                zoom={zoom}
                onZoomChange={handleZoomChange}
                onPageChange={handlePageChange}
                onScrollChange={handleScrollChange}
                showControls={true}
                dimmed={false}
              />
            ) : (
              <div className="min-h-full flex items-start justify-center p-3 overflow-auto touch-manipulation"
                style={{ touchAction: 'none' }}
                onTouchMove={(e) => {
                  if (e.touches.length === 2) {
                    e.preventDefault();
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    const dist = Math.hypot(
                      touch2.clientX - touch1.clientX,
                      touch2.clientY - touch1.clientY
                    );
                    if (lastDist.current > 0) {
                      const delta = dist - lastDist.current;
                      const newZoom = Math.min(5, Math.max(0.25, zoom + delta * 0.01));
                      handleZoomChange(newZoom);
                    }
                    lastDist.current = dist;
                  }
                }}
                onTouchEnd={() => { lastDist.current = null; }}
              >
                <div className="relative inline-block w-full"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.1s' }}>
                  <img src={extractFileUrl} alt={extract.extract_title_internal || extract.extract_title_official}
                    className="block max-w-full shadow-xl rounded mx-auto" draggable={false} />
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center space-y-2">
                <ImageIcon className="w-10 h-10 mx-auto opacity-20" />
                <p className="text-sm text-slate-400">{extract.extract_title_internal || extract.extract_title_official}</p>
                <p className="text-xs text-slate-600">No file uploaded for this extract</p>
              </div>
            </div>
          )}
        </div>

        {/* Callout sidebar */}
        {allCallouts.length > 0 && (
          <div className="w-28 flex-shrink-0 bg-[#0f1629] border-l border-[#1e2a45] overflow-y-auto" ref={sidebarRef}>
            <div className="p-1.5 space-y-1.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold px-1 pt-1">
                Callouts ({allCallouts.length})
              </p>
              {allCallouts.map(c => {
                const isLinked = selectedProof?.callout_id === c.id;
                const isDisabled = selectedProof?.callout_id && !isLinked; // Disable all non-linked callouts if proof has a linked one
                return (
                  <CalloutItem
                    key={c.id}
                    callout={c}
                    witnessName={c.witness_id ? witnessByCallout[c.witness_id] : null}
                    isActive={spotlightCallout?.id === c.id}
                    isLinked={isLinked}
                    isDisabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return;
                      // Toggle: click same callout to close, click different to open
                      setSpotlightCallout(prev => prev?.id === c.id ? null : c);
                      // Auto-navigate to callout's page via shared state
                      if (isPdf && c.page_number) {
                        setPage(c.page_number);
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}