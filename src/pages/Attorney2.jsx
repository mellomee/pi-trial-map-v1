import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useActiveCase from '@/components/hooks/useActiveCase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Square, ChevronDown, ChevronUp, Zap } from 'lucide-react';

export default function Attorney2() {
  const { activeCase } = useActiveCase();
  const [questions, setQuestions] = useState([]);
  const [witnesses, setWitnesses] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [selectedProof, setSelectedProof] = useState(null);
  const [isPublished, setIsPublished] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize or get trial session
  useEffect(() => {
    if (!activeCase?.id) return;
    const initSession = async () => {
      try {
        const sessions = await base44.entities.TrialSessions.filter({ case_id: activeCase.id });
        let session = sessions[0];
        if (!session) {
          session = await base44.entities.TrialSessions.create({ case_id: activeCase.id });
        }
        setSessionId(session.id);

        // Initialize state record
        const states = await base44.entities.TrialSessionStates.filter({ trial_session_id: session.id });
        if (!states[0]) {
          await base44.entities.TrialSessionStates.create({ trial_session_id: session.id });
        }
      } catch (err) {
        console.error('Session init failed:', err);
      }
    };
    initSession();
  }, [activeCase?.id]);

  // Load data
  useEffect(() => {
    if (!activeCase?.id) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const qs = await base44.entities.Questions.filter({ case_id: activeCase.id });
        const ws = await base44.entities.Parties.filter({ case_id: activeCase.id });
        setQuestions(qs);
        setWitnesses(ws);
      } catch (err) {
        console.error('Load failed:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeCase?.id]);

  // Handle publish
  const handlePublish = async (proof) => {
    if (!sessionId || !proof) return;
    try {
      await base44.entities.TrialSessionStates.update(
        await (await base44.entities.TrialSessionStates.filter({ trial_session_id: sessionId }))[0]?.id,
        {
          current_proof_item_id: proof.id,
          jury_display_enabled: true,
          jury_can_see_proof: true,
        }
      );
      setSelectedProof(proof);
      setIsPublished(true);
    } catch (err) {
      console.error('Publish failed:', err);
    }
  };

  // Handle unpublish
  const handleUnpublish = async () => {
    if (!sessionId) return;
    try {
      const state = await base44.entities.TrialSessionStates.filter({ trial_session_id: sessionId });
      if (state[0]) {
        await base44.entities.TrialSessionStates.update(state[0].id, {
          current_proof_item_id: null,
          jury_display_enabled: false,
          jury_can_see_proof: false,
        });
      }
      setSelectedProof(null);
      setIsPublished(false);
    } catch (err) {
      console.error('Unpublish failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950">
        <div className="text-slate-300 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-black/40 border-b border-blue-500/20 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-400" />
            Attorney Control
          </h1>
          <p className="text-xs text-slate-400 mt-1">{activeCase?.name || 'No case selected'}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPublished && (
            <Badge className="bg-red-600/80 text-red-100 animate-pulse">LIVE JURY VIEW</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Left: Questions List */}
        <div className="w-72 bg-slate-800/50 rounded-lg border border-slate-700/50 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Questions</p>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 p-2">
            {questions.map(q => (
              <button
                key={q.id}
                onClick={() => setSelectedQuestion(q)}
                className={`w-full text-left p-3 rounded-lg transition-all text-xs leading-relaxed ${
                  selectedQuestion?.id === q.id
                    ? 'bg-blue-600/40 border border-blue-400/60 text-blue-100'
                    : 'bg-slate-700/20 hover:bg-slate-700/40 border border-slate-600/30 text-slate-300'
                }`}
              >
                {q.question_text}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Proof Selection & Preview */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Current Question Info */}
          {selectedQuestion && (
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
              <p className="text-xs text-blue-300 uppercase tracking-wider font-semibold mb-1">Active Question</p>
              <p className="text-white text-sm leading-relaxed">{selectedQuestion.question_text}</p>
              {selectedQuestion.expected_answer && (
                <p className="text-xs text-slate-400 mt-2 italic">Expected: {selectedQuestion.expected_answer}</p>
              )}
            </div>
          )}

          {/* Published Proof Preview */}
          {isPublished && selectedProof && (
            <div className="flex-1 bg-black/60 border-2 border-red-500/40 rounded-lg p-4 flex flex-col overflow-hidden">
              <p className="text-xs text-red-400 uppercase tracking-wider font-semibold mb-2">🔴 Published to Jury</p>
              <div className="flex-1 bg-slate-950 rounded-lg border border-slate-700/50 flex items-center justify-center overflow-hidden">
                {selectedProof.label && (
                  <div className="text-center">
                    <p className="text-slate-400 text-xs">{selectedProof.label}</p>
                    <p className="text-slate-600 text-[10px] mt-1">Proof ID: {selectedProof.id}</p>
                  </div>
                )}
              </div>
              <Button
                onClick={handleUnpublish}
                className="mt-3 bg-red-700 hover:bg-red-600 w-full h-9 text-xs gap-1"
              >
                <Square className="w-3 h-3" /> Unpublish
              </Button>
            </div>
          )}

          {/* Available Proofs */}
          {!isPublished && (
            <div className="flex-1 bg-slate-800/50 rounded-lg border border-slate-700/50 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Available Proofs</p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 p-3">
                <div className="text-xs text-slate-500 text-center py-8">
                  Select a question to view available proofs
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Control Panel */}
        <div className="w-64 flex flex-col gap-4">
          {/* Status */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Status</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Jury Display:</span>
                <Badge className={isPublished ? 'bg-green-900/60 text-green-200' : 'bg-slate-700/60 text-slate-300'}>
                  {isPublished ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Questions:</span>
                <Badge variant="outline">{questions.length}</Badge>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          {!isPublished && selectedQuestion && (
            <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Quick Publish</p>
              <Button
                onClick={() => handlePublish(selectedQuestion)}
                className="w-full bg-cyan-600 hover:bg-cyan-700 h-9 text-xs gap-1"
              >
                <Monitor className="w-3 h-3" /> Publish Question
              </Button>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 bg-slate-900/30 rounded-lg border border-slate-700/50 p-4 flex flex-col">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Info</p>
            <div className="text-[10px] text-slate-500 space-y-2 flex-1 flex flex-col justify-center">
              <p>• Real-time sync to jury view</p>
              <p>• Touch gestures supported</p>
              <p>• Publish one proof at a time</p>
              <p>• Click Unpublish to clear jury screen</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}