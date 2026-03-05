import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import useActiveCase from '@/components/hooks/useActiveCase';

export default function JuryView() {
  const { activeCase } = useActiveCase();
  const [trialSession, setTrialSession] = useState(null);
  const [sessionState, setSessionState] = useState(null);
  const [proofItem, setProofItem] = useState(null);
  const [content, setContent] = useState(null); // the actual resolved content
  const [callout, setCallout] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const pollRef = useRef(null);

  // Find active trial session for this case
  useEffect(() => {
    if (!activeCase?.id) return;
    loadSession();
  }, [activeCase?.id]);

  const loadSession = async () => {
    const sessions = await base44.entities.TrialSessions.filter({
      case_id: activeCase.id,
      status: { $in: ['Setup', 'Active'] },
    });
    if (sessions.length > 0) setTrialSession(sessions[0]);
  };

  // Poll session state every 1.5 seconds
  useEffect(() => {
    if (!trialSession?.id) return;
    const poll = async () => {
      const states = await base44.entities.TrialSessionStates.filter({ trial_session_id: trialSession.id });
      const state = states[0] || null;
      setSessionState(prev => {
        const prevId = prev?.current_proof_item_id;
        const newId = state?.current_proof_item_id;
        if (prevId !== newId) {
          if (newId) loadProofItem(newId);
          else { setProofItem(null); setContent(null); setCallout(null); setHighlights([]); }
        }
        return state;
      });
    };
    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => clearInterval(pollRef.current);
  }, [trialSession?.id]);

  const loadProofItem = async (proofItemId) => {
    const items = await base44.entities.ProofItems.filter({ id: proofItemId });
    if (!items[0]) return;
    const pi = items[0];
    setProofItem(pi);

    if (pi.type === 'depoClip') {
      const clips = await base44.entities.DepoClips.filter({ id: pi.source_id });
      setContent(clips[0] || null);
      setCallout(null);
      setHighlights([]);
    } else if (pi.type === 'extract') {
      const extracts = await base44.entities.ExhibitExtracts.filter({ id: pi.source_id });
      setContent(extracts[0] || null);
      // Load callout
      const calloutId = pi.callout_id;
      if (calloutId) {
        const callouts = await base44.entities.Callouts.filter({ id: calloutId });
        const co = callouts[0] || null;
        setCallout(co);
        // Load highlights for this callout
        if (co) {
          const hl = await base44.entities.Highlights.filter({ callout_id: co.id });
          setHighlights(hl);
        } else {
          setHighlights([]);
        }
      } else {
        setCallout(null);
        setHighlights([]);
      }
    }
  };

  const isLive = sessionState?.jury_can_see_proof && sessionState?.current_proof_item_id;

  if (!activeCase) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <p className="text-slate-500 text-sm">No active case selected.</p>
      </div>
    );
  }

  if (!trialSession) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <p className="text-slate-500 text-sm">No active trial session. Start one in Attorney View.</p>
      </div>
    );
  }

  if (!isLive) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-3 h-3 bg-slate-600 rounded-full mx-auto animate-pulse" />
          <p className="text-slate-600 text-sm">Waiting for attorney to publish evidence…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex items-center justify-center overflow-hidden">
      {proofItem?.type === 'depoClip' && content && (
        <DepoClipDisplay clip={content} />
      )}
      {proofItem?.type === 'extract' && callout?.snapshot_image_url && (
        <CalloutDisplay callout={callout} highlights={highlights} />
      )}
      {proofItem?.type === 'extract' && !callout?.snapshot_image_url && content && (
        <div className="text-slate-500 text-sm">No callout image available for this exhibit.</div>
      )}
    </div>
  );
}

function DepoClipDisplay({ clip }) {
  const lines = (clip.clip_text || '').split('\n').filter(Boolean);
  return (
    <div className="w-full h-full flex flex-col bg-black overflow-hidden">
      {clip.clip_title && (
        <div className="px-10 pt-8 pb-2">
          <p className="text-amber-300 text-xl font-semibold">{clip.clip_title}</p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-10 py-4 space-y-1">
        {lines.map((line, i) => {
          const parts = line.match(/^(\d+:\d+)\s+(.*)$/);
          if (parts) {
            return (
              <div key={i} className="flex gap-4 py-1">
                <span className="font-mono text-cyan-500 text-lg w-16 flex-shrink-0 font-bold">{parts[1]}</span>
                <span className="text-white text-xl leading-relaxed">{parts[2]}</span>
              </div>
            );
          }
          return <div key={i} className="text-white text-xl leading-relaxed py-1">{line}</div>;
        })}
      </div>
    </div>
  );
}

function CalloutDisplay({ callout, highlights }) {
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState(null);

  const COLOR_MAP = {
    yellow: { fill: 'rgba(251,191,36,0.35)', stroke: 'rgba(251,191,36,0.9)' },
    red:    { fill: 'rgba(239,68,68,0.32)',  stroke: 'rgba(239,68,68,0.9)' },
    green:  { fill: 'rgba(34,197,94,0.32)',  stroke: 'rgba(34,197,94,0.9)' },
    blue:   { fill: 'rgba(59,130,246,0.32)', stroke: 'rgba(59,130,246,0.9)' },
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6 bg-black relative">
      <div className="relative inline-block max-h-full">
        <img
          ref={imgRef}
          src={callout.snapshot_image_url}
          alt="Evidence"
          className="max-h-screen max-w-full object-contain block"
          style={{ maxHeight: 'calc(100vh - 48px)' }}
          onLoad={(e) => {
            const el = e.currentTarget;
            setImgSize({ width: el.clientWidth, height: el.clientHeight });
          }}
        />
        {/* Highlight overlays */}
        {imgSize && highlights.map(hl => {
          const colors = COLOR_MAP[hl.color] || COLOR_MAP.yellow;
          const rects = hl.rects_norm || [];
          return rects.map((r, ri) => (
            <div
              key={`${hl.id}-${ri}`}
              style={{
                position: 'absolute',
                left: r.x * imgSize.width,
                top: r.y * imgSize.height,
                width: r.w * imgSize.width,
                height: r.h * imgSize.height,
                backgroundColor: colors.fill,
                border: `2px solid ${colors.stroke}`,
                borderRadius: 3,
                pointerEvents: 'none',
              }}
            />
          ));
        })}
      </div>
    </div>
  );
}