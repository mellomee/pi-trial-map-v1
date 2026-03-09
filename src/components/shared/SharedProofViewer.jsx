/**
 * SharedProofViewer
 *
 * Single PDF/image viewer used by BOTH attorney (ExtractViewerZone) and jury (JuryView).
 * Attorney mode: interactive pan/zoom/page nav, writes sync state.
 * Jury mode:     readOnly=true, mirrors external page/scale/position, no sidebar.
 */
import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, Eye, X, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PAGE_WIDTH = 620;
const SYNC_THROTTLE_MS = 90;

// ── Highlight overlay ────────────────────────────────────────────────────────
function HighlightOverlay({ highlights }) {
  if (!highlights?.length) return null;
  const colorMap = {
    yellow: 'rgba(253,224,71,0.5)', red: 'rgba(239,68,68,0.45)',
    green: 'rgba(34,197,94,0.45)', blue: 'rgba(59,130,246,0.45)',
  };
  return (
    <div className="absolute inset-0 pointer-events-none">
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

// ── Spotlight overlay ────────────────────────────────────────────────────────
function SpotlightOverlay({ callout, highlights, onClose, showClose = true }) {
  if (!callout?.snapshot_image_url) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.72)' }}>
      {showClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-red-900/80 hover:bg-red-700 text-red-300 p-1.5 rounded-lg z-40 touch-manipulation"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="relative inline-block shadow-2xl rounded-lg border border-white/10" style={{ maxWidth: '92%', maxHeight: '90%' }}>
        <img
          src={callout.snapshot_image_url}
          alt={callout.name || 'Callout'}
          className="block rounded-lg"
          style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }}
          draggable={false}
        />
        <HighlightOverlay highlights={highlights} />
      </div>
      {callout.name && (
        <div className="absolute bottom-3 left-0 right-0 text-center z-40">
          <span className="text-slate-300 text-xs bg-black/70 px-3 py-1 rounded-full">{callout.name}</span>
        </div>
      )}
    </div>
  );
}

