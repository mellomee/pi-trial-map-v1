import { base44 } from "@/api/base44Client";

/**
 * Fetch and merge proof for a question.
 * Priority: question.proofOverrideRefs > question.evidenceGroupId proof
 */
export async function getProofForQuestion(question, depoClips, jointExhibits, extracts, callouts) {
  const proof = {
    depoClips: [],
    jointExhibits: [],
    extracts: [],
    callouts: [],
  };

  // Start with evidence group proof if linked
  if (question.evidence_group_id) {
    const group = await base44.entities.EvidenceGroups.filter({ id: question.evidence_group_id });
    if (group.length > 0) {
      const gr = group[0];
      const refs = gr.proof_refs || [];
      refs.forEach(ref => {
        if (ref.type === "DEPO_CLIP") {
          const clip = depoClips.find(c => c.id === ref.ref_id);
          if (clip) proof.depoClips.push({ ...clip, _sortOrder: ref.sort_order || 0 });
        } else if (ref.type === "JOINT_EXHIBIT") {
          const je = jointExhibits.find(j => j.id === ref.ref_id);
          if (je) proof.jointExhibits.push({ ...je, _sortOrder: ref.sort_order || 0 });
        } else if (ref.type === "EXTRACT") {
          const ex = extracts.find(e => e.id === ref.ref_id);
          if (ex) proof.extracts.push({ ...ex, _sortOrder: ref.sort_order || 0 });
        } else if (ref.type === "CALLOUT") {
          const co = callouts.find(c => c.id === ref.ref_id);
          if (co) proof.callouts.push({ ...co, _sortOrder: ref.sort_order || 0 });
        }
      });
    }
  }

  // Merge overrides (or replace if present)
  if (question.proof_override_refs && question.proof_override_refs.length > 0) {
    const overrides = question.proof_override_refs;
    overrides.forEach(ref => {
      if (ref.type === "DEPO_CLIP") {
        const clip = depoClips.find(c => c.id === ref.ref_id);
        if (clip) {
          const existing = proof.depoClips.find(c => c.id === ref.ref_id);
          if (!existing) proof.depoClips.push({ ...clip, _sortOrder: ref.sort_order || 0 });
        }
      } else if (ref.type === "JOINT_EXHIBIT") {
        const je = jointExhibits.find(j => j.id === ref.ref_id);
        if (je) {
          const existing = proof.jointExhibits.find(j => j.id === ref.ref_id);
          if (!existing) proof.jointExhibits.push({ ...je, _sortOrder: ref.sort_order || 0 });
        }
      } else if (ref.type === "EXTRACT") {
        const ex = extracts.find(e => e.id === ref.ref_id);
        if (ex) {
          const existing = proof.extracts.find(e => e.id === ref.ref_id);
          if (!existing) proof.extracts.push({ ...ex, _sortOrder: ref.sort_order || 0 });
        }
      } else if (ref.type === "CALLOUT") {
        const co = callouts.find(c => c.id === ref.ref_id);
        if (co) {
          const existing = proof.callouts.find(c => c.id === ref.ref_id);
          if (!existing) proof.callouts.push({ ...co, _sortOrder: ref.sort_order || 0 });
        }
      }
    });
  }

  // Sort each category by sort_order
  Object.keys(proof).forEach(key => {
    proof[key].sort((a, b) => (a._sortOrder || 0) - (b._sortOrder || 0));
  });

  return proof;
}

/**
 * Get trial point IDs for a question (inherited from group if not overridden)
 */
export async function getTrialPointIdsForQuestion(question) {
  if (question.trial_point_ids && question.trial_point_ids.length > 0) {
    return question.trial_point_ids;
  }
  // Inherit from evidence group
  if (question.evidence_group_id) {
    const group = await base44.entities.EvidenceGroups.filter({ id: question.evidence_group_id });
    if (group.length > 0) {
      return group[0].linked_trial_point_ids || [];
    }
  }
  return [];
}