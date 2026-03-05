import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Monitor, Square, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Eye, EyeOff, BookOpen, Layers, X, Image as ImageIcon,
} from 'lucide-react';

// ---------- Highlight overlay ----------
function HighlightOverlay({ highlights, zoom = 1 }) {
  if (!highlights?.length) return null;
  const colorMap = {
    yellow: 'rgba(253,224,71,0.45)',
    red: 'rgba(239,68,68,0.4)',
    green: 'rgba(34,197,94,0.4)',
    blue: 'rgba(59,130,246,0.4)',
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
              mixBlendMode: 'multiply',
            }}
          />
        ))
      )}
    </div>
  );
}

// ---------- Callout spotlight overlay ----------
function CalloutSpotlight({ callout, highlights, onClose }) {
  const [zoom, setZoom] = useState(1);
  if (!callout?.snapshot_image_url) return null;

  return (
    <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center" style={{ backdropFilter: 'blur(2px)' }}>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-3 z-30 flex-shrink-0">
        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="bg-[#0f1629] hover:bg-[#1e2a45] border border-[#1e2a45] text-white p-2 rounded-lg touch-manipulation">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={() => setZoom(1)} className="bg-[#0f1629] hover:bg-[#1e2a45] border border-[#1e2a45] text-slate-300 px-3 py-2 rounded-lg text-xs font-mono touch-manipulation">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))} className="bg-[#0f1629] hover:bg-[#1e2a45] border border-[#1e2a45] text-white p-2 rounded-lg touch-manipulation">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={onClose} className="bg-red-900/60 hover:bg-red-800 border border-red-700/40 text-red-300 p-2 rounded-lg touch-manipulation ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Spotlighted callout image */}
      <div className="overflow-auto max-w-full max-h-[80%] rounded-xl shadow-2xl border border-[#1e2a45]">
        <div className="relative inline-block" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <img
            src={callout.snapshot_image_url}
            alt={callout.name || 'Callout'}
            className="block max-w-[90vw]"
            draggable={false}
          />
          <HighlightOverlay highlights={highlights} zoom={zoom} />
        </div>
      </div>
      {callout.name && (
        <p className="text-slate-400 text-xs mt-2">{callout.name}</p>
      )}
    </div>
  );
}

