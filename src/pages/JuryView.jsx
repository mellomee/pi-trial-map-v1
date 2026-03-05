import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Monitor, ChevronLeft, ChevronRight } from "lucide-react";

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
    const sessions = await base44.entities.TrialSessions.filter({
      case_id: activeCase.id,
      status: { $in: ['Setup', 'Active'] },
    });
    if (sessions.length > 0) {
      setTrialSession(sessions[0]);
      loadState(sessions[0].id);
    }
  };

  const loadState = async (sessionId) => {
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
  };

  // Poll every 2 seconds for live updates
  useEffect(() => {
    if (!trialSession?.id) return;
    const interval = setInterval(() => loadState(trialSession.id), 2000);
    return () => clearInterval(interval);
  }, [trialSession?.id]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#02060f] text-white overflow-hidden">
      {!publishedProof ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Monitor className="w-20 h-20 text-slate-800" />
          <p className="text-3xl font-bold text-slate-700">Jury View</p>
          <p className="text-slate-700 text-base">Waiting for evidence...</p>
        </div>
      ) : (
        <div className="flex-1 w-full h-full overflow-hidden">
          {publishedProof.type === 'extract' && publishedProof.source_id && (
            <ExtractJuryView
              sourceId={publishedProof.source_id}
              calloutId={publishedProof.callout_id}
              sessionStateCalloutId={sessionState?.current_callout_id}
            />
          )}
          {publishedProof.type === 'depoClip' && publishedProof.source_id && (
            <DepoClipJuryView sourceId={publishedProof.source_id} />
          )}
        </div>
      )}
    </div>
  );
}

function ExtractJuryView({ sourceId, calloutId }) {
  const [callouts, setCallouts] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [jx, setJx] = useState(null);

  useEffect(() => {
    if (!sourceId) return;
    setCurrentIdx(0);
    base44.entities.ExhibitExtracts.filter({ id: sourceId }).then(r => {
      if (r[0]) {
        base44.entities.JointExhibits.filter({ exhibit_extract_id: r[0].id }).then(j => setJx(j[0] || null));
      }
    });
    base44.entities.Callouts.filter({ extract_id: sourceId }).then(cs => {
      if (calloutId) {
        const sorted = [...cs].sort((a, b) => (a.id === calloutId ? -1 : b.id === calloutId ? 1 : 0));
        setCallouts(sorted);
      } else {
        setCallouts(cs);
      }
    });
  }, [sourceId, calloutId]);

  const current = callouts[currentIdx] || null;

  if (!current?.snapshot_image_url) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-700">
        <p>Loading exhibit...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      {/* Full-screen image */}
      <img
        src={current.snapshot_image_url}
        alt="Exhibit"
        className="max-w-full max-h-full object-contain"
        style={{ maxHeight: '100vh', maxWidth: '100vw' }}
      />

      {/* Admitted number — corner overlay only */}
      {jx?.admitted_no && (
        <div className="absolute top-4 right-4 bg-black/70 text-white px-4 py-2 rounded-lg text-2xl font-bold border border-white/20">
          #{jx.admitted_no}
        </div>
      )}

      {/* Page navigation */}
      {callouts.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIdx(i => Math.max(i - 1, 0))}
            disabled={currentIdx === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full disabled:opacity-20 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => setCurrentIdx(i => Math.min(i + 1, callouts.length - 1))}
            disabled={currentIdx === callouts.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full disabled:opacity-20 transition-all"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-1.5 rounded-full">
            {currentIdx + 1} / {callouts.length}
          </div>
        </>
      )}
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
    <div className="w-full h-full flex items-center justify-center p-12">
      <div className="w-full max-w-5xl max-h-full overflow-y-auto">
        <div className="space-y-0">
          {lines.map((line, i) => {
            const parts = line.match(/^(\d+:\d+)\s+(.*)$/);
            if (parts) {
              return (
                <div key={i} className="flex gap-0 border-b border-slate-800/60">
                  <span className="text-cyan-500 font-mono text-xl w-24 flex-shrink-0 py-3 px-4 bg-slate-900/40">{parts[1]}</span>
                  <span className="text-white text-xl leading-relaxed py-3 px-6 flex-1">{parts[2]}</span>
                </div>
              );
            }
            return <p key={i} className="text-white text-xl leading-relaxed py-3 px-4">{line}</p>;
          })}
        </div>
      </div>
    </div>
  );
}