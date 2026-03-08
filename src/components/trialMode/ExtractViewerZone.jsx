import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Monitor, Square, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Eye, Layers, X, Image as ImageIcon, CheckCircle2,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// ---------- Highlight overlay (percentage-based, fits the image) ----------
function HighlightOverlay({ highlights }) {
  if (!highlights?.length) return null;
  const colorMap = {
    yellow: 'rgba(253,224,71,0.5)',
    red: 'rgba(239,68,68,0.45)',
    green: 'rgba(34,197,94,0.45)',
    blue: 'rgba(59,130,246,0.45)',
  };
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {highlights.map((h, hi) =>
        (h.rects_norm || []).map((rect, ri) => (
          <div
            key={`${hi}-${ri}`}
            style={{
              position: 'absolute',
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
              backgroundColor: colorMap[h.color] || colorMap.yellow,
            }}
          />
        ))
      )}
    </div>
  );
}

/**
 * Spotlight mode:
 * - Background: the full extract page image (dimmed)
 * - Foreground: the callout image with highlights, large and bright
 */
function SpotlightOverlay({ extractPageUrl, callout, highlights, onClose }) {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden" style={{ background: 'rgba(0,0,0,0.0)' }}>
      {/* Background: full extract page, dimmed */}
      {extractPageUrl && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
          <img
            src={extractPageUrl}
            alt="Extract page"
            className="block max-w-full max-h-full object-contain"
            style={{ opacity: 0.18, filter: 'blur(1px)', userSelect: 'none' }}
            draggable={false}
          />
        </div>
      )}

      {/* Dark overlay on top of background */}
      <div className="absolute inset-0" style={{ background: 'rgba(5,8,22,0.7)', zIndex: 2 }} />

      {/* Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-40">
        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="bg-[#0f1629]/90 hover:bg-[#1e2a45] border border-[#1e2a45] text-white p-2 rounded-lg touch-manipulation">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={() => setZoom(1)} className="bg-[#0f1629]/90 hover:bg-[#1e2a45] border border-[#1e2a45] text-slate-300 px-3 py-2 rounded-lg text-xs font-mono touch-manipulation">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))} className="bg-[#0f1629]/90 hover:bg-[#1e2a45] border border-[#1e2a45] text-white p-2 rounded-lg touch-manipulation">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={onClose} className="bg-red-900/80 hover:bg-red-700 border border-red-600/40 text-red-300 p-2 rounded-lg touch-manipulation ml-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Callout image — centered, bright, large */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 3 }}>
        <div className="overflow-auto" style={{ maxWidth: '95vw', maxHeight: '90vh' }}>
          <div
            className="relative inline-block shadow-2xl rounded-lg border border-white/10"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s' }}
          >
            <img
              src={callout.snapshot_image_url}
              alt={callout.name || 'Callout'}
              className="block"
              style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }}
              draggable={false}
            />
            <HighlightOverlay highlights={highlights} />
          </div>
        </div>
      </div>

      {callout.name && (
        <div className="absolute bottom-4 left-0 right-0 text-center z-40">
          <span className="text-slate-400 text-xs bg-black/60 px-3 py-1 rounded-full">{callout.name}</span>
        </div>
      )}
    </div>
  );
}

