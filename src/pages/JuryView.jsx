import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { usePresentationState } from "@/components/hooks/usePresentationState";
import PdfViewerReact from "@/components/shared/PdfViewerReact";

function HighlightOverlay({ highlights, containerWidth, containerHeight }) {
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
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
                backgroundColor: bg,
                mixBlendMode: 'multiply',
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
  const [sessionState, setSessionState] = useState(null);
  const [proofItem, setProofItem] = useState(null);
  const [extract, setExtract] = useState(null);
  const [callout, setCallout] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [depoClip, setDepoClip] = useState(null);
  const [depo, setDepo] = useState(null);
  const [jx, setJx] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Subscribe to trial session state changes (real-time, not polling)
  useEffect(() => {
    if (!activeCase?.id) return;

    // Initial load: get current trial session
    let trialSessionId = null;
    base44.entities.TrialSessions.filter({
      case_id: activeCase.id,
      status: { $in: ['Setup', 'Active'] },
    }).then((sessions) => {
      if (sessions.length) {
        trialSessionId = sessions[0].id;
        // Subscribe to this session's state changes
        const unsub = base44.entities.TrialSessionStates.subscribe((event) => {
          if (event.data?.trial_session_id === trialSessionId) {
            setSessionState(event.data);
          }
        });
        return unsub;
      }
    });
  }, [activeCase?.id]);

  // Update zoom and page from session state
  useEffect(() => {
    if (sessionState?.proof_zoom_level) setZoom(sessionState.proof_zoom_level);
    if (sessionState?.proof_current_page) setCurrentPage(sessionState.proof_current_page);
  }, [sessionState?.proof_zoom_level, sessionState?.proof_current_page]);

  // Load proof item when session state changes
  useEffect(() => {
    const pid = sessionState?.current_proof_item_id;
    // Clear display if proof is NOT approved for jury view
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

    // Proof IS approved — load it
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
        setExtract(null);
        setCallout(null);
        setHighlights([]);
        setJx(null);
      } else if (item.type === 'extract' && item.source_id) {
        // Load extract file
        const extracts = await base44.entities.ExhibitExtracts.filter({ id: item.source_id });
        const extract = extracts[0];
        if (!extract || !extract.extract_file_url) {
          setExtract(null);
          setCallout(null);
          return;
        }
        setExtract(extract);

        // Load callouts and highlights ONLY if a specific callout is spotlighted
        const spotlightCalloutId = sessionState?.current_callout_id;
        if (spotlightCalloutId) {
          const callouts = await base44.entities.Callouts.filter({ id: spotlightCalloutId });
          const targetCallout = callouts[0] || null;
          setCallout(targetCallout);
          // Load highlights for this callout
          if (targetCallout) {
            const hs = await base44.entities.Highlights.filter({ callout_id: targetCallout.id });
            setHighlights(hs);
          } else {
            setHighlights([]);
          }
        } else {
          // No spotlight — show full extract, no callout
          setCallout(null);
          setHighlights([]);
        }

        // Load joint exhibit for label
        const jxs = await base44.entities.JointExhibits.filter({ exhibit_extract_id: extract.id });
        setJx(jxs[0] || null);
        setDepoClip(null);
        setDepo(null);
      }
    });
  }, [sessionState?.current_proof_item_id, sessionState?.jury_can_see_proof, sessionState?.current_callout_id]);

  // Waiting / blank screen
  if (!sessionState || !sessionState.jury_can_see_proof || !proofItem) {
    return <div className="fixed inset-0 bg-black" />;
  }

  // Build exhibit label: only "Exhibit X" using admitted number
  const exhibitLabel = jx?.admitted_no ? `Exhibit ${jx.admitted_no}` : jx?.marked_no ? `Exhibit ${jx.marked_no}` : null;
  const isPdf = extract?.extract_file_url?.match(/\.pdf(\?|$)/i);

  return (
    <div className="fixed inset-0 bg-[#060810] flex items-center justify-center overflow-hidden">
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

      {proofItem.type === 'extract' && extract?.extract_file_url && (
        <div className="w-full h-full relative overflow-hidden">
          {/* Exhibit label */}
          {exhibitLabel && (
            <div className="absolute top-3 right-4 z-20">
              <span className="text-slate-300 text-base font-semibold bg-black/60 rounded px-3 py-1 tracking-wide">{exhibitLabel}</span>
            </div>
          )}

          {isPdf ? (
          <>
          {/* PDF with optional spotlight overlay */}
          <PdfViewerReact
            fileUrl={extract.extract_file_url}
            externalZoom={zoom}
            externalPage={currentPage}
            readOnly={true}
            showControls={false}
            dimmed={false}
          />

          {/* Layer 1: Dark overlay (only when callout is spotlighted) */}
          {callout?.snapshot_image_url && (
            <div className="absolute inset-0 z-5" style={{ background: 'rgba(0, 0, 0, 0.35)' }} />
              )}

              {/* Layer 2: Spotlighted callout (if active) */}
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

            </>
          ) : (
            <>
              {/* Image with optional spotlight overlay */}
              <div className="absolute inset-0 flex items-center justify-center z-0">
                <img
                  src={extract.extract_file_url}
                  alt="Extract"
                  style={{
                    display: 'block',
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                    objectFit: 'contain',
                    opacity: callout?.snapshot_image_url ? 0.25 : 1,
                    filter: callout?.snapshot_image_url ? 'blur(0px)' : 'none',
                    userSelect: 'none'
                  }}
                  draggable={false}
                />
              </div>

              {/* Layer 1: Dark overlay (only when callout is spotlighted) */}
              {callout?.snapshot_image_url && (
                <div className="absolute inset-0 z-5" style={{ background: 'rgba(0, 0, 0, 0.35)' }} />
              )}

              {/* Layer 2: Spotlighted callout (if active) */}
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

            </>
          )}
        </div>
      )}
    </div>
  );
}