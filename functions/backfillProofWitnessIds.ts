import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Backfill witness_id for existing ProofItems based on their source (DepoClips or ExhibitExtracts)
 * Admin-only function
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { mode = 'dryrun', caseId } = await req.json();

    if (!caseId) {
      return Response.json({ error: 'caseId is required' }, { status: 400 });
    }

    const report = {
      mode,
      caseId,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Get all ProofItems for this case
    const proofItems = await base44.asServiceRole.entities.ProofItems.filter({
      case_id: caseId,
    });

    for (const item of proofItems) {
      try {
        // Skip if already has witness_id
        if (item.witness_id) {
          report.skipped++;
          continue;
        }

        let witnessId = null;

        // Get witness from source
        if (item.type === 'depoClip') {
          const clips = await base44.asServiceRole.entities.DepoClips.filter({
            id: item.source_id,
          });
          if (clips.length > 0) {
            witnessId = clips[0].deponent_party_id || clips[0].witness_id;
          }
        } else if (item.type === 'extract') {
          const extracts = await base44.asServiceRole.entities.ExhibitExtracts.filter({
            id: item.source_id,
          });
          if (extracts.length > 0) {
            // ExhibitExtracts don't directly have witness_id, so we skip
            // Witness assignment should happen at exhibit level
            continue;
          }
        } else if (item.type === 'callout' || item.type === 'highlight') {
          // These are derived, witness should come from parent extract
          continue;
        }

        // Update if we found a witness
        if (witnessId && mode !== 'dryrun') {
          await base44.asServiceRole.entities.ProofItems.update(item.id, {
            witness_id: witnessId,
          });
          report.updated++;
        } else if (witnessId) {
          report.updated++;
        }
      } catch (err) {
        report.errors.push({
          proof_item_id: item.id,
          error: err.message,
        });
      }
    }

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});