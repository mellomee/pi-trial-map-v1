import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Monitor, Square, ZoomIn, ZoomOut, X, Image as ImageIcon, Eye } from 'lucide-react';

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
function SpotlightOverlay({ extractFileUrl, callout, highlights, onClose }) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className="absolute inset-0 z-30 overflow-hidden" style={{ background: 'rgba(0,0,0,0.0)' }}>
      {/* Background: dimmed extract file */}
      {extractFileUrl && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
          <img src={extractFileUrl} alt="Extract" className="block max-w-full max-h-full object-contain"
            style={{ opacity: 0.15, filter: 'blur(1px)', userSelect: 'none' }} draggable={false} />
        </div>
      )}
      <div className="absolute inset-0" style={{ background: 'rgba(5,8,22,0.75)', zIndex: 2 }} />

      {/* Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-40">
        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="bg-[#0f1629]/90 hover:bg-[#1e2a45] border border-[#1e2a45] text-white p-2 rounded-lg touch-manipulation"><ZoomOut className="w-4 h-4" /></button>
        <button onClick={() => setZoom(1)} className="bg-[#0f1629]/90 hover:bg-[#1e2a45] border border-[#1e2a45] text-slate-300 px-3 py-2 rounded-lg text-xs font-mono touch-manipulation">{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))} className="bg-[#0f1629]/90 hover:bg-[#1e2a45] border border-[#1e2a45] text-white p-2 rounded-lg touch-manipulation"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={onClose} className="bg-red-900/80 hover:bg-red-700 border border-red-600/40 text-red-300 p-2 rounded-lg touch-manipulation ml-1"><X className="w-4 h-4" /></button>
      </div>

      {/* Callout — centered, bright */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 3 }}>
        <div className="overflow-auto" style={{ maxWidth: '95vw', maxHeight: '90vh' }}>
          <div className="relative inline-block shadow-2xl rounded-lg border border-white/10"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s' }}>
            <img src={callout.snapshot_image_url} alt={callout.name || 'Callout'}
              className="block" style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }} draggable={false} />
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
function CalloutItem({ callout, witnessName, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-2 transition-all touch-manipulation space-y-1 ${
        isActive ? 'border-amber-400 bg-amber-500/10' : 'border-[#1e2a45] hover:border-slate-500 bg-[#0f1629] hover:bg-[#131a2e]'
      }`}
    >
      {callout.snapshot_image_url ? (
        <div className="relative w-full aspect-video rounded overflow-hidden bg-black">
          <img src={callout.snapshot_image_url} alt={callout.name} className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="w-full aspect-video rounded bg-[#0a0f1e] flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-slate-600" />
        </div>
      )}
      {callout.name && <p className="text-[10px] text-slate-300 truncate font-medium leading-tight">{callout.name}</p>}
      {witnessName && <p className="text-[10px] text-cyan-400 truncate leading-tight">{witnessName}</p>}
      {isActive && (
        <div className="flex items-center gap-1 text-[9px] text-amber-400 font-medium">
          <Eye className="w-2.5 h-2.5" /> Spotlighted
        </div>
      )}
    </button>
  );
}

// ---------- Main component ----------
export default function ExtractViewerZone({ selectedProof, isPublishing, onPublish, onUnpublish }) {
  const [extract, setExtract] = useState(null);
  const [allCallouts, setAllCallouts] = useState([]);
  const [highlightsByCallout, setHighlightsByCallout] = useState({});
  const [witnessByCallout, setWitnessByCallout] = useState({});
  const [jx, setJx] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [spotlightCallout, setSpotlightCallout] = useState(null); // callout being spotlighted

  const imgContainerRef = useRef(null);
  const lastDist = useRef(null);

  useEffect(() => {
    if (!selectedProof?.source_id) {
      setExtract(null); setAllCallouts([]); setHighlightsByCallout({});
      setWitnessByCallout({}); setJx(null); setZoom(1); setSpotlightCallout(null);
      return;
    }
    setExtract(null); setAllCallouts([]); setHighlightsByCallout({});
    setWitnessByCallout({}); setJx(null); setZoom(1); setSpotlightCallout(null);

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

      // Auto-spotlight the linked callout if proof has one
      if (selectedProof.callout_id) {
        const linked = sorted.find(c => c.id === selectedProof.callout_id);
        if (linked) setSpotlightCallout(linked);
      }

      base44.entities.JointExhibits.filter({ exhibit_extract_id: ext.id }).then(j => setJx(j[0] || null));
    });
  }, [selectedProof?.source_id, selectedProof?.callout_id]);

  const exhibitLabel = jx?.admitted_no ? `Exhibit ${jx.admitted_no}` : jx?.marked_no ? `Exhibit ${jx.marked_no}` : null;
  const extractFileUrl = extract?.extract_file_url || null;
  const spotlightHighlights = spotlightCallout ? (highlightsByCallout[spotlightCallout.id] || []) : [];

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
      setZoom(z => Math.min(Math.max(z * (dist / lastDist.current), 0.25), 5));
      lastDist.current = dist;
      e.preventDefault();
    }
  }, []);
  const onTouchEnd = useCallback(() => { lastDist.current = null; }, []);

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

  const isImage = extractFileUrl?.match(/\.(jpe?g|png|gif|webp)(\?|$)/i);

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45] relative overflow-hidden">

      {/* Spotlight overlay */}
      {spotlightCallout && (
        <SpotlightOverlay
          extractFileUrl={extractFileUrl}
          callout={spotlightCallout}
          highlights={spotlightHighlights}
          onClose={() => setSpotlightCallout(null)}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 flex-wrap">
        {exhibitLabel && (
          <span className="text-xs font-semibold text-green-300 bg-green-900/30 border border-green-700/30 px-2 py-0.5 rounded mr-1">
            {exhibitLabel}
          </span>
        )}
        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} className="p-1 rounded hover:bg-white/10 touch-manipulation">
          <ZoomOut className="w-3.5 h-3.5 text-slate-300" />
        </button>
        <button onClick={() => setZoom(1)} className="text-[10px] text-slate-300 font-mono px-1.5 py-0.5 rounded hover:bg-white/10 min-w-[36px] text-center touch-manipulation">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => setZoom(z => Math.min(z + 0.25, 5))} className="p-1 rounded hover:bg-white/10 touch-manipulation">
          <ZoomIn className="w-3.5 h-3.5 text-slate-300" />
        </button>
        <div className="flex-1" />
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
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Main extract file viewer */}
        <div className="flex-1 overflow-auto bg-[#080c18] relative"
          ref={imgContainerRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          {extractFileUrl ? (
            <div className="min-h-full flex items-start justify-center p-3">
              <div className="relative inline-block w-full"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.1s' }}>
                {isImage ? (
                  <img src={extractFileUrl} alt={extract.extract_title_internal || extract.extract_title_official}
                    className="block max-w-full shadow-xl rounded mx-auto" draggable={false} />
                ) : (
                  <iframe src={extractFileUrl} title={extract.extract_title_internal || extract.extract_title_official}
                    className="w-full rounded shadow-xl" style={{ minHeight: '80vh', border: 'none' }} />
                )}
              </div>
            </div>
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
          <div className="w-28 flex-shrink-0 bg-[#0f1629] border-l border-[#1e2a45] overflow-y-auto">
            <div className="p-1.5 space-y-1.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold px-1 pt-1">
                Callouts ({allCallouts.length})
              </p>
              {allCallouts.map(c => (
                <CalloutItem
                  key={c.id}
                  callout={c}
                  witnessName={c.witness_id ? witnessByCallout[c.witness_id] : null}
                  isActive={spotlightCallout?.id === c.id}
                  onClick={() => setSpotlightCallout(prev => prev?.id === c.id ? null : c)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}