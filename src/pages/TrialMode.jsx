import React, { useState, useEffect, useMemo } from "react";
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
import { useSearchParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function TrialMode() {
  const { activeCase, loading } = useActiveCase();
  const [searchParams] = useSearchParams();

  const [witnesses, setWitnesses] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedWitnessId, setSelectedWitnessId] = useState(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [examType, setExamType] = useState("Main");
  const [panelVisible, setPanelVisible] = useState(true);

  const [resolvedLinks, setResolvedLinks] = useState({
    evidenceGroups: [],
    proofItems: [],
    trialPoints: [],
  });

  const [trialSession, setTrialSession] = useState(null);
  const [publishedProof, setPublishedProof] = useState(null);
  const [selectedProof, setSelectedProof] = useState(null);

  useEffect(() => {
    if (!activeCase?.id) {
      setWitnesses([]);
      setQuestions([]);
      return;
    }
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
    const firstWitnessId = witnessIdParam || (witnessesList.length > 0 ? witnessesList[0].id : null);
    if (firstWitnessId) {
      setSelectedWitnessId(firstWitnessId);
      const qs = await getQuestionsForWitness(activeCase.id, firstWitnessId);
      setQuestions(qs);
    }
  };

  const handleSelectWitness = async (witnessId) => {
    setSelectedWitnessId(witnessId);
    setSelectedQuestionId(null);
    setSelectedProof(null);
    const qs = await getQuestionsForWitness(activeCase.id, witnessId);
    setQuestions(qs);
  };

  const handleSelectQuestion = async (questionId) => {
    // Auto-unpublish if moving to a new question
    if (publishedProof && questionId !== selectedQuestionId) {
      await handleClearJury();
    }
    setSelectedQuestionId(questionId);
    setSelectedProof(null);
    const links = await resolveQuestionLinks(questionId, activeCase.id);
    setResolvedLinks(links);
  };

  const handleStatusChange = async (status) => {
    if (!selectedQuestionId) return;
    await updateQuestionStatus(selectedQuestionId, { status });
    setQuestions(q => q.map(qq => qq.id === selectedQuestionId ? { ...qq, status } : qq));
  };

  const handlePublishProof = async (proofItem) => {
    if (!trialSession || !proofItem) return;
    await publishProofToJury(trialSession.id, proofItem.id);
    setPublishedProof(proofItem);
  };

  const handleClearJury = async () => {
    if (!trialSession) return;
    await clearJuryDisplay(trialSession.id);
    setPublishedProof(null);
  };

  // Ordered parent questions for the selected witness filtered by examType
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
    return questions
      .filter(q => q.parent_id === selectedQuestionId)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [questions, selectedQuestionId]);

  // Find bucket name for selected question
  const bucketName = useMemo(() => {
    if (resolvedLinks.evidenceGroups.length > 0) {
      return resolvedLinks.evidenceGroups[0].title || resolvedLinks.evidenceGroups[0].name || null;
    }
    return null;
  }, [resolvedLinks.evidenceGroups]);

  if (loading) return <div className="flex items-center justify-center h-screen bg-[#0a0f1e] text-slate-400">Loading...</div>;
  if (!activeCase) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f1e] text-slate-400">
        <p>Please select a case to begin</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0f1e] overflow-hidden">
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
          />
        </div>
      ) : (
        <div className="flex flex-col items-center pt-4 w-8 flex-shrink-0 bg-[#0f1629] border-r border-[#1e2a45]">
          <button
            onClick={() => setPanelVisible(true)}
            className="text-slate-500 hover:text-cyan-400 transition-colors p-1"
            title="Show panel"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Center: 2x2 grid (B, C, D, E) */}
      <div className="flex-1 min-w-0 grid grid-cols-2 grid-rows-2 h-full">
        {/* Zone B: Runner */}
        <div className="border-r border-b border-[#1e2a45] overflow-hidden">
          <RunnerZone
            question={selectedQuestion}
            nextQuestion={nextQuestion}
            questionIndex={questionIndex}
            totalQuestions={orderedParentQuestions.length}
            childQuestions={childQuestions}
            bucketName={bucketName}
            onStatusChange={handleStatusChange}
            onSelectQuestion={handleSelectQuestion}
          />
        </div>

        {/* Zone C: Proof Preview */}
        <div className="border-b border-[#1e2a45] overflow-hidden">
          <ProofPreviewZone
            selectedProof={selectedProof}
            isPublishing={!!(publishedProof && selectedProof && publishedProof.id === selectedProof.id)}
            onPublish={handlePublishProof}
            onUnpublish={handleClearJury}
          />
        </div>

        {/* Zone D: Child Questions */}
        <div className="border-r border-[#1e2a45] overflow-hidden">
          <ChildQuestionsZone
            parentQuestion={selectedQuestion}
            childQuestions={childQuestions}
          />
        </div>

        {/* Zone E: Proof List */}
        <div className="overflow-hidden">
          <ProofZone
            proofItems={resolvedLinks.proofItems}
            selectedProofId={selectedProof?.id}
            onSelectProof={(proof) => setSelectedProof(proof)}
          />
        </div>
      </div>
    </div>
  );
}