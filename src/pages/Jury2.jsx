import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useActiveCase from '@/components/hooks/useActiveCase';
import { Volume2 } from 'lucide-react';

export default function Jury2() {
  const { activeCase } = useActiveCase();
  const [sessionId, setSessionId] = useState(null);
  const [proof, setProof] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [touchStartDist, setTouchStartDist] = useState(null);

  // Find and subscribe to trial session state
  useEffect(() => {
    if (!activeCase?.id) return;

    const initAndSubscribe = async () => {
      try {
        // Get or create session
        const sessions = await base44.entities.TrialSessions.filter({ case_id: activeCase.id });
        let session = sessions[0];
        if (!session) {
          session = await base44.entities.TrialSessions.create({ case_id: activeCase.id });
        }
        setSessionId(session.id);

        // Subscribe to state changes
        const unsubscribe = base44.entities.TrialSessionStates.subscribe((event) => {
          if (event.data?.trial_session_id === session.id) {
            const state = event.data;
            if (state.jury_display_enabled && state.current_proof_item_id) {
              setIsActive(true);
              // In a real scenario, you'd fetch the proof item here
              setProof({
                id: state.current_proof_item_id,
                label: `Proof: ${state.current_proof_item_id}`,
              });
              setZoom(state.proof_zoom_level || 1);
            } else {
              setIsActive(false);
              setProof(null);
              setZoom(1);
            }
          }
        });

        // Initial fetch
        const states = await base44.entities.TrialSessionStates.filter({ trial_session_id: session.id });
        if (states[0]) {
          const state = states[0];
          if (state.jury_display_enabled && state.current_proof_item_id) {
            setIsActive(true);
            setProof({ id: state.current_proof_item_id, label: `Proof: ${state.current_proof_item_id}` });
            setZoom(state.proof_zoom_level || 1);
          }
        }

        return unsubscribe;
      } catch (err) {
        console.error('Session init failed:', err);
      }
    };

    const cleanup = initAndSubscribe();
    return () => {
      cleanup?.then(unsub => unsub?.());
    };
  }, [activeCase?.id]);

  // Handle pinch zoom on touch
  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      if (touchStartDist === null) {
        setTouchStartDist(dist);
      } else {
        const delta = dist - touchStartDist;
        const newZoom = Math.min(3, Math.max(0.5, zoom + delta * 0.005));
        setZoom(newZoom);
        setTouchStartDist(dist);
      }
    }
  };

  const handleTouchEnd = () => {
    setTouchStartDist(null);
  };

  if (!isActive || !proof) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Volume2 className="w-16 h-16 text-slate-600 mx-auto opacity-40" />
          <p className="text-slate-500 text-lg">Waiting for attorney to publish evidence...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'none' }}
    >
      {/* Proof Display */}
      <div
        className="bg-slate-950 rounded-lg border border-slate-700/50 flex items-center justify-center shadow-2xl"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center',
          transition: 'transform 0.1s ease-out',
          maxWidth: '90vw',
          maxHeight: '90vh',
          aspectRatio: '16/9',
        }}
      >
        {proof.label && (
          <div className="text-center">
            <p className="text-slate-300 text-lg font-medium">{proof.label}</p>
            <p className="text-slate-500 text-xs mt-2">Pinch to zoom • Swipe to pan</p>
          </div>
        )}
      </div>

      {/* Zoom Level Indicator */}
      <div className="absolute bottom-4 right-4 text-xs text-slate-400 bg-black/60 px-3 py-1.5 rounded-lg">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}