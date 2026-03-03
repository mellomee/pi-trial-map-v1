import React from 'react';
import LinkQuestionProofModal from '@/components/proofLibrary/LinkQuestionProofModal';

export default function AddQuestionProofModal({ isOpen, onClose, question, evidenceGroupId, caseId, onProofLinked }) {
  if (!isOpen) return null;

  return (
    <LinkQuestionProofModal
      isOpen={isOpen}
      onClose={onClose}
      question={question}
      evidenceGroupId={evidenceGroupId}
      caseId={caseId}
      onProofLinked={onProofLinked}
    />
  );
}