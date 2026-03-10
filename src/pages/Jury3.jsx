import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Monitor } from "lucide-react";

export default function Jury3() {
  const { activeCase } = useActiveCase();
  const [sessionId, setSessionId] = useState(null);
  const [proofContent, setProofContent] = useState(null);
  const [isDisplaying, setIsDisplaying] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      if (!activeCase?.id) {
        setLoading(false);
        return;
      }
      try {
        const sessions = await base44.entities.TrialSessions.filter({ case_id: activeCase.id });
        if (sessions.length) {
          setSessionId(sessions[0].id);
        }
      } catch (err) {
        console.error('Session init failed:', err);
      }
      setLoading(false);
    };
    initSession();
  }, [activeCase?.id]);

  // Subscribe to session state changes and load proof content
  useEffect(() => {
    if (!sessionId) return;

    const loadProofContent = async (proofId) => {
      if (!proofId) {
        setProofContent(null);
        setIsDisplaying(false);
        return;
      }
      try {
        const proofs = await base44.entities.ProofItems.filter({ id: proofId });
        if (proofs.length) {
          setProofContent(proofs[0]);
          setIsDisplaying(true);
        }
      } catch (err) {
        console.error('Load proof content failed:', err);
      }
    };

    const unsubscribe = base44.entities.TrialSessionStates.subscribe((event) => {
      if (event.data?.trial_session_id === sessionId) {
        const state = event.data;
        if (state.jury_can_see_proof && state.current_proof_item_id) {
          loadProofContent(state.current_proof_item_id);
        } else {
          setProofContent(null);
          setIsDisplaying(false);
        }
      }
    });

    return unsubscribe;
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-slate-300 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-black/80 border-b border-blue-500/20 px-6 py-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Monitor className="w-6 h-6 text-blue-400" />
          Jury View v3
        </h1>
      </div>

      {/* Main display */}
      <div className="flex-1 overflow-hidden flex items-center justify-center">
        {isDisplaying && proofContent ? (
          <div className="w-full h-full flex items-center justify-center bg-black p-4">
            {proofContent.file_url ? (
              <img
                src={proofContent.file_url}
                alt="jury-proof"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-center">
                <p className="text-slate-400 text-sm">{proofContent.label || 'Evidence'}</p>
                <p className="text-slate-600 text-xs mt-2">ID: {proofContent.id?.slice(0, 8)}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-slate-500 text-lg">Waiting for evidence...</p>
            <p className="text-slate-600 text-xs mt-2">Attorney will publish evidence here</p>
          </div>
        )}
      </div>
    </div>
  );
}