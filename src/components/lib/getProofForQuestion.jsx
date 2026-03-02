import { base44 } from "@/api/base44Client";

/**
 * Retrieves all proof items for a question.
 * Returns group.linkedEvidence + question.proofOverrides, sorted by type and sortOrder.
 * 
 * @param {string} questionId - Question ID
 * @returns {Promise<{ clips: Array, exhibits: Array, extracts: Array, callouts: Array }>}
 */
export async function getProofForQuestion(questionId) {
  try {
    const [questions, groups] = await Promise.all([
      base44.entities.Questions.filter({ id: questionId }),
      base44.entities.EvidenceGroups.list(),
    ]);

    if (!questions.length) {
      return { clips: [], exhibits: [], extracts: [], callouts: [] };
    }

    const question = questions[0];
    const group = groups.find(g => g.id === question.primary_evidence_group_id);

    if (!group) {
      return { clips: [], exhibits: [], extracts: [], callouts: [] };
    }

    // Combine group evidence + question overrides
    const allEvidence = [
      ...(group.linked_evidence || []),
      ...(question.proof_overrides || []),
    ].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Group by type
    const proof = {
      clips: allEvidence.filter(e => e.type === "DEPO_CLIP"),
      exhibits: allEvidence.filter(e => e.type === "JOINT_EXHIBIT"),
      extracts: allEvidence.filter(e => e.type === "EXTRACT"),
      callouts: allEvidence.filter(e => e.type === "CALLOUT"),
    };

    return proof;
  } catch (error) {
    console.error("Error fetching proof for question:", error);
    return { clips: [], exhibits: [], extracts: [], callouts: [] };
  }
}