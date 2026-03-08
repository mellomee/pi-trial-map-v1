import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";

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
  const [depoExhibit, setDepoExhibit] = useState(null);

  // Subscribe to TrialSessionStates for instant updates
  useEffect(() => {
    if (!activeCase?.id) return;
    
    // First load active session
    base44.entities.TrialSessions.filter({
      case_id: activeCase.id,
      status: { $in: ['Setup', 'Active'] },
    }).then(async (sessions) => {
      if (!sessions.length) return;
      const sessionId = sessions[0].id;
      
      // Subscribe to state changes for this session
      const unsub = base44.entities.TrialSessionStates.subscribe((event) => {
        if (event.data?.trial_session_id === sessionId) {
          setSessionState(event.data);
        }
      });
      
      // Load initial state
      const states = await base44.entities.TrialSessionStates.filter({
        trial_session_id: sessionId,
      });
      if (states.length) setSessionState(states[0]);
      
      return unsub;
    });
  }, [activeCase?.id]);

  // Load proof item when session state changes
  useEffect(() => {
    const pid = sessionState?.current_proof_item_id;
    if (!pid || !sessionState?.jury_can_see_proof) {
      setProofItem(null);
      setExtract(null);
      setCallout(null);
      setHighlights([]);
      setDepoClip(null);
      setDepo(null);
      setJx(null);
      setDepoExhibit(null);
      return;
    }
    
    (async () => {
      try {
        const items = await base44.entities.ProofItems.filter({ id: pid });
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
          setCallout(null);
          setHighlights([]);
          setJx(null);
          setExtract(null);
        } else if (item.type === 'extract' && item.source_id) {
          const extracts = await base44.entities.ExhibitExtracts.filter({ id: item.source_id });
          const extract = extracts[0];
          if (!extract) return;
          
          // Always store and display the extract (base layer)
          setExtract(extract);
          setDepoClip(null);
          setDepo(null);
          
          // If extract doesn't have a file URL, try to load from primary depo exhibit
          let depoEx = null;
          if (!extract.extract_file_url && extract.primary_depo_exhibit_id) {
            const depoExhibits = await base44.entities.DepositionExhibits.filter({ id: extract.primary_depo_exhibit_id });
            depoEx = depoExhibits[0] || null;
            setDepoExhibit(depoEx);
          } else {
            setDepoExhibit(null);
          }
          
          // Load joint exhibit for label
          const jxs = await base44.entities.JointExhibits.filter({ exhibit_extract_id: extract.id });
          setJx(jxs[0] || null);
          
          // Check if spotlight callout is visible
          const spotlightCalloutId = sessionState?.current_callout_id;
          const spotlight_enabled = sessionState?.spotlight_enabled;
          
          if (spotlight_enabled && spotlightCalloutId) {
            const cs = await base44.entities.Callouts.filter({ id: spotlightCalloutId });
            const targetCallout = cs[0] || null;
            setCallout(targetCallout);
            // Load highlights for that callout
            if (targetCallout) {
              const hs = await base44.entities.Highlights.filter({ callout_id: targetCallout.id });
              setHighlights(hs);
            } else {
              setHighlights([]);
            }
          } else {
            // No spotlight — just show extract, no callout overlay
            setCallout(null);
            setHighlights([]);
          }
        }
      } catch (error) {
        console.error('Error loading proof:', error);
      }
    })();
  }, [sessionState?.current_proof_item_id, sessionState?.jury_can_see_proof, sessionState?.current_callout_id, sessionState?.spotlight_enabled]);

  // Waiting / blank screen
  if (!sessionState || !sessionState.jury_can_see_proof || !proofItem) {
    return <div className="fixed inset-0 bg-black" />;
  }

  // Build exhibit label
  const exhibitLabel = jx?.admitted_no ? `Exhibit ${jx.admitted_no}` : jx?.marked_no ? `Exhibit ${jx.marked_no}` : null;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Depo Clip */}
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

      {/* Extract — base layer always shown */}
      {proofItem.type === 'extract' && extract && (
        <div className="w-full h-full relative overflow-hidden bg-black">
          {/* Exhibit label */}
          {exhibitLabel && (
            <div className="absolute top-3 right-4 z-20 pointer-events-none">
              <span className="text-slate-300 text-base font-semibold bg-black/60 rounded px-3 py-1 tracking-wide">{exhibitLabel}</span>
            </div>
          )}

          {/* Layer 0: Full-screen extract base */}
          {(extract.extract_file_url || depoExhibit?.file_url) ? (
            <div className="absolute inset-0 flex items-center justify-center z-0 bg-black">
              <img
                src={extract.extract_file_url || depoExhibit?.file_url}
                alt="Extract"
                className="max-w-full max-h-full object-contain"
                style={{ userSelect: 'none' }}
                draggable={false}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center z-0 bg-black">
              <p className="text-slate-400">Extract file not available</p>
            </div>
          )}

          {/* Layer 1: Dark overlay (only if spotlight active) */}
          {callout?.snapshot_image_url && (
            <div className="absolute inset-0 z-1" style={{ background: 'rgba(5,8,22,0.72)' }} />
          )}

          {/* Layer 2: Dimmed extract background (only if spotlight active) */}
          {callout?.snapshot_image_url && extract.extract_file_url && (
            <div className="absolute inset-0 flex items-center justify-center z-2">
              <img
                src={extract.extract_file_url}
                alt="Extract"
                style={{ display: 'block', maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain', opacity: 0.15, filter: 'blur(1px)', userSelect: 'none' }}
                draggable={false}
              />
            </div>
          )}

          {/* Layer 3: Spotlighted callout (only if active) */}
          {callout?.snapshot_image_url && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="relative inline-block shadow-2xl rounded-lg border border-white/10">
                <img
                  src={callout.snapshot_image_url}
                  alt="Evidence"
                  style={{ display: 'block', maxWidth: '95vw', maxHeight: '92vh', objectFit: 'contain', userSelect: 'none' }}
                  draggable={false}
                />
                <HighlightOverlay highlights={highlights} />
              </div>
            </div>
          )}

          {/* Callout name label */}
          {callout?.name && (
            <div className="absolute bottom-4 left-0 right-0 text-center z-20 pointer-events-none">
              <span className="text-slate-300 text-sm bg-black/70 px-4 py-1.5 rounded-full font-medium">{callout.name}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}