import { base44 } from '@/api/base44Client';

/**
 * Resolve all linked data for a question:
 * - EvidenceGroups linked via QuestionEvidenceGroups
 * - ProofItems in those groups via EvidenceGroupProofItems
 * - TrialPoints linked to those groups via EvidenceGroupTrialPoints
 */
export async function resolveQuestionLinks(questionId, caseId) {
  if (!questionId) return { evidenceGroups: [], proofItems: [], trialPoints: [] };

  try {
    // Step 1: Get EvidenceGroups linked to this question
    const questionEvidenceGroupLinks = await base44.entities.QuestionEvidenceGroups.filter({
      question_id: questionId,
    });

    if (questionEvidenceGroupLinks.length === 0) {
      return { evidenceGroups: [], proofItems: [], trialPoints: [] };
    }

    const egIds = questionEvidenceGroupLinks.map(link => link.evidence_group_id);

    // Step 2: Fetch the EvidenceGroups
    const evidenceGroups = await Promise.all(
      egIds.map(egId => base44.entities.EvidenceGroups.filter({ id: egId }))
    ).then(results => results.flat());

    // Step 3: Get ProofItems for those groups
    const egProofItemLinks = await base44.entities.EvidenceGroupProofItems.filter({
      evidence_group_id: { $in: egIds },
    });

    const proofItemIds = egProofItemLinks.map(link => link.proof_item_id);
    const proofItems = proofItemIds.length
      ? await Promise.all(
          proofItemIds.map(piId => base44.entities.ProofItems.filter({ id: piId }))
        ).then(results => results.flat())
      : [];

    // Step 4: Get TrialPoints linked to those groups
    const egTrialPointLinks = await base44.entities.EvidenceGroupTrialPoints.filter({
      evidence_group_id: { $in: egIds },
    });

    const trialPointIds = egTrialPointLinks.map(link => link.trial_point_id);
    const trialPoints = trialPointIds.length
      ? await Promise.all(
          trialPointIds.map(tpId => base44.entities.TrialPoints.filter({ id: tpId }))
        ).then(results => results.flat())
      : [];

    return {
      evidenceGroups,
      proofItems,
      trialPoints,
      questionEvidenceGroupLinks,
      egProofItemLinks,
      egTrialPointLinks,
    };
  } catch (error) {
    console.error('Error resolving question links:', error);
    return { evidenceGroups: [], proofItems: [], trialPoints: [] };
  }
}

/**
 * Get all witnesses for a case, optionally filtered by those assigned to a witness
 */
export async function getWitnessesForCase(caseId) {
  try {
    const parties = await base44.entities.Parties.filter({ case_id: caseId });
    // Filter to only "witnesses" (could be any party, but typically deponents/experts)
    return parties.filter(p => p.role === 'Witness' || p.role === 'Deponent' || !p.role);
  } catch (error) {
    console.error('Error fetching witnesses:', error);
    return [];
  }
}

/**
 * Get questions for a specific witness in a case
 */
export async function getQuestionsForWitness(caseId, witnessId, examType = null) {
  try {
    const filter = { case_id: caseId, party_id: witnessId };
    if (examType) filter.exam_type = examType;
    return await base44.entities.Questions.filter(filter);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return [];
  }
}

/**
 * Update question status or text
 */
export async function updateQuestionStatus(questionId, updates) {
  try {
    return await base44.entities.Questions.update(questionId, updates);
  } catch (error) {
    console.error('Error updating question:', error);
    throw error;
  }
}

/**
 * Get or create a TrialSession for a case
 */
export async function getOrCreateTrialSession(caseId, sessionTitle = null) {
  try {
    const existing = await base44.entities.TrialSessions.filter({
      case_id: caseId,
      status: { $in: ['Setup', 'Active'] },
    });
    if (existing.length > 0) return existing[0];

    // Create new session
    const session = await base44.entities.TrialSessions.create({
      case_id: caseId,
      title: sessionTitle || `Trial Session ${new Date().toLocaleDateString()}`,
      status: 'Setup',
      pair_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
    });
    return session;
  } catch (error) {
    console.error('Error getting/creating trial session:', error);
    return null;
  }
}

/**
 * Update TrialSessionState with currently published item
 */
export async function publishProofToJury(trialSessionId, proofItemId) {
  try {
    const existing = await base44.entities.TrialSessionStates.filter({
      trial_session_id: trialSessionId,
    });

    const update = {
      current_proof_item_id: proofItemId,
      jury_display_enabled: true,
      jury_can_see_proof: true,
    };

    if (existing.length > 0) {
      return await base44.entities.TrialSessionStates.update(existing[0].id, update);
    } else {
      return await base44.entities.TrialSessionStates.create({
        trial_session_id: trialSessionId,
        ...update,
      });
    }
  } catch (error) {
    console.error('Error publishing to jury:', error);
    throw error;
  }
}

/**
 * Clear jury display
 */
export async function clearJuryDisplay(trialSessionId) {
  try {
    const existing = await base44.entities.TrialSessionStates.filter({
      trial_session_id: trialSessionId,
    });

    if (existing.length > 0) {
      return await base44.entities.TrialSessionStates.update(existing[0].id, {
        current_proof_item_id: null,
        jury_can_see_proof: false,
      });
    }
  } catch (error) {
    console.error('Error clearing jury:', error);
    throw error;
  }
}