// ---------- Main component ----------
export default function ExtractViewerZone({ selectedProof, isPublishing, onPublish, onUnpublish }) {
  const [extract, setExtract] = useState(null);
  const [callouts, setCallouts] = useState([]);
  const [highlightsByCallout, setHighlightsByCallout] = useState({});
  const [jx, setJx] = useState(null);

  // Viewer state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [jumpInput, setJumpInput] = useState('');

  // Callout/spotlight
  const [showCalloutPanel, setShowCalloutPanel] = useState(false);
  const [spotlightCallout, setSpotlightCallout] = useState(null); // callout being spotlighted
  const [spotlightHighlights, setSpotlightHighlights] = useState([]);

  // Touch pinch zoom
  const imgContainerRef = useRef(null);
  const lastDist = useRef(null);

  useEffect(() => {
    if (!selectedProof?.source_id) {
      setExtract(null); setCallouts([]); setJx(null); setHighlightsByCallout({});
      setCurrentPage(1); setZoom(1); setSpotlightCallout(null);
      return;
    }
    setExtract(null); setCallouts([]); setJx(null); setHighlightsByCallout({});
    setCurrentPage(1); setZoom(1); setSpotlightCallout(null);

    base44.entities.ExhibitExtracts.filter({ id: selectedProof.source_id }).then(async r => {
      const ext = r[0];
      if (!ext) return;
      setExtract(ext);

      // Figure out total pages from pages field or callout count
      const cs = await base44.entities.Callouts.filter({ extract_id: ext.id });
      setCallouts(cs);
      setTotalPages(Math.max(cs.length, 1));

      // If proof has a preferred callout, go to its page
      if (selectedProof.callout_id) {
        const idx = cs.findIndex(c => c.id === selectedProof.callout_id);
        if (idx >= 0) setCurrentPage(idx + 1);
      }

      // Load highlights for every callout
      const hMap = {};
      await Promise.all(cs.map(async c => {
        const hs = await base44.entities.Highlights.filter({ callout_id: c.id });
        hMap[c.id] = hs;
      }));
      setHighlightsByCallout(hMap);

      base44.entities.JointExhibits.filter({ exhibit_extract_id: ext.id }).then(j => setJx(j[0] || null));
    });
  }, [selectedProof?.source_id, selectedProof?.callout_id]);

  const currentCallout = callouts[currentPage - 1] || null;
  const currentHighlights = currentCallout ? (highlightsByCallout[currentCallout.id] || []) : [];

  // Exhibit label
  const exhibitLabel = jx?.admitted_no
    ? `Exhibit ${jx.admitted_no}`
    : jx?.marked_no
    ? `Exhibit ${jx.marked_no}`
    : null;

  const goPage = (p) => setCurrentPage(Math.min(Math.max(p, 1), totalPages));

  // Pinch zoom touch handling
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
      setZoom(z => Math.min(Math.max(z * delta, 0.5), 5));
      lastDist.current = dist;
      e.preventDefault();
    }
  }, []);

  const onTouchEnd = useCallback(() => { lastDist.current = null; }, []);

  const openSpotlight = (callout) => {
    setSpotlightCallout(callout);
    setSpotlightHighlights(highlightsByCallout[callout.id] || []);
  };

  // Empty state
  if (!selectedProof) {
    return (
      <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45] items-center justify-center text-slate-600">
        <p className="text-xs">Select a proof to preview</p>
      </div>
    );
  }

  // Non-extract proof
  if (selectedProof.type !== 'extract') {
    return null; // handled by parent
  }

  if (!extract) {
    return (
      <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45] items-center justify-center text-slate-500">
        <p className="text-xs">Loading extract...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45] relative overflow-hidden">
      {/* Callout spotlight overlay */}
      {spotlightCallout && (
        <CalloutSpotlight
          callout={spotlightCallout}
          highlights={spotlightHighlights}
          onClose={() => setSpotlightCallout(null)}
        />
      )}

      {/* Top toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 flex-wrap">
        {/* Exhibit label */}
        {exhibitLabel && (
          <span className="text-xs font-semibold text-green-300 bg-green-900/30 border border-green-700/30 px-2 py-0.5 rounded mr-1">
            {exhibitLabel}
          </span>
        )}

        {/* Page nav */}
        <button onClick={() => goPage(currentPage - 1)} disabled={currentPage <= 1} className="p-1 rounded hover:bg-white/10 disabled:opacity-30 touch-manipulation">
          <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
        </button>
        <form onSubmit={e => { e.preventDefault(); const n = parseInt(jumpInput); if (!isNaN(n)) goPage(n); setJumpInput(''); }}
          className="flex items-center gap-1">
          <input
            value={jumpInput || ''}
            onChange={e => setJumpInput(e.target.value)}
            placeholder={`${currentPage}`}
            className="w-9 text-center text-xs bg-[#0a0f1e] border border-[#1e2a45] rounded px-1 py-0.5 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
          />
          <span className="text-[10px] text-slate-500">/ {totalPages}</span>
        </form>
        <button onClick={() => goPage(currentPage + 1)} disabled={currentPage >= totalPages} className="p-1 rounded hover:bg-white/10 disabled:opacity-30 touch-manipulation">
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        </button>

        {/* Divider */}
        <span className="text-[#1e2a45] text-lg font-thin mx-1 select-none">|</span>

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

        {/* Divider */}
        <span className="text-[#1e2a45] text-lg font-thin mx-1 select-none">|</span>

        {/* Callout panel toggle */}
        <button
          onClick={() => setShowCalloutPanel(v => !v)}
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors touch-manipulation ${showCalloutPanel ? 'border-cyan-500 text-cyan-300 bg-cyan-500/10' : 'border-[#1e2a45] text-slate-400 hover:border-cyan-500/30'}`}
        >
          <Layers className="w-3 h-3" />
          Callouts
        </button>

        {/* Spacer */}
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

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Callout panel (sidebar) */}
        {showCalloutPanel && callouts.length > 0 && (
          <div className="w-24 flex-shrink-0 bg-[#0f1629] border-r border-[#1e2a45] overflow-y-auto">
            <div className="p-1 space-y-1">
              {callouts.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => { setCurrentPage(idx + 1); }}
                  className={`relative w-full aspect-[3/4] rounded border overflow-hidden transition-all touch-manipulation ${
                    currentPage === idx + 1 ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-[#1e2a45] hover:border-cyan-500/40'
                  }`}
                >
                  {c.snapshot_image_url ? (
                    <img src={c.snapshot_image_url} alt={`Callout ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#0a0f1e] flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-slate-600" />
                    </div>
                  )}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-[8px] text-slate-300 text-center py-0.5">
                    {idx + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image viewer */}
        <div
          className="flex-1 overflow-auto bg-[#080c18] relative"
          ref={imgContainerRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {currentCallout?.snapshot_image_url ? (
            <div className="min-h-full flex items-start justify-center p-3">
              <div
                className="relative inline-block"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.1s' }}
              >
                <img
                  src={currentCallout.snapshot_image_url}
                  alt={`Page ${currentPage}`}
                  className="block max-w-full shadow-xl rounded"
                  draggable={false}
                />
                <HighlightOverlay highlights={currentHighlights} />
                {/* Spotlight trigger */}
                {currentHighlights.length > 0 && (
                  <button
                    onClick={() => openSpotlight(currentCallout)}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-cyan-700/80 border border-cyan-500/40 text-cyan-300 text-[10px] px-2 py-1 rounded-full flex items-center gap-1 touch-manipulation"
                    title="Spotlight this callout"
                  >
                    <Eye className="w-3 h-3" />
                    Spotlight
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600">
              <div className="text-center space-y-2">
                <ImageIcon className="w-10 h-10 mx-auto opacity-20" />
                <p className="text-xs">No image for this page</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}