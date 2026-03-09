import { base44 } from '@/api/base44Client';

/**
 * Resolve all linked data for a question with fixed behavior:
 * - ISSUE #4: Deterministic proof resolution (no lag/missing/0 bugs)
 * - ISSUE #5: Only show directly linked proofs, never fall back to all proofs
 * If no proofs are directly linked, return empty proof list
 */
export async function resolveQuestionLinksFixed(questionId, caseId) {
  if (!questionId) return { evidenceGroups: [], proofItems: [], trialPoints: [] };

  try {
    // ISSUE #4 & #5: Deterministic proof resolution
    // Only show proofs that are DIRECTLY linked to this question
    // Do NOT fall back to EvidenceGroup proofs if no direct links exist
    const directProofLinks = await base44.entities.QuestionProofItems.filter({ question_id: questionId });
    const questionLinks = await base44.entities.QuestionLinks.filter({ question_id: questionId });
    const questionLinkedProofIds = questionLinks
      .filter(l => l.link_type === 'ProofItem')
      .map(l => l.link_id);

    // Merge direct links (prefer direct over fallback)
    const directProofItemIds = directProofLinks.map(l => l.proof_item_id);
    const allLinkedProofIds = [...new Set([...questionLinkedProofIds, ...directProofItemIds])];

    // If no direct links exist, return empty proof list (issue #5: don't show unrelated proofs)
    if (allLinkedProofIds.length === 0) {
      return { evidenceGroups: [], proofItems: [], trialPoints: [] };
    }

    // Load only the directly linked proof items
    let proofItems = await Promise.all(
      allLinkedProofIds.map(piId => base44.entities.ProofItems.filter({ id: piId }))
    ).then(r => r.flat());

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

    // Load evidence groups and trial points only if they exist (not fallback)
    const questionRecord = await base44.entities.Questions.filter({ id: questionId }).then(r => r[0]);
    const primaryEgId = questionRecord?.primary_evidence_group_id;
    const questionEvidenceGroupLinks = await base44.entities.QuestionEvidenceGroups.filter({ question_id: questionId });
    const rawEgIds = questionEvidenceGroupLinks.map(link => link.evidence_group_id);
    const egIds = primaryEgId && !rawEgIds.includes(primaryEgId) ? [...rawEgIds, primaryEgId] : rawEgIds;

    const [evidenceGroups, egTrialPointLinks] = egIds.length
      ? await Promise.all([
          Promise.all(egIds.map(egId => base44.entities.EvidenceGroups.filter({ id: egId }))).then(r => r.flat()),
          base44.entities.EvidenceGroupTrialPoints.filter({ evidence_group_id: { $in: egIds } }),
        ])
      : [[], []];

    const trialPointIds = egTrialPointLinks.map(l => l.trial_point_id);
    const trialPoints = trialPointIds.length
      ? await Promise.all(trialPointIds.map(tpId => base44.entities.TrialPoints.filter({ id: tpId }))).then(r => r.flat())
      : [];

    return { evidenceGroups, proofItems, trialPoints, questionEvidenceGroupLinks };
  } catch (error) {
    console.error('Error resolving question links:', error);
    return { evidenceGroups: [], proofItems: [], trialPoints: [] };
  }
}

export async function getWitnessesForCase(caseId) {
  try {
    const parties = await base44.entities.Parties.filter({ case_id: caseId });
    return parties.map(p => ({
      ...p,
      displayName: p.display_name || p.last_name || p.name || 'Unnamed',
    }));
  } catch (error) {
    console.error('Error fetching witnesses:', error);
    return [];
  }
}

export async function getQuestionsForWitness(caseId, witnessId, examType = null) {
  try {
    const filter = { case_id: caseId, party_id: witnessId };
    if (examType) filter.exam_type = examType;
    const questions = await base44.entities.Questions.filter(filter);
    
    return questions.map(q => ({
      ...q,
      witness_id: q.witness_id || q.party_id,
    }));
  } catch (error) {
    console.error('Error fetching questions:', error);
    return [];
  }
}

export async function updateQuestionStatus(questionId, updates) {
  try {
    return await base44.entities.Questions.update(questionId, updates);
  } catch (error) {
    console.error('Error updating question:', error);
    throw error;
  }
}

export async function getOrCreateTrialSession(caseId, sessionTitle = null) {
  try {
    const existing = await base44.entities.TrialSessions.filter({
      case_id: caseId,
      status: { $in: ['Setup', 'Active'] },
    });
    if (existing.length > 0) return existing[0];

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
  }
}