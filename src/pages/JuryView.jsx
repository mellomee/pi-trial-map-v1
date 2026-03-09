import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { usePresentationState } from "@/components/hooks/usePresentationState";
import PdfViewer from "@/components/shared/PdfViewer";

// Normalize highlight rects over their containing box
function HighlightOverlay({ highlights }) {
  if (!highlights?.length) return null;
  const colorMap = {
    yellow: 'rgba(253,224,71,0.45)',
    red: 'rgba(239,68,68,0.4)',
    green: 'rgba(34,197,94,0.4)',
    blue: 'rgba(59,130,246,0.4)',
  };
  return (
    <div className="absolute inset-0 pointer-events-none">
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

export default function JuryView() {
  const { activeCase } = useActiveCase();
  const [trialSessionId, setTrialSessionId] = useState(null);
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

  // ── Single source of truth: usePresentationState (jury = reader) ──────────
  // This hook subscribes first, then loads — no race conditions.
  // We do NOT maintain a separate subscription for session state.
  const { state: sessionState } = usePresentationState(trialSessionId, false);

  const zoom = sessionState?.proof_zoom_level || 1;
  const currentPage = sessionState?.proof_current_page || 1;
  const sharedScrollLeft = sessionState?.proof_scroll_left ?? null;
  const sharedScrollTop = sessionState?.proof_scroll_top ?? null;

  // Attorney viewport dimensions → used to create matching framed viewport on jury screen
  const attyVpW = sessionState?.proof_viewport_width || 0;
  const attyVpH = sessionState?.proof_viewport_height || 0;

  // ── Proof content loading — STRICTLY gated on jury_can_see_proof ──────────
  useEffect(() => {
    const pid = sessionState?.current_proof_item_id;

    // GATE: nothing shows unless attorney explicitly published
    if (!sessionState?.jury_can_see_proof || !pid) {
      setProofItem(null);
      setExtract(null);
      setCallout(null);
      setHighlights([]);
      setDepoClip(null);
      setDepo(null);
      setJx(null);
      return;
    }

    base44.entities.ProofItems.filter({ id: pid }).then(async (items) => {
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
        if (!ext || !ext.extract_file_url) { setExtract(null); setCallout(null); return; }
        setExtract(ext);

        const spotlightCalloutId = sessionState?.current_callout_id;
        if (spotlightCalloutId) {
          const callouts = await base44.entities.Callouts.filter({ id: spotlightCalloutId });
          const targetCallout = callouts[0] || null;
          setCallout(targetCallout);
          if (targetCallout) {
            const hs = await base44.entities.Highlights.filter({ callout_id: targetCallout.id });
            setHighlights(hs);
          } else {
            setHighlights([]);
          }
        } else {
          setCallout(null); setHighlights([]);
        }

        const jxs = await base44.entities.JointExhibits.filter({ exhibit_extract_id: ext.id });
        setJx(jxs[0] || null);
        setDepoClip(null); setDepo(null);
      }
    });
  }, [
    sessionState?.current_proof_item_id,
    sessionState?.jury_can_see_proof,
    sessionState?.current_callout_id,
  ]);

  // ── Blank screen guard ────────────────────────────────────────────────────
  if (!sessionState || !sessionState.jury_can_see_proof || !proofItem) {
    return <div className="fixed inset-0 bg-black" />;
  }

  const exhibitLabel = jx?.admitted_no
    ? `Exhibit ${jx.admitted_no}`
    : jx?.marked_no
    ? `Exhibit ${jx.marked_no}`
    : null;
  const isPdf = extract?.extract_file_url?.match(/\.pdf(\?|$)/i);

  // ── Framed viewport: jury renders into a box that matches the attorney's ──
  // viewport proportions exactly. The box is centered with black margins.
  // If viewport dims not yet known, fall back to a 16:9 frame.
  const hasVpDims = attyVpW > 0 && attyVpH > 0;
  const frameAspect = hasVpDims ? attyVpW / attyVpH : 16 / 9;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">

      {/* ── Depo clip display ─────────────────────────────────────────────── */}
      {proofItem.type === 'depoClip' && depoClip && (
        <div className="w-full h-full flex flex-col justify-center px-10 py-10">
          <div className="mb-6 flex flex-wrap gap-4 items-baseline">
            {depo && (
              <span className="text-slate-400 text-xl font-semibold tracking-wide uppercase">
                {depo.sheet_name}
              </span>
            )}
            <span className="text-cyan-300 font-mono text-lg">
              {depoClip.start_cite} – {depoClip.end_cite}
            </span>
          </div>
          <div className="overflow-y-auto max-h-[75vh] space-y-0">
            {(depoClip.clip_text || '').split('\n').filter(Boolean).map((line, i) => {
              const parts = line.match(/^(\d+:\d+)\s+(.*)$/);
              if (parts) {
                return (
                  <div key={i} className="flex border-b border-white/5 py-3">
                    <span className="font-mono text-cyan-400 text-2xl font-bold w-28 flex-shrink-0 pr-4 text-right leading-tight">
                      {parts[1]}
                    </span>
                    <span className="text-white text-2xl leading-tight flex-1">{parts[2]}</span>
                  </div>
                );
              }
              return <div key={i} className="text-white text-2xl py-3">{line}</div>;
            })}
          </div>
        </div>
      )}

      {/* ── Extract / PDF display inside matching framed viewport ─────────── */}
      {proofItem.type === 'extract' && extract?.extract_file_url && (
        /*
         * Framed Presentation Viewport
         * ─────────────────────────────
         * We render the PDF inside a box whose aspect ratio == attorney viewport aspect ratio.
         * CSS trick: use aspect-ratio + max-w/max-h to let the browser pick the largest
         * fitting box. Black area outside the frame is the parent flex container's bg.
         *
         * The PdfViewer inside this box receives the SAME zoom/scroll/page values as the
         * attorney. Because the container is proportionally identical to the attorney's,
         * the visible content is pixel-for-proportion identical.
         */
        <div
          style={{
            // Constrain to screen while maintaining attorney viewport aspect ratio
            aspectRatio: `${frameAspect}`,
            maxWidth: '100vw',
            maxHeight: '100vh',
            // Shrink to fit whichever dimension is the binding constraint
            width: `min(100vw, calc(100vh * ${frameAspect}))`,
            height: `min(100vh, calc(100vw / ${frameAspect}))`,
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* Exhibit label */}
          {exhibitLabel && (
            <div className="absolute top-3 right-4 z-20">
              <span className="text-slate-300 text-base font-semibold bg-black/60 rounded px-3 py-1 tracking-wide">
                {exhibitLabel}
              </span>
            </div>
          )}

          {isPdf ? (
            <>
              {/* PDF — readOnly, no controls, mirrors attorney viewport */}
              <PdfViewer
                fileUrl={extract.extract_file_url}
                externalZoom={zoom}
                externalPage={currentPage}
                externalScrollLeft={sharedScrollLeft}
                externalScrollTop={sharedScrollTop}
                readOnly={true}
                showControls={false}
                dimmed={!!callout?.snapshot_image_url}
              />

              {/* Dark overlay when callout is spotlighted */}
              {callout?.snapshot_image_url && (
                <div className="absolute inset-0 z-10" style={{ background: 'rgba(0,0,0,0.4)' }} />
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
            </>
          ) : (
            <>
              {/* Image extract */}
              <div className="absolute inset-0 flex items-center justify-center z-0">
                <img
                  src={extract.extract_file_url}
                  alt="Extract"
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    opacity: callout?.snapshot_image_url ? 0.2 : 1,
                    userSelect: 'none',
                  }}
                  draggable={false}
                />
              </div>

              {callout?.snapshot_image_url && (
                <div className="absolute inset-0 z-10" style={{ background: 'rgba(0,0,0,0.4)' }} />
              )}

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
            </>
          )}
        </div>
      )}
    </div>
  );
}