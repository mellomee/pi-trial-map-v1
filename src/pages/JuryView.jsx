import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { usePresentationState } from "@/components/hooks/usePresentationState";
import PdfViewer from "@/components/shared/PdfViewer";

// ---------- Highlight overlay ----------
function HighlightOverlay({ highlights }) {
  if (!highlights?.length) return null;
  return (
    <div className="absolute inset-0 pointer-events-none">
      {highlights.map((h, hi) =>
        (h.rects_norm || []).map((rect, ri) => {
          const colorMap = { yellow: 'rgba(253,224,71,0.45)', red: 'rgba(239,68,68,0.4)', green: 'rgba(34,197,94,0.4)', blue: 'rgba(59,130,246,0.4)' };
          const bg = colorMap[h.color] || colorMap.yellow;
          return (
            <div
              key={`${hi}-${ri}`}
              style={{
                position: 'absolute',
                left: `${rect.x * 100}%`, top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`, height: `${rect.h * 100}%`,
                backgroundColor: bg, mixBlendMode: 'multiply',
              }}
            />
          );
        })
      )}
    </div>
  );
}

export default function JuryView() {
  const { activeCase } = useActiveCase();
  const [trialSessionId, setTrialSessionId] = useState(null);

  // Proof content
  const [proofItem, setProofItem] = useState(null);
  const [extract, setExtract] = useState(null);
  const [callout, setCallout] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [depoClip, setDepoClip] = useState(null);
  const [depo, setDepo] = useState(null);
  const [jx, setJx] = useState(null);

  // Find current trial session
  useEffect(() => {
    if (!activeCase?.id) return;
    base44.entities.TrialSessions.filter({
      case_id: activeCase.id,
      status: { $in: ['Setup', 'Active'] },
    }).then((sessions) => {
      if (sessions.length) setTrialSessionId(sessions[0].id);
    });
  }, [activeCase?.id]);

  /**
   * SINGLE source of truth: usePresentationState for ALL session state.
   * This handles both initial load AND real-time subscription.
   * Jury is read-only (isAttorney=false).
   */
  const { state: presentationState } = usePresentationState(trialSessionId, false);

  // Derived values from shared state
  const juryCanSeeProof = presentationState?.jury_can_see_proof === true;
  const currentProofItemId = presentationState?.current_proof_item_id;
  const currentCalloutId = presentationState?.current_callout_id;
  const zoom = presentationState?.proof_zoom_level || 1;
  const currentPage = presentationState?.proof_current_page || 1;
  const sharedScrollLeft = presentationState?.proof_scroll_left ?? 0;
  const sharedScrollTop = presentationState?.proof_scroll_top ?? 0;

  // Attorney viewport dimensions for frame matching
  const attorneyVpWidth = presentationState?.attorney_viewport_width || null;
  const attorneyVpHeight = presentationState?.attorney_viewport_height || null;

  // Load proof content when shared state changes
  // STRICT GATE: only load if juryCanSeeProof is explicitly true
  useEffect(() => {
    if (!juryCanSeeProof || !currentProofItemId) {
      setProofItem(null);
      setExtract(null);
      setCallout(null);
      setHighlights([]);
      setDepoClip(null);
      setDepo(null);
      setJx(null);
      return;
    }

    base44.entities.ProofItems.filter({ id: currentProofItemId }).then(async (items) => {
      const item = items[0];
      if (!item) return;
      setProofItem(item);

      if (item.type === 'depoClip' && item.source_id) {
        const clips = await base44.entities.DepoClips.filter({ id: item.source_id });
        const clip = clips[0] || null;
        setDepoClip(clip);
        if (clip?.deposition_id) {
          const depos = await base44.entities.Depositions.filter({ id: clip.deposition_id });
          setDepo(depos[0] || null);
        }
        setExtract(null); setCallout(null); setHighlights([]); setJx(null);

      } else if (item.type === 'extract' && item.source_id) {
        const extracts = await base44.entities.ExhibitExtracts.filter({ id: item.source_id });
        const ext = extracts[0];
        if (!ext?.extract_file_url) { setExtract(null); setCallout(null); return; }
        setExtract(ext);

        if (currentCalloutId) {
          const callouts = await base44.entities.Callouts.filter({ id: currentCalloutId });
          const targetCallout = callouts[0] || null;
          setCallout(targetCallout);
          if (targetCallout) {
            const hs = await base44.entities.Highlights.filter({ callout_id: targetCallout.id });
            setHighlights(hs);
          } else {
            setHighlights([]);
          }
        } else {
          setCallout(null);
          setHighlights([]);
        }

        const jxs = await base44.entities.JointExhibits.filter({ exhibit_extract_id: ext.id });
        setJx(jxs[0] || null);
        setDepoClip(null); setDepo(null);
      }
    });
  }, [juryCanSeeProof, currentProofItemId, currentCalloutId]);

  // ── Blank screen when nothing is published ────────────────────────────────
  if (!juryCanSeeProof || !proofItem) {
    return <div className="fixed inset-0 bg-black" />;
  }

  const exhibitLabel = jx?.admitted_no ? `Exhibit ${jx.admitted_no}` : jx?.marked_no ? `Exhibit ${jx.marked_no}` : null;
  const isPdf = extract?.extract_file_url?.match(/\.pdf(\?|$)/i);

  return (
    <div className="fixed inset-0 bg-[#060810] flex items-center justify-center overflow-hidden">

      {/* ── Depo clip display ── */}
      {proofItem.type === 'depoClip' && depoClip && (
        <div className="w-full h-full flex flex-col justify-center px-10 py-10">
          <div className="mb-6 flex flex-wrap gap-4 items-baseline">
            {depo && (
              <span className="text-slate-400 text-xl font-semibold tracking-wide uppercase">{depo.sheet_name}</span>
            )}
            <span className="text-cyan-300 font-mono text-lg">{depoClip.start_cite} – {depoClip.end_cite}</span>
          </div>
          <div className="overflow-y-auto max-h-[75vh] space-y-0">
            {(depoClip.clip_text || '').split('\n').filter(Boolean).map((line, i) => {
              const parts = line.match(/^(\d+:\d+)\s+(.*)$/);
              if (parts) {
                return (
                  <div key={i} className="flex border-b border-white/5 py-3">
                    <span className="font-mono text-cyan-400 text-2xl font-bold w-28 flex-shrink-0 pr-4 text-right leading-tight">{parts[1]}</span>
                    <span className="text-white text-2xl leading-tight flex-1">{parts[2]}</span>
                  </div>
                );
              }
              return <div key={i} className="text-white text-2xl py-3">{line}</div>;
            })}
          </div>
        </div>
      )}

      {/* ── Extract / PDF display ── */}
      {proofItem.type === 'extract' && extract?.extract_file_url && (
        isPdf ? (
          <JuryPdfFrame
            fileUrl={extract.extract_file_url}
            zoom={zoom}
            currentPage={currentPage}
            scrollLeft={sharedScrollLeft}
            scrollTop={sharedScrollTop}
            callout={callout}
            highlights={highlights}
            exhibitLabel={exhibitLabel}
            attorneyVpWidth={attorneyVpWidth}
            attorneyVpHeight={attorneyVpHeight}
          />
        ) : (
          <JuryImageFrame
            fileUrl={extract.extract_file_url}
            callout={callout}
            highlights={highlights}
            exhibitLabel={exhibitLabel}
          />
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JuryPdfFrame
//
// Renders the PDF inside a centered presentation box whose proportions match
// the attorney's PDF viewport. This ensures the same zoom/scroll/page values
// produce visually identical output on both screens.
//
// Math:
//   attorneyVpWidth / attorneyVpHeight = the aspect ratio of the source frame.
//   We scale that frame to fit the jury screen (letterbox/pillarbox).
//   Then we render the PdfViewer inside that exact-sized box.
//   Because the box has the same aspect ratio as the attorney's viewport,
//   the PDF content area is proportionally identical.
// ─────────────────────────────────────────────────────────────────────────────
function JuryPdfFrame({ fileUrl, zoom, currentPage, scrollLeft, scrollTop, callout, highlights, exhibitLabel, attorneyVpWidth, attorneyVpHeight }) {
  const screenRef = useRef(null);
  const [frameStyle, setFrameStyle] = useState({ width: '100%', height: '100%' });

  useEffect(() => {
    if (!attorneyVpWidth || !attorneyVpHeight || !screenRef.current) return;

    const compute = () => {
      const sw = screenRef.current.offsetWidth;
      const sh = screenRef.current.offsetHeight;
      const atAR = attorneyVpWidth / attorneyVpHeight;
      const screenAR = sw / sh;
      let w, h;
      if (screenAR > atAR) {
        // Screen is wider than attorney frame → pillarbox (black bars on sides)
        h = sh;
        w = sh * atAR;
      } else {
        // Screen is taller → letterbox (black bars on top/bottom)
        w = sw;
        h = sw / atAR;
      }
      setFrameStyle({ width: `${Math.round(w)}px`, height: `${Math.round(h)}px` });
    };

    compute();
    const obs = new ResizeObserver(compute);
    obs.observe(screenRef.current);
    return () => obs.disconnect();
  }, [attorneyVpWidth, attorneyVpHeight]);

  return (
    <div ref={screenRef} className="w-full h-full flex items-center justify-center">
      {/* Centered presentation frame — matches attorney viewport proportions */}
      <div style={{ ...frameStyle, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {exhibitLabel && (
          <div className="absolute top-3 right-4 z-20">
            <span className="text-slate-300 text-base font-semibold bg-black/60 rounded px-3 py-1 tracking-wide">{exhibitLabel}</span>
          </div>
        )}

        <PdfViewer
          fileUrl={fileUrl}
          externalZoom={zoom}
          externalPage={currentPage}
          externalScrollLeft={scrollLeft}
          externalScrollTop={scrollTop}
          readOnly={true}
          showControls={false}
          dimmed={!!(callout?.snapshot_image_url)}
        />

        {/* Dark overlay when callout spotlighted */}
        {callout?.snapshot_image_url && (
          <div className="absolute inset-0 z-10" style={{ background: 'rgba(0,0,0,0.35)' }} />
        )}

        {/* Spotlighted callout */}
        {callout?.snapshot_image_url && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="relative inline-block shadow-2xl rounded-lg border border-white/10">
              <img
                src={callout.snapshot_image_url}
                alt="Callout"
                style={{ display: 'block', maxWidth: '95%', maxHeight: '90%', objectFit: 'contain' }}
                draggable={false}
              />
              <HighlightOverlay highlights={highlights} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple image frame (non-PDF extracts)
function JuryImageFrame({ fileUrl, callout, highlights, exhibitLabel }) {
  return (
    <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
      {exhibitLabel && (
        <div className="absolute top-3 right-4 z-20">
          <span className="text-slate-300 text-base font-semibold bg-black/60 rounded px-3 py-1 tracking-wide">{exhibitLabel}</span>
        </div>
      )}
      <img
        src={fileUrl}
        alt="Extract"
        style={{
          display: 'block', maxWidth: '100vw', maxHeight: '100vh',
          objectFit: 'contain',
          opacity: callout?.snapshot_image_url ? 0.25 : 1,
          userSelect: 'none',
        }}
        draggable={false}
      />
      {callout?.snapshot_image_url && (
        <div className="absolute inset-0 z-5" style={{ background: 'rgba(0,0,0,0.35)' }} />
      )}
      {callout?.snapshot_image_url && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="relative inline-block shadow-2xl rounded-lg border border-white/10">
            <img
              src={callout.snapshot_image_url}
              alt="Callout"
              style={{ display: 'block', maxWidth: '95vw', maxHeight: '92vh', objectFit: 'contain' }}
              draggable={false}
            />
            <HighlightOverlay highlights={highlights} />
          </div>
        </div>
      )}
    </div>
  );
}