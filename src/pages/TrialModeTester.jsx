import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useActiveCase from '@/components/hooks/useActiveCase';
import { AlertCircle } from 'lucide-react';

export default function TrialModeTester() {
  const { activeCase } = useActiveCase();
  const [trialSession, setTrialSession] = useState(null);
  const [sessionState, setSessionState] = useState(null);
  const [proof, setProof] = useState(null);
  const [availableProofs, setAvailableProofs] = useState([]);
  const [selectedProofId, setSelectedProofId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load or create trial session
  useEffect(() => {
    if (!activeCase?.id) return;
    setLoading(true);
    setError(null);

    base44.entities.TrialSessions.filter({ case_id: activeCase.id })
      .then(sessions => {
        if (sessions.length > 0) {
          const session = sessions[0];
          setTrialSession(session);
          
          // Load available proofs
          base44.entities.ProofItems.filter({ case_id: activeCase.id })
            .then(proofs => {
              setAvailableProofs(proofs);
            });
          
          // Subscribe to session state changes
          const unsub = base44.entities.TrialSessionStates.subscribe(event => {
            if (event.data?.trial_session_id === session.id) {
              setSessionState(event.data);
            }
          });

          // Load current state
          base44.entities.TrialSessionStates.filter({ trial_session_id: session.id })
            .then(states => {
              if (states[0]) setSessionState(states[0]);
              setLoading(false);
            });

          return unsub;
        } else {
          setError('No trial session found. Create one in TrialMode first.');
          setLoading(false);
        }
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [activeCase?.id]);

  // Load current proof when state changes
  useEffect(() => {
    if (!sessionState?.current_proof_item_id) {
      setProof(null);
      return;
    }
    base44.entities.ProofItems.filter({ id: sessionState.current_proof_item_id })
      .then(items => setProof(items[0] || null));
  }, [sessionState?.current_proof_item_id]);

  const handlePublishTest = async () => {
    if (!sessionState?.id) return;
    try {
      await base44.entities.TrialSessionStates.update(sessionState.id, {
        jury_display_enabled: true,
        jury_can_see_proof: true,
      });
      console.log('Published successfully');
    } catch (err) {
      setError(`Publish failed: ${err.message}`);
    }
  };

  const handleUnpublishTest = async () => {
    if (!sessionState?.id) return;
    try {
      await base44.entities.TrialSessionStates.update(sessionState.id, {
        jury_display_enabled: false,
        jury_can_see_proof: false,
      });
      console.log('Unpublished successfully');
    } catch (err) {
      setError(`Unpublish failed: ${err.message}`);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>;
  if (error) return (
    <div className="p-8 bg-red-900/20 border border-red-700 rounded m-4 flex gap-3">
      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-red-300 font-semibold">Error</p>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-slate-200 overflow-hidden">
      {/* Control panel */}
      <div className="w-64 bg-[#0f1629] border-r border-[#1e2a45] p-4 overflow-y-auto flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-bold text-cyan-400 mb-2">Trial Mode Tester</h2>
          <p className="text-xs text-slate-500">See attorney & jury sync in real-time</p>
        </div>

        <div className="bg-[#131a2e] border border-[#1e2a45] rounded p-3 space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Session State</p>
          <div className="text-[11px] space-y-1 font-mono text-slate-300">
            <div><span className="text-slate-500">ID:</span> {sessionState?.id?.slice(0, 8)}...</div>
            <div><span className="text-slate-500">Published:</span> <span className={sessionState?.jury_display_enabled ? 'text-green-400' : 'text-red-400'}>{String(sessionState?.jury_display_enabled)}</span></div>
            <div><span className="text-slate-500">Can See:</span> <span className={sessionState?.jury_can_see_proof ? 'text-green-400' : 'text-red-400'}>{String(sessionState?.jury_can_see_proof)}</span></div>
            <div><span className="text-slate-500">Proof ID:</span> {sessionState?.current_proof_item_id?.slice(0, 8)}...</div>
          </div>
        </div>

        {proof && (
          <div className="bg-[#131a2e] border border-[#1e2a45] rounded p-3 space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Current Proof</p>
            <div className="text-[11px] space-y-1 text-slate-300">
              <div><span className="text-slate-500">Type:</span> {proof.proof_type}</div>
              <div><span className="text-slate-500">Label:</span> {proof.proof_label}</div>
              <div><span className="text-slate-500">Admitted:</span> <span className={proof.is_admitted ? 'text-green-400' : 'text-amber-400'}>{String(proof.is_admitted)}</span></div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={handlePublishTest}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold py-2 rounded transition-colors"
          >
            Publish Test
          </button>
          <button
            onClick={handleUnpublishTest}
            className="w-full bg-red-700 hover:bg-red-600 text-white text-xs font-semibold py-2 rounded transition-colors"
          >
            Unpublish Test
          </button>
        </div>

        <div className="pt-4 border-t border-[#1e2a45] text-[10px] text-slate-500">
          <p className="font-semibold mb-2">How to use:</p>
          <ol className="space-y-1 list-decimal list-inside">
            <li>Watch left/right panels</li>
            <li>Click Publish/Unpublish</li>
            <li>See state sync instantly</li>
            <li>Debug sync issues</li>
          </ol>
        </div>
      </div>

      {/* Split view */}
      <div className="flex-1 flex gap-0.5 overflow-hidden bg-[#0a0f1e]">
        {/* Attorney side (left) */}
        <div className="flex-1 flex flex-col border-r border-[#1e2a45]">
          <div className="px-3 py-2 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0">
            <h3 className="text-xs font-bold text-cyan-400">ATTORNEY VIEW</h3>
            <p className="text-[10px] text-slate-500">(TrialMode)</p>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="text-slate-400 text-xs space-y-3">
              <div className="bg-[#131a2e] border border-[#1e2a45] rounded p-3">
                <p className="font-semibold text-slate-300 mb-2">Session {sessionState?.id?.slice(0, 8)}...</p>
                <pre className="text-[9px] overflow-auto bg-black/30 p-2 rounded">{JSON.stringify(sessionState, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Jury side (right) */}
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-2 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0">
            <h3 className="text-xs font-bold text-amber-400">JURY VIEW</h3>
            <p className="text-[10px] text-slate-500">(What jury sees)</p>
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center">
            {sessionState?.jury_display_enabled && sessionState?.jury_can_see_proof ? (
              <div className="w-full max-w-md space-y-4">
                <div className="bg-green-900/20 border border-green-700 rounded p-4">
                  <p className="text-green-300 text-sm font-semibold mb-2">✓ Display Active</p>
                  {proof ? (
                    <div className="text-green-200 text-xs space-y-2">
                      <p><span className="text-slate-400">Type:</span> {proof.proof_type}</p>
                      <p><span className="text-slate-400">Label:</span> {proof.proof_label}</p>
                      <p className="text-[10px] text-slate-500 mt-3">👁️ Jury would see proof here</p>
                    </div>
                  ) : (
                    <p className="text-green-300 text-xs">Display is live but no proof selected</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <div className="w-8 h-8 bg-white/10 rounded"></div>
                </div>
                <p className="text-slate-500 text-sm">Jury display off</p>
                <p className="text-slate-700 text-xs mt-1">Waiting for attorney to publish...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}