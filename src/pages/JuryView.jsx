import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Monitor } from "lucide-react";

export default function JuryView() {
  const { activeCase } = useActiveCase();
  const [sessionState, setSessionState] = useState(null);
  const [publishedProof, setPublishedProof] = useState(null);
  const [trialSession, setTrialSession] = useState(null);

  useEffect(() => {
    if (!activeCase?.id) return;
    loadSession();
  }, [activeCase?.id]);

  const loadSession = async () => {
    try {
      const sessions = await base44.entities.TrialSessions.filter({
        case_id: activeCase.id,
        status: { $in: ['Setup', 'Active'] },
      });
      if (sessions.length > 0) {
        setTrialSession(sessions[0]);
        loadState(sessions[0].id);
      }
    } catch (e) { console.error(e); }
  };

  const loadState = async (sessionId) => {
    try {
      const states = await base44.entities.TrialSessionStates.filter({ trial_session_id: sessionId });
      if (states.length > 0) {
        setSessionState(states[0]);
        if (states[0].current_proof_item_id && states[0].jury_can_see_proof) {
          const proofs = await base44.entities.ProofItems.filter({ id: states[0].current_proof_item_id });
          setPublishedProof(proofs[0] || null);
        } else {
          setPublishedProof(null);
        }
      }
    } catch (e) { console.error(e); }
  };

  // Poll every 2 seconds for live updates
  useEffect(() => {
    if (!trialSession?.id) return;
    const interval = setInterval(() => loadState(trialSession.id), 2000);
    return () => clearInterval(interval);
  }, [trialSession?.id]);

  return (
    <div className="flex flex-col h-screen bg-[#02060f] text-white items-center justify-center">
      {!publishedProof ? (
        <div className="text-center space-y-4">
          <Monitor className="w-16 h-16 text-slate-700 mx-auto" />
          <p className="text-2xl font-bold text-slate-600">Jury View</p>
          <p className="text-slate-600 text-sm">Waiting for attorney to publish evidence...</p>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center p-8">
          <div className="max-w-4xl w-full space-y-4">
            <p className="text-xs text-slate-500 text-center uppercase tracking-wider">Now Showing</p>
            <h2 className="text-3xl font-bold text-white text-center">{publishedProof.label}</h2>
            {publishedProof.type === 'extract' && publishedProof.source_id && (
              <ExtractJuryView proofItemId={publishedProof.id} sourceId={publishedProof.source_id} calloutId={publishedProof.callout_id} />
            )}
            {publishedProof.type === 'depoClip' && publishedProof.source_id && (
              <DepoClipJuryView sourceId={publishedProof.source_id} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExtractJuryView({ sourceId, calloutId }) {
  const [callout, setCallout] = useState(null);

  useEffect(() => {
    if (calloutId) {
      base44.entities.Callouts.filter({ id: calloutId }).then(r => setCallout(r[0] || null));
    } else if (sourceId) {
      base44.entities.Callouts.filter({ extract_id: sourceId }).then(r => setCallout(r[0] || null));
    }
  }, [calloutId, sourceId]);

  if (!callout?.snapshot_image_url) return null;

  return (
    <div className="flex justify-center">
      <img
        src={callout.snapshot_image_url}
        alt={callout.name}
        className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl"
      />
    </div>
  );
}

function DepoClipJuryView({ sourceId }) {
  const [clip, setClip] = useState(null);

  useEffect(() => {
    base44.entities.DepoClips.filter({ id: sourceId }).then(r => setClip(r[0] || null));
  }, [sourceId]);

  if (!clip) return null;

  const lines = (clip.clip_text || '').split('\n').filter(Boolean);

  return (
    <div className="bg-[#0a0f1e] border border-[#1e2a45] rounded-xl p-8 max-h-[70vh] overflow-y-auto">
      <p className="text-xs text-cyan-400 font-mono mb-4">{clip.start_cite} – {clip.end_cite}</p>
      <div className="space-y-2">
        {lines.map((line, i) => {
          const parts = line.match(/^(\d+:\d+)\s+(.*)$/);
          if (parts) {
            return (
              <div key={i} className="flex gap-6">
                <span className="text-cyan-400 font-mono text-lg w-20 flex-shrink-0">{parts[1]}</span>
                <span className="text-white text-lg leading-relaxed">{parts[2]}</span>
              </div>
            );
          }
          return <p key={i} className="text-white text-lg leading-relaxed">{line}</p>;
        })}
      </div>
    </div>
  );
}