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
    // Path A: Direct QuestionProofItems links (used by child questions and direct-linked proofs)
    const directProofLinks = await base44.entities.QuestionProofItems.filter({ question_id: questionId });

    // Path B: QuestionLinks of type 'ProofItem' — these are the question-specific proof links
    const questionLinks = await base44.entities.QuestionLinks.filter({ question_id: questionId });
    const questionLinkedProofIds = questionLinks
      .filter(l => l.link_type === 'ProofItem')
      .map(l => l.link_id);

    // Path C: EvidenceGroup-based links — also check question's primary_evidence_group_id
    const questionEvidenceGroupLinks = await base44.entities.QuestionEvidenceGroups.filter({ question_id: questionId });
    const questionRecord = await base44.entities.Questions.filter({ id: questionId }).then(r => r[0]);
    const primaryEgId = questionRecord?.primary_evidence_group_id;
    const rawEgIds = questionEvidenceGroupLinks.map(link => link.evidence_group_id);
    const egIds = primaryEgId && !rawEgIds.includes(primaryEgId) ? [...rawEgIds, primaryEgId] : rawEgIds;

    const [evidenceGroups, egProofItemLinks] = egIds.length
      ? await Promise.all([
          Promise.all(egIds.map(egId => base44.entities.EvidenceGroups.filter({ id: egId }))).then(r => r.flat()),
          base44.entities.EvidenceGroupProofItems.filter({ evidence_group_id: { $in: egIds } }),
        ])
      : [[], []];

    // Proof items shown in ProofZone = only directly question-linked ones (QuestionLinks + QuestionProofItems)
    // No fallback to EG proofs — if question has no direct links, show 0 proofs
    const directProofItemIds = directProofLinks.map(l => l.proof_item_id);
    const allProofItemIds = [...new Set([...questionLinkedProofIds, ...directProofItemIds])];

    let proofItems = allProofItemIds.length
      ? await Promise.all(allProofItemIds.map(piId => base44.entities.ProofItems.filter({ id: piId }))).then(r => r.flat())
      : [];

    // Enrich proof items: depoClip gets clip_title, extract gets callout_name
    proofItems = await Promise.all(proofItems.map(async (pi) => {
      if (pi.type === 'depoClip' && pi.source_id) {
        const clips = await base44.entities.DepoClips.filter({ id: pi.source_id });
        if (clips[0]?.topic_tag) return { ...pi, clip_title: clips[0].topic_tag };
      }
      if (pi.type === 'extract' && pi.source_id) {
        const enriched = { ...pi };
        if (pi.callout_id) {
          const callouts = await base44.entities.Callouts.filter({ id: pi.callout_id });
          if (callouts[0]?.name) enriched.callout_name = callouts[0].name;
        }
        if (!enriched.label) {
          // Fallback label from extract title
          const extracts = await base44.entities.ExhibitExtracts.filter({ id: pi.source_id });
          if (extracts[0]) enriched.label = extracts[0].extract_title_internal || extracts[0].extract_title_official || 'Extract';
        }
        return enriched;
      }
      return pi;
    }));

    // TrialPoints linked to those groups
    const egTrialPointLinks = egIds.length
      ? await base44.entities.EvidenceGroupTrialPoints.filter({ evidence_group_id: { $in: egIds } })
      : [];
    const trialPointIds = egTrialPointLinks.map(l => l.trial_point_id);
    const trialPoints = trialPointIds.length
      ? await Promise.all(trialPointIds.map(tpId => base44.entities.TrialPoints.filter({ id: tpId }))).then(r => r.flat())
      : [];

    return { evidenceGroups, proofItems, trialPoints, questionEvidenceGroupLinks, egProofItemLinks, egTrialPointLinks };
  } catch (error) {
    console.error('Error resolving question links:', error);
    return { evidenceGroups: [], proofItems: [], trialPoints: [] };
  }
}

/**
 * Get all witnesses for a case
 * Loads from Parties table and ensures witness names resolve correctly
 */
export async function getWitnessesForCase(caseId) {
  try {
    const parties = await base44.entities.Parties.filter({ case_id: caseId });
    // Return all parties as potential witnesses (filter by role if needed in Trial Mode)
    return parties.map(p => ({
      ...p,
      displayName: p.display_name || p.last_name || p.name || 'Unnamed',
    }));
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
    const questions = await base44.entities.Questions.filter(filter);
    
    // Resolve witness_id from party_id if not explicitly set
    return questions.map(q => ({
      ...q,
      witness_id: q.witness_id || q.party_id,
    }));
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
export async function publishProofToJury(trialSessionId, proofItemId, calloutId = null) {
  try {
    const existing = await base44.entities.TrialSessionStates.filter({
      trial_session_id: trialSessionId,
    });

    const update = {
      current_proof_item_id: proofItemId,
      current_callout_id: calloutId || null,
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