import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import WitnessQuestionsList from "@/components/trialMode/WitnessQuestionsList";
import QuestionWorkspace from "@/components/trialMode/QuestionWorkspace";
import JuryControls from "@/components/trialMode/JuryControls";
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

export default function TrialMode() {
  const { activeCase, loading } = useActiveCase();
  const [searchParams] = useSearchParams();

  const [witnesses, setWitnesses] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedWitnessId, setSelectedWitnessId] = useState(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [examType, setExamType] = useState("Direct");

  const [resolvedLinks, setResolvedLinks] = useState({
    evidenceGroups: [],
    proofItems: [],
    trialPoints: [],
  });

  const [trialSession, setTrialSession] = useState(null);
  const [publishedProof, setPublishedProof] = useState(null);

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
    if (witnessIdParam) {
      setSelectedWitnessId(witnessIdParam);
      const qs = await getQuestionsForWitness(activeCase.id, witnessIdParam);
      setQuestions(qs);
    } else if (witnessesList.length > 0) {
      setSelectedWitnessId(witnessesList[0].id);
      const qs = await getQuestionsForWitness(activeCase.id, witnessesList[0].id);
      setQuestions(qs);
    }
  };

  const handleSelectWitness = async (witnessId) => {
    setSelectedWitnessId(witnessId);
    setSelectedQuestionId(null);
    const qs = await getQuestionsForWitness(activeCase.id, witnessId, examType);
    setQuestions(qs);
  };

  const handleSelectQuestion = async (questionId) => {
    setSelectedQuestionId(questionId);
    const links = await resolveQuestionLinks(questionId, activeCase.id);
    setResolvedLinks(links);
  };

  const handleUpdateQuestion = async (updated) => {
    await updateQuestionStatus(updated.id, {
      question_text: updated.question_text,
      live_notes: updated.live_notes,
      status: updated.status,
    });
    setSelectedQuestionId(updated.id);
  };

  const handleStatusChange = async (status) => {
    if (!selectedQuestionId) return;
    await updateQuestionStatus(selectedQuestionId, { status });
    setQuestions(q => q.map(qq => qq.id === selectedQuestionId ? { ...qq, status } : qq));
  };

  const handlePublishProof = async (proofItem) => {
    if (!trialSession) return;
    await publishProofToJury(trialSession.id, proofItem.id);
    setPublishedProof(proofItem);
  };

  const handleClearJury = async () => {
    if (!trialSession) return;
    await clearJuryDisplay(trialSession.id);
    setPublishedProof(null);
  };

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!activeCase) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">
        <p>Please select a case to begin</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0f1e] overflow-hidden">
      <div className="w-64 min-w-[16rem] max-w-[16rem] flex-shrink-0 flex flex-col h-full overflow-hidden">
        <WitnessQuestionsList
          witnesses={witnesses}
          questions={questions}
          selectedWitnessId={selectedWitnessId}
          onSelectWitness={handleSelectWitness}
          selectedQuestionId={selectedQuestionId}
          onSelectQuestion={handleSelectQuestion}
          examType={examType}
          onExamTypeChange={setExamType}
        />
      </div>

      <div className="flex-1 min-w-0 overflow-hidden flex flex-col h-full">
        <QuestionWorkspace
          question={selectedQuestion}
          evidenceGroups={resolvedLinks.evidenceGroups}
          trialPoints={resolvedLinks.trialPoints}
          proofItems={resolvedLinks.proofItems}
          onUpdateQuestion={handleUpdateQuestion}
          onStatusChange={handleStatusChange}
          onPreviewProof={(proof) => console.log("Preview:", proof)}
          onPublishProof={handlePublishProof}
        />
      </div>

      <div className="w-56 min-w-[14rem] max-w-[14rem] flex-shrink-0 flex flex-col h-full overflow-hidden">
        <JuryControls
          caseId={activeCase.id}
          trialSession={trialSession}
          onPublish={handlePublishProof}
          publishedProof={publishedProof}
        />
      </div>
    </div>
  );
}