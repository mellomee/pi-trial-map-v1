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
        // Load callout
        const calloutId = item.callout_id;
        let cs = await base44.entities.Callouts.filter({ extract_id: extract.id });
        let targetCallout = calloutId ? cs.find(c => c.id === calloutId) : cs[0];
        setCallout(targetCallout || null);
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
  }, [sessionState?.current_proof_item_id, sessionState?.jury_can_see_proof]);

  // Waiting screen
  if (!sessionState || !sessionState.jury_can_see_proof || !proofItem) {
    return (
      <div className="fixed inset-0 bg-[#020510] flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#0f1629] border border-[#1e2a45] flex items-center justify-center mx-auto animate-pulse">
            <div className="w-3 h-3 bg-cyan-500 rounded-full" />
          </div>
          <p className="text-slate-500 text-sm tracking-wide uppercase">Waiting for attorney...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {proofItem.type === 'depoClip' && depoClip && (
        <div className="w-full h-full flex flex-col justify-center px-16 py-12 max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex flex-wrap gap-4 items-baseline">
            {depo && (
              <span className="text-slate-400 text-xl font-semibold tracking-wide uppercase">{depo.sheet_name}</span>
            )}
            <span className="text-cyan-300 font-mono text-lg">{depoClip.start_cite} – {depoClip.end_cite}</span>
          </div>
          {/* Transcript lines */}
          <div className="space-y-0 overflow-y-auto max-h-[70vh]">
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

      {proofItem.type === 'extract' && callout?.snapshot_image_url && (
        <div className="w-full h-full flex flex-col items-center justify-center p-8">
          {/* Exhibit badges */}
          {jx && (
            <div className="flex gap-4 mb-4 items-center">
              {jx.internal_name && (
                <span className="text-slate-300 text-lg font-semibold">{jx.internal_name}</span>
              )}
              {jx.marked_no && (
                <span className="bg-yellow-600/30 border border-yellow-500/40 text-yellow-200 text-base font-bold px-3 py-1 rounded">#{jx.marked_no}</span>
              )}
              {jx.admitted_no && (
                <span className="bg-green-600/30 border border-green-500/40 text-green-200 text-base font-bold px-3 py-1 rounded">Admitted #{jx.admitted_no}</span>
              )}
            </div>
          )}
          {/* Image with highlights */}
          <div className="relative max-w-full max-h-[85vh] flex-1 flex items-center justify-center">
            <div className="relative inline-block">
              <img
                src={callout.snapshot_image_url}
                alt="Evidence"
                className="max-w-full max-h-[80vh] object-contain shadow-2xl rounded"
                style={{ display: 'block' }}
              />
              <HighlightOverlay highlights={highlights} />
            </div>
          </div>
        </div>
      )}

      {proofItem.type === 'extract' && !callout?.snapshot_image_url && (
        <div className="text-slate-500 text-xl">Loading evidence...</div>
      )}
    </div>
  );
}