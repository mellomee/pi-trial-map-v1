import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import WitnessQuestionsList from "@/components/trialMode/WitnessQuestionsList";
import RunnerZone from "@/components/trialMode/RunnerZone";
import ChildQuestionsZone from "@/components/trialMode/ChildQuestionsZone";
import ProofZone from "@/components/trialMode/ProofZone";
import ProofPreviewZone from "@/components/trialMode/ProofPreviewZone";
import {
  resolveQuestionLinks,
  getWitnessesForCase,
  getQuestionsForWitness,
  updateQuestionStatus,
  getOrCreateTrialSession,
  publishProofToJury,
  clearJuryDisplay,
} from "@/components/trialMode/trialModeResolvers";
import { setSpotlightChangeCallback } from "@/components/trialMode/ExtractViewerZone";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ChevronRight, AlertTriangle, X } from "lucide-react";

const PERSIST_KEY = "trialMode_state";
const LAYOUT_KEY = "trialMode_layout";

const DEFAULT_LAYOUT = { topBPct: 50, topCPct: 50, leftPct: 50 }; // percent splits — B and C heights independent

function loadPersisted(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
  catch { return fallback; }
}

export default function TrialMode() {
  const { activeCase, loading } = useActiveCase();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const savedState = loadPersisted(PERSIST_KEY, {});
  const savedLayout = loadPersisted(LAYOUT_KEY, DEFAULT_LAYOUT);

  const [witnesses, setWitnesses] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedWitnessId, setSelectedWitnessId] = useState(savedState.witnessId || null);
  const [selectedQuestionId, setSelectedQuestionId] = useState(savedState.questionId || null);
  const [selectedChildQuestionId, setSelectedChildQuestionId] = useState(null);
  const [examType, setExamType] = useState(savedState.examType || "Main");
  const [panelVisible, setPanelVisible] = useState(savedState.panelVisible !== false);

  const [resolvedLinks, setResolvedLinks] = useState({ evidenceGroups: [], proofItems: [], trialPoints: [] });
   const [childResolvedLinks, setChildResolvedLinks] = useState(null); // non-null when a child is selected

   const [trialSession, setTrialSession] = useState(null);
   const [publishedProof, setPublishedProof] = useState(null);
   const [selectedProof, setSelectedProof] = useState(null);

   // Request token to prevent stale async proof results
   const requestTokenRef = useRef(0);

  // Resizable layout state
  const [layout, setLayout] = useState({
    topBPct: savedLayout.topBPct ?? savedLayout.topPct ?? 50,
    topCPct: savedLayout.topCPct ?? savedLayout.topPct ?? 50,
    leftPct: savedLayout.leftPct ?? 50,
  });
  const isDraggingHB = useRef(false); // horizontal divider for B/D column
  const isDraggingHC = useRef(false); // horizontal divider for C/E column
  const isDraggingV = useRef(false); // vertical divider (left/right cols)
  const containerRef = useRef(null);

  // Unpublish warning
  const [showUnpublishWarning, setShowUnpublishWarning] = useState(false);
  const pendingNavAction = useRef(null);

  // Persist layout
  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  }, [layout]);

  // Persist state
  useEffect(() => {
    if (!activeCase?.id) return;
    const state = {
      witnessId: selectedWitnessId,
      questionId: selectedQuestionId,
      examType,
      panelVisible,
      caseId: activeCase.id,
      selectedProofId: selectedProof?.id,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
  }, [selectedWitnessId, selectedQuestionId, examType, panelVisible, activeCase?.id, selectedProof?.id]);

  useEffect(() => {
    if (!activeCase?.id) { setWitnesses([]); setQuestions([]); return; }
    loadCaseData();
  }, [activeCase?.id]);

  const loadCaseData = async () => {
    const [witnessesList, session] = await Promise.all([
      getWitnessesForCase(activeCase.id),
      getOrCreateTrialSession(activeCase.id),
    ]);
    setWitnesses(witnessesList);
    setTrialSession(session);

    const witnessIdParam = searchParams.get("witnessId");
    const saved = loadPersisted(PERSIST_KEY, {});
    const savedWitnessId = saved.caseId === activeCase.id ? saved.witnessId : null;
    const savedQuestionId = saved.caseId === activeCase.id ? saved.questionId : null;
    const savedProofId = saved.caseId === activeCase.id ? saved.selectedProofId : null;

    const resolvedWitnessId = witnessIdParam || savedWitnessId || (witnessesList.length > 0 ? witnessesList[0].id : null);
    if (resolvedWitnessId) {
      setSelectedWitnessId(resolvedWitnessId);
      const qs = await getQuestionsForWitness(activeCase.id, resolvedWitnessId);
      setQuestions(qs);
      if (savedQuestionId) {
        setSelectedQuestionId(savedQuestionId);

        // Guard against stale async results during restore
        const token = ++requestTokenRef.current;
        const links = await resolveQuestionLinks(savedQuestionId, activeCase.id);
        if (token === requestTokenRef.current) {
          setResolvedLinks(links);
          // Restore selectedProof
          if (savedProofId && links.proofItems) {
            const restoredProof = links.proofItems.find(p => p.id === savedProofId);
            if (restoredProof) setSelectedProof(restoredProof);
          }
        }
      }
    }
  };

  const handleSelectWitness = async (witnessId) => {
    // Auto-unpublish if witness changes away from published proof
    if (publishedProof) {
      await handleClearJury();
    }
    setSelectedWitnessId(witnessId);
    setSelectedQuestionId(null);
    setSelectedProof(null);
    setResolvedLinks({ evidenceGroups: [], proofItems: [], trialPoints: [] });
    setChildResolvedLinks(null);
    setSelectedChildQuestionId(null);
    const qs = await getQuestionsForWitness(activeCase.id, witnessId);
    setQuestions(qs);
  };

  const handleSelectQuestion = async (questionId) => {
     // Auto-unpublish when changing questions
     if (publishedProof) {
       await handleClearJury();
     }
     setSelectedQuestionId(questionId);
     setSelectedChildQuestionId(null);
     setChildResolvedLinks(null);
     setSelectedProof(null);

     // Guard against stale async results
     const token = ++requestTokenRef.current;
     const links = await resolveQuestionLinks(questionId, activeCase.id);
     if (token === requestTokenRef.current) {
       setResolvedLinks(links);
     }
   };

  const handleSelectChildQuestion = async (childQuestion) => {
     if (selectedChildQuestionId === childQuestion.id) {
       // Deselect — revert to parent's proof; auto-unpublish if needed
       if (publishedProof) {
         await handleClearJury();
       }
       setSelectedChildQuestionId(null);
       setChildResolvedLinks(null);
       setSelectedProof(null);
     } else {
       // Auto-unpublish if child context changes
       if (publishedProof) {
         await handleClearJury();
       }
       setSelectedChildQuestionId(childQuestion.id);
       setSelectedProof(null);

       // Guard against stale async results
       const token = ++requestTokenRef.current;
       const links = await resolveQuestionLinks(childQuestion.id, activeCase.id);
       if (token === requestTokenRef.current) {
         setChildResolvedLinks(links);
       }
     }
   };

  // The proof items currently shown in Zone E
  const activeProofItems = childResolvedLinks ? childResolvedLinks.proofItems : resolvedLinks.proofItems;

  const handleStatusChange = async (status) => {
    if (!selectedQuestionId) return;
    await updateQuestionStatus(selectedQuestionId, { status });
    setQuestions(q => q.map(qq => qq.id === selectedQuestionId ? { ...qq, status } : qq));

    // Auto-advance on Expected (Asked) or Skipped
    if (status === 'Asked' || status === 'Skipped') {
      if (nextQuestion) {
        setTimeout(() => handleSelectQuestion(nextQuestion.id), 300);
      }
    }
  };

  const handlePublishProof = async (proofItem) => {
    if (!trialSession || !proofItem) return;
    // For extract proofs, verify admitted status before publishing
    if (proofItem.type === 'extract' && proofItem.source_id) {
      const jxs = await base44.entities.JointExhibits.filter({ exhibit_extract_id: proofItem.source_id });
      const jx = jxs[0];
      if (!jx || jx.status !== 'Admitted' || !jx.admitted_no) {
        // Not admitted — don't publish, the ProofZone Admit button handles this
        return;
      }
    }
    await publishProofToJury(trialSession.id, proofItem.id);
    setPublishedProof(proofItem);
    window.__trialModePublished = true;
  };

  const handleClearJury = async () => {
    if (!trialSession) return;
    await clearJuryDisplay(trialSession.id);
    setPublishedProof(null);
    window.__trialModePublished = false;
  };

  const handleSpotlightChange = useCallback(async (calloutId) => {
    if (!trialSession || !publishedProof) return;
    await publishProofToJury(trialSession.id, publishedProof.id, calloutId);
  }, [trialSession, publishedProof]);

  // Register spotlight callback with ExtractViewerZone
  useEffect(() => {
    setSpotlightChangeCallback(handleSpotlightChange);
    return () => setSpotlightChangeCallback(null);
  }, [handleSpotlightChange]);

  // Resizing logic
  const startDragHB = useCallback((e) => {
    e.preventDefault();
    isDraggingHB.current = true;
    const onMove = (ev) => {
      if (!isDraggingHB.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = (ev.clientY || ev.touches?.[0]?.clientY) - rect.top;
      const pct = Math.min(Math.max((y / rect.height) * 100, 15), 85);
      setLayout(l => ({ ...l, topBPct: pct }));
    };
    const onUp = () => { isDraggingHB.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const startDragHC = useCallback((e) => {
    e.preventDefault();
    isDraggingHC.current = true;
    const onMove = (ev) => {
      if (!isDraggingHC.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = (ev.clientY || ev.touches?.[0]?.clientY) - rect.top;
      const pct = Math.min(Math.max((y / rect.height) * 100, 15), 85);
      setLayout(l => ({ ...l, topCPct: pct }));
    };
    const onUp = () => { isDraggingHC.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const startDragV = useCallback((e) => {
    e.preventDefault();
    isDraggingV.current = true;
    const onMove = (ev) => {
      if (!isDraggingV.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (ev.clientX || ev.touches?.[0]?.clientX) - rect.left;
      const pct = Math.min(Math.max((x / rect.width) * 100, 20), 80);
      setLayout(l => ({ ...l, leftPct: pct }));
    };
    const onUp = () => { isDraggingV.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const orderedParentQuestions = useMemo(() => {
    let qs = questions.filter(q => q.party_id === selectedWitnessId && !q.parent_id);
    if (examType !== 'All') {
      if (examType === 'Main') qs = qs.filter(q => q.exam_type === 'Direct' || q.exam_type === 'Cross');
      else qs = qs.filter(q => q.exam_type === examType);
    }
    return qs.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [questions, selectedWitnessId, examType]);

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);
  const questionIndex = orderedParentQuestions.findIndex(q => q.id === selectedQuestionId);
  const nextQuestion = questionIndex >= 0 ? orderedParentQuestions[questionIndex + 1] : null;

  const childQuestions = useMemo(() => {
    if (!selectedQuestionId) return [];
    return questions.filter(q => q.parent_id === selectedQuestionId).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [questions, selectedQuestionId]);

  const bucketName = useMemo(() => {
    const groups = (childResolvedLinks || resolvedLinks).evidenceGroups;
    return groups.length > 0 ? (groups[0].title || groups[0].name || null) : null;
  }, [resolvedLinks, childResolvedLinks]);

  if (loading) return <div className="flex items-center justify-center h-screen bg-[#0a0f1e] text-slate-400">Loading...</div>;
  if (!activeCase) return <div className="flex items-center justify-center h-screen bg-[#0a0f1e] text-slate-400"><p>Please select a case to begin</p></div>;

  const leftW = `${layout.leftPct}%`;

  return (
    <div className="flex h-screen bg-[#0a0f1e] overflow-hidden">
      {/* Unpublish warning modal */}
      {showUnpublishWarning && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-[#0f1629] border border-amber-500/40 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-300">Proof is still published</p>
                <p className="text-xs text-slate-400 mt-1">The jury display is active. Unpublish before moving away?</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => { await handleClearJury(); setShowUnpublishWarning(false); if (pendingNavAction.current) { pendingNavAction.current(); pendingNavAction.current = null; } }}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
              >
                Unpublish &amp; Continue
              </button>
              <button
                onClick={() => { setShowUnpublishWarning(false); if (pendingNavAction.current) { pendingNavAction.current(); pendingNavAction.current = null; } }}
                className="flex-1 bg-[#1e2a45] hover:bg-[#263354] text-slate-300 text-xs font-semibold py-2 rounded-lg transition-colors"
              >
                Continue Anyway
              </button>
              <button
                onClick={() => { setShowUnpublishWarning(false); pendingNavAction.current = null; }}
                className="px-3 bg-[#1e2a45] hover:bg-[#263354] text-slate-400 text-xs py-2 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone A: Witness + Questions panel (collapsible) */}
      {panelVisible ? (
        <div className="w-60 min-w-[15rem] max-w-[15rem] flex-shrink-0 flex flex-col h-full overflow-hidden">
          <WitnessQuestionsList
            witnesses={witnesses}
            questions={questions}
            selectedWitnessId={selectedWitnessId}
            onSelectWitness={handleSelectWitness}
            selectedQuestionId={selectedQuestionId}
            onSelectQuestion={handleSelectQuestion}
            examType={examType}
            onExamTypeChange={setExamType}
            onCollapse={() => setPanelVisible(false)}
            selectedQuestionBucket={bucketName}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center pt-4 w-8 flex-shrink-0 bg-[#0f1629] border-r border-[#1e2a45]">
          <button onClick={() => setPanelVisible(true)} className="text-slate-500 hover:text-cyan-400 transition-colors p-1" title="Show panel">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Center: B/D left column + C/E right column, each independently resizable */}
      <div ref={containerRef} className="flex-1 min-w-0 flex h-full relative select-none">
        {/* Left column: B (top) + D (bottom) */}
        <div className="flex flex-col overflow-hidden" style={{ width: leftW }}>
          {/* Zone B */}
          <div className="overflow-hidden" style={{ height: `${layout.topBPct}%` }}>
            <RunnerZone
              question={selectedQuestion}
              nextQuestion={nextQuestion}
              questionIndex={questionIndex}
              totalQuestions={orderedParentQuestions.length}
              childQuestions={childQuestions}
              bucketName={bucketName}
              onStatusChange={handleStatusChange}
              onSelectQuestion={handleSelectQuestion}
              hasProof={resolvedLinks.proofItems?.length > 0}
              onSelectCurrentQuestion={() => {
                // Deselect child, revert Zone E to parent proof
                setSelectedChildQuestionId(null);
                setChildResolvedLinks(null);
                setSelectedProof(null);
              }}
            />
          </div>

          {/* Horizontal divider for B/D */}
          <div
            onMouseDown={startDragHB}
            className="h-1.5 bg-[#1e2a45] hover:bg-cyan-500/40 cursor-row-resize flex-shrink-0 transition-colors z-10 active:bg-cyan-400/60"
            title="Drag to resize B/D"
          />

          {/* Zone D */}
          <div className="overflow-hidden flex-1">
            <ChildQuestionsZone
              parentQuestion={selectedQuestion}
              childQuestions={childQuestions}
              selectedChildId={selectedChildQuestionId}
              onSelectChild={handleSelectChildQuestion}
            />
          </div>
        </div>

        {/* Vertical divider */}
        <div
          onMouseDown={startDragV}
          className="w-1.5 bg-[#1e2a45] hover:bg-cyan-500/40 cursor-col-resize flex-shrink-0 transition-colors z-10 active:bg-cyan-400/60"
          title="Drag to resize"
        />

        {/* Right column: C (top) + E (bottom) */}
        <div className="flex flex-col overflow-hidden flex-1">
          {/* Zone C */}
          <div className="overflow-hidden" style={{ height: `${layout.topCPct}%` }}>
            <ProofPreviewZone
              selectedProof={selectedProof}
              isPublishing={!!(publishedProof && selectedProof && publishedProof.id === selectedProof.id)}
              onPublish={handlePublishProof}
              onUnpublish={handleClearJury}
              trialSessionId={trialSession?.id}
            />
          </div>

          {/* Horizontal divider for C/E */}
          <div
            onMouseDown={startDragHC}
            className="h-1.5 bg-[#1e2a45] hover:bg-cyan-500/40 cursor-row-resize flex-shrink-0 transition-colors z-10 active:bg-cyan-400/60"
            title="Drag to resize C/E"
          />

          {/* Zone E */}
          <div className="overflow-hidden flex-1">
            <ProofZone
              proofItems={activeProofItems}
              selectedProofId={selectedProof?.id}
              onSelectProof={async (proof) => {
                // Keep publish active when switching between proofs of the same question
                // Only unpublish if switching to a different proof AND something is published
                if (publishedProof && publishedProof.id !== proof.id) {
                  await handleClearJury();
                }
                setSelectedProof(proof);
              }}
              childQuestionActive={!!selectedChildQuestionId}
              onProofAdmitted={() => {
                // Re-resolve proof list so admitted status updates
                if (selectedChildQuestionId && childResolvedLinks) {
                  resolveQuestionLinks(selectedChildQuestionId, activeCase.id).then(setChildResolvedLinks);
                } else if (selectedQuestionId) {
                  resolveQuestionLinks(selectedQuestionId, activeCase.id).then(setResolvedLinks);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}