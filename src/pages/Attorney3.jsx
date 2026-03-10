import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Zap, Monitor, Square, ChevronDown } from "lucide-react";

export default function Attorney3() {
  const { activeCase } = useActiveCase();
  const [sessionId, setSessionId] = useState(null);
  const [stateId, setStateId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [questionProofs, setQuestionProofs] = useState([]);
  const [selectedProof, setSelectedProof] = useState(null);
  const [isPublished, setIsPublished] = useState(false);
  const [proofContent, setProofContent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      if (!activeCase?.id) {
        setLoading(false);
        return;
      }
      try {
        let sessions = await base44.entities.TrialSessions.filter({ case_id: activeCase.id });
        if (!sessions.length) {
          const newSession = await base44.entities.TrialSessions.create({ case_id: activeCase.id });
          sessions = [newSession];
        }
        const session = sessions[0];
        setSessionId(session.id);

        // Ensure state record exists
        const states = await base44.entities.TrialSessionStates.filter({ trial_session_id: session.id });
        if (!states.length) {
          const newState = await base44.entities.TrialSessionStates.create({ trial_session_id: session.id });
          setStateId(newState.id);
        } else {
          setStateId(states[0].id);
        }
      } catch (err) {
        console.error('Session init failed:', err);
      }
      setLoading(false);
    };
    initSession();
  }, [activeCase?.id]);

  // Load questions
  useEffect(() => {
    const loadQuestions = async () => {
      if (!activeCase?.id) return;
      try {
        const qs = await base44.entities.Questions.filter({ case_id: activeCase.id });
        setQuestions(qs);
      } catch (err) {
        console.error('Load questions failed:', err);
      }
    };
    loadQuestions();
  }, [activeCase?.id]);

  // Load proofs for selected question
  useEffect(() => {
    if (!selectedQuestion?.id) {
      setQuestionProofs([]);
      setProofContent(null);
      return;
    }
    const loadProofs = async () => {
      try {
        const proofs = await base44.entities.QuestionProofItems.filter({ question_id: selectedQuestion.id });
        setQuestionProofs(proofs);
      } catch (err) {
        console.error('Load proofs failed:', err);
        setQuestionProofs([]);
      }
    };
    loadProofs();
  }, [selectedQuestion?.id]);

  // Load proof content when proof is selected
  useEffect(() => {
    const loadProofContent = async () => {
      if (!selectedProof?.id) {
        setProofContent(null);
        return;
      }
      try {
        const proofItems = await base44.entities.ProofItems.filter({ id: selectedProof.id });
        if (proofItems.length) {
          const item = proofItems[0];
          let content = { ...item };
          
          // If proof references an extract, load its file
          if (item.exhibit_extract_id) {
            const extracts = await base44.entities.ExhibitExtracts.filter({ id: item.exhibit_extract_id });
            if (extracts.length) {
              const extract = extracts[0];
              content.file_url = extract.file_url;
              content.label = extract.display_title || extract.title;
            }
          }
          // If proof references a depo clip, load its metadata
          else if (item.deposition_clip_id) {
            const clips = await base44.entities.DepoClips.filter({ id: item.deposition_clip_id });
            if (clips.length) {
              content.label = clips[0].clip_title || `Clip: ${clips[0].start_cite}`;
            }
          }
          
          setProofContent(content);
        }
      } catch (err) {
        console.error('Load proof content failed:', err);
      }
    };
    loadProofContent();
  }, [selectedProof?.id]);

  // Subscribe to session state
  useEffect(() => {
    if (!sessionId) return;
    const unsubscribe = base44.entities.TrialSessionStates.subscribe((event) => {
      if (event.data?.trial_session_id === sessionId) {
        setIsPublished(!!event.data.jury_display_enabled && !!event.data.current_proof_item_id);
      }
    });
    return unsubscribe;
  }, [sessionId]);

  // Publish proof to jury
  const handlePublish = async (proof) => {
    if (!stateId || !proof) return;
    try {
      await base44.entities.TrialSessionStates.update(stateId, {
        current_proof_item_id: proof.id,
        jury_display_enabled: true,
        jury_can_see_proof: true,
      });
      setSelectedProof(proof);
    } catch (err) {
      console.error('Publish failed:', err);
    }
  };

  // Unpublish from jury
  const handleUnpublish = async () => {
    if (!stateId) return;
    try {
      await base44.entities.TrialSessionStates.update(stateId, {
        current_proof_item_id: null,
        jury_display_enabled: false,
        jury_can_see_proof: false,
      });
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
            Attorney Control v3
          </h1>
          <p className="text-xs text-slate-400 mt-1">{activeCase?.name || 'No case selected'}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPublished && <Badge className="bg-red-600/80 text-red-100 animate-pulse">LIVE JURY VIEW</Badge>}
        </div>
      </div>

      {/* Main content with resizable panels */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Questions Panel */}
          <ResizablePanel defaultSize={25} minSize={15}>
            <div className="h-full bg-slate-800/50 rounded-lg border border-slate-700/50 flex flex-col m-2 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Questions ({questions.length})</p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 p-2">
                {questions.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQuestion(q)}
                    className={`w-full text-left p-2 rounded text-xs leading-relaxed transition-all ${
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
          </ResizablePanel>

          <ResizableHandle />

          {/* Proofs Panel */}
          <ResizablePanel defaultSize={25} minSize={15}>
            <div className="h-full bg-slate-800/50 rounded-lg border border-slate-700/50 flex flex-col m-2 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Proofs ({questionProofs.length})</p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 p-2">
                {questionProofs.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-4">
                    {selectedQuestion ? 'No proofs linked' : 'Select a question'}
                  </div>
                ) : (
                  questionProofs.map((proof) => (
                    <button
                      key={proof.id}
                      onClick={() => setSelectedProof(proof)}
                      className={`w-full text-left p-2 rounded text-xs transition-all ${
                        selectedProof?.id === proof.id
                          ? 'bg-blue-600/50 border border-blue-400/60 text-blue-100'
                          : 'bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/30 text-slate-300'
                      }`}
                    >
                      <p className="font-medium truncate">Proof {proof.id?.slice(0, 8)}</p>
                      {proof.label && <p className="text-[10px] text-slate-500 truncate">{proof.label}</p>}
                    </button>
                  ))
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Preview Panel */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col m-2 overflow-hidden">
              {isPublished && selectedProof ? (
                <div className="flex-1 bg-black/60 border-2 border-red-500/40 rounded-lg p-4 flex flex-col overflow-hidden">
                  <p className="text-xs text-red-400 uppercase tracking-wider font-semibold mb-2">🔴 Published to Jury</p>
                  <div className="flex-1 bg-slate-950 rounded-lg border border-slate-700/50 flex items-center justify-center overflow-hidden">
                    {proofContent?.file_url ? (
                      <img
                        src={proofContent.file_url}
                        alt="proof"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <p className="text-slate-400 text-xs">{selectedProof.label || 'Proof'}</p>
                        <p className="text-slate-600 text-[10px] mt-1">ID: {selectedProof.id?.slice(0, 8)}</p>
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
              ) : selectedProof ? (
                <div className="flex-1 bg-slate-800/50 rounded-lg border border-slate-700/50 p-4 flex flex-col overflow-hidden">
                  <p className="text-xs text-slate-300 uppercase tracking-wider font-semibold mb-2">Preview</p>
                  <div className="flex-1 bg-slate-950 rounded-lg border border-slate-700/50 flex items-center justify-center overflow-hidden">
                    {proofContent?.file_url ? (
                      <img
                        src={proofContent.file_url}
                        alt="proof"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <p className="text-slate-400 text-xs">{selectedProof.label || 'Proof'}</p>
                        <p className="text-slate-600 text-[10px] mt-1">ID: {selectedProof.id?.slice(0, 8)}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handlePublish(selectedProof)}
                    className="mt-3 bg-green-700 hover:bg-green-600 w-full h-9 text-xs"
                  >
                    Publish to Jury
                  </Button>
                </div>
              ) : (
                <div className="flex-1 bg-slate-800/50 rounded-lg border border-slate-700/50 flex items-center justify-center">
                  <p className="text-xs text-slate-500">Select a proof to preview</p>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}