// ---------- Main component ----------
export default function ExtractViewerZone({ selectedProof, isPublishing, onPublish, onUnpublish }) {
  const [extract, setExtract] = useState(null);
  const [extractPageUrl, setExtractPageUrl] = useState(null); // full page image (background for spotlight)
  // Only the callouts linked to this proof (not all callouts)
  const [linkedCallouts, setLinkedCallouts] = useState([]);
  const [allCalloutsByPage, setAllCalloutsByPage] = useState([]); // for page nav: sorted by page_number
  const [highlightsByCallout, setHighlightsByCallout] = useState({});
  const [jx, setJx] = useState(null);

  // Viewer state: which callout is selected
  const [selectedCalloutIdx, setSelectedCalloutIdx] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Spotlight
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  // Touch pinch zoom
  const imgContainerRef = useRef(null);
  const lastDist = useRef(null);

  useEffect(() => {
    if (!selectedProof?.source_id) {
      setExtract(null); setLinkedCallouts([]); setAllCalloutsByPage([]);
      setHighlightsByCallout({}); setJx(null); setSelectedCalloutIdx(0);
      setZoom(1); setSpotlightOpen(false); setExtractPageUrl(null);
      return;
    }

    setExtract(null); setLinkedCallouts([]); setAllCalloutsByPage([]);
    setHighlightsByCallout({}); setJx(null); setSelectedCalloutIdx(0);
    setZoom(1); setSpotlightOpen(false); setExtractPageUrl(null);

    base44.entities.ExhibitExtracts.filter({ id: selectedProof.source_id }).then(async r => {
      const ext = r[0];
      if (!ext) return;
      setExtract(ext);

      // Store extract full page image if available
      if (ext.page_image_url) setExtractPageUrl(ext.page_image_url);
      else if (ext.file_url) setExtractPageUrl(ext.file_url);

      // Get ALL callouts for this extract (for the callout panel)
      const allCs = await base44.entities.Callouts.filter({ extract_id: ext.id });
      setAllCalloutsByPage(allCs);

      // Determine which callouts are "linked" to this proof item
      // If proof has a specific callout_id, just show that one (+ siblings on same page for context)
      let focused = [];
      if (selectedProof.callout_id) {
        const target = allCs.find(c => c.id === selectedProof.callout_id);
        if (target) {
          // Also grab any callout on the same page (by page_number field or index proximity)
          const targetPage = target.page_number;
          if (targetPage != null) {
            focused = allCs.filter(c => c.page_number === targetPage);
          } else {
            focused = [target];
          }
        }
      }
      // If no specific callout_id on proof, show no callouts (extract only, no callout selected)
      // Only show callouts when the proof explicitly has one linked
      if (!selectedProof.callout_id && !focused.length) focused = [];
      setLinkedCallouts(focused);

      // Jump to the target callout
      if (selectedProof.callout_id) {
        const idx = focused.findIndex(c => c.id === selectedProof.callout_id);
        if (idx >= 0) setSelectedCalloutIdx(idx);
      }

      // Load highlights for all callouts
      const hMap = {};
      await Promise.all(allCs.map(async c => {
        const hs = await base44.entities.Highlights.filter({ callout_id: c.id });
        hMap[c.id] = hs;
      }));
      setHighlightsByCallout(hMap);

      base44.entities.JointExhibits.filter({ exhibit_extract_id: ext.id }).then(j => setJx(j[0] || null));
    });
  }, [selectedProof?.source_id, selectedProof?.callout_id]);

  const totalCallouts = linkedCallouts.length;
  const currentCallout = linkedCallouts[selectedCalloutIdx] || null;
  const currentHighlights = currentCallout ? (highlightsByCallout[currentCallout.id] || []) : [];

  // Exhibit label
  const exhibitLabel = jx?.admitted_no
    ? `Exhibit ${jx.admitted_no}`
    : jx?.marked_no
    ? `Exhibit ${jx.marked_no}`
    : null;

  const goCallout = (i) => setSelectedCalloutIdx(Math.min(Math.max(i, 0), totalCallouts - 1));

  // Pinch zoom
  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && lastDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = dist / lastDist.current;
      setZoom(z => Math.min(Math.max(z * delta, 0.25), 5));
      lastDist.current = dist;
      e.preventDefault();
    }
  }, []);

  const onTouchEnd = useCallback(() => { lastDist.current = null; }, []);

  // Empty/loading states
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

      {/* Spotlight overlay */}
      {spotlightOpen && currentCallout && (
        <SpotlightOverlay
          extractPageUrl={extractPageUrl || currentCallout.page_image_url || null}
          callout={currentCallout}
          highlights={currentHighlights}
          onClose={() => setSpotlightOpen(false)}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 flex-wrap">
        {exhibitLabel && (
          <span className="text-xs font-semibold text-green-300 bg-green-900/30 border border-green-700/30 px-2 py-0.5 rounded mr-1">
            {exhibitLabel}
          </span>
        )}

        {/* Callout pagination */}
        {totalCallouts > 1 && (
          <>
            <button onClick={() => goCallout(selectedCalloutIdx - 1)} disabled={selectedCalloutIdx <= 0}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 touch-manipulation">
              <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
            </button>
            <span className="text-[10px] text-slate-400 font-mono">{selectedCalloutIdx + 1}/{totalCallouts}</span>
            <button onClick={() => goCallout(selectedCalloutIdx + 1)} disabled={selectedCalloutIdx >= totalCallouts - 1}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 touch-manipulation">
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            </button>
            <span className="text-[#1e2a45] text-lg font-thin mx-1 select-none">|</span>
          </>
        )}

        {/* Zoom */}
        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} className="p-1 rounded hover:bg-white/10 touch-manipulation">
          <ZoomOut className="w-3.5 h-3.5 text-slate-300" />
        </button>
        <button onClick={() => setZoom(1)} className="text-[10px] text-slate-300 font-mono px-1.5 py-0.5 rounded hover:bg-white/10 min-w-[36px] text-center touch-manipulation">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => setZoom(z => Math.min(z + 0.25, 5))} className="p-1 rounded hover:bg-white/10 touch-manipulation">
          <ZoomIn className="w-3.5 h-3.5 text-slate-300" />
        </button>

        <span className="text-[#1e2a45] text-lg font-thin mx-1 select-none">|</span>

        {/* Spotlight button */}
        <button
          onClick={() => setSpotlightOpen(true)}
          disabled={!selectedProof?.callout_id || !currentCallout?.snapshot_image_url}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-amber-600/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-30 touch-manipulation transition-colors"
        >
          <Eye className="w-3 h-3" />
          Spotlight
        </button>

        <div className="flex-1" />

        {/* Publish/Unpublish */}
        {isPublishing ? (
          <Button size="sm" onClick={onUnpublish} className="h-7 text-xs bg-red-700 hover:bg-red-600 px-2 gap-1 touch-manipulation">
            <Square className="w-3 h-3" />
            Unpublish
          </Button>
        ) : (
          <Button size="sm" onClick={() => onPublish(selectedProof)} className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 px-2 gap-1 touch-manipulation">
            <Monitor className="w-3 h-3" />
            Publish
          </Button>
        )}
      </div>

      {/* Main view */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Callout thumbnail sidebar — only when proof has a callout_id */}
      {selectedProof?.callout_id && allCalloutsByPage.length > 1 && (
          <div className="w-20 flex-shrink-0 bg-[#0f1629] border-r border-[#1e2a45] overflow-y-auto">
            <div className="p-1 space-y-1">
              {allCalloutsByPage.map((c, idx) => {
                const isLinked = linkedCallouts.some(lc => lc.id === c.id);
                const isActive = currentCallout?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      const linkedIdx = linkedCallouts.findIndex(lc => lc.id === c.id);
                      if (linkedIdx >= 0) setSelectedCalloutIdx(linkedIdx);
                    }}
                    className={`relative w-full aspect-[3/4] rounded border overflow-hidden transition-all touch-manipulation ${
                      isActive ? 'border-cyan-400 ring-1 ring-cyan-400' :
                      isLinked ? 'border-amber-500/60 hover:border-amber-400' :
                      'border-[#1e2a45] hover:border-slate-500/40 opacity-40'
                    }`}
                    title={isLinked ? 'Linked callout' : 'Not linked to this proof'}
                  >
                    {c.snapshot_image_url ? (
                      <img src={c.snapshot_image_url} alt={`Callout ${idx + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#0a0f1e] flex items-center justify-center">
                        <ImageIcon className="w-3 h-3 text-slate-600" />
                      </div>
                    )}
                    {isLinked && (
                      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                    <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-[7px] text-slate-300 text-center py-0.5">{idx + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Current callout image — or no-callout state */}
        <div
          className="flex-1 overflow-auto bg-[#080c18] relative"
          ref={imgContainerRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {!selectedProof?.callout_id ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center space-y-3 px-8">
                <ImageIcon className="w-10 h-10 mx-auto opacity-20" />
                <div>
                  <p className="text-sm font-medium text-slate-400">{extract?.extract_title_internal || extract?.extract_title_official}</p>
                  <p className="text-xs mt-1 text-slate-600">No callout linked to this proof</p>
                </div>
              </div>
            </div>
          ) : currentCallout?.snapshot_image_url ? (
            <div className="min-h-full flex items-start justify-center p-3">
              <div
                className="relative inline-block"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.1s' }}
              >
                <img
                  src={currentCallout.snapshot_image_url}
                  alt={`Callout ${selectedCalloutIdx + 1}`}
                  className="block max-w-full shadow-xl rounded"
                  draggable={false}
                />
                <HighlightOverlay highlights={currentHighlights} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600">
              <div className="text-center space-y-2">
                <ImageIcon className="w-10 h-10 mx-auto opacity-20" />
                <p className="text-xs">No image for this callout</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}