// ── Callout sidebar item ─────────────────────────────────────────────────────
function CalloutItem({ callout, witnessName, isActive, isLinked, onClick, onSetAsProof }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-1.5 transition-all space-y-1 touch-manipulation ${
        isActive
          ? 'border-cyan-300 border-2 bg-cyan-500/20'
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
      <div className="flex items-center gap-1">
        {isActive && <span className="text-[8px] text-amber-400 flex items-center gap-0.5"><Eye className="w-2 h-2" /> Active</span>}
        {isLinked && <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400 ml-auto" />}
      </div>
      {isActive && !isLinked && onSetAsProof && (
        <button
          onClick={(e) => { e.stopPropagation(); onSetAsProof(callout); }}
          className="w-full text-[8px] bg-cyan-700/50 hover:bg-cyan-600/60 text-cyan-300 rounded py-0.5 transition-colors"
        >
          Set as Proof
        </button>
      )}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
const SharedProofViewer = React.forwardRef(function SharedProofViewer({
  // Data
  extract,
  callouts = [],
  caseParties = {},
  proofItem,

  // Auto-spotlight / auto-jump: if set, viewer will spotlight this callout on load
  activeCalloutId = null,

  // Callbacks (attorney mode)
  onPageChange,
  onTransformChange,  // ({ scale, positionX, positionY }) => void
  onSpotlightChange,  // (callout | null) => void
  onSetAsProofCallout,

  // External state (jury mode)
  externalPage = null,
  externalScale = null,
  externalPositionX = null,
  externalPositionY = null,
  externalCalloutId = null, // jury follows attorney spotlight

  readOnly = false,
}, ref) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [spotlightCallout, setSpotlightCallout] = useState(null);
  const [highlights, setHighlights] = useState([]);

  const transformRef = useRef(null);
  const syncThrottleRef = useRef(0);
  const numPagesRef = useRef(0);
  const currentPageRef = useRef(1);

  useImperativeHandle(ref, () => ({
    getSpotlightCallout: () => spotlightCallout,
    clearSpotlight: () => handleSetSpotlight(null),
  }), [spotlightCallout]);

  // Load highlights whenever spotlightCallout changes
  useEffect(() => {
    if (!spotlightCallout?.id) { setHighlights([]); return; }
    base44.entities.Highlights.filter({ callout_id: spotlightCallout.id })
      .then(setHighlights)
      .catch(() => setHighlights([]));
  }, [spotlightCallout?.id]);

  const handleSetSpotlight = useCallback((callout) => {
    setSpotlightCallout(callout);
    onSpotlightChange?.(callout);
  }, [onSpotlightChange]);

  // Auto-jump + auto-spotlight when activeCalloutId or callouts change (attorney side)
  useEffect(() => {
    if (!activeCalloutId || !callouts.length || readOnly) return;
    const match = callouts.find((c) => c.id === activeCalloutId);
    if (!match) return;
    handleSetSpotlight(match);
    if (match.page_number) {
      const page = Math.max(1, Math.min(match.page_number, numPagesRef.current || 9999));
      setCurrentPage(page);
      currentPageRef.current = page;
      onPageChange?.(page);
    }
  }, [activeCalloutId, callouts]);

  // Jury: follow external spotlight
  useEffect(() => {
    if (!readOnly) return;
    if (externalCalloutId === null) {
      setSpotlightCallout(null);
      return;
    }
    const match = callouts.find((c) => c.id === externalCalloutId) || null;
    setSpotlightCallout(match);
  }, [externalCalloutId, callouts, readOnly]);

  // External page sync (jury follows attorney)
  useEffect(() => {
    if (externalPage == null) return;
    const page = Math.max(1, Math.min(externalPage, numPagesRef.current || 9999));
    if (page !== currentPageRef.current) {
      setCurrentPage(page);
      currentPageRef.current = page;
    }
  }, [externalPage]);

  // External transform sync (jury follows attorney)
  useEffect(() => {
    if (externalScale == null || !transformRef.current) return;
    const x = externalPositionX ?? 0;
    const y = externalPositionY ?? 0;
    transformRef.current.setTransform(x, y, externalScale, 0);
  }, [externalScale, externalPositionX, externalPositionY]);

  const handleDocumentLoad = useCallback(({ numPages: n }) => {
    setNumPages(n);
    numPagesRef.current = n;
    setCurrentPage(1);
    currentPageRef.current = 1;
  }, []);

  const goToPage = useCallback((p) => {
    const page = Math.max(1, Math.min(p, numPagesRef.current || 1));
    setCurrentPage(page);
    currentPageRef.current = page;
    onPageChange?.(page);
  }, [onPageChange]);

  const handleTransformed = useCallback((_ref, state) => {
    if (readOnly || !onTransformChange) return;
    const now = Date.now();
    if (now - syncThrottleRef.current < SYNC_THROTTLE_MS) return;
    syncThrottleRef.current = now;
    onTransformChange(state); // { scale, positionX, positionY }
  }, [readOnly, onTransformChange]);

  const handleCalloutClick = useCallback((callout) => {
    const next = spotlightCallout?.id === callout.id ? null : callout;
    handleSetSpotlight(next);
    if (next && callout.page_number) goToPage(callout.page_number);
  }, [spotlightCallout, handleSetSpotlight, goToPage]);

  const isPdf = extract?.extract_file_url?.match(/\.pdf(\?|$)/i);
  const fileUrl = extract?.extract_file_url;
  // Show sidebar only when interactive (attorney)
  const showSidebar = !readOnly && callouts.length > 0;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden relative">
      {/* Spotlight overlay */}
      {spotlightCallout && (
        <SpotlightOverlay
          callout={spotlightCallout}
          highlights={highlights}
          onClose={() => handleSetSpotlight(null)}
          showClose={!readOnly}
        />
      )}

      {/* Main PDF/image area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Page nav — always shown for PDFs; disabled (not hidden) in readOnly */}
        {isPdf && (
          <div className="flex items-center gap-1 px-2 py-1 bg-[#0f1629] border-b border-[#1e2a45] flex-shrink-0">
            <button
              onClick={() => !readOnly && goToPage(currentPage - 1)}
              disabled={readOnly || currentPage <= 1}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 touch-manipulation"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
            </button>
            <span className="text-[10px] text-slate-400 font-mono flex-1 text-center">
              {currentPage} / {numPages || '?'}
            </span>
            <button
              onClick={() => !readOnly && goToPage(currentPage + 1)}
              disabled={readOnly || currentPage >= (numPages || 1)}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 touch-manipulation"
            >
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            </button>
          </div>
        )}

        {/* Zoomable / pannable content */}
        <div className="flex-1 overflow-hidden bg-[#080c18]">
          {fileUrl ? (
            <TransformWrapper
              ref={transformRef}
              initialScale={1}
              minScale={0.2}
              maxScale={5}
              limitToBounds={false}
              centerOnInit={true}
              doubleClick={{ disabled: true }}
              panning={{ disabled: readOnly, velocityDisabled: false }}
              pinch={{ disabled: readOnly }}
              wheel={{ disabled: readOnly, step: 0.08 }}
              onTransformed={handleTransformed}
            >
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ display: 'flex', justifyContent: 'center', padding: '16px' }}
              >
                {isPdf ? (
                  <Document
                    file={fileUrl}
                    onLoadSuccess={handleDocumentLoad}
                    loading={<div className="text-slate-400 text-xs p-8">Loading PDF…</div>}
                    error={<div className="text-red-400 text-xs p-4">Failed to load PDF</div>}
                  >
                    <Page
                      pageNumber={currentPage}
                      width={PAGE_WIDTH}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                ) : (
                  <img
                    src={fileUrl}
                    alt={extract?.extract_title_internal || 'Extract'}
                    style={{ maxWidth: `${PAGE_WIDTH}px` }}
                    draggable={false}
                  />
                )}
              </TransformComponent>
            </TransformWrapper>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center space-y-2">
                <ImageIcon className="w-8 h-8 mx-auto opacity-20" />
                <p className="text-xs">No file uploaded</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Callout sidebar — attorney only */}
      {showSidebar && (
        <div className="w-28 flex-shrink-0 bg-[#0f1629] border-l border-[#1e2a45] overflow-y-auto">
          <div className="p-1.5 space-y-1.5">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold px-1 pt-1">
              Callouts ({callouts.length})
            </p>
            {callouts.map((c) => (
              <CalloutItem
                key={c.id}
                callout={c}
                witnessName={c.witness_id ? caseParties[c.witness_id] : null}
                isActive={spotlightCallout?.id === c.id}
                isLinked={proofItem?.callout_id === c.id}
                onClick={() => handleCalloutClick(c)}
                onSetAsProof={onSetAsProofCallout}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default SharedProofViewer;