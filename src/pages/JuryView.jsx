import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";

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
  const pollRef = useRef(null);

  // Poll for session state
  useEffect(() => {
    if (!activeCase?.id) return;
    const poll = async () => {
      const sessions = await base44.entities.TrialSessions.filter({
        case_id: activeCase.id,
        status: { $in: ['Setup', 'Active'] },
      });
      if (!sessions.length) return;
      const states = await base44.entities.TrialSessionStates.filter({
        trial_session_id: sessions[0].id,
      });
      if (states.length) setSessionState(states[0]);
      else setSessionState(null);
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => clearInterval(pollRef.current);
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
        setCallout(null);
        setHighlights([]);
        setJx(null);
      } else if (item.type === 'extract' && item.source_id) {
        const extracts = await base44.entities.ExhibitExtracts.filter({ id: item.source_id });
        const extract = extracts[0];
        if (!extract) return;
        // Prefer current_callout_id from session state (live spotlight), fallback to proof item's callout_id
        const spotlightCalloutId = sessionState?.current_callout_id || item.callout_id;
        let cs = await base44.entities.Callouts.filter({ extract_id: extract.id });
        let targetCallout = spotlightCalloutId ? cs.find(c => c.id === spotlightCalloutId) : cs[0];
        setCallout(targetCallout || null);
        // Store extract file url for background
        setExtract(extract);
        // Load highlights for that callout
        if (targetCallout) {
          const hs = await base44.entities.Highlights.filter({ callout_id: targetCallout.id });
          setHighlights(hs);
        } else {
          setHighlights([]);
        }
        // Load joint exhibit
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

      {proofItem.type === 'extract' && (
        <div className="w-full h-full relative overflow-hidden">
          {/* Exhibit label */}
          {exhibitLabel && (
            <div className="absolute top-3 right-4 z-20">
              <span className="text-slate-300 text-base font-semibold bg-black/60 rounded px-3 py-1 tracking-wide">{exhibitLabel}</span>
            </div>
          )}

          {/* Background: full extract file, dimmed */}
          {extract?.extract_file_url && (
            <div className="absolute inset-0 flex items-center justify-center z-0">
              <img
                src={extract.extract_file_url}
                alt="Extract"
                style={{ display: 'block', maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain', opacity: 0.18, filter: 'blur(1px)', userSelect: 'none' }}
                draggable={false}
              />
            </div>
          )}

          {/* Dark overlay */}
          <div className="absolute inset-0 z-1" style={{ background: 'rgba(5,8,22,0.72)' }} />

          {/* Foreground: spotlighted callout */}
          {callout?.snapshot_image_url ? (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="relative inline-block shadow-2xl rounded-lg border border-white/10">
                <img
                  src={callout.snapshot_image_url}
                  alt="Evidence"
                  style={{ display: 'block', maxWidth: '95vw', maxHeight: '92vh', objectFit: 'contain' }}
                  draggable={false}
                />
                <HighlightOverlay highlights={highlights} />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center z-10 text-slate-500 text-xl">Loading evidence...</div>
          )}

          {/* Callout name label */}
          {callout?.name && (
            <div className="absolute bottom-4 left-0 right-0 text-center z-20">
              <span className="text-slate-300 text-sm bg-black/70 px-4 py-1.5 rounded-full font-medium">{callout.name